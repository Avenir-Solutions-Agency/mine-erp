import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  PortalSyncInput,
  type PortalWeighingDto,
  type PortalWeighingInput,
} from "@mine-erp/contracts";
import {
  type Db,
  desc,
  eq,
  eventLog,
  inArray,
  portalWeighing,
} from "@mine-erp/db";
import { Access, AuthGuard, read } from "./auth.ts";
import { ApiError } from "./http.ts";
import { DB } from "./invoices.repository.ts";
import { AgentGuard } from "./scale.ts";

type Row = typeof portalWeighing.$inferSelect;

const toInput = (r: Row): PortalWeighingInput => ({
  portalId: r.portalId,
  ticketNumber: r.ticketNumber,
  direction: r.direction,
  status: r.status,
  licensePlate: r.licensePlate,
  trailerPlate: r.trailerPlate,
  customerName: r.customerName,
  customerTaxNumber: r.customerTaxNumber,
  materialName: r.materialName,
  grossKg: r.grossKg,
  tareKg: r.tareKg,
  netKg: r.netKg,
  firstWeightKg: r.firstWeightKg,
  firstMeasuredAt: r.firstMeasuredAt?.toISOString() ?? null,
  completedAt: r.completedAt?.toISOString() ?? null,
  driverName: r.driverName,
  carrierName: r.carrierName,
  ekaerNumber: r.ekaerNumber,
});

const normalized = (w: PortalWeighingInput): PortalWeighingInput => ({
  ...w,
  firstMeasuredAt: w.firstMeasuredAt
    ? new Date(w.firstMeasuredAt).toISOString()
    : null,
  completedAt: w.completedAt ? new Date(w.completedAt).toISOString() : null,
});

/** True when the stored row already holds exactly what PORTAL AI sent. */
export function samePortalWeighing(
  stored: PortalWeighingInput,
  sent: PortalWeighingInput,
): boolean {
  const a = normalized(stored);
  const b = normalized(sent);
  return (Object.keys(b) as (keyof PortalWeighingInput)[]).every(
    (k) => a[k] === b[k],
  );
}

const toValues = (w: PortalWeighingInput) => ({
  ...w,
  firstMeasuredAt: w.firstMeasuredAt ? new Date(w.firstMeasuredAt) : null,
  completedAt: w.completedAt ? new Date(w.completedAt) : null,
  syncedAt: new Date(),
});

/** Mirror of PORTAL AI weighings; the agent resends rows, only real changes are written. */
@Injectable()
export class PortalWeighings {
  constructor(@Inject(DB) private readonly db: Db) {}

  async sync(rows: PortalWeighingInput[]) {
    if (rows.length === 0) return { inserted: 0, updated: 0 };
    return this.db.transaction(async (tx) => {
      const stored = await tx
        .select()
        .from(portalWeighing)
        .where(
          inArray(
            portalWeighing.portalId,
            rows.map((r) => r.portalId),
          ),
        );
      const byId = new Map(stored.map((s) => [s.portalId, s]));
      let inserted = 0;
      let updated = 0;
      for (const row of rows) {
        const old = byId.get(row.portalId);
        if (!old) {
          await tx.insert(portalWeighing).values(toValues(row));
          inserted++;
        } else if (!samePortalWeighing(toInput(old), row)) {
          await tx
            .update(portalWeighing)
            .set(toValues(row))
            .where(eq(portalWeighing.portalId, row.portalId));
          updated++;
        }
      }
      if (inserted + updated > 0)
        await tx.insert(eventLog).values({
          actorType: "agent",
          entity: "portal_weighing",
          action: "synced",
          payload: { inserted, updated },
        });
      return { inserted, updated };
    });
  }

  /** Open ones first, then the latest 300 by when they were measured. */
  async list(): Promise<PortalWeighingDto[]> {
    const rows = await this.db
      .select()
      .from(portalWeighing)
      .orderBy(desc(portalWeighing.completedAt), desc(portalWeighing.portalId))
      .limit(300);
    return rows.map((r) => ({
      ...toInput(r),
      id: r.id,
      syncedAt: r.syncedAt.toISOString(),
    }));
  }
}

@Controller()
export class PortalWeighingsController {
  constructor(private readonly portal: PortalWeighings) {}

  @Post("scale/portal-weighings")
  @UseGuards(AgentGuard)
  async sync(@Body() body: unknown) {
    const input = PortalSyncInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás PORTAL AI mérési adat.");
    return { data: await this.portal.sync(input.data.rows) };
  }

  @Get("portal-weighings")
  @UseGuards(AuthGuard)
  @Access(read("scale"))
  async list() {
    return { data: await this.portal.list() };
  }
}
