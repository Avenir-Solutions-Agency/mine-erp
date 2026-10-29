import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CustomerInput,
  CustomerPatch,
  ProductInput,
  ProductPatch,
} from "@mine-erp/contracts";
import { asc, customer, type Db, eq, eventLog, product } from "@mine-erp/db";
import type { z } from "zod";
import { type Actor, AuthGuard, CurrentActor } from "./auth.ts";
import { ApiError, isUniqueViolation } from "./http.ts";
import { DB } from "./invoices.repository.ts";

type Table = typeof customer | typeof product;
const ENTITY = new Map<Table, { name: string; duplicate: [string, string] }>([
  [
    customer,
    {
      name: "customer",
      duplicate: [
        "customer_tax_number_unique",
        "Ezzel az adószámmal már van vevő.",
      ],
    },
  ],
  [
    product,
    {
      name: "product",
      duplicate: ["product_name_unique", "Ilyen nevű termék már van."],
    },
  ],
]);

/** Customers and products: list, create, change; never delete (old weigh tickets point at them). */
@Injectable()
export class MasterData {
  constructor(@Inject(DB) private readonly db: Db) {}

  customers() {
    return this.db.select().from(customer).orderBy(asc(customer.name));
  }

  products() {
    return this.db.select().from(product).orderBy(asc(product.name));
  }

  /** Active record by id, for linking a weighing; inactive or unknown ids are refused. */
  async activeById(table: Table, id: string) {
    const [row] = await this.db.select().from(table).where(eq(table.id, id));
    if (!row?.active)
      throw new ApiError(
        422,
        "unknown_master_data",
        "A kiválasztott vevő vagy termék nem aktív.",
      );
    return row;
  }

  /** Insert or update plus its event in one transaction; a duplicate tax number or name is a 409. */
  async save(
    table: Table,
    id: string | null,
    values: Record<string, unknown>,
    actor: Actor,
  ) {
    const meta = ENTITY.get(table)!;
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = id
          ? await tx
              .update(table)
              .set({ ...values, updatedAt: new Date() })
              .where(eq(table.id, id))
              .returning()
          : await tx
              .insert(table)
              .values({ ...(values as { name: string }), createdBy: actor.id })
              .returning();
        if (!row) throw new ApiError(404, "not_found", "Nem található.");
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: meta.name,
          entityId: row.id,
          action: id ? "updated" : "created",
          payload: values,
        });
        return row;
      });
    } catch (e) {
      if (isUniqueViolation(e, meta.duplicate[0]))
        throw new ApiError(409, "duplicate", meta.duplicate[1]);
      throw e;
    }
  }
}

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new ApiError(
      400,
      "invalid_input",
      r.error.issues[0]?.message ?? "Hibás adatok.",
    );
  return r.data;
}

@Controller()
@UseGuards(AuthGuard)
export class MasterDataController {
  constructor(private readonly data: MasterData) {}

  @Get("customers")
  async customers() {
    return { data: await this.data.customers() };
  }

  @Post("customers")
  async createCustomer(@Body() body: unknown, @CurrentActor() actor: Actor) {
    return {
      data: await this.data.save(
        customer,
        null,
        parse(CustomerInput, body),
        actor,
      ),
    };
  }

  @Patch("customers/:id")
  async updateCustomer(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return {
      data: await this.data.save(
        customer,
        id,
        parse(CustomerPatch, body),
        actor,
      ),
    };
  }

  @Get("products")
  async products() {
    return { data: await this.data.products() };
  }

  @Post("products")
  async createProduct(@Body() body: unknown, @CurrentActor() actor: Actor) {
    return {
      data: await this.data.save(
        product,
        null,
        parse(ProductInput, body),
        actor,
      ),
    };
  }

  @Patch("products/:id")
  async updateProduct(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return {
      data: await this.data.save(product, id, parse(ProductPatch, body), actor),
    };
  }
}
