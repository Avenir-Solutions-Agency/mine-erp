import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { readPortalDb, toKg, toPortalWeighing, toUtc } from "./portal-db.ts";

test("weights become integer kg; tonnes are converted; nonsense is dropped", () => {
  const values = [
    toKg(38520.4, "kg"),
    toKg(38.52, "t"),
    toKg("", "kg"),
    toKg(9e9, "kg"),
  ];

  expect(values).toEqual([38520, 38520, null, null]);
});

test("a time with a zone keeps its instant; a bad one is null", () => {
  const values = [
    toUtc("2026-11-03T10:20:00+01:00"),
    toUtc("tegnap"),
    toUtc(null),
  ];

  expect(values).toEqual(["2026-11-03T09:20:00.000Z", null, null]);
});

test("rows with an unknown status are skipped", () => {
  const row = toPortalWeighing({ id: 1, status: "draft" }, "kg");

  expect(row).toBeNull();
});

test("reads open weighings and recent ones from a portal.db, never old closed ones", () => {
  const path = join(mkdtempSync(join(tmpdir(), "portal-")), "portal.db");
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE weighings (id INTEGER PRIMARY KEY, ticket_number TEXT, direction TEXT,
    status TEXT, license_plate TEXT, trailer_plate TEXT, customer_name TEXT,
    customer_tax_number TEXT, material_name TEXT, gross REAL, tare REAL, net REAL,
    first_weight REAL, first_measured_at TEXT, completed_at TEXT, created_at TEXT,
    driver_name TEXT, carrier_name TEXT, ekaer_number TEXT)`);
  const add = db.prepare(
    "INSERT INTO weighings (id, status, net, completed_at, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  add.run(1, "completed", 24340, "2020-01-01 10:00:00", "2020-01-01 09:00:00");
  add.run(
    2,
    "completed",
    25000,
    new Date().toISOString(),
    new Date().toISOString(),
  );
  add.run(3, "open", null, null, "2020-01-01 09:00:00");
  db.close();

  const rows = readPortalDb(path, 30, "kg");

  expect(rows.map((r) => [r.portalId, r.status, r.netKg])).toEqual([
    [2, "completed", 25000],
    [3, "open", null],
  ]);
});
