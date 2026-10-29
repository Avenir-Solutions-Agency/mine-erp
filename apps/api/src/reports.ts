import {
  Controller,
  Get,
  Injectable,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { ShipmentReportDto } from "@mine-erp/contracts";
import {
  budapestDate,
  summarizeShipments,
  validRange,
} from "@mine-erp/domain/report";
import ExcelJS from "exceljs";
import { AuthGuard } from "./auth.ts";
import { ApiError } from "./http.ts";
import { Shipments } from "./shipments.ts";

const DAY = 86_400_000;

/** Shipment report for the accountant (T-036): a Budapest-day range, totals, and an Excel file. */
@Injectable()
export class Reports {
  constructor(private readonly shipments: Shipments) {}

  async shipmentReport(from: string, to: string): Promise<ShipmentReportDto> {
    if (!validRange(from, to))
      throw new ApiError(
        400,
        "invalid_range",
        "Adjon meg érvényes időszakot (legfeljebb egy év).",
      );
    // A day wider on both sides in UTC, then exact by Budapest date, so DST never cuts a day.
    const wide = await this.shipments.list({
      from: new Date(Date.parse(`${from}T00:00:00Z`) - DAY),
      to: new Date(Date.parse(`${to}T00:00:00Z`) + 2 * DAY),
    });
    const rows = wide
      .filter((s) => {
        const d = budapestDate(new Date(s.shippedAt));
        return d >= from && d <= to;
      })
      .reverse();
    return { from, to, rows, ...summarizeShipments(rows) };
  }

  async shipmentWorkbook(from: string, to: string): Promise<Buffer> {
    const r = await this.shipmentReport(from, to);
    const wb = new ExcelJS.Workbook();
    wb.creator = "Mészkő-Polgár ERP";
    const list = wb.addWorksheet("Szállítások");
    list.columns = [
      { header: "Szám", key: "number", width: 18 },
      { header: "Dátum", key: "date", width: 12 },
      { header: "Idő", key: "time", width: 8 },
      { header: "Rendszám", key: "plate", width: 12 },
      { header: "Vevő", key: "customer", width: 30 },
      { header: "Termék", key: "product", width: 24 },
      { header: "Nettó (kg)", key: "kg", width: 12 },
      { header: "Nettó (t)", key: "t", width: 10 },
      { header: "EKÁER-szám", key: "tcn", width: 18 },
      { header: "Állapot", key: "status", width: 12 },
    ];
    for (const s of r.rows) {
      const at = new Date(s.shippedAt);
      list.addRow({
        number: s.registryNumber,
        date: budapestDate(at),
        time: at.toLocaleTimeString("hu-HU", {
          timeZone: "Europe/Budapest",
          hour: "2-digit",
          minute: "2-digit",
        }),
        plate: s.plate,
        customer: s.customer,
        product: s.product,
        kg: s.netKg,
        t: s.netKg / 1000,
        tcn: s.ekaerTcn ?? "",
        status: s.status === "registered" ? "Nyilvántartva" : "Sztornó",
      });
    }
    const totals = (
      name: string,
      rows: { key: string; count: number; netKg: number }[],
      label: string,
    ) => {
      const ws = wb.addWorksheet(name);
      ws.columns = [
        { header: label, key: "key", width: 40 },
        { header: "Szállítás (db)", key: "count", width: 14 },
        { header: "Nettó (kg)", key: "kg", width: 14 },
        { header: "Nettó (t)", key: "t", width: 12 },
      ];
      for (const t of rows)
        ws.addRow({
          key: t.key,
          count: t.count,
          kg: t.netKg,
          t: t.netKg / 1000,
        });
      ws.addRow({
        key: "Összesen",
        count: r.total.count,
        kg: r.total.netKg,
        t: r.total.netKg / 1000,
      }).font = { bold: true };
    };
    totals("Vevők szerint", r.byCustomer, "Vevő");
    totals("Termékek szerint", r.byProduct, "Termék");
    for (const ws of wb.worksheets) {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      for (const key of ["kg", "t"]) {
        const col = ws.getColumn(key);
        col.numFmt = key === "kg" ? "# ##0" : "# ##0.000";
      }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: Reports) {}

  @Get("shipments")
  async shipments(@Query("from") from: string, @Query("to") to: string) {
    return {
      data: await this.reports.shipmentReport(String(from), String(to)),
    };
  }

  @Get("shipments.xlsx")
  async workbook(@Query("from") from: string, @Query("to") to: string) {
    const file = await this.reports.shipmentWorkbook(String(from), String(to));
    return new StreamableFile(file, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="szallitasok_${from}_${to}.xlsx"`,
    });
  }
}
