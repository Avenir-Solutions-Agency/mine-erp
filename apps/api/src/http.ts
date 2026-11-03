import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Response } from "express";

/** A failure with a Hungarian message the client may show. */
export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ error: { code, message } }, status);
  }
}

/** Every error leaves as `{ error: { code, message } }`; unexpected ones are logged once with a request id. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger("Error");

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof ApiError)
      return res.status(err.getStatus()).json(err.getResponse());
    // Express body-parser errors (too large, broken JSON) carry their own 4xx status.
    const parserStatus =
      err instanceof Error && "status" in err && typeof err.status === "number"
        ? err.status
        : 0;
    if (
      err instanceof HttpException ||
      (parserStatus >= 400 && parserStatus < 500)
    ) {
      const status =
        err instanceof HttpException ? err.getStatus() : parserStatus;
      const message =
        status === 413
          ? "A kérés vagy a fájl túl nagy."
          : status === 404
            ? "Nincs ilyen végpont."
            : "Hibás kérés.";
      return res
        .status(status)
        .json({ error: { code: `http_${status}`, message } });
    }
    const requestId = randomUUID();
    this.log.error(
      `${requestId} ${err instanceof Error ? err.stack : String(err)}`,
    );
    return res.status(500).json({
      error: {
        code: "internal",
        message: `Váratlan hiba. Azonosító: ${requestId}`,
      },
    });
  }
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
