import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { ENV, type Env } from "./env.ts";
import { ApiError } from "./http.ts";

export interface Actor {
  id: string;
  email: string | null;
}

type AuthedRequest = Request & { actor?: Actor };

/**
 * Tokens Supabase confirmed in the last 30 s, so the Mérleg screen's live polling does not call
 * Supabase Auth twice a second. shortcut: a signed-out token stays valid for up to 30 s; the
 * JWKS check in T-005 removes the round trip and this cache.
 */
const verified = new Map<string, { actor: Actor; until: number }>();

/**
 * Checks the Supabase access token by asking Supabase Auth who it belongs to.
 * shortcut: one Auth round trip per request and no `aal2` check; T-005 switches to JWKS
 * verification and requires TOTP for office users before production.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, "unauthenticated", "Jelentkezzen be.");
    const cached = verified.get(token);
    if (cached && cached.until > Date.now()) {
      req.actor = cached.actor;
      return true;
    }
    const res = await fetch(`${this.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: this.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok)
      throw new ApiError(
        401,
        "unauthenticated",
        "A munkamenet lejárt, jelentkezzen be újra.",
      );
    const user = (await res.json()) as { id?: unknown; email?: unknown };
    if (typeof user.id !== "string")
      throw new ApiError(401, "unauthenticated", "Jelentkezzen be.");
    req.actor = {
      id: user.id,
      email: typeof user.email === "string" ? user.email : null,
    };
    if (verified.size > 500) verified.clear();
    verified.set(token, { actor: req.actor, until: Date.now() + 30_000 });
    return true;
  }
}

export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor =>
    ctx.switchToHttp().getRequest<AuthedRequest>().actor!,
);

/** Fixed window per user; enough for one office (AGENTS §05 rate-limits uploads). */
export class RateLimit {
  private readonly hits = new Map<string, { start: number; n: number }>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()) {
    const h = this.hits.get(key);
    if (!h || now - h.start > this.windowMs) {
      this.hits.set(key, { start: now, n: 1 });
      return;
    }
    if (++h.n > this.max)
      throw new ApiError(
        429,
        "rate_limited",
        "Túl sok feltöltés, próbálja újra egy perc múlva.",
      );
  }
}
