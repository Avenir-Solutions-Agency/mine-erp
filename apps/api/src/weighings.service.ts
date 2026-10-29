import { Injectable } from "@nestjs/common";
import type { FirstWeighingInput, WeighingDto } from "@mine-erp/contracts";
import {
  firstWeighing,
  formatTicketNumber,
  normalizePlate,
  type Result,
  secondWeighing,
  voidWeighing,
  type Weighing,
  weighingWithSavedTare,
} from "@mine-erp/domain/weighing";
import type { Actor } from "./auth.ts";
import { ApiError } from "./http.ts";
import { ScaleLive } from "./scale.ts";
import {
  type WeighingRow,
  WeighingsRepository,
} from "./weighings.repository.ts";

export function toDto(w: WeighingRow): WeighingDto {
  return {
    id: w.id,
    ticketNumber: w.ticketNumber,
    status: w.status,
    plate: w.plate,
    trailerPlate: w.trailerPlate,
    customer: w.customer,
    material: w.material,
    note: w.note,
    firstKg: w.firstKg,
    firstAt: w.firstAt.toISOString(),
    secondKg: w.secondKg,
    secondAt: w.secondAt?.toISOString() ?? null,
    grossKg: w.grossKg,
    tareKg: w.tareKg,
    netKg: w.netKg,
    savedTare: w.savedTare,
    voidReason: w.voidReason,
  };
}

/** The domain view of a stored row, so the rules decide every transition. */
export function toDomain(w: WeighingRow): Weighing {
  if (w.status === "open")
    return { status: "open", firstKg: w.firstKg, firstAt: w.firstAt.getTime() };
  const completed = {
    status: "completed" as const,
    firstKg: w.firstKg,
    firstAt: w.firstAt.getTime(),
    secondKg: w.secondKg!,
    secondAt: w.secondAt!.getTime(),
    grossKg: w.grossKg!,
    tareKg: w.tareKg!,
    netKg: w.netKg!,
    savedTare: w.savedTare,
  };
  if (w.status === "completed") return completed;
  return {
    status: "void",
    voidReason: w.voidReason ?? "",
    before:
      w.netKg == null
        ? { status: "open", firstKg: w.firstKg, firstAt: w.firstAt.getTime() }
        : completed,
  };
}

/** Postgres unique violation on a named constraint; Drizzle wraps the driver error in `cause`. */
export function isUniqueViolation(e: unknown, constraint: string): boolean {
  for (
    let x = e;
    x && typeof x === "object";
    x = (x as { cause?: unknown }).cause
  ) {
    const pg = x as { code?: string; constraint_name?: string };
    if (pg.code === "23505" && pg.constraint_name === constraint) return true;
  }
  return false;
}

function ok<T>(r: Result<T>): T {
  if (!r.ok) throw new ApiError(422, r.code, r.message);
  return r.value;
}

/** Ticket numbers restart each calendar year in Hungarian time. */
const budapestYear = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Europe/Budapest",
    }).format(d),
  );

@Injectable()
export class WeighingsService {
  constructor(
    private readonly repo: WeighingsRepository,
    private readonly scale: ScaleLive,
  ) {}

  async list(): Promise<WeighingDto[]> {
    return (await this.repo.list(200)).map(toDto);
  }

  /** First pass, or a finished one-pass weighing with the vehicle's saved tare. The weight comes from the scale, never the client. */
  async first(input: FirstWeighingInput, actor: Actor): Promise<WeighingDto> {
    const plate = normalizePlate(input.plate);
    if (plate.length < 2)
      throw new ApiError(422, "invalid_plate", "Hibás rendszám.");
    const open = await this.repo.openForPlate(plate);
    if (open)
      throw new ApiError(
        409,
        "already_open",
        `Ennek a járműnek nyitott mérlegelése van (${open.ticketNumber}); azt zárja le második méréssel.`,
      );
    const kg = this.scale.requireStable();
    const now = new Date();
    const v = await this.repo.vehicleByPlate(plate);
    if (input.useSavedTare && v?.tareKg == null)
      throw new ApiError(
        422,
        "no_saved_tare",
        "Ennek a járműnek nincs mentett tárája.",
      );
    const w = ok(
      input.useSavedTare
        ? weighingWithSavedTare(kg, v!.tareKg!, now.getTime())
        : firstWeighing(kg, now.getTime()),
    );
    const done = w.status === "completed" ? w : null;
    const row = await this.repo
      .create(
        {
          status: w.status as "open" | "completed",
          plate,
          vehicleId: v?.id ?? null,
          trailerPlate: input.trailerPlate
            ? normalizePlate(input.trailerPlate)
            : null,
          customer: input.customer || null,
          material: input.material || null,
          note: input.note || null,
          firstKg: kg,
          firstAt: now,
          secondKg: done?.secondKg ?? null,
          secondAt: done ? now : null,
          grossKg: done?.grossKg ?? null,
          tareKg: done?.tareKg ?? null,
          netKg: done?.netKg ?? null,
          savedTare: done?.savedTare ?? false,
        },
        budapestYear(now),
        (seq) => formatTicketNumber(budapestYear(now), seq),
        actor,
      )
      .catch((e: unknown) => {
        // Two first weighings for the same plate at once: the partial unique index stops the second.
        if (isUniqueViolation(e, "weighing_one_open_per_plate"))
          throw new ApiError(
            409,
            "already_open",
            "Ennek a járműnek már van nyitott mérlegelése.",
          );
        throw e;
      });
    return toDto(row);
  }

  async second(id: string, actor: Actor): Promise<WeighingDto> {
    const row = await this.load(id);
    const kg = this.scale.requireStable();
    const now = new Date();
    const w = ok(secondWeighing(toDomain(row), kg, now.getTime()));
    if (w.status !== "completed") throw new Error("unreachable");
    const saved = await this.repo.update(
      id,
      "open",
      {
        status: "completed",
        secondKg: w.secondKg,
        secondAt: now,
        grossKg: w.grossKg,
        tareKg: w.tareKg,
        netKg: w.netKg,
      },
      "second_weighing",
      actor,
    );
    if (!saved)
      throw new ApiError(
        409,
        "changed",
        "A mérlegelést közben lezárták vagy sztornózták.",
      );
    return toDto(saved);
  }

  async void(id: string, reason: string, actor: Actor): Promise<WeighingDto> {
    const row = await this.load(id);
    const w = ok(voidWeighing(toDomain(row), reason));
    if (w.status !== "void") throw new Error("unreachable");
    const saved = await this.repo.update(
      id,
      row.status,
      { status: "void", voidReason: w.voidReason, voidedAt: new Date() },
      "voided",
      actor,
    );
    if (!saved)
      throw new ApiError(
        409,
        "changed",
        "A mérlegelés közben megváltozott, töltse újra.",
      );
    return toDto(saved);
  }

  private async load(id: string): Promise<WeighingRow> {
    const row = await this.repo.get(id);
    if (!row)
      throw new ApiError(404, "not_found", "A mérlegelés nem található.");
    return row;
  }
}
