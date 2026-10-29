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
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const message =
        status === 413
          ? "A fájl túl nagy (legfeljebb 10 MB)."
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
