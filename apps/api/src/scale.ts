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
  type ScaleSource,
  ScaleSourceInput,
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
import { AuthGuard, Access, read, write } from "./auth.ts";
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

  /** Forget every reading, so a source switch never mixes simulated and real weights. */
  reset() {
    this.readings = [];
  }

  live(now = Date.now()): Omit<ScaleLiveDto, "simulator" | "source"> {
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
 * The Mérleg screen switches between it and the real scale (agent readings); while the simulator
 * is the source, agent readings are dropped. Without SCALE_SIMULATOR the source is always the scale.
 */
@Injectable()
export class ScaleSimulator implements OnModuleDestroy {
  private load: Load = { kg: 0, since: 0 };
  private timer: ReturnType<typeof setInterval> | undefined;
  private current: ScaleSource;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly scale: ScaleLive,
  ) {
    this.current = this.enabled ? "simulator" : "scale";
  }

  get enabled(): boolean {
    return this.env.SCALE_SIMULATOR === "true";
  }

  get source(): ScaleSource {
    return this.current;
  }

  /** True while simulated weights are the live weight. */
  get active(): boolean {
    return this.current === "simulator";
  }

  use(source: ScaleSource) {
    this.requireEnabled();
    this.stop();
    this.scale.reset();
    this.load = { kg: 0, since: 0 };
    this.current = source;
  }

  put(load: SimLoad, now = Date.now()) {
    this.requireEnabled();
    if (!this.active)
      throw new ApiError(
        409,
        "scale_source",
        "Előbb kapcsoljon a szimulált mérlegre.",
      );
    this.load = { kg: SIM_LOADS[load], since: now };
    this.timer ??= setInterval(
      () => this.scale.add(indicatorKg(this.load, Date.now())),
      250,
    );
  }

  onModuleDestroy() {
    this.stop();
  }

  private stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private requireEnabled() {
    if (!this.enabled)
      throw new ApiError(
        404,
        "not_found",
        "A mérlegszimulátor ki van kapcsolva.",
      );
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
    if (!this.simulator.active) this.scale.add(input.data.kg);
  }

  @Get("live")
  @Access(read("scale"))
  @UseGuards(AuthGuard)
  live() {
    return {
      data: {
        ...this.scale.live(),
        simulator: this.simulator.enabled,
        source: this.simulator.source,
      },
    };
  }

  @Post("simulate")
  @Access(write("scale"))
  @HttpCode(204)
  @UseGuards(AuthGuard)
  simulate(@Body() body: unknown) {
    const input = ScaleSimulateInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás szimulált terhelés.");
    this.simulator.put(input.data.load);
  }

  @Post("source")
  @Access(write("scale"))
  @HttpCode(204)
  @UseGuards(AuthGuard)
  setSource(@Body() body: unknown) {
    const input = ScaleSourceInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás mérlegforrás.");
    this.simulator.use(input.data.source);
  }
}
