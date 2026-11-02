import { timingSafeEqual } from "node:crypto";
import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  type OnModuleDestroy,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  ScaleReadingInput,
  type ScaleLiveDto,
  ScaleSimulateInput,
} from "@mine-erp/contracts";
import {
  indicatorKg,
  type Load,
  SIM_LOADS,
  type SimLoad,
} from "@mine-erp/domain/scale-simulator";
import {
  DEFAULT_STABILITY,
  type Reading,
  stableWeight,
} from "@mine-erp/domain/weighing";
import { AuthGuard } from "./auth.ts";
import { ENV, type Env } from "./env.ts";
import { ApiError } from "./http.ts";

/** A reading older than this means the agent or the indicator is gone. */
const OFFLINE_MS = 2000;
const KEEP_MS = 10_000;

/**
 * The latest indicator readings, stamped with the API's clock so stability does not depend on
 * the agent's clock. shortcut: kept in memory, so it assumes one API instance and one scale;
 * move to Redis or the database when either becomes two.
 */
@Injectable()
export class ScaleLive {
  private readings: Reading[] = [];

  add(kg: number, at = Date.now()) {
    this.readings.push({ kg, at });
    this.readings = this.readings.filter((r) => r.at >= at - KEEP_MS);
  }

  live(now = Date.now()): Omit<ScaleLiveDto, "simulator"> {
    const last = this.readings.at(-1);
    const online = !!last && now - last.at <= OFFLINE_MS;
    return {
      kg: online ? Math.round(last.kg) : null,
      stableKg: online ? stableWeight(this.readings, now) : null,
      online,
      empty: online && last.kg < DEFAULT_STABILITY.minKg,
    };
  }

  /** The weight to record now; refuses while moving, empty or offline. */
  requireStable(now = Date.now()): number {
    const { stableKg, online } = this.live(now);
    if (!online)
      throw new ApiError(503, "scale_offline", "A mérleg nem küld adatot.");
    if (stableKg == null)
      throw new ApiError(409, "not_stable", "A súly még nem stabil, várjon.");
    return stableKg;
  }
}

/**
 * A pretend indicator inside the API (SCALE_SIMULATOR=true), so the test environment can be
 * weighed from the browser without running apps/scale-agent. Feeds ScaleLive like the agent does.
 */
@Injectable()
export class ScaleSimulator implements OnModuleDestroy {
  private load: Load = { kg: 0, since: 0 };
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly scale: ScaleLive,
  ) {}

  get enabled(): boolean {
    return this.env.SCALE_SIMULATOR === "true";
  }

  put(load: SimLoad, now = Date.now()) {
    if (!this.enabled)
      throw new ApiError(
        404,
        "not_found",
        "A mérlegszimulátor ki van kapcsolva.",
      );
    this.load = { kg: SIM_LOADS[load], since: now };
    this.timer ??= setInterval(
      () => this.scale.add(indicatorKg(this.load, Date.now())),
      250,
    );
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }
}

/** The scale agent authenticates with its own shared token, not a user session. */
@Injectable()
export class AgentGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.env.SCALE_AGENT_TOKEN;
    if (!expected)
      throw new ApiError(
        503,
        "agent_disabled",
        "A mérleg-ügynök nincs beállítva.",
      );
    const got = ctx
      .switchToHttp()
      .getRequest<Request>()
      .headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!got || !sameSecret(got, expected))
      throw new ApiError(401, "unauthenticated", "Érvénytelen ügynök-token.");
    return true;
  }
}

export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

@Controller("scale")
export class ScaleController {
  constructor(
    private readonly scale: ScaleLive,
    private readonly simulator: ScaleSimulator,
  ) {}

  @Post("readings")
  @HttpCode(204)
  @UseGuards(AgentGuard)
  reading(@Body() body: unknown) {
    const input = ScaleReadingInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás mérési adat.");
    this.scale.add(input.data.kg);
  }

  @Get("live")
  @UseGuards(AuthGuard)
  live() {
    return {
      data: { ...this.scale.live(), simulator: this.simulator.enabled },
    };
  }

  @Post("simulate")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  simulate(@Body() body: unknown) {
    const input = ScaleSimulateInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás szimulált terhelés.");
    this.simulator.put(input.data.load);
  }
}
