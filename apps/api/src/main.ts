import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createDb } from "@mine-erp/db";
import { AuthGuard } from "./auth.ts";
import { HealthController } from "./health.ts";
import { ENV, loadEnv } from "./env.ts";
import { InvoiceExtractor } from "./extract.ts";
import { ErrorFilter } from "./http.ts";
import { InvoicesController } from "./invoices.controller.ts";
import { DB, InvoicesRepository } from "./invoices.repository.ts";
import { InvoicesService } from "./invoices.service.ts";
import { AgentGuard, ScaleController, ScaleLive } from "./scale.ts";
import { MasterData, MasterDataController } from "./master-data.ts";
import { Client, Connection } from "@temporalio/client";
import {
  EkaerReports,
  EkaerReportsController,
  TEMPORAL,
} from "./ekaer-reports.ts";
import { Storage } from "./storage.ts";
import { TicketPdf } from "./ticket.ts";
import { WeighingsController } from "./weighings.controller.ts";
import { WeighingsRepository } from "./weighings.repository.ts";
import { WeighingsService } from "./weighings.service.ts";

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);

@Module({
  controllers: [
    HealthController,
    InvoicesController,
    ScaleController,
    WeighingsController,
    MasterDataController,
    EkaerReportsController,
  ],
  providers: [
    { provide: ENV, useValue: env },
    { provide: DB, useValue: db },
    AuthGuard,
    Storage,
    InvoiceExtractor,
    InvoicesRepository,
    InvoicesService,
    AgentGuard,
    ScaleLive,
    WeighingsRepository,
    WeighingsService,
    TicketPdf,
    MasterData,
    EkaerReports,
    {
      provide: TEMPORAL,
      // Lazy: the API starts without Temporal; only starting a workflow needs it.
      useValue: new Client({
        connection: Connection.lazy({ address: env.TEMPORAL_ADDRESS }),
      }),
    },
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
