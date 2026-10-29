import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createDb } from "@mine-erp/db";
import { AuthGuard } from "./auth.ts";
import { ENV, loadEnv } from "./env.ts";
import { InvoiceExtractor } from "./extract.ts";
import { ErrorFilter } from "./http.ts";
import { InvoicesController } from "./invoices.controller.ts";
import { DB, InvoicesRepository } from "./invoices.repository.ts";
import { InvoicesService } from "./invoices.service.ts";
import { Storage } from "./storage.ts";

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { data: { status: "ok" } };
  }
}

@Module({
  controllers: [HealthController, InvoicesController],
  providers: [
    { provide: ENV, useValue: env },
    { provide: DB, useValue: db },
    AuthGuard,
    Storage,
    InvoiceExtractor,
    InvoicesRepository,
    InvoicesService,
  ],
})
class AppModule {}

const app = await NestFactory.create(AppModule);
app.enableCors({
  origin: env.WEB_ORIGIN,
  allowedHeaders: ["authorization", "content-type"],
});
app.useGlobalFilters(new ErrorFilter());
await app.get(Storage).ensureBucket();
await app.listen(env.API_PORT);
