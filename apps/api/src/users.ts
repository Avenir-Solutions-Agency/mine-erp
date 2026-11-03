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
  type MeDto,
  UserCreate,
  type UserDto,
  UserPatch,
} from "@mine-erp/contracts";
import { z } from "zod";
import { appUser, asc, type Db, eq, eventLog } from "@mine-erp/db";
import {
  Access,
  type Actor,
  AuthGuard,
  CurrentActor,
  read,
  write,
} from "./auth.ts";
import { ENV, type Env } from "./env.ts";
import { ApiError } from "./http.ts";
import { DB } from "./invoices.repository.ts";

type Row = typeof appUser.$inferSelect;
const toDto = (r: Row): UserDto => ({
  id: r.id,
  email: r.email,
  name: r.name,
  access: r.access,
  active: r.active,
});

/**
 * ERP users with menu-level access. Anyone with write access to the "users" menu may add people
 * and set their menus (decided 2026-11-03); passwords live in Supabase Auth only.
 */
@Injectable()
export class Users {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(): Promise<UserDto[]> {
    const rows = await this.db
      .select()
      .from(appUser)
      .orderBy(asc(appUser.name));
    return rows.map(toDto);
  }

  private authAdmin(path: string, method: string, body?: object) {
    return fetch(`${this.env.SUPABASE_URL}/auth/v1/admin/users${path}`, {
      method,
      headers: {
        apikey: this.env.SUPABASE_SECRET_KEY,
        authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  }

  async create(input: UserCreate, actor: Actor): Promise<UserDto> {
    // shortcut: called from the API, not a Temporal activity; it must answer the form at once.
    const res = await this.authAdmin("", "POST", {
      // email_confirm: the office hands over the password in person, there is no e-mail round.
      email: input.email,
      password: input.password,
      email_confirm: true,
    }).catch(() => null);
    if (!res)
      throw new ApiError(
        502,
        "auth_failed",
        "A fiókot nem sikerült létrehozni, próbálja újra.",
      );
    const body = (await res.json().catch(() => null)) as {
      id?: string;
      error_code?: string;
    } | null;
    if (res.status === 422 && body?.error_code === "email_exists")
      throw new ApiError(
        409,
        "email_exists",
        "Ezzel az e-mail-címmel már van fiók.",
      );
    if (res.status === 422 && body?.error_code === "weak_password")
      throw new ApiError(400, "weak_password", "A jelszó túl gyenge.");
    if (!res.ok || !body?.id)
      throw new ApiError(
        502,
        "auth_failed",
        "A fiókot nem sikerült létrehozni, próbálja újra.",
      );
    const id = body.id;
    const [row] = await this.db
      .transaction(async (tx) => {
        const rows = await tx
          .insert(appUser)
          .values({
            id,
            email: input.email.toLowerCase(),
            name: input.name,
            access: input.access,
            createdBy: actor.id,
          })
          .returning();
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "app_user",
          entityId: id,
          action: "created",
          payload: { access: input.access },
        });
        return rows;
      })
      .catch(async (e: unknown) => {
        // No ERP row: remove the sign-in account too, so no orphan login stays behind.
        await this.authAdmin(`/${id}`, "DELETE").catch(() => null);
        throw e;
      });
    return toDto(row!);
  }

  async update(id: string, patch: UserPatch, actor: Actor): Promise<UserDto> {
    // Turning yourself off or dropping your own user rights would leave nobody to undo it.
    if (
      id.toLowerCase() === actor.id &&
      (patch.active === false ||
        (patch.access && patch.access.users !== "write"))
    )
      throw new ApiError(
        400,
        "self_lockout",
        "A saját felhasználókezelési jogát és fiókját nem vonhatja vissza.",
      );
    const row = await this.db.transaction(async (tx) => {
      // Locks every user row, so two people cannot take each other's rights at the same time.
      await tx.select({ id: appUser.id }).from(appUser).for("update");
      const [updated] = await tx
        .update(appUser)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(appUser.id, id))
        .returning();
      if (!updated)
        throw new ApiError(404, "not_found", "Nincs ilyen felhasználó.");
      const all = await tx.select().from(appUser);
      if (!all.some((u) => u.active && u.access.users === "write"))
        throw new ApiError(
          409,
          "last_admin",
          "Legalább egy aktív felhasználónak meg kell tartania a felhasználókezelési írási jogot.",
        );
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "app_user",
        entityId: id,
        action: "changed",
        // Name stays out: event_log is permanent, personal data must stay deletable.
        payload: { access: patch.access, active: patch.active },
      });
      return updated;
    });
    return toDto(row);
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
export class UsersController {
  constructor(private readonly users: Users) {}

  /** The signed-in user's own menus; the web hides the rest. */
  @Get("me")
  @Access(read())
  me(@CurrentActor() actor: Actor) {
    const me: MeDto = {
      id: actor.id,
      email: actor.email,
      access: actor.access,
    };
    return { data: me };
  }

  @Get("users")
  @Access(read("users"))
  async list() {
    return { data: await this.users.list() };
  }

  @Post("users")
  @Access(write("users"))
  async create(@Body() body: unknown, @CurrentActor() actor: Actor) {
    return { data: await this.users.create(parse(UserCreate, body), actor) };
  }

  @Patch("users/:id")
  @Access(write("users"))
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return { data: await this.users.update(id, parse(UserPatch, body), actor) };
  }
}
