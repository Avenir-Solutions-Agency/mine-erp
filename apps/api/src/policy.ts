import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { type PolicyDto, PolicyPatch } from "@mine-erp/contracts";
import { type Db, eq, eventLog, policy } from "@mine-erp/db";
import { type Actor, AuthGuard, CurrentActor } from "./auth.ts";
import { ApiError } from "./http.ts";
import { DB } from "./invoices.repository.ts";

const EKAER_AUTO = "ekaer.auto";

/**
 * Office switches (T-020). Off unless someone turned them on; every change is logged with the
 * person. shortcut: any signed-in office user may change them; a role check comes with roles.
 */
@Injectable()
export class Policies {
  constructor(@Inject(DB) private readonly db: Db) {}

  async ekaerAuto(): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(policy)
      .where(eq(policy.key, EKAER_AUTO));
    return (row?.value as { enabled?: boolean } | undefined)?.enabled === true;
  }

  async get(): Promise<PolicyDto> {
    return { ekaerAuto: await this.ekaerAuto() };
  }

  async set(patch: Partial<PolicyDto>, actor: Actor): Promise<PolicyDto> {
    if (patch.ekaerAuto !== undefined) {
      const value = { enabled: patch.ekaerAuto };
      await this.db.transaction(async (tx) => {
        await tx
          .insert(policy)
          .values({ key: EKAER_AUTO, value, updatedBy: actor.id })
          .onConflictDoUpdate({
            target: policy.key,
            set: { value, updatedBy: actor.id, updatedAt: new Date() },
          });
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "policy",
          action: "changed",
          payload: { key: EKAER_AUTO, ...value },
        });
      });
    }
    return this.get();
  }
}

@Controller("policy")
@UseGuards(AuthGuard)
export class PolicyController {
  constructor(private readonly policies: Policies) {}

  @Get()
  async get() {
    return { data: await this.policies.get() };
  }

  @Patch()
  async set(@Body() body: unknown, @CurrentActor() actor: Actor) {
    const input = PolicyPatch.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás beállítás.");
    return { data: await this.policies.set(input.data, actor) };
  }
}
