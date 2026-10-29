import { describe, expect, test, vi } from "vitest";
import { WeighingsService } from "./weighings.service.ts";
import type { WeighingRow } from "./weighings.repository.ts";

const row = (over: Partial<WeighingRow> = {}): WeighingRow =>
  ({
    id: "w1",
    ticketNumber: "MJ-2026-000007",
    status: "completed",
    firstAt: new Date("2026-10-31T23:30:00Z"),
    secondAt: new Date("2026-10-31T23:40:00Z"),
    ticketPath: null,
    voidTicketPath: null,
    ...over,
  }) as WeighingRow;

/** The service with its storage, renderer and repository replaced at the boundary. */
function service(r: WeighingRow, putOnce = true) {
  const stored = new Map<string, Buffer>();
  const storage = {
    putOnce: vi.fn(async (_b: string, path: string, body: Buffer) => {
      if (!putOnce) return false;
      stored.set(path, body);
      return true;
    }),
    download: vi.fn(
      async (_b: string, path: string) =>
        stored.get(path) ?? Buffer.from("earlier copy"),
    ),
  };
  const tickets = { render: vi.fn(async () => Buffer.from("fresh pdf")) };
  const repo = {
    get: vi.fn(async () => r),
    setTicketFile: vi.fn(async () => {}),
  };
  const none = {
    latestFor: async () => new Map(),
    forWeighings: async () => new Map(),
  };
  const svc = new WeighingsService(
    repo as never,
    {} as never,
    tickets as never,
    {} as never,
    none as never,
    none as never,
    storage as never,
    { WEIGH_TICKET_BUCKET: "weigh-tickets" } as never,
  );
  return { svc, storage, tickets, repo };
}

describe("weigh ticket archive", () => {
  test("the first download renders, stores in the Budapest month and records the SHA-256", async () => {
    const t = service(row());

    const { pdf } = await t.svc.ticket("w1");

    expect(pdf.toString()).toBe("fresh pdf");
    expect(t.storage.putOnce).toHaveBeenCalledWith(
      "weigh-tickets",
      "2026-11/MJ-2026-000007.pdf",
      pdf,
      "application/pdf",
    );
    expect(t.repo.setTicketFile).toHaveBeenCalledWith(
      "w1",
      false,
      "2026-11/MJ-2026-000007.pdf",
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  test("an archived ticket is served from storage and never rendered again", async () => {
    const t = service(row({ ticketPath: "2026-11/MJ-2026-000007.pdf" }));

    await t.svc.ticket("w1");

    expect(t.tickets.render).not.toHaveBeenCalled();
    expect(t.storage.download).toHaveBeenCalledWith(
      "weigh-tickets",
      "2026-11/MJ-2026-000007.pdf",
    );
  });

  test("when another request archived it first, that stored copy wins", async () => {
    const t = service(row(), false);

    const { pdf } = await t.svc.ticket("w1");

    expect(pdf.toString()).toBe("earlier copy");
  });

  test("a void weighing gets its own SZTORNÓ copy next to the original", async () => {
    const t = service(
      row({ status: "void", ticketPath: "2026-11/MJ-2026-000007.pdf" }),
    );

    await t.svc.ticket("w1");

    expect(t.storage.putOnce).toHaveBeenCalledWith(
      "weigh-tickets",
      "2026-11/MJ-2026-000007-sztorno.pdf",
      expect.anything(),
      "application/pdf",
    );
    expect(t.repo.setTicketFile).toHaveBeenCalledWith(
      "w1",
      true,
      "2026-11/MJ-2026-000007-sztorno.pdf",
      expect.any(String),
    );
  });
});
