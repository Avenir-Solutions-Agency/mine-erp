import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { KeyObject } from "node:crypto";
import type { Request } from "express";
import type { AccessLevel, MenuAccess, MenuId } from "@mine-erp/contracts";
import { appUser, type Db, eq } from "@mine-erp/db";
import { ENV, type Env } from "./env.ts";
import { ApiError } from "./http.ts";
import { DB } from "./invoices.repository.ts";
import { jwksCache, tokenKid, verifySupabaseJwt } from "./jwt.ts";

export interface Actor {
  id: string;
  email: string | null;
  access: MenuAccess;
}

export interface AccessRule {
  level: AccessLevel;
  /** Any one of these menus is enough (e.g. customers serve both Mérleg and Fuvarok). */
  menus: readonly MenuId[];
}

/**
 * Which menu an endpoint belongs to. Required on every AuthGuard endpoint: one without it is
 * refused, so a new endpoint cannot slip through unchecked. No menus: any active ERP user.
 */
export const Access = Reflector.createDecorator<AccessRule>();
export const read = (...menus: MenuId[]): AccessRule => ({
  level: "read",
  menus,
});
export const write = (...menus: MenuId[]): AccessRule => ({
  level: "write",
  menus,
});

/** "write" includes "read". */
export function hasAccess(access: MenuAccess, rule: AccessRule): boolean {
  if (rule.menus.length === 0) return true;
  return rule.menus.some((m) => {
    const level = access[m];
    return level === "write" || (level === "read" && rule.level === "read");
  });
}

type AuthedRequest = Request & { actor?: Actor };

/**
 * Verifies the Supabase access token locally (JWKS, ES256) and, unless AUTH_REQUIRE_AAL2=false,
 * requires a session that passed the TOTP step (aal2) for every office user (SECURITY.md).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly keys: (
    kid: string | undefined,
  ) => Promise<Map<string, KeyObject>>;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    private readonly reflector: Reflector,
  ) {
    this.keys = jwksCache(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, "unauthenticated", "Jelentkezzen be.");
    const result = verifySupabaseJwt(token, await this.keys(tokenKid(token)), {
      issuer: `${this.env.SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    if (!result.ok)
      throw new ApiError(
        401,
        "unauthenticated",
        result.error === "expired"
          ? "A munkamenet lejárt, jelentkezzen be újra."
          : "Jelentkezzen be.",
      );
    if (this.env.AUTH_REQUIRE_AAL2 !== "false" && result.claims.aal !== "aal2")
      throw new ApiError(
        401,
        "mfa_required",
        "Kétlépcsős azonosítás szükséges: adja meg a hitelesítő alkalmazás kódját.",
      );
    const rule = this.reflector.getAllAndOverride(Access, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rule) throw new ApiError(403, "forbidden", "Nincs jogosultsága.");
    const [user] = await this.db
      .select()
      .from(appUser)
      .where(eq(appUser.id, result.claims.sub));
    if (!user?.active)
      throw new ApiError(
        403,
        "no_access",
        "A fiókja nincs engedélyezve az ERP-ben. Kérjen hozzáférést egy kollégától.",
      );
    if (!hasAccess(user.access, rule))
      throw new ApiError(
        403,
        "forbidden",
        "Nincs jogosultsága ehhez a menühöz.",
      );
    req.actor = {
      id: result.claims.sub,
      email: result.claims.email ?? null,
      access: user.access,
    };
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
