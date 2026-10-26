// Engine of the demo page (docs/reference/demo.html), ported 1:1 in source order.
// The demo patches itself: later rounds wrap earlier functions. Patched functions are `let`
// bindings here and are reassigned the same way, so the final behaviour is the demo's.
import {
  addDays,
  fmt,
  fmtH,
  ft,
  iso,
  mft,
  mondayOf,
  msBetween,
  pct,
  tn,
  ds,
} from "./format";
import type {
  AgentMode,
  Approval,
  Client,
  Doc,
  Driver,
  Ekaer,
  Employee,
  Inbound,
  MachineLog,
  WasteEntry,
  Extraction,
  Flag,
  Inquiry,
  InquiryLine,
  InvoiceItem,
  Job,
  Order,
  Payload,
  PriceLine,
  PriceResult,
  Quote,
  Seq,
  State,
  Transport,
  Truck,
} from "./types";
import {
  CONTRACT_TEMPLATE,
  round4Drivers,
  round4Leave,
  round4Machines,
  round4Trucks,
  seedData,
} from "./data";

export interface DemoEnv {
  /** Current time; the demo calls `new Date()` / `Date.now()`. */
  now(): number;
  /** Random number in [0, 1); the demo calls `Math.random()`. */
  random(): number;
  /** SHA-256 hex digest (crypto.subtle in the browser and Node). */
  sha256(text: string): Promise<string>;
}

/** Live Claude capability of the demo (`window.claude.use('sample')`); null when unavailable. */
export interface SampleTool {
  name: string;
  description: string;
  execute: () => unknown;
}
export interface Sample {
  (
    prompt: string,
    opts: { tools: SampleTool[]; onText?: (p: { text: string }) => void },
  ): Promise<{ text: string }>;
  json(
    prompt: string,
    opts: { modelTier: string },
  ): Promise<Record<string, unknown>>;
}

export type Listener = () => void;

export function createDemo(env: DemoEnv) {
  const TODAY = new Date("2026-10-03T09:00:00");
  const now = () => new Date(env.now());
  const rnd = () => env.random();

  // ---------- runtime hooks (render, toast, navigation) ----------
  let version = 0;
  const listeners = new Set<Listener>();
  const toastListeners = new Set<(m: string) => void>();
  let SEEDING = false;
  const pending: Promise<unknown>[] = [];
  const ui = {
    route: "dash",
    sub: { reports: "pnl" } as Record<string, string>,
    sel: {} as Record<string, string | null | undefined>,
    navigate: (_r: string) => {},
    sample: null as Sample | null,
    download: null as
      null | ((filename: string, data: string) => Promise<void>),
  };
  function render() {
    version++;
    listeners.forEach((l) => l());
  }
  function toast(m: string) {
    if (SEEDING) return;
    toastListeners.forEach((l) => l(m));
  }
  function go(r: string) {
    ui.route = r;
    ui.navigate(r);
    render();
  }

  let SEQ: Seq = {
    A: 88,
    M: 41,
    F: 612,
    SZL: 330,
    SZ: 412,
    R: 57,
    AP: 1,
    INQ: 20,
    PO: 18,
    MV: 1000,
  };
  const nid = (k: string, fmtfn?: (n: number) => string) => {
    SEQ[k]++;
    return fmtfn ? fmtfn(SEQ[k]) : k + "-" + SEQ[k];
  };

  /* ---------------- TÖRZSADATOK ---------------- */
  const S = seedData() as State;
  const P = (id: string) => S.products.find((p) => p.id === id)!;
  const C = (id: string | null | undefined) =>
    S.clients.find((c) => c.id === id);
  const D = (id: string) => S.depots.find((d) => d.id === id)!;

  /* ---------------- KÉSZLETNAPLÓ (egyetlen forrás) ---------------- */
  function move(
    date: Date | string,
    pid: string,
    depot: string,
    qty: number,
    type: string,
    ref?: string,
  ) {
    S.stockMoves.push({
      id: "MV-" + ++SEQ.MV,
      date: new Date(date),
      pid,
      depot,
      qty,
      type,
      ref: ref || "",
    });
  }
  S.products.forEach((p) => {
    const [o, pr, sl] = S.vol[p.id];
    move("2026-09-01", p.id, p.depot, o, "nyitó");
    move(
      "2026-09-30",
      p.id,
      p.depot,
      pr,
      p.src === "buy" ? "beszerzés" : "gyártás",
    );
    move("2026-09-30", p.id, p.depot, -sl, "eladás");
  });
  const stockOf = (pid: string, depot?: string) =>
    S.stockMoves
      .filter((m) => m.pid === pid && (!depot || m.depot === depot))
      .reduce((a, m) => a + m.qty, 0);
  const reservedOf = (pid: string) =>
    S.orders
      .filter((o) => o.status !== "Lezárva")
      .reduce(
        (a, o) =>
          a +
          o.lines
            .filter((l) => l.pid === pid)
            .reduce(
              (b, l) => b + Math.max(0, l.qty - (o.delivered[l.pid] || 0)),
              0,
            ),
        0,
      );

  /* ---------------- KÖLTSÉGMODELL ---------------- */
  function costModel() {
    const pools: Record<string, number> = {
      kitermeles: 0,
      toro: 0,
      rakodas: 0,
      fuvar: 0,
      rezsi: 0,
    };
    const mach = S.machines.map((m) => {
      const extra = S.issues
        .filter((i) => i.machine === m.id)
        .reduce((a, i) => a + i.cost, 0);
      const fuelFt = m.fuel * S.diesel;
      const total = m.dep + fuelFt + m.parts + (m.toll || 0) + extra;
      pools[m.stage] += total;
      return { ...m, fuelFt, extra, total, perH: total / m.h };
    });
    const labor = S.staff.map((s) => {
      const cost = s.gross * (1 + S.szocho);
      pools[s.stage] += cost;
      return { ...s, cost, perH: cost / s.h };
    });
    S.overhead.forEach(([, st, v]) => (pools[st] += v));
    const prodOwn = S.products.filter((p) => p.src === "own");
    const prodT: Record<string, number> = Object.fromEntries(
      S.products.map((p) => [p.id, S.vol[p.id][1]]),
    );
    const soldT: Record<string, number> = Object.fromEntries(
      S.products.map((p) => [p.id, S.vol[p.id][2]]),
    );
    const totOwn = prodOwn.reduce((a, p) => a + prodT[p.id], 0);
    const totSold = S.products.reduce((a, p) => a + soldT[p.id], 0);
    const weighted = prodOwn.reduce((a, p) => a + prodT[p.id] * p.factor, 0);
    const prodValue = prodOwn.reduce((a, p) => a + prodT[p.id] * p.price, 0);
    const royalty = prodValue * S.royaltyRate;
    pools.rezsi += royalty;
    const unit: Record<string, number> = {},
      parts: Record<
        string,
        { base: number; k: number; t: number; r: number; o: number }
      > = {};
    S.products.forEach((p) => {
      let k = 0,
        t = 0,
        base = 0;
      if (p.src === "own") {
        k = pools.kitermeles / totOwn;
        t = pools.toro * (p.factor / weighted);
      } else {
        base = p.buy!;
      }
      const r = pools.rakodas / totSold,
        o = pools.rezsi / totSold;
      parts[p.id] = { base, k, t, r, o };
      unit[p.id] = base + k + t + r + o;
    });
    const km = S.machines
      .filter((m) => m.stage === "fuvar")
      .reduce((a, m) => a + m.km!, 0);
    const ftPerKm = pools.fuvar / km;
    const revenue = S.products.reduce((a, p) => a + soldT[p.id] * p.price, 0);
    const buyCost = S.products
      .filter((p) => p.src === "buy")
      .reduce((a, p) => a + soldT[p.id] * p.buy!, 0);
    const freightRev = pools.fuvar * (1 + S.policy.freightMarkup);
    const totalCost =
      pools.kitermeles +
      pools.toro +
      pools.rakodas +
      pools.fuvar +
      pools.rezsi +
      buyCost;
    return {
      pools,
      mach,
      labor,
      unit,
      parts,
      ftPerKm,
      km,
      royalty,
      revenue: revenue + freightRev,
      freightRev,
      buyCost,
      totalCost,
      soldT,
      prodT,
      totSold,
    };
  }

  /* ---------------- TÁVOLSÁG, ÁRAZÓ ---------------- */
  const DIST: [string, number][] = [
    ["815", 8],
    ["81", 18],
    ["80", 22],
    ["82", 55],
    ["84", 62],
    ["86", 38],
    ["85", 75],
    ["24", 45],
    ["20", 70],
    ["1", 85],
    ["9", 120],
    ["7", 110],
    ["6", 150],
    ["5", 190],
    ["4", 230],
    ["3", 180],
    ["2", 75],
  ];
  const distKm = (zip: string | null | undefined) => {
    const z = String(zip || "");
    const hit = DIST.find(([p]) => z.startsWith(p));
    return hit ? hit[1] : 90;
  };
  interface PriceArgs {
    clientId: string | null | undefined;
    lines: { pid: string; qty: number; note?: string }[];
    zip: string | undefined;
    delivery?: boolean;
  }
  let priceEngine = function ({
    clientId,
    lines,
    zip,
    delivery = true,
  }: PriceArgs): PriceResult {
    const cm = costModel(),
      cl: Pick<Client, "disc" | "limit" | "used" | "end"> & { name?: string } =
        C(clientId) || {
          disc: 0,
          limit: 0,
          used: 0,
          end: true,
        };
    const totalT = lines.reduce((a, l) => a + l.qty, 0);
    const km = distKm(zip),
      trips = Math.ceil(totalT / S.policy.truckT);
    const freightCost = delivery
      ? trips * (km * 2 * cm.ftPerKm + S.policy.tollPerTrip)
      : 0;
    const freightNet = freightCost * (1 + S.policy.freightMarkup);
    const flags: Flag[] = [];
    const out: PriceLine[] = lines.map((l) => {
      const p = P(l.pid);
      const disc = cl.disc || 0;
      const unitNet = Math.round(p.price * (1 - disc));
      const unitCost = cm.unit[p.id];
      const margin = (unitNet - unitCost) / unitNet;
      const rec = Math.ceil(unitCost / (1 - S.policy.targetMargin) / 10) * 10;
      const avail = stockOf(p.id) - reservedOf(p.id);
      if (margin < S.policy.minMargin)
        flags.push({
          lvl: "bad",
          t: `${p.name}: árrés ${pct(margin)} a ${pct(S.policy.minMargin)} minimum alatt (javasolt ár ${ft(rec)}/t)`,
        });
      if (avail < l.qty)
        flags.push({
          lvl: "warn",
          t: `${p.name}: szabad készlet ${tn(avail)}, igény ${tn(l.qty)}`,
        });
      return {
        ...l,
        name: p.name,
        unitNet,
        unitCost,
        margin,
        rec,
        net: unitNet * l.qty,
      };
    });
    const prodNet = out.reduce((a, l) => a + l.net, 0),
      net = prodNet + freightNet,
      gross = net * (1 + S.policy.vat);
    if (!cl.end && cl.limit && cl.used + gross > cl.limit)
      flags.push({
        lvl: "bad",
        t: `Hitelkeret túllépés: felhasznált ${mft(cl.used)} + ${mft(gross)} > keret ${mft(cl.limit)}`,
      });
    if (cl.end)
      flags.push({
        lvl: "ok",
        t: "Magánszemély: előre utalás vagy készpénz a rakodáskor",
      });
    if (cl.name) {
      const od = overdueOf(cl.name);
      if (od.days > 7)
        flags.push({
          lvl: "bad",
          t: `Lejárt tartozás: ${mft(od.sum)}, legrégebbi ${od.days} napja — szállítási zárlat javasolt`,
        });
    }
    const totalCost =
      out.reduce((a, l) => a + l.unitCost * l.qty, 0) + freightCost;
    return {
      lines: out,
      km,
      trips,
      freightCost,
      freightNet,
      freightPerT: totalT ? freightNet / totalT : 0,
      prodNet,
      net,
      gross,
      margin: (net - totalCost) / net,
      flags,
      totalT,
    };
  };

  /* ---------------- AI: AJÁNLATKÉRÉS-ÉRTELMEZŐ ---------------- */
  const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  let parseInquiry = function (text: string, from: string): Extraction {
    const lines: InquiryLine[] = [];
    const raw = text.split(/\n|;/);
    raw.forEach((line) => {
      const low = line.toLowerCase();
      for (const p of S.products) {
        const hit = p.aliases.find((a) =>
          new RegExp("(?<![\\d/])" + reEsc(a) + "(?![\\d])", "i").test(low),
        );
        if (hit) {
          const q = low.match(
            /(\d+(?:[ .]\d{3})*(?:,\d+)?)\s*(t\b|tonna|to\b|m3|m³|köbméter)/i,
          );
          if (q) {
            let n = parseFloat(q[1].replace(/[ .]/g, "").replace(",", "."));
            let note = "";
            if (/m3|m³|köb/.test(q[2])) {
              const dens = S.policy.density[p.id] || S.policy.density.default;
              note = `${fmt(n)} m³ × ${fmt(dens, 2)} t/m³`;
              n = Math.round(n * dens);
            }
            lines.push({ pid: p.id, qty: n, note });
          }
          break;
        }
      }
    });
    const zm = text.match(
      /\b([1-9]\d{3})\s+([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)(?:,?\s*([^\n]{0,40}?\d+\.?))?/,
    );
    let date: Date | null = null;
    const dm = text.match(/(20\d{2})[.\-]\s?(\d{1,2})[.\-]\s?(\d{1,2})/);
    if (dm) date = new Date(+dm[1], +dm[2] - 1, +dm[3]);
    else if (/jövő\s?hét/i.test(text)) date = addDays(TODAY, 7);
    else if (/holnap/i.test(text)) date = addDays(TODAY, 1);
    const comp =
      (text.match(
        /([A-ZÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüű\-]+(?:\s[A-ZÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüű\-]+)*\s(?:Kft|Zrt|Bt|Nyrt)\.?)/,
      ) || [])[1] || "";
    const dom = (from || "").split("@")[1] || "";
    const client =
      S.clients.find((c) => c.domain && c.domain === dom) ||
      S.clients.find(
        (c) => comp && c.name.startsWith(comp.replace(/\.$/, "")),
      ) ||
      S.clients.find((c) => c.email === from);
    const found = [lines.length > 0, !!zm, !!date, !!client];
    const conf = found.filter(Boolean).length / found.length;
    return {
      lines,
      zip: zm ? zm[1] : "",
      city: zm ? zm[2] : "",
      addr: zm && zm[3] ? zm[3].trim() : "",
      date,
      company: comp,
      clientId: client ? client.id : null,
      conf,
      missing: ["tétel", "szállítási cím", "határidő", "ismert ügyfél"].filter(
        (_, i) => !found[i],
      ),
    };
  };

  function log(actor: string, what: string, ref?: string) {
    S.audit.unshift({ t: now(), actor, what, ref: ref || "" });
  }
  function approval(
    kind: string,
    refId: string,
    title: string,
    reason: string,
    ai: string,
  ) {
    const a: Approval = {
      id: "J-" + SEQ.AP++,
      kind,
      refId,
      title,
      reason,
      ai,
      status: "Vár",
      t: now(),
    };
    S.approvals.unshift(a);
    return a;
  }
  const mode = (id: string): AgentMode =>
    S.agents.find((a) => a.id === id)!.mode;

  /* ---------------- INTEGRÁCIÓS KIMENŐ SOR (outbox) ---------------- */
  SEQ.JOB = 500;
  function job(
    system: string,
    op: string,
    ref: string,
    payload: Payload,
    fn: () => string | void,
    onFail?: (j: Job) => void,
  ): Job {
    const j: Job = {
      id: "JOB-" + ++SEQ.JOB,
      system,
      op,
      ref,
      payload,
      attempts: 0,
      status: "Sorban",
      idem:
        (system === "NAV EKÁER" ? "EK" : "BG") +
        "-" +
        ref +
        "-" +
        op.split(" ")[0].toLowerCase(),
      t: now(),
      fn,
      onFail,
    };
    const dup = S.jobs.find((x) => x.idem === j.idem && x.status === "Sikeres");
    if (dup) {
      log(
        "Integráció",
        `Ismételt kérés kiszűrve (idempotencia: ${j.idem})`,
        ref,
      );
      return dup;
    }
    S.jobs.unshift(j);
    runJob(j);
    return j;
  }
  function runJob(j: Job) {
    j.attempts++;
    const down =
      (j.system === "NAV EKÁER" && S.sim.ekaerDown) ||
      (j.system === "Billingo" && S.sim.billingoDown);
    if (down) {
      j.resp =
        j.system === "NAV EKÁER"
          ? "HTTP 503 — a szolgáltatás nem érhető el"
          : "HTTP 429 — túl sok kérés, várakozás";
      j.status = j.attempts >= 3 ? "Hiba — döntés kell" : "Újrapróbálás";
      log(
        "Integráció",
        `${j.system} · ${j.op} sikertelen (${j.attempts}. próbálkozás): ${j.resp}`,
        j.ref,
      );
      if (j.onFail) j.onFail(j);
      if (j.attempts >= 3 && !S.approvals.some((a) => a.refId === j.id))
        approval(
          "int",
          j.id,
          `Integrációs hiba — ${j.system}: ${j.op}`,
          `${j.attempts} sikertelen próbálkozás · ${j.resp}`,
          j.system === "NAV EKÁER"
            ? "Javaslat: a fuvar nem indul el. Tartós NAV-üzemszünetnél a NAV által közzétett tartalék eljárást kell követni (könyvelővel egyeztetett ügyrend szerint)."
            : "Javaslat: a bizonylat sorban marad, a Billingo helyreállása után újraküldés; az ügyfél addig nem kap e-mailt.",
        );
      return false;
    }
    j.resp = j.fn() || "200 OK";
    j.status = "Sikeres";
    return true;
  }
  function retryJob(id: string) {
    const j = S.jobs.find((x) => x.id === id);
    if (!j || j.status === "Sikeres") return;
    runJob(j);
  }

  function processInquiry(inq: Inquiry, override?: Extraction) {
    if (mode("inbox") === "off" && !override) {
      inq.status = "Kézi feldolgozásra vár";
      return;
    }
    const ex = override || parseInquiry(inq.raw, inq.from);
    inq.ex = ex;
    inq.conf = ex.conf;
    log(
      override ? "AI · Claude (élő modell)" : "AI · Ajánlatkérés-feldolgozó",
      `Értelmezve (${pct(ex.conf)} bizonyosság): ${ex.lines.length} tétel, ${ex.zip || "cím nélkül"}`,
      inq.id,
    );
    if (!ex.lines.length) {
      inq.status = "Hiányos — visszakérdezés";
      inq.reply = `Tisztelt Partnerünk! Köszönjük megkeresését. Kérjük, adja meg a kért frakciót és mennyiséget (tonna vagy m³), valamint a szállítási címet, és 1 órán belül küldjük az árajánlatot.`;
      log(
        "AI · Ajánlatkérés-feldolgozó",
        "Hiányzó tételek miatt visszakérdező e-mail piszkozat",
        inq.id,
      );
      return;
    }
    const clientId = ex.clientId || inq.clientId || null;
    const pr = priceEngine({
      clientId,
      lines: ex.lines,
      zip: ex.zip || inq.zip,
    });
    const q: Quote = {
      id: nid("A", (n) => "A-2026-" + n),
      inq: inq.id,
      clientId,
      clientName: clientId
        ? C(clientId)!.name
        : ex.company || inq.name || "Új ügyfél",
      zip: (ex.zip || inq.zip)!,
      city: ex.city,
      addr: ex.addr,
      date: ex.date,
      pr,
      created: now(),
      valid: addDays(TODAY, 14),
      status: "Piszkozat",
    };
    S.quotes.unshift(q);
    inq.quoteId = q.id;
    const blockers = pr.flags.filter((f) => f.lvl === "bad");
    const needsHuman =
      mode("quote") !== "auto" ||
      blockers.length ||
      pr.net > S.policy.autoQuoteMaxNet ||
      ex.conf < 0.75 ||
      !clientId;
    if (needsHuman) {
      q.status = "Jóváhagyásra vár";
      inq.status = "Jóváhagyásra vár";
      const why = [...blockers.map((b) => b.t)];
      if (pr.net > S.policy.autoQuoteMaxNet)
        why.push(
          `Nettó ${mft(pr.net)} > auto-küldési limit ${mft(S.policy.autoQuoteMaxNet)}`,
        );
      if (ex.conf < 0.75)
        why.push(
          `Alacsony értelmezési bizonyosság (${pct(ex.conf)}): hiányzik ${ex.missing.join(", ")}`,
        );
      if (!clientId) why.push("Új ügyfél: adószám/hitelkeret rögzítendő");
      approval(
        "quote",
        q.id,
        `Árajánlat ${q.id} — ${q.clientName}`,
        why.join(" · "),
        `Javaslat: ${blockers.length ? "ár módosítása a javasolt árra vagy előleg kérése" : "küldhető"}; árrés ${pct(pr.margin)}`,
      );
      log(
        "AI · Árazó",
        `Ajánlat összeállítva, emberi jóváhagyásra küldve`,
        q.id,
      );
    } else {
      q.status = "Kiküldve";
      inq.status = "Ajánlat kiküldve";
      log(
        "AI · Árazó",
        `Ajánlat automatikusan kiküldve (${mft(pr.net)} nettó, árrés ${pct(pr.margin)})`,
        q.id,
      );
    }
  }

  /* ---------------- MEGRENDELÉS, FUVAR, EKÁER ---------------- */
  let quoteToOrder = function (qid: string): Order | undefined {
    const q = S.quotes.find((x) => x.id === qid);
    if (!q || q.orderId) return;
    const o: Order = {
      id: nid("M", (n) => "M-2026-" + n),
      quote: q.id,
      clientId: q.clientId,
      clientName: q.clientName,
      zip: q.zip,
      city: q.city,
      addr: q.addr,
      lines: q.pr.lines.map((l) => ({
        pid: l.pid,
        qty: l.qty,
        unitNet: l.unitNet,
      })),
      freightPerT: q.pr.freightPerT,
      delivered: {},
      planned: {},
      status: "Visszaigazolva",
      date: q.date || addDays(TODAY, 2),
      created: now(),
    };
    S.orders.unshift(o);
    q.orderId = o.id;
    q.status = "Megrendelve";
    log(
      "Ügyfél (elfogadó link)",
      `Ajánlat elfogadva → megrendelés ${o.id}`,
      o.id,
    );
    if (mode("dispatch") === "auto") planTransports(o.id);
    return o;
  };
  function ekaerCheck(o: Order, pid: string, t: number): Ekaer {
    const p = P(pid),
      c: { end?: boolean } = C(o.clientId) || { end: true };
    const value =
      t * (o.lines.find((l) => l.pid === pid) || { unitNet: p.price }).unitNet;
    const reasons: string[] = [];
    let req = false;
    if (!p.ekaer) {
      reasons.push(
        `${p.vtsz} nincs a bejelentésköteles termékkörben (beállítás)`,
      );
    } else if (p.src === "buy") {
      reasons.push(
        "Belföldi beszerzésű áru továbbértékesítése — nem első belföldi értékesítés, nem bejelentésköteles (EU-ból beszerzett tételnél a beszerzéskor kell bejelenteni)",
      );
    } else if (c.end) {
      reasons.push(
        "Közvetlen végfelhasználónak történő értékesítés — nem bejelentésköteles",
      );
    } else {
      const overW = t * 1000 > S.policy.ekaerWeightKg,
        overV = value > S.policy.ekaerValueLimit;
      reasons.push(
        "Első belföldi adóköteles értékesítés nem végfelhasználónak, saját előállítású termék",
      );
      reasons.push(
        `Bruttó tömeg ${fmt(t * 1000)} kg ${overW ? ">" : "≤"} ${fmt(S.policy.ekaerWeightKg)} kg; érték ${ft(value)} ${overV ? ">" : "≤"} ${ft(S.policy.ekaerValueLimit)}`,
      );
      req = overW || overV;
    }
    return {
      required: req,
      reasons,
      value,
      number: null,
      status: req ? "Bejelentendő" : "Nem szükséges",
    };
  }
  let planTransports = function (oid: string): number {
    const o = S.orders.find((x) => x.id === oid)!;
    let day = new Date(o.date),
      ti = 0,
      made = 0;
    o.lines.forEach((l) => {
      let rest = l.qty - (o.planned[l.pid] || 0) - (o.delivered[l.pid] || 0);
      while (rest > 0.01) {
        const tr = S.trucks[ti % S.trucks.length];
        const t = Math.min(tr.cap, rest);
        const f: Transport = {
          id: nid("F", (n) => "F-2026-" + n),
          order: o.id,
          clientId: o.clientId,
          clientName: o.clientName,
          pid: l.pid,
          planned: t,
          truck: tr.id,
          driver: tr.driver || "",
          date: new Date(day),
          status: "Tervezett",
          net: null,
          depot: P(l.pid).depot,
          ekaer: ekaerCheck(o, l.pid, t),
        };
        S.transports.unshift(f);
        o.planned[l.pid] = (o.planned[l.pid] || 0) + t;
        rest -= t;
        ti++;
        made++;
        if (ti % (S.trucks.length * 3) === 0) day = addDays(day, 1);
        if (f.ekaer.required && mode("ekaer") === "auto")
          ekaerSubmit(f.id, true);
      }
    });
    o.status = "Ütemezve";
    log(
      "AI · Fuvarszervező",
      `${made} forduló ütemezve ${S.trucks.length} autóra`,
      o.id,
    );
    return made;
  };
  function ekaerPayload(f: Transport): Payload {
    const o = S.orders.find((x) => x.id === f.order)!,
      p = P(f.pid),
      c: Partial<Client> = C(f.clientId) || {};
    const t = f.net ?? f.planned;
    return {
      tradeType: "D",
      sellerVatNumber: "12312312-2-07",
      sellerName: "Mészkő-Polgár Kft.",
      destinationVatNumber: c.tax || null,
      destinationName: c.name || f.clientName,
      loadLocation: {
        country: "HU",
        postalCode: "8154",
        city: "Polgárdi",
        street: "Bánya út 1.",
      },
      unloadLocation: {
        country: "HU",
        postalCode: o.zip,
        city: o.city || "",
        street: o.addr || "",
      },
      vehicle: { plateNumber: f.truck, carrierName: "Mészkő-Polgár Kft." },
      loadDate: iso(f.date),
      items: [
        {
          productName: p.name,
          productVtsz: p.vtsz.replace(" ", ""),
          weight: Math.round(t * 1000),
          value: Math.round(f.ekaer.value),
          currency: "HUF",
        },
      ],
      orderNumber: o.id,
      transportId: f.id,
    };
  }
  let ekaerSubmit = function (
    fid: string,
    silent?: boolean,
    _approved?: boolean,
  ): void {
    const f = S.transports.find((x) => x.id === fid);
    if (!f || !f.ekaer.required || f.ekaer.number) return;
    const j = job(
      "NAV EKÁER",
      "Bejelentés (létrehozás)",
      f.id,
      ekaerPayload(f),
      () => {
        const n =
          "E" +
          String(env.now()).slice(-8) +
          String(Math.floor(rnd() * 90000 + 10000));
        f.ekaer.number = n;
        f.ekaer.status = "Bejelentve";
        f.ekaer.at = now();
        log(
          "AI · EKÁER-ügyintéző",
          `Bejelentés elfogadva (szimulált NAV válasz) → ${n}`,
          f.id,
        );
        return "EKÁER-szám: " + n;
      },
      (jj) => {
        f.ekaer.status = jj.attempts >= 3 ? "Hiba" : "Újrapróbálás";
      },
    );
    f.ekaer.job = j.id;
    if (!silent)
      toast(
        f.ekaer.number ? `EKÁER-szám: ${f.ekaer.number}` : `EKÁER: ${j.resp}`,
      );
  };
  function ekaerModify(f: Transport, what: string) {
    job("NAV EKÁER", `Módosítás (${what})`, f.id, ekaerPayload(f), () => {
      log("AI · EKÁER-ügyintéző", `Bejelentés módosítva: ${what}`, f.id);
      return "módosítva";
    });
  }
  function ekaerFinalize(f: Transport) {
    job(
      "NAV EKÁER",
      "Lezárás (lerakodás megtörtént)",
      f.id,
      { tradeCardNumber: f.ekaer.number, unloadDate: iso(TODAY) },
      () => {
        f.ekaer.status = "Lezárva";
        return "lezárva";
      },
    );
  }
  function ekaerCancel(f: Transport) {
    job(
      "NAV EKÁER",
      "Törlés (fuvar elmaradt)",
      f.id,
      { tradeCardNumber: f.ekaer.number },
      () => {
        f.ekaer.status = "Törölve";
        return "törölve";
      },
    );
  }
  function closeTransport(fid: string, net: number, wait = 0) {
    const f = S.transports.find((x) => x.id === fid)!;
    const o = S.orders.find((x) => x.id === f.order)!;
    if (!(net > 0)) {
      toast("Adja meg a mérlegjegy szerinti nettó tömeget.");
      return;
    }
    if (f.ekaer.required && !f.ekaer.number) {
      toast("EKÁER-szám nélkül a fuvar nem indulhat. Előbb jelentse be.");
      return;
    }
    const line = o.lines.find((l) => l.pid === f.pid)!;
    const after = (o.delivered[f.pid] || 0) + net;
    if (after > line.qty * (1 + S.policy.overDeliveryTol)) {
      approval(
        "over",
        f.id,
        `Túlszállítás — ${f.id}`,
        `Megrendelt ${tn(line.qty)}, ezzel együtt ${tn(after)} (+${pct(after / line.qty - 1)})`,
        "Javaslat: pótrendelés kérése az ügyféltől, vagy a többlet visszarakása",
      );
      toast("Túlszállítás: jóváhagyásra küldve, a fuvar nem zárult le.");
      return;
    }
    f.net = net;
    f.status = "Lezárva";
    f.wait = wait || 0;
    o.delivered[f.pid] = after;
    o.planned[f.pid] = Math.max(0, (o.planned[f.pid] || 0) - f.planned);
    move(TODAY, f.pid, f.depot, -net, "eladás", f.id);
    if (f.ekaer.required) {
      if (Math.abs(net - f.planned) > 0.5)
        ekaerModify(f, `tömeg ${tn(f.planned)} → ${tn(net)}`);
      ekaerFinalize(f);
    }
    const dn: Doc = {
      id: nid("SZL", (n) => "SZL-2026-" + n),
      type: "Szállítólevél",
      ref: f.id,
      order: o.id,
      clientName: o.clientName,
      amount: net * line.unitNet,
      qty: net,
      pid: f.pid,
      status: "Sorban (Billingo)",
      number: null,
      nav: "—",
      created: now(),
      payload: {},
    };
    dn.payload = billingoPayload(dn, o);
    S.docs.unshift(dn);
    f.dn = dn.id;
    job("Billingo", "Szállítólevél kiállítás", dn.id, dn.payload, () => {
      dn.status = "Billingóban kiállítva";
      dn.number = "MP-SZL-2026-" + String(SEQ.SZL).padStart(4, "0");
      log(
        "AI · Számlázó",
        `Szállítólevél kiállítva a Billingóban (${dn.number}), e-mailben a vevőnek és a sofőr appjába`,
        f.id,
      );
      return dn.number;
    });
    if (o.lines.every((l) => (o.delivered[l.pid] || 0) >= l.qty * 0.98)) {
      o.status = "Teljesítve";
      log("Rendszer", `Megrendelés teljesítve`, o.id);
      onOrderComplete(o);
    }
    toast(`${f.id} lezárva · ${dn.number}`);
  }
  function billingoPayload(doc: Doc, o: Order): Payload {
    const c: Partial<Client> = C(o.clientId) || {};
    const isInv = doc.type === "Számla";
    const items = isInv
      ? doc.items
      : [
          {
            name: P(doc.pid!).name,
            unit_price: (
              o.lines.find((l) => l.pid === doc.pid) ||
              ({} as Partial<(typeof o.lines)[0]>)
            ).unitNet,
            unit_price_type: "net",
            quantity: doc.qty,
            unit: "t",
            vat: "27%",
            comment: `Fuvar: ${doc.ref} · EKÁER: ${(S.transports.find((t) => t.id === doc.ref) || { ekaer: {} as Partial<Ekaer> }).ekaer.number || "nem köteles"}`,
          },
        ];
    return {
      partner_id: c.billingoId || "(Billingo partner_id — ügyfél-szinkronból)",
      block_id: isInv
        ? "(számla bizonylattömb)"
        : "(szállítólevél bizonylattömb)",
      type: isInv
        ? "invoice"
        : "(szállítólevél típus — Billingo API v3 specifikáció szerint)",
      fulfillment_date: iso(TODAY),
      due_date: iso(addDays(TODAY, c.payDays || 0)),
      payment_method: c.end ? "cash" : "wire_transfer",
      language: "hu",
      currency: "HUF",
      electronic: true,
      items,
      comment: `Megrendelés: ${o.id}`,
    };
  }
  function invoiceOrder(oid: string) {
    const o = S.orders.find((x) => x.id === oid)!;
    const closed = S.transports.filter(
      (f) => f.order === oid && f.status === "Lezárva" && !f.inv && tigOk(f),
    );
    if (!closed.length) {
      toast("Nincs elfogadott TIG-gel igazolt, számlázatlan forduló.");
      return;
    }
    const byP: Record<string, number> = {};
    closed.forEach((f) => (byP[f.pid] = (byP[f.pid] || 0) + f.net!));
    const items: InvoiceItem[] = Object.entries(byP).map(([pid, q]) => ({
      name: P(pid).name,
      unit_price: o.lines.find((l) => l.pid === pid)!.unitNet,
      unit_price_type: "net",
      quantity: Math.round(q * 100) / 100,
      unit: "t",
      vat: "27%",
    }));
    const tq = Object.values(byP).reduce((a, b) => a + b, 0);
    const wmin = closed.reduce((a, f) => a + (f.wait || 0), 0);
    const freeMin = closed.length * 30;
    if (wmin > freeMin)
      items.push({
        name: `Állásidő (${closed.length} forduló, 30 perc/forduló díjmentes felett)`,
        unit_price: 18000,
        unit_price_type: "net",
        quantity: Math.round(((wmin - freeMin) / 60) * 100) / 100,
        unit: "óra",
        vat: "27%",
      });
    if (o.freightPerT)
      items.push({
        name: "Fuvardíj",
        unit_price: Math.round(o.freightPerT),
        unit_price_type: "net",
        quantity: Math.round(tq * 100) / 100,
        unit: "t",
        vat: "27%",
      });
    const net = items.reduce((a, i) => a + i.unit_price * i.quantity, 0);
    const gross = net * 1.27;
    const inv: Doc = {
      id: nid("SZ", (n) => "SZ-" + n),
      type: "Számla",
      ref: closed.map((f) => f.id).join(", "),
      order: o.id,
      clientName: o.clientName,
      amount: net,
      gross,
      items,
      created: now(),
      status: "Piszkozat",
      nav: "—",
      payload: {},
    };
    inv.payload = billingoPayload(inv, o);
    S.docs.unshift(inv);
    closed.forEach((f) => (f.inv = inv.id));
    if (gross > S.policy.autoInvoiceMaxGross || mode("billing") !== "auto") {
      inv.status = "Jóváhagyásra vár";
      approval(
        "invoice",
        inv.id,
        `Számla — ${o.clientName} (${o.id})`,
        `Bruttó ${mft(gross)} > automatikus számlázási limit ${mft(S.policy.autoInvoiceMaxGross)}`,
        `Ellenőrizve: ${closed.length} lezárt fuvar, mérlegjegyek egyeznek, ár = visszaigazolt ár`,
      );
      log("AI · Számlázó", "Számlapiszkozat jóváhagyásra küldve", inv.id);
    } else issueInvoice(inv.id);
    o.invoiced = inv.id;
  }
  function issueInvoice(id: string) {
    const d = S.docs.find((x) => x.id === id)!;
    const o = S.orders.find((x) => x.id === d.order)!;
    const c = C(o.clientId);
    if (c && !c.billingoId)
      job(
        "Billingo",
        "Partner létrehozás",
        c.id,
        {
          name: c.name,
          taxcode: c.tax || null,
          address: { country_code: "HU", post_code: c.zip, city: c.city },
          emails: [c.email],
        },
        () => {
          c.billingoId = String(4100000 + Math.floor(rnd() * 90000));
          d.payload.partner_id = +c.billingoId;
          return "partner_id " + c.billingoId;
        },
      );
    d.status = "Sorban (Billingo)";
    job("Billingo", "Számla kiállítás", d.id, d.payload, () => {
      d.status = "Billingóban kiállítva";
      d.number = "MP-2026-" + String(SEQ.SZ).padStart(4, "0");
      d.nav = "Befogadva (NAV Online Számla, Billingón át)";
      d.due = addDays(TODAY, (c && c.payDays) || 0);
      d.paid = false;
      if (c) c.used += d.gross!;
      log(
        "AI · Számlázó",
        `Számla kiállítva: ${d.number}, NAV: befogadva`,
        d.id,
      );
      return d.number;
    });
  }
  function syncPayments() {
    job(
      "Billingo",
      "Fizetések lekérdezése",
      iso(TODAY) + "-" + S.jobs.length,
      {
        endpoint:
          "GET /v3/documents?payment_status=paid&start_date=" +
          iso(addDays(TODAY, -7)),
      },
      () => {
        let n = 0;
        S.docs
          .filter(
            (d) =>
              d.type === "Számla" && !d.paid && d.payAt && d.payAt <= TODAY,
          )
          .forEach((d) => {
            d.paid = true;
            d.status = "Kiegyenlítve";
            const c = S.clients.find((x) => x.name === d.clientName);
            if (c) c.used = Math.max(0, c.used - d.gross!);
            n++;
            log(
              "AI · Pénzügyi elemző",
              `Kiegyenlítés párosítva: ${d.number} (${mft(d.gross!)})`,
              d.id,
            );
          });
        return n + " kiegyenlítés";
      },
    );
  }

  /* ---------------- ÜZEMI RAKTÁR ---------------- */
  function reorderSuggestions() {
    return S.parts.map((s) => {
      const daily = s.use / 30;
      const cover = daily ? s.qty / daily : 999;
      const need = s.qty < s.min || cover < s.lead + 7;
      const sugg = need
        ? Math.ceil(Math.max(s.min * 2 - s.qty, daily * (s.lead + 30) - s.qty))
        : 0;
      return { ...s, cover, need, sugg };
    });
  }
  function issuePart(sid: string, qtyIn: number | string, mid: string) {
    const s = S.parts.find((x) => x.id === sid)!;
    const qty = +qtyIn;
    if (!(qty > 0) || qty > s.qty) {
      toast("Érvénytelen mennyiség vagy nincs elég készlet.");
      return;
    }
    s.qty -= qty;
    const cost = qty * s.price;
    S.issues.push({ t: now(), sid, qty, machine: mid, cost });
    log(
      "Raktáros (ember)",
      `${fmt(qty, qty % 1 ? 1 : 0)} ${s.unit} ${s.name} kiadva → ${S.machines.find((m) => m.id === mid)!.name} (${ft(cost)})`,
      sid,
    );
    toast("Kiadva, a költség a gépre terhelve.");
  }

  /* ---------------- KEZDŐ ÁLLAPOT (példák) ---------------- */
  let seed = function () {
    S.products.forEach((p) => (p.ekaer = true));
    (
      [
        ["MP-2026-0398", "V-Híd Építő Zrt.", 24.5e6, "2026-09-25", null],
        ["MP-2026-0402", "Fehérvári Útépítő Kft.", 6.1e6, "2026-10-07", null],
        [
          "MP-2026-0405",
          "Balaton-Mélyép Kft.",
          4.3e6,
          "2026-09-28",
          "2026-10-02",
        ],
        ["MP-2026-0409", "V-Híd Építő Zrt.", 18.2e6, "2026-10-12", null],
        ["MP-2026-0411", "Fehérvári Útépítő Kft.", 3.9e6, "2026-10-18", null],
      ] as [string, string, number, string, string | null][]
    ).forEach(([no, cl, g, due, pay], i) =>
      S.docs.push({
        id: "SZ-old-" + i,
        type: "Számla",
        number: no,
        ref: "szeptemberi teljesítés",
        order: "—",
        clientName: cl,
        amount: g / 1.27,
        gross: g,
        items: [
          {
            name: "Szeptemberi szállítások (összesítve)",
            unit_price: Math.round(g / 1.27),
            unit_price_type: "net",
            quantity: 1,
            unit: "tétel",
            vat: "27%",
          },
        ],
        status: "Billingóban kiállítva",
        nav: "Befogadva",
        due: new Date(due),
        payAt: pay ? new Date(pay) : null,
        paid: false,
        payload: { note: "korábbi számla (Billingóból szinkronizálva)" },
        created: addDays(new Date(due), -15),
      }),
    );
    const inq = [
      {
        channel: "E-mail",
        from: "beszerzes@fehervariut.hu",
        name: "Tóth Gábor",
        subject: "Ajánlatkérés — Berényi út",
        raw: "Tisztelt Mészkő-Polgár!\nA 8000 Székesfehérvár, Berényi út 72. alatti munkánkra kérnénk ajánlatot:\n- 320 t Z 0/22 zúzottkő\n- 120 t NZ 4/22\nSzállítás: 2026.10.12-től folyamatosan.\nÜdv, Tóth Gábor — Fehérvári Útépítő Kft.",
      },
      {
        channel: "E-mail",
        from: "info@balatonmelyep.hu",
        name: "Horváth Ádám",
        subject: "földmű anyag",
        raw: "Sziasztok!\n8600 Siófok, Fő utca 12.\nkb. 600 m3 M2 földműanyag kellene jövő héten.\nBalaton-Mélyép Kft.",
      },
      {
        channel: "E-mail",
        from: "beszerzes@fehervariut.hu",
        name: "Tóth Gábor",
        subject: "Pótrendelés Seregélyesi út",
        raw: "Szia!\nA 8000 Székesfehérvár, Seregélyesi út 11. munkára még kellene 75 t Z 0/63, 2026.10.07-re.\nKöszi, Fehérvári Útépítő Kft.",
      },
      {
        channel: "Web",
        from: "kovacs.janos@gmail.com",
        name: "Kovács János",
        subject: "Webes ajánlatkérő",
        raw: "Termék: 0/1 mosott homok — 15 t\nCím: 8156 Kisláng, Petőfi u. 3.\nKért időpont: 2026.10.08.",
      },
    ];
    inq.forEach((x, i) => {
      const r: Inquiry = {
        id: "INQ-" + ++SEQ.INQ,
        received: addDays(TODAY, -(2 - i) * 0.2),
        status: "Új",
        ...x,
      };
      S.inquiries.unshift(r);
      processInquiry(r);
    });
    // korábbi, elfogadott ajánlat → futó megrendelés V-Híd
    const pr = priceEngine({
      clientId: "c1",
      lines: [{ pid: "p2", qty: 200 }],
      zip: "1134",
    });
    const q: Quote = {
      id: "A-2026-81",
      clientId: "c1",
      clientName: "V-Híd Építő Zrt.",
      zip: "1134",
      city: "Budapest",
      addr: "Váci út 45.",
      date: addDays(TODAY, -3),
      pr,
      created: addDays(TODAY, -6),
      valid: addDays(TODAY, 8),
      status: "Kiküldve",
    };
    S.quotes.push(q);
    const o = quoteToOrder("A-2026-81")!;
    o.date = addDays(TODAY, -2);
    planTransports(o.id);
    S.transports
      .filter((f) => f.order === o.id)
      .slice(-3)
      .forEach((f, i) => {
        f.date = addDays(TODAY, -1);
        ekaerSubmit(f.id, true);
        closeTransport(f.id, [24.6, 25.3, 23.9][i]);
      });
    S.transports
      .filter((f) => f.order === o.id && f.status !== "Lezárva")
      .forEach((f) => {
        f.date = TODAY;
        if (!f.ekaer.number) ekaerSubmit(f.id, true);
      });
    const t1 = S.transports.find(
      (f) => f.order === o.id && f.status === "Tervezett",
    );
    if (t1) t1.status = "Úton";
    {
      const cm = costModel();
      S.products.forEach((p) => {
        const m = (p.price - cm.unit[p.id]) / p.price;
        if (m < S.policy.targetMargin) {
          const rec =
            Math.ceil(cm.unit[p.id] / (1 - S.policy.targetMargin) / 10) * 10;
          approval(
            "price",
            p.id,
            `Árjavaslat — ${p.name}`,
            `Szeptemberi önköltség ${ft(cm.unit[p.id])}/t, fedezet ${pct(m)} a ${pct(S.policy.targetMargin)} cél alatt`,
            `Javaslat: listaár ${ft(p.price)} → ${ft(rec)}/t; a már kiküldött ajánlatok nem változnak`,
          );
        }
      });
    }
    const po = reorderSuggestions().filter((s) => s.need);
    po.slice(0, 3).forEach((s) =>
      approval(
        "po",
        s.id,
        `Beszerzés — ${s.name}`,
        `Készlet ${fmt(s.qty)} ${s.unit}, fedezet ${fmt(s.cover)} nap, szállítási idő ${s.lead} nap`,
        `Javasolt rendelés: ${fmt(s.sugg)} ${s.unit} · ${s.sup} · kb. ${ft(s.sugg * s.price)}`,
      ),
    );
    S.audit.sort((a, b) => msBetween(b.t, a.t));
  };

  /* ---------------- UI: counts ---------------- */
  let counts = function (): Record<string, number> {
    return {
      ap: S.approvals.filter((a) => a.status === "Vár").length,
      inq: S.inquiries.filter((i) => !/kiküldve/i.test(i.status)).length,
      jobs: S.jobs.filter((j) => j.status !== "Sikeres").length,
    };
  };

  /* --- cash-flow előrejelzés --- */
  function cashflow() {
    const cm = costModel();
    const weeks: {
      a: Date;
      b: Date;
      inn: number;
      out: number;
      bal: number;
      items: [string, number][];
    }[] = [];
    let bal = 62000000;
    const start = new Date("2026-10-05");
    const monthlyRev = cm.revenue;
    const wage = S.staff.reduce((a, s) => a + s.gross, 0);
    const recv: [string, number, string | null | undefined, boolean][] = S.docs
      .filter((d) => d.type === "Számla" && !d.paid && d.due)
      .map((d) => {
        const late = d.due! < TODAY;
        return [
          iso(
            late
              ? addDays(
                  TODAY,
                  late && msBetween(TODAY, d.due!) / 864e5 > 7 ? 12 : 5,
                )
              : d.due!,
          ),
          d.gross!,
          d.number,
          late,
        ];
      });
    for (let w = 0; w < 13; w++) {
      const a = addDays(start, w * 7),
        b = addDays(a, 6);
      let inn = 0,
        out = 0;
      const items: [string, number][] = [];
      const inWeek = (d: Date) => d >= a && d <= b;
      recv.forEach(([d, v, no, late]) => {
        if (inWeek(new Date(d))) {
          inn += v;
          items.push([
            (late ? "Lejárt, behajtás alatt: " : "Esedékes: ") + no,
            v,
          ]);
        }
      });
      if (w >= 3) {
        const v = ((monthlyRev * 1.27) / 4.33) * 0.92;
        inn += v;
        items.push(["Várható befolyás (nyitott rendelések + trend)", v]);
      }
      for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
        const day = d.getDate();
        if (day === 10) {
          const v = wage * 0.665;
          out += v;
          items.push(["Nettó bérek", v]);
        }
        if (day === 12) {
          const v = wage * (0.335 + S.szocho);
          out += v;
          items.push(["Bérjárulékok, SZJA, szocho", v]);
        }
        if (day === 20) {
          const v = monthlyRev * 0.27 * 0.55;
          out += v;
          items.push(["ÁFA-befizetés (becslés)", v]);
        }
        if (day === 15) {
          out += 3.4e6;
          items.push(["Lízing (tehergépkocsik)", 3.4e6]);
        }
        if (day === 25) {
          out += 4.2e6;
          items.push(["Robbantás alvállalkozó", 4.2e6]);
        }
      }
      if (w % 2 === 0) {
        const v = 28000 * S.diesel * 1.27;
        out += v;
        items.push(["Gázolaj-töltés", v]);
      }
      out +=
        (S.overhead
          .filter((o) => o[1] === "rezsi")
          .reduce((acc, o) => acc + o[2], 0) /
          4.33) *
        1.27;
      {
        const v = 2.6e6;
        out += v;
        items.push(["Alkatrész, kenőanyag beszerzés", v]);
      }
      for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
        if (d.getDate() === 10) {
          out += 8.6e6 * 1.27;
          items.push(["Bérelt gépek", 8.6e6 * 1.27]);
        }
        if (d.getDate() === 20) {
          out += 4.5e6;
          items.push(["TAO- és HIPA-előleg, bányajáradék", 4.5e6]);
        }
      }
      if (w === 4) {
        out += 2850000 * 1.27;
        items.push(["Törőpofa (jóváhagyott PO)", 2850000 * 1.27]);
      }
      bal += inn - out;
      weeks.push({ a, b, inn, out, bal, items });
    }
    return weeks;
  }
  type CostModel = ReturnType<typeof costModel>;
  type CashWeek = ReturnType<typeof cashflow>[number];
  function insights(cm: CostModel, cf: CashWeek[]) {
    const out: string[] = [];
    const worst = S.products
      .map((p) => ({ p, m: (p.price - cm.unit[p.id]) / p.price }))
      .sort((a, b) => a.m - b.m)[0];
    out.push(
      `A legkisebb fedezetű termék a ${worst.p.name} (${pct(worst.m)}); célárrés mellett ${ft(Math.ceil(cm.unit[worst.p.id] / (1 - S.policy.targetMargin) / 10) * 10)}/t lenne az ár.`,
    );
    const big = [...cm.mach].sort((a, b) => b.total - a.total)[0];
    out.push(
      `A legdrágább gép a ${big.name}: ${mft(big.total)} a hónapban, ${ft(big.perH)}/üzemóra.`,
    );
    out.push(
      `Fuvarköltség ${ft(cm.ftPerKm)}/km a saját flottán — az ajánlatok ezzel számolnak.`,
    );
    const minW = cf.reduce((m, w) => (w.bal < m.bal ? w : m), cf[0]);
    out.push(
      minW.bal < 15e6
        ? `Figyelem: ${ds(minW.a)} hetében a pénzállás ${mft(minW.bal)}-ra csökken; javasolt a lejárt vevőszámlák behajtása vagy egy nagy beszerzés halasztása.`
        : `A pénzállás 13 héten át a biztonsági szint felett marad.`,
    );
    return out;
  }

  /* ================= ESEMÉNYEK (core) ================= */
  // Form submits and clicks of the demo; DOM reads are parameters here.
  function submitWebInquiry(v: {
    name: string;
    mail: string;
    prod: string;
    qty: string;
    zip: string;
    city: string;
    date: string;
  }) {
    const r: Inquiry = {
      id: "INQ-" + ++SEQ.INQ,
      channel: "Web",
      from: v.mail,
      name: v.name,
      subject: "Webes ajánlatkérő",
      received: now(),
      status: "Új",
      raw: `Termék: ${P(v.prod).name} — ${v.qty} t\nCím: ${v.zip} ${v.city}\nKért időpont: ${v.date.replace(/-/g, ".")}.\n${v.name}`,
    };
    S.inquiries.unshift(r);
    processInquiry(r);
    ui.sel.inq = r.id;
    render();
    toast(`Feldolgozva: ${r.status}`);
  }
  function submitStockMove(pid: string, t: string, qIn: number) {
    let q = qIn;
    if (t === "saját felhasználás") q = -Math.abs(q);
    move(TODAY, pid, P(pid).depot, q, t, "kézi");
    log("Bányamester (ember)", `${t}: ${fmt(q, 1)} t ${P(pid).name}`, "");
    render();
    toast("Könyvelve a mozgásnaplóba.");
  }
  function submitIssue(sid: string, qty: string, mid: string) {
    issuePart(sid, qty, mid);
    render();
  }
  function setAgentMode(id: string, value: AgentMode, label: string) {
    S.agents.find((a) => a.id === id)!.mode = value;
    log(
      "Tulajdonos",
      `${S.agents.find((a) => a.id === id)!.name} mód: ${label}`,
    );
    toast("Mentve.");
  }
  function setPolicy(key: string, value: string) {
    (S.policy as unknown as Record<string, number>)[key] = +value;
    log("Tulajdonos", `Házirend: ${key} = ${value}`);
    toast("Házirend mentve.");
  }
  function setPolicyPct(key: string, value: string) {
    (S.policy as unknown as Record<string, number>)[key] = +value / 100;
    log("Tulajdonos", `Házirend: ${key} = ${value}%`);
    toast("Házirend mentve.");
  }
  function swapTruck(fid: string, truckId: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    const ev = assign(
      f,
      truckId,
      f.driverId || S.drivers[0].id,
      "Diszpécser (ember)",
    );
    render();
    toast(
      ev.hard.length
        ? "Szabálysértés: " + ev.hard[0]
        : "Autó cserélve, EKÁER rendszám módosítva.",
    );
  }
  function setSimEkaer(on: boolean) {
    S.sim.ekaerDown = on;
    log("Tulajdonos", `EKÁER üzemszünet szimuláció: ${on ? "be" : "ki"}`);
    render();
  }
  function setSimBillingo(on: boolean) {
    S.sim.billingoDown = on;
    log("Tulajdonos", `Billingo hiba szimuláció: ${on ? "be" : "ki"}`);
    render();
  }
  function setTargetMargin(v: string) {
    S.policy.targetMargin = +v / 100;
    render();
  }
  function setMinMargin(v: string) {
    S.policy.minMargin = +v / 100;
    render();
  }
  function cancelTransport(fid: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    const o = S.orders.find((x) => x.id === f.order)!;
    if (f.ekaer.number) ekaerCancel(f);
    f.status = "Törölve";
    o.planned[f.pid] = Math.max(0, (o.planned[f.pid] || 0) - f.planned);
    log(
      "Diszpécser (ember)",
      "Fuvar törölve, a mennyiség újra ütemezhető",
      f.id,
    );
    render();
    toast("Fuvar törölve, EKÁER-bejelentés visszavonva.");
  }
  function stornoInvoice(id: string) {
    const doc = S.docs.find((x) => x.id === id)!;
    job(
      "Billingo",
      "Sztornó számla",
      doc.id,
      { endpoint: `POST /v3/documents/${doc.id}/cancel` },
      () => {
        doc.status = "Sztornó";
        const c = S.clients.find((x) => x.name === doc.clientName);
        if (c) c.used = Math.max(0, c.used - doc.gross!);
        log("Tulajdonos", `Számla sztornózva: ${doc.number}`, doc.id);
        return "sztornó kiállítva";
      },
    );
    render();
    toast("Sztornó számla kiállítva.");
  }
  function selectJob(id: string) {
    ui.sel.job = id;
    render();
  }
  function retryClick(id: string) {
    retryJob(id);
    render();
    toast("Újrapróbálva.");
  }
  function retryAll() {
    S.jobs.filter((j) => j.status !== "Sikeres").forEach((j) => runJob(j));
    render();
    toast("Hibás feladatok újrapróbálva.");
  }
  function syncClick() {
    syncPayments();
    render();
    toast("Fizetések szinkronizálva.");
  }
  function openReport(rep: string) {
    ui.sub.reports = rep;
    go("reports");
  }
  function emailInquiry(v: {
    from: string;
    subject: string;
    body: string;
    channel?: string;
  }) {
    const r: Inquiry = {
      id: "INQ-" + ++SEQ.INQ,
      channel: "E-mail",
      from: v.from,
      name: "",
      subject: v.subject,
      received: now(),
      status: "Új",
      raw: v.body,
    };
    S.inquiries.unshift(r);
    processInquiry(r);
    ui.sel.inq = r.id;
    render();
    toast(`Feldolgozva: ${r.status}`);
  }
  function selectInquiry(id: string) {
    ui.sel.inq = id;
    render();
  }
  function openQuote(id: string) {
    ui.sel.q = id;
    go("quotes");
  }
  function approveQuote(id: string) {
    const a = S.approvals.find((x) => x.refId === id && x.status === "Vár");
    if (a) return decide(a.id, true);
    const q = S.quotes.find((x) => x.id === id)!;
    q.status = "Kiküldve";
    render();
  }
  function repriceQuote(id: string) {
    const q = S.quotes.find((x) => x.id === id)!;
    const lines = q.pr.lines.map((l) => ({ pid: l.pid, qty: l.qty }));
    const pr = priceEngine({ clientId: q.clientId, lines, zip: q.zip });
    pr.lines.forEach((l) => {
      if (l.margin < S.policy.targetMargin) {
        l.unitNet = l.rec;
        l.net = l.rec * l.qty;
        l.margin = (l.unitNet - l.unitCost) / l.unitNet;
      }
    });
    pr.prodNet = pr.lines.reduce((a, l) => a + l.net, 0);
    pr.net = pr.prodNet + pr.freightNet;
    pr.gross = pr.net * 1.27;
    const tc =
      pr.lines.reduce((a, l) => a + l.unitCost * l.qty, 0) + pr.freightCost;
    pr.margin = (pr.net - tc) / pr.net;
    pr.flags = pr.flags.filter((f) => !/árrés/.test(f.t));
    q.pr = pr;
    log("AI · Árazó", `Átárazva célárrésre: ${mft(pr.net)}`, q.id);
    render();
    toast("Átárazva. Ellenőrizze, majd hagyja jóvá.");
  }
  function orderFromQuote(id: string) {
    const o = quoteToOrder(id)!;
    render();
    toast(`Megrendelés: ${o.id}`);
  }
  function planClick(oid: string) {
    const n = planTransports(oid);
    render();
    toast(`${n} forduló ütemezve.`);
  }
  function invoiceClick(oid: string) {
    invoiceOrder(oid);
    go("billing");
  }
  function selectTransport(id: string) {
    ui.sel.f = id;
    render();
  }
  function ekaerClick(fid: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    if (f.ekaer.job && !f.ekaer.prepared) {
      retryJob(f.ekaer.job);
      toast(
        f.ekaer.number
          ? `EKÁER-szám: ${f.ekaer.number}`
          : "Még mindig sikertelen.",
      );
    } else ekaerSubmit(fid, false, true);
    render();
  }
  function closeClick(fid: string, weight: string, waitMin: string | number) {
    const v = parseFloat(String(weight).replace(",", "."));
    const wt = +waitMin;
    closeTransport(fid, v, wt);
    render();
  }
  function selectDoc(id: string) {
    ui.sel.doc = id;
    render();
  }
  function issueClick(id: string) {
    const a = S.approvals.find((x) => x.refId === id && x.status === "Vár");
    if (a) return decide(a.id, true);
    issueInvoice(id);
    render();
  }
  function poClick(sid: string) {
    const s = reorderSuggestions().find((x) => x.id === sid)!;
    if (!S.approvals.some((a) => a.refId === s.id && a.status === "Vár"))
      approval(
        "po",
        s.id,
        `Beszerzés — ${s.name}`,
        `Készlet ${fmt(s.qty)} ${s.unit}, fedezet ${fmt(s.cover)} nap`,
        `Javasolt rendelés: ${fmt(s.sugg)} ${s.unit} · ${s.sup} · kb. ${ft(s.sugg * s.price)}`,
      );
    toast("Jóváhagyásra küldve.");
    render();
  }
  function receivePo(id: string) {
    const p = S.pos.find((x) => x.id === id)!;
    p.status = "Beérkezett";
    S.parts.find((s) => s.id === p.sid)!.qty += p.qty;
    log("Raktáros (ember)", `Beérkeztetve: ${p.name} ${fmt(p.qty)}`, p.id);
    render();
  }
  function setPrice(pid: string, v: string) {
    const p = P(pid);
    log("Tulajdonos", `Listaár: ${p.name} ${ft(p.price)} → ${ft(+v)}`);
    p.price = +v;
    render();
    toast("Listaár frissítve; az új ajánlatok ezzel számolnak.");
  }
  let decide = function (id: string, ok: boolean): void {
    const a = S.approvals.find((x) => x.id === id)!;
    a.status = ok ? "Jóváhagyva" : "Elutasítva";
    log(
      "Tulajdonos",
      `${ok ? "Jóváhagyva" : "Elutasítva"}: ${a.title}`,
      a.refId,
    );
    if (ok) {
      if (a.kind === "quote") {
        const q = S.quotes.find((x) => x.id === a.refId)!;
        q.status = "Kiküldve";
        const i = S.inquiries.find((x) => x.quoteId === q.id);
        if (i) i.status = "Ajánlat kiküldve";
        log(
          "Rendszer",
          `Ajánlat e-mailben kiküldve, PDF + elfogadó link`,
          q.id,
        );
      }
      if (a.kind === "invoice") issueInvoice(a.refId);
      if (a.kind === "po") {
        const s = reorderSuggestions().find((x) => x.id === a.refId)!;
        S.pos.unshift({
          id: nid("PO", (n) => "PO-2026-" + n),
          sid: s.id,
          name: s.name,
          sup: s.sup,
          qty: s.sugg,
          status: "Megrendelve (PO)",
        });
        log("AI · Raktáros", `Rendelés elküldve: ${s.sup}`, s.id);
      }
      if (a.kind === "price") {
        const p = P(a.refId);
        const cm = costModel();
        const rec =
          Math.ceil(cm.unit[p.id] / (1 - S.policy.targetMargin) / 10) * 10;
        if (rec > p.price) p.price = rec;
        log("Rendszer", `Listaár frissítve: ${p.name} → ${ft(p.price)}`);
      }
      if (a.kind === "int") {
        const j = S.jobs.find((x) => x.id === a.refId)!;
        j.attempts = 0;
        runJob(j);
      }
      if (a.kind === "over") {
        const f = S.transports.find((x) => x.id === a.refId)!;
        const o = S.orders.find((x) => x.id === f.order)!;
        o.lines.find((l) => l.pid === f.pid)!.qty *= 1.2;
        log("Tulajdonos", "Pótrendelés rögzítve (+20%)", o.id);
      }
    } else if (a.kind === "quote") {
      const q = S.quotes.find((x) => x.id === a.refId)!;
      q.status = "Piszkozat";
    }
    render();
    toast(ok ? "Jóváhagyva." : "Elutasítva.");
  };

  /* ================= 2. KÖR: BŐVÍTÉSEK ================= */
  S.agents.push(
    {
      id: "followup",
      name: "Ajánlat-utánkövető",
      does: "3 nap után emlékeztetőt küld a meg nem válaszolt ajánlatokra, 10 nap után telefonos feladatot ad az értékesítőnek.",
      mode: "auto",
    },
    {
      id: "collect",
      name: "Követeléskezelő",
      does: "Lejárt számlákra fokozatos felszólítás; 15 nap felett szállítási zárlatot javasol.",
      mode: "auto",
    },
    {
      id: "maint",
      name: "Karbantartás-tervező",
      does: "Üzemóra alapján munkalapot nyit, lefoglalja az alkatrészt, a leállást a fuvartervbe illeszti.",
      mode: "auto",
    },
    {
      id: "stockrec",
      name: "Leltár-egyeztető",
      does: "Drónos/GPS depófelmérést összevet a könyvi készlettel; eltérésnél helyesbítést javasol.",
      mode: "suggest",
    },
  );
  const PHASES: [string, string, string, string][] = [
    [
      "Ajánlatkérés beérkezése",
      "Ajánlatkérés-feldolgozó",
      "értelmezés, ügyfélazonosítás, hiány esetén visszakérdezés",
      "<75% bizonyosság vagy új ügyfél",
    ],
    [
      "Árazás",
      "Árazó",
      "önköltség + fuvar + kedvezmény, árrés- és hitelkeret-őr",
      "limit feletti összeg, árrés a minimum alatt, lejárt tartozás",
    ],
    [
      "Utánkövetés",
      "Ajánlat-utánkövető",
      "emlékeztető e-mail, telefonos feladat",
      "10 nap után ember hív",
    ],
    [
      "Megrendelés",
      "Rendszer",
      "elfogadó link vagy portál → megrendelés, készletfoglalás",
      "készlethiány",
    ],
    [
      "Fuvarszervezés",
      "Fuvarszervező",
      "fordulók autókra, karbantartási leállások kikerülése",
      "diszpécser jóváhagyja a napi tervet",
    ],
    [
      "EKÁER",
      "EKÁER-ügyintéző",
      "kötelezettség-döntés, bejelentés, módosítás, lezárás, törlés",
      "3 sikertelen próbálkozás",
    ],
    [
      "Mérlegelés, szállítólevél",
      "Számlázó",
      "mérlegjegyből készletcsökkenés és Billingo-szállítólevél",
      "túlszállítás a tűrés felett",
    ],
    [
      "Számlázás",
      "Számlázó",
      "teljesítésből számla, NAV-adatszolgáltatás a Billingón át",
      "bruttó limit felett",
    ],
    [
      "Befolyás, behajtás",
      "Követeléskezelő",
      "fizetés-párosítás, felszólítás, zárlat",
      "szállítási zárlat elrendelése",
    ],
    [
      "Termelés, készlet",
      "Leltár-egyeztető",
      "termelés könyvelése, depófelmérés egyeztetése",
      "3% feletti eltérés",
    ],
    [
      "Gépek, raktár",
      "Karbantartás-tervező, Raktáros",
      "munkalap, alkatrész-foglalás, rendelési javaslat",
      "minden beszerzési rendelés",
    ],
    [
      "Pénzügy, árazás",
      "Pénzügyi elemző",
      "cash-flow, árrés-figyelés, árjavaslat, kérdés-válasz",
      "listaár-módosítás",
    ],
  ];

  /* ---- élő Claude (sample képesség) ---- */
  S.ask = {
    q: "Miért alacsony a földműanyag fedezete, és mit tegyek?",
    a: "",
    busy: false,
  };
  let erpTools = function (): SampleTool[] {
    const cm = costModel();
    return [
      {
        name: "eredmeny",
        description:
          "Szeptemberi eredménykimutatás és költségpoolok forintban.",
        execute: () => ({
          arbevetel: Math.round(cm.revenue),
          fuvarbevetel: Math.round(cm.freightRev),
          koltsegek: Object.fromEntries(
            Object.entries(cm.pools).map(([k, v]) => [k, Math.round(v)]),
          ),
          beszerzett_aru: Math.round(cm.buyCost),
          uzemi_eredmeny: Math.round(cm.revenue - cm.totalCost),
        }),
      },
      {
        name: "termek_onkoltseg",
        description:
          "Termékenként önköltség-bontás Ft/t, listaár, fedezet, eladott tonna.",
        execute: () =>
          S.products.map((p) => ({
            termek: p.name,
            onkoltseg: Math.round(cm.unit[p.id]),
            bontas: Object.fromEntries(
              Object.entries(cm.parts[p.id]).map(([k, v]) => [
                k,
                Math.round(v),
              ]),
            ),
            listaar: p.price,
            fedezet: +((p.price - cm.unit[p.id]) / p.price).toFixed(3),
            eladott_t: cm.soldT[p.id],
          })),
      },
      {
        name: "keszlet",
        description:
          "Termékkészlet depónként, lekötött és szabad mennyiség tonnában.",
        execute: () =>
          S.products.map((p) => ({
            termek: p.name,
            keszlet: Math.round(stockOf(p.id)),
            lekotott: Math.round(reservedOf(p.id)),
            minimum: p.min,
          })),
      },
      {
        name: "cashflow",
        description:
          "13 hetes pénzállás-előrejelzés hetente: befolyó, kifizetés, záró egyenleg, fő tételek.",
        execute: () =>
          cashflow().map((w) => ({
            het: iso(w.a),
            be: Math.round(w.inn),
            ki: Math.round(w.out),
            zaro: Math.round(w.bal),
          })),
      },
      {
        name: "gepek",
        description:
          "Gépenként havi költség, Ft/üzemóra és szervizig hátralévő idő.",
        execute: () =>
          cm.mach.map((m) => ({
            gep: m.name,
            osszes: Math.round(m.total),
            ft_uzemora: Math.round(m.perH),
            szervizig: m.next,
          })),
      },
      {
        name: "vevok",
        description:
          "Vevőnként szeptemberi árbevétel, fedezet, kintlévőség, lejárt tartozás.",
        execute: () =>
          custProfit().map((c) => ({
            vevo: c.name,
            arbevetel: Math.round(c.rev),
            fedezet: Math.round(c.margin),
            fedezet_szazalek: +(c.margin / c.rev).toFixed(3),
            lejart: Math.round(c.overdue),
          })),
      },
    ];
  };
  const SAMPLE_ERRORS: Record<string, string> = {
    not_granted: "A Claude-hívás nincs engedélyezve ehhez az oldalhoz.",
    rate_limited: "Túl sok kérés, próbálja újra később.",
    tools_unavailable: "Ez a nézet nem futtat eszközhívást.",
  };
  const errField = (e: unknown, k: string) =>
    e && typeof e === "object" && k in e
      ? String((e as Record<string, unknown>)[k])
      : undefined;
  async function ask(q: string) {
    const SAMPLE = ui.sample;
    if (!q.trim() || !SAMPLE) return;
    S.ask = { q, a: "", busy: true };
    render();
    try {
      const { text } = await SAMPLE(
        `Te a Mészkő-Polgár Kft. (mészkőbánya, Polgárdi) ERP-rendszerének pénzügyi elemzője vagy. A tulajdonos kérdésére válaszolj magyarul, tömören (legfeljebb 8 mondat vagy rövid lista), konkrét számokkal, és zárd egy javasolt döntéssel. Csak az eszközökből kapott adatokra támaszkodj; ha valami nem derül ki belőlük, mondd meg.\n\nKérdés: ${q}`,
        {
          tools: erpTools(),
          onText: ({ text }) => {
            S.ask.a = text;
            render();
          },
        },
      );
      S.ask.a = text;
      log(
        "AI · Claude (élő modell)",
        `Tulajdonosi kérdés megválaszolva: „${q.slice(0, 60)}”`,
      );
    } catch (e) {
      S.ask.a =
        errField(e, "text") ||
        SAMPLE_ERRORS[errField(e, "code") || ""] ||
        "A válasz nem érkezett meg, próbálja újra.";
    }
    S.ask.busy = false;
    render();
  }
  async function claudeParse(id: string) {
    const SAMPLE = ui.sample;
    const inq = S.inquiries.find((i) => i.id === id);
    if (!SAMPLE || !inq) return;
    inq.claudeBusy = true;
    render();
    try {
      const r = await SAMPLE.json(
        `Egy magyar mészkőbánya ajánlatkérő levelét kell értelmezni. Termékkatalógus (id: név):\n${S.products.map((p) => p.id + ": " + p.name).join("\n")}\nÜgyfelek: ${S.clients.map((c) => c.id + ": " + c.name).join("; ")}\nm³ → tonna: 1,75 t/m³ (M2 0/90: 1,9).\nVálaszolj CSAK ezzel a JSON-nal: {"lines":[{"pid":"p1","qty_t":120}],"zip":"8000","city":"Székesfehérvár","addr":"Fő u. 1.","date":"2026-10-12 vagy null","clientId":"c2 vagy null","company":"cégnév","missing":["ami hiányzik"]}\n\nFeladó: ${inq.from}\nLevél:\n${inq.raw}`,
        { modelTier: "quick" },
      );
      const rl = Array.isArray(r.lines)
        ? (r.lines as { pid?: unknown; qty_t?: unknown }[])
        : [];
      const lines: InquiryLine[] = rl
        .filter(
          (l) =>
            typeof l.pid === "string" &&
            S.products.some((p) => p.id === l.pid) &&
            +String(l.qty_t) > 0,
        )
        .map((l) => ({
          pid: String(l.pid),
          qty: Math.round(+String(l.qty_t)),
          note: "Claude",
        }));
      const ex: Extraction = {
        lines,
        zip: String(r.zip || ""),
        city: String(r.city || ""),
        addr: String(r.addr || ""),
        date: r.date && r.date !== "null" ? new Date(String(r.date)) : null,
        company: String(r.company || ""),
        clientId: C(String(r.clientId)) ? String(r.clientId) : null,
        missing: Array.isArray(r.missing) ? r.missing.map(String) : [],
        conf: 0,
      };
      ex.conf =
        [lines.length > 0, !!ex.zip, !!ex.date, !!ex.clientId].filter(Boolean)
          .length / 4;
      if (inq.quoteId) {
        const q = S.quotes.find((x) => x.id === inq.quoteId);
        if (q && !q.orderId) {
          q.status = "Felülírva";
          S.approvals
            .filter((a) => a.refId === q.id && a.status === "Vár")
            .forEach((a) => (a.status = "Elutasítva"));
        }
      }
      processInquiry(inq, ex);
      toast("Claude újraértelmezte, az ajánlat frissült.");
    } catch (e) {
      toast(
        errField(e, "code") === "not_granted"
          ? "A Claude-hívás nincs engedélyezve."
          : "Claude nem tudta értelmezni, a helyi értelmező eredménye marad.",
      );
    }
    inq.claudeBusy = false;
    render();
  }

  /* ---- vevői jövedelmezőség ---- */
  const SHARE: Record<string, Record<string, number>> = {
    c1: { p1: 0.38, p2: 0.45, p3: 0.3, p6: 0.4 },
    c2: { p1: 0.3, p2: 0.25, p3: 0.35, p4: 0.4 },
    c3: { p5: 0.55, p7: 0.5, p4: 0.2 },
    c4: { p8: 0.06 },
  };
  const KM: Record<string, number> = { c1: 85, c2: 22, c3: 38, c4: 8 };
  function custProfit() {
    const cm = costModel();
    const rows = S.clients.map((c) => {
      let t = 0,
        rev = 0,
        cost = 0;
      Object.entries(SHARE[c.id] || {}).forEach(([pid, sh]) => {
        const q = cm.soldT[pid] * sh;
        t += q;
        rev += q * P(pid).price * (1 - c.disc);
        cost += q * cm.unit[pid];
      });
      const trips = Math.ceil(t / 25),
        fc = trips * (KM[c.id] * 2 * cm.ftPerKm + S.policy.tollPerTrip),
        fr = fc * (1 + S.policy.freightMarkup);
      const fin = (rev + fr) * 1.27 * (c.payDays / 365) * 0.085;
      const od = overdueOf(c.name);
      return {
        id: c.id as string | undefined,
        name: c.name,
        t,
        rev: rev + fr,
        prodCost: cost,
        freightCost: fc,
        fin,
        margin: rev + fr - cost - fc - fin,
        overdue: od.sum,
        odDays: od.days,
        disc: c.disc,
        payDays: c.payDays,
      };
    });
    const other = {
      id: undefined as string | undefined,
      name: "Egyéb vevők (42 db)",
      t: 0,
      rev: 0,
      prodCost: 0,
      freightCost: 0,
      fin: 0,
      margin: 0,
      overdue: 0,
      odDays: 0,
      disc: 0,
      payDays: 8,
    };
    S.products.forEach((p) => {
      const used = Object.values(SHARE).reduce((a, m) => a + (m[p.id] || 0), 0);
      const q = cm.soldT[p.id] * (1 - used);
      other.t += q;
      other.rev += q * p.price;
      other.prodCost += q * cm.unit[p.id];
    });
    other.freightCost =
      cm.pools.fuvar - rows.reduce((a, r) => a + r.freightCost, 0);
    other.rev += Math.max(0, other.freightCost) * (1 + S.policy.freightMarkup);
    other.margin = other.rev - other.prodCost - other.freightCost;
    return [...rows, other];
  }
  function overdueOf(name: string) {
    const docs = S.docs.filter(
      (d) =>
        d.type === "Számla" &&
        !d.paid &&
        d.status !== "Sztornó" &&
        d.clientName === name &&
        d.due &&
        d.due < TODAY,
    );
    return {
      sum: docs.reduce((a, d) => a + d.gross!, 0),
      days: docs.reduce(
        (m, d) => Math.max(m, Math.round(msBetween(TODAY, d.due!) / 864e5)),
        0,
      ),
      docs,
    };
  }

  /* ---- követeléskezelés ---- */
  S.dunning = [];
  function runCollections() {
    if (mode("collect") === "off") return;
    S.docs
      .filter(
        (d) =>
          d.type === "Számla" &&
          !d.paid &&
          d.status !== "Sztornó" &&
          d.due &&
          d.due < TODAY,
      )
      .forEach((d) => {
        const days = Math.round(msBetween(TODAY, d.due!) / 864e5);
        const lvl = days > 15 ? 3 : days > 7 ? 2 : 1;
        if (S.dunning.some((x) => x.doc === d.id && x.lvl >= lvl)) return;
        const txt =
          lvl === 1
            ? `Tisztelt Partnerünk! Az ${d.number} számú, ${ds(d.due!)}-i esedékességű, ${ft(d.gross)} összegű számlánk kiegyenlítése a nyilvántartásunk szerint még nem történt meg. Kérjük, ellenőrizze. Ha már utalt, tekintse tárgytalannak levelünket.`
            : lvl === 2
              ? `Tisztelt Partnerünk! Az ${d.number} számú számla ${days} napja lejárt (${ft(d.gross)}). Kérjük, 5 munkanapon belül rendezze, vagy jelezzen fizetési ütemezést. Ezt követően a további kiszállításokat előre utaláshoz kötjük.`
              : `Fizetési felszólítás: ${d.number}, ${days} nap késés. A kiszállításokat felfüggesztjük a rendezésig.`;
        const x = {
          doc: d.id,
          number: d.number!,
          client: d.clientName,
          lvl,
          days,
          txt,
          status:
            lvl < 3 && mode("collect") === "auto"
              ? "Elküldve"
              : "Jóváhagyásra vár",
          t: now(),
        };
        S.dunning.unshift(x);
        if (x.status === "Elküldve")
          log(
            "AI · Követeléskezelő",
            `${lvl}. fokú fizetési emlékeztető elküldve: ${d.number} (${days} nap)`,
            d.id,
          );
        else if (!S.approvals.some((a) => a.refId === d.id && a.kind === "dun"))
          approval(
            "dun",
            d.id,
            `Szállítási zárlat — ${d.clientName}`,
            `${d.number}: ${days} napos késés, ${mft(d.gross!)}`,
            "Javaslat: új fuvar csak előre utalással; felszólító levél kiküldése",
          );
      });
  }

  /* ---- ajánlat-utánkövetés ---- */
  S.followups = [];
  function runFollowups() {
    S.quotes
      .filter((q) => q.status === "Kiküldve" && !q.orderId)
      .forEach((q) => {
        const age = Math.round(msBetween(TODAY, q.created) / 864e5);
        if (
          age < 3 ||
          S.followups.some((f) => f.q === q.id && f.age >= (age >= 10 ? 10 : 3))
        )
          return;
        const f = {
          q: q.id,
          client: q.clientName,
          age,
          kind:
            age >= 10 ? "Telefonos feladat — értékesítő" : "Emlékeztető e-mail",
          txt:
            age >= 10
              ? `Hívja fel: ${q.clientName}, ajánlat ${q.id} (${mft(q.pr.net)}) ${age} napja megválaszolatlan. Kérdezze meg, kell-e ármódosítás vagy más szállítási ütem.`
              : `Tisztelt Partnerünk! ${ds(q.created)}-i, ${q.id} számú ajánlatunk ${ds(q.valid)}-ig érvényes. Az ajánlat elfogadása egy kattintás: [Elfogadom]. Kérdés esetén keressen bátran.`,
          status: mode("followup") === "auto" ? "Elküldve" : "Javaslat",
        };
        S.followups.unshift(f);
        log("AI · Ajánlat-utánkövető", `${f.kind}: ${q.id} (${age} nap)`, q.id);
      });
  }

  /* ---- leltár, átszállítás ---- */
  S.surveys = [];
  function survey(depot: string, pid: string, m3: number, method: string) {
    const dens = S.policy.density[pid] || S.policy.density.default;
    const t = m3 * dens;
    const book = stockOf(pid, depot);
    const diff = t - book;
    const rel = book ? diff / book : 0;
    const sv = {
      id: "FM-" + (S.surveys.length + 1),
      date: new Date(TODAY),
      depot,
      pid,
      m3,
      dens,
      t,
      book,
      diff,
      rel,
      method,
      status: Math.abs(rel) > 0.03 ? "Jóváhagyásra vár" : "Egyezik",
    };
    S.surveys.unshift(sv);
    log(
      "AI · Leltár-egyeztető",
      `Felmérés ${D(depot).name}, ${P(pid).name}: mért ${tn(t)} / könyvi ${tn(book)} (${rel > 0 ? "+" : ""}${pct(rel)})`,
      sv.id,
    );
    if (sv.status !== "Egyezik")
      approval(
        "inv",
        sv.id,
        `Készlethelyesbítés — ${P(pid).name}, ${D(depot).name}`,
        `Felmérés szerinti eltérés ${tn(diff)} (${pct(rel)}), a 3% tűrés felett`,
        `Javaslat: helyesbítés ${tn(diff)}; ${diff < 0 ? "valószínű ok: mérlegelés nélküli saját felhasználás vagy szórás — a rakodási naplót ellenőrizni" : "valószínű ok: könyveletlen termelés"}`,
      );
    return sv;
  }
  function transfer(pid: string, from: string, to: string, t: number) {
    if (t > stockOf(pid, from)) {
      toast("A forrásdepóban nincs ennyi készlet.");
      return false;
    }
    move(TODAY, pid, from, -t, "átszállítás ki", to);
    move(TODAY, pid, to, t, "átszállítás be", from);
    log(
      "Bányamester (ember)",
      `Átszállítás: ${tn(t)} ${P(pid).name} ${D(from).name} → ${D(to).name}`,
    );
    return true;
  }

  /* ---- munkalapok, tartály ---- */
  S.wos = [];
  SEQ.WO = 70;
  const WOKIT: Record<string, [string, number][]> = {
    "TOR-01": [
      ["s3", 60],
      ["s5", 5],
      ["s6", 1],
    ],
    "DOZ-01": [
      ["s8", 1],
      ["s4", 35],
    ],
    "RAK-01": [
      ["s4", 30],
      ["s3", 40],
    ],
    "OSZT-01": [
      ["s5", 4],
      ["s7", 1],
    ],
  };
  function runMaintenance() {
    if (mode("maint") === "off") return;
    S.machines
      .filter((m) => m.stage !== "fuvar" && m.next < 60)
      .forEach((m) => {
        if (S.wos.some((w) => w.machine === m.id && w.status !== "Lezárva"))
          return;
        const kit = (WOKIT[m.id] || [["s4", 20]]).map(([sid, q]) => ({
          sid,
          q,
          ok: S.parts.find((x) => x.id === sid)!.qty >= q,
        }));
        const w = {
          id: "ML-" + ++SEQ.WO,
          machine: m.id,
          name: `${m.svcEvery} órás szerviz`,
          due: addDays(TODAY, Math.max(1, Math.floor(m.next / 8))),
          kit,
          hours: m.id === "TOR-01" ? 10 : 6,
          status: "Tervezett",
        };
        S.wos.unshift(w);
        log(
          "AI · Karbantartás-tervező",
          `Munkalap nyitva: ${m.name}, ${w.name}, ${ds(w.due)}; alkatrész ${kit.every((k) => k.ok) ? "lefoglalva" : "HIÁNYOS"}`,
          w.id,
        );
      });
  }
  function closeWO(id: string) {
    const w = S.wos.find((x) => x.id === id)!;
    const m = S.machines.find((x) => x.id === w.machine)!;
    if (w.kit.some((k) => S.parts.find((x) => x.id === k.sid)!.qty < k.q)) {
      toast("Hiányzó alkatrész: előbb rendelje meg.");
      return;
    }
    w.kit.forEach((k) => issuePart(k.sid, k.q, m.id));
    const lab = w.hours * ((720000 * 1.13) / 168);
    S.issues.push({
      t: now(),
      sid: "s4",
      qty: 0,
      machine: m.id,
      cost: lab,
      labor: true,
    });
    m.next = m.svcEvery;
    w.status = "Lezárva";
    log(
      "Gépszerelő (ember)",
      `Munkalap lezárva: ${m.name}, ${w.hours} óra szerelői munka (${ft(lab)})`,
      w.id,
    );
    toast("Munkalap lezárva, alkatrész és munkaóra a gépre terhelve.");
  }
  S.tank = [];
  function tankCheck(dip: number) {
    const s = S.parts.find((x) => x.id === "s1")!;
    const diff = dip - s.qty;
    const rel = diff / s.qty;
    S.tank.unshift({ t: now(), book: s.qty, dip, diff, rel });
    log(
      "AI · Raktáros",
      `Kúttartály mérés: ${fmt(dip)} l, könyvi ${fmt(s.qty)} l, eltérés ${fmt(diff)} l (${pct(rel)})`,
    );
    if (Math.abs(rel) > 0.01)
      approval(
        "inv",
        "tank",
        `Üzemanyag-eltérés — kúttartály`,
        `Pálcás mérés ${fmt(dip)} l, könyvi ${fmt(s.qty)} l (${pct(rel)}), a 1% tűrés felett`,
        "Javaslat: a kútautomata tankolási naplójának egyeztetése gépenként; ismétlődés esetén biztonsági kamera ellenőrzése",
      );
    else {
      s.qty = dip;
    }
  }

  /* ---- terv–tény, szimuláció ---- */
  const BUDGET: Record<string, number> = {
    kitermeles: 24.0e6,
    toro: 21.5e6,
    rakodas: 6.4e6,
    fuvar: 20.5e6,
    rezsi: 26.0e6,
    revenue: 150e6,
  };
  const SIM_DEFAULT = {
    diesel: 560,
    wage: 0,
    vol: 0,
    blast: 4200000,
    price: 0,
  };
  let SIM: Record<string, number> = { ...SIM_DEFAULT };
  function withSim<T>(fn: () => T): T {
    const bk = {
      d: S.diesel,
      st: S.staff.map((x) => x.gross),
      vol: JSON.parse(JSON.stringify(S.vol)) as State["vol"],
      oh: S.overhead.map((o) => o[2]),
      pr: S.products.map((p) => p.price),
    };
    S.diesel = SIM.diesel;
    S.staff.forEach((x, i) => (x.gross = bk.st[i] * (1 + SIM.wage / 100)));
    Object.keys(S.vol).forEach((k) => {
      S.vol[k][1] *= 1 + SIM.vol / 100;
      S.vol[k][2] *= 1 + SIM.vol / 100;
    });
    S.overhead[0][2] = SIM.blast;
    S.products.forEach(
      (p, i) => (p.price = Math.round(bk.pr[i] * (1 + SIM.price / 100))),
    );
    const fuelMach = S.machines.map((m) => m.fuel);
    S.machines.forEach((m) => (m.fuel *= 1 + SIM.vol / 100));
    try {
      return fn();
    } finally {
      S.diesel = bk.d;
      S.staff.forEach((x, i) => (x.gross = bk.st[i]));
      S.vol = bk.vol;
      S.overhead.forEach((o, i) => (o[2] = bk.oh[i]));
      S.products.forEach((p, i) => (p.price = bk.pr[i]));
      S.machines.forEach((m, i) => (m.fuel = fuelMach[i]));
    }
  }
  function setSim(k: string, v: string) {
    SIM[k] = +v;
    render();
  }
  function resetSim() {
    SIM = { ...SIM_DEFAULT };
    render();
  }
  function fileInquiry(
    name: string,
    text: string,
    from: string,
    channel = "E-mail csatolmány",
  ) {
    const inq: Inquiry = {
      id: "INQ-" + ++SEQ.INQ,
      channel,
      from,
      name: "",
      subject: name,
      received: now(),
      status: "Új",
      raw: text.slice(0, 8000),
    };
    S.inquiries.unshift(inq);
    processInquiry(inq);
    ui.sel.inq = inq.id;
    render();
    toast(`Beolvasva: ${name}`);
  }
  function closeWoClick(id: string) {
    closeWO(id);
    render();
  }
  function submitTransfer(pid: string, a: string, b: string, q: number) {
    if (a === b) toast("A két depó nem lehet azonos.");
    else if (transfer(pid, a, b, q)) toast("Átszállítás könyvelve.");
    render();
  }
  function submitSurvey(depot: string, pid: string, m3: number) {
    const sv = survey(depot, pid, m3, "Drónos felmérés");
    toast(
      sv.status === "Egyezik"
        ? "Egyezik a könyvi készlettel."
        : "Eltérés: helyesbítés jóváhagyásra küldve.",
    );
    render();
  }
  function submitTank(l: number) {
    tankCheck(l);
    toast("Tartály egyeztetve.");
    render();
  }

  /* ---- Ügyfélportál ---- */
  ui.sel.portal = "c1";
  function setPortalClient(id: string) {
    ui.sel.portal = id;
    render();
  }
  function portalAccept(qid: string) {
    const o = quoteToOrder(qid)!;
    log("Vevő (portál)", `Ajánlat elfogadva a portálon`, qid);
    render();
    toast(`Megrendelés létrejött: ${o.id}`);
  }
  function portalReorder(oid: string) {
    const o = S.orders.find((x) => x.id === oid)!;
    const c = C(o.clientId)!;
    const inq: Inquiry = {
      id: "INQ-" + ++SEQ.INQ,
      channel: "Vevői portál",
      from: c.email,
      name: c.name,
      subject: "Újrarendelés a portálon",
      received: now(),
      status: "Új",
      raw: `Újrarendelés (${o.id} alapján)\n${o.lines.map((l) => `${fmt(l.qty)} t ${P(l.pid).aliases[0].toUpperCase()}`).join("\n")}\nCím: ${o.zip} ${o.city} ${o.addr || ""}\nKért időpont: ${iso(addDays(TODAY, 5)).replace(/-/g, ".")}.`,
    };
    S.inquiries.unshift(inq);
    processInquiry(inq);
    render();
    toast(`Újrarendelés: ${inq.status}`);
  }

  /* ---- jóváhagyások kiegészítése ---- */
  {
    const _decide = decide;
    decide = function (id, ok) {
      const a = S.approvals.find((x) => x.id === id)!;
      if (ok && a.kind === "inv") {
        if (a.refId === "tank") {
          const s = S.parts.find((x) => x.id === "s1")!;
          s.qty = S.tank[0].dip;
          log("Tulajdonos", "Üzemanyag-készlet helyesbítve a mért értékre");
        } else {
          const sv = S.surveys.find((x) => x.id === a.refId)!;
          move(
            TODAY,
            sv.pid,
            sv.depot,
            sv.diff,
            "helyesbítés (felmérés)",
            sv.id,
          );
          sv.status = "Helyesbítve";
        }
      }
      if (ok && a.kind === "dun") {
        const c = S.clients.find(
          (x) => x.name === a.title.replace("Szállítási zárlat — ", ""),
        );
        if (c) c.hold = true;
        log("Tulajdonos", `Szállítási zárlat elrendelve: ${c && c.name}`);
      }
      _decide(id, ok);
    };
  }

  /* ---- napi futtatás a seed után ---- */
  {
    const _seed = seed;
    seed = function () {
      _seed();
      const q: Quote = {
        id: "A-2026-79",
        clientId: "c3",
        clientName: "Balaton-Mélyép Kft.",
        zip: "8600",
        city: "Siófok",
        addr: "Ipari park 4.",
        date: addDays(TODAY, 4),
        pr: priceEngine({
          clientId: "c3",
          lines: [{ pid: "p7", qty: 400 }],
          zip: "8600",
        }),
        created: addDays(TODAY, -4),
        valid: addDays(TODAY, 10),
        status: "Kiküldve",
      };
      S.quotes.push(q);
      const q2: Quote = {
        id: "A-2026-74",
        clientId: "c2",
        clientName: "Fehérvári Útépítő Kft.",
        zip: "8000",
        city: "Székesfehérvár",
        addr: "Palotai út 9.",
        date: addDays(TODAY, 2),
        pr: priceEngine({
          clientId: "c2",
          lines: [{ pid: "p4", qty: 180 }],
          zip: "8000",
        }),
        created: addDays(TODAY, -11),
        valid: addDays(TODAY, 3),
        status: "Kiküldve",
      };
      S.quotes.push(q2);
      syncPayments();
      runFollowups();
      runCollections();
      runMaintenance();
      survey("CSU-1", "p5", 2550, "Drónos felmérés (szept. 30.)");
      S.audit.sort((a, b) => msBetween(b.t, a.t));
    };
  }

  /* ================= 3. KÖR: TERMELÉS, MINŐSÉG ================= */
  S.shifts = [];
  S.lab = [];
  const RECIPE: Record<string, Record<string, number>> = {
    "TOR-01 + OSZT-01 · osztályozott frakciók": {
      p4: 0.276,
      p9: 0.118,
      p10: 0.171,
      p11: 0.335,
      veszt: 0.1,
    },
    "TOR-01 · Z 0/22 keverék": { p1: 0.88, p3: 0.04, veszt: 0.08 },
    "TOR-01 · durva törés": { p2: 0.55, p6: 0.18, p7: 0.17, veszt: 0.1 },
    "Csúcsoshegy · osztályozás nélkül": { p5: 0.92, veszt: 0.08 },
  };
  const SITE_OF: Record<string, string> = {
    "TOR-01 · Z 0/22 keverék": "POL",
    "TOR-01 + OSZT-01 · osztályozott frakciók": "POL",
    "TOR-01 · durva törés": "POL",
    "Csúcsoshegy · osztályozás nélkül": "CSU",
  };
  function postShift(
    recipe: string,
    inT: number,
    hours: number,
    who: string,
    silent?: boolean,
  ) {
    const r = RECIPE[recipe];
    const out: { pid: string; t: number }[] = [];
    Object.entries(r).forEach(([pid, sh]) => {
      if (pid === "veszt" || !sh) return;
      const t = Math.round(inT * sh);
      move(TODAY, pid, P(pid).depot, t, "gyártás", `MŰ-${S.shifts.length + 1}`);
      out.push({ pid, t });
    });
    const sh = {
      id: "MŰ-" + (S.shifts.length + 1),
      date: new Date(TODAY),
      recipe,
      site: SITE_OF[recipe],
      inT,
      hours,
      who,
      out,
      loss: inT * r.veszt,
      tph: inT / hours,
    };
    S.shifts.unshift(sh);
    const T1 = S.machines.find((m) => m.id === "TOR-01")!;
    if (recipe.startsWith("TOR-01")) {
      T1.next = Math.max(0, T1.next - hours);
    }
    log(
      who,
      `Műszak könyvelve: ${fmt(inT)} t feladás → ${out.map((o) => tn(o.t) + " " + P(o.pid).name).join(", ")}`,
      sh.id,
    );
    if (sh.tph < 180 && recipe.startsWith("TOR-01"))
      log(
        "AI · Leltár-egyeztető",
        `Alacsony törőteljesítmény: ${fmt(sh.tph)} t/óra (terv 220 t/óra) — a törőpofa kopását ellenőrizni`,
        sh.id,
      );
    if (!silent) runMaintenance();
    return sh;
  }
  function labSample(pid: string, pass: boolean, note: string) {
    const x = {
      id: "LAB-" + (S.lab.length + 101),
      date: new Date(TODAY),
      pid,
      pass,
      note,
    };
    S.lab.unshift(x);
    if (!pass) {
      const p = P(pid);
      p.qhold = true;
      log(
        "Minőségügy (ember)",
        `Nem megfelelő vizsgálat: ${p.name} — ${note}. A termék zárolva, az árazó és a fuvarszervező nem ad ki belőle.`,
        x.id,
      );
      approval(
        "inv",
        x.id,
        `Minőségi zárolás — ${p.name}`,
        `Szemeloszlás-vizsgálat nem felel meg: ${note}`,
        "Javaslat: a depó átosztályozása M2 földműanyagba, vagy újratörés; a CE-teljesítménynyilatkozat szerinti szállítás addig szünetel",
      );
    } else {
      P(pid).qhold = false;
    }
  }
  {
    const _pe = priceEngine;
    priceEngine = function (a) {
      const r = _pe(a);
      a.lines.forEach((l) => {
        if (P(l.pid).qhold)
          r.flags.push({
            lvl: "bad",
            t: `${P(l.pid).name}: minőségi zárolás alatt — nem szállítható`,
          });
      });
      return r;
    };
  }
  function submitShift(recipe: string, inT: number, hours: number) {
    postShift(recipe, inT, hours, "Törőkezelő (ember)");
    toast("Műszak könyvelve, a depók készlete nőtt.");
    render();
  }
  function submitLab(pid: string, pass: boolean, note: string) {
    labSample(pid, pass, note);
    toast(pass ? "Rögzítve." : "Termék zárolva.");
    render();
  }
  {
    const _seed3 = seed;
    seed = function () {
      _seed3();
      postShift(
        "TOR-01 + OSZT-01 · osztályozott frakciók",
        1760,
        8,
        "Törőkezelő (ember)",
        true,
      );
      postShift(
        "Csúcsoshegy · osztályozás nélkül",
        2400,
        9,
        "Bányamester (ember)",
        true,
      );
      ["p1", "p2", "p3", "p4", "p5"].forEach((p) =>
        labSample(p, true, "EN 933-1 szerint megfelel"),
      );
      S.audit.sort((a, b) => msBetween(b.t, a.t));
    };
  }
  {
    const _decide3 = decide;
    decide = function (id, ok) {
      const a = S.approvals.find((x) => x.id === id);
      if (a && a.kind === "inv" && a.refId.startsWith("LAB-")) {
        if (ok) {
          const x = S.lab.find((l) => l.id === a.refId)!;
          log("Tulajdonos", `Minőségi intézkedés jóváhagyva: ${P(x.pid).name}`);
        }
        a.status = ok ? "Jóváhagyva" : "Elutasítva";
        render();
        return toast("Rögzítve.");
      }
      _decide3(id, ok);
    };
  }

  /* ================= 4. KÖR: FUVARSZERVEZÉS ================= */
  S.trucks = round4Trucks();
  S.machines.push(...round4Machines());
  S.drivers = round4Drivers();
  S.leave = round4Leave();
  /* Szállítási címek korlátozásai */
  interface AddrRule {
    m: RegExp;
    zone: string;
    needPermit?: boolean;
    euro?: string;
    maxGross?: number;
    tip?: string;
    note: string;
  }
  const ADDRRULE: AddrRule[] = [
    {
      m: /budapest|^1\d{3}$/i,
      zone: "Budapest",
      needPermit: true,
      euro: "EURO VI",
      note: "Budapest: 12 t felett behajtási engedély (P+), EURO VI",
    },
    {
      m: /siófok|8600/i,
      zone: "Siófok belterület",
      maxGross: 32,
      note: "Siófok, Fő utca: 32 t össztömeg-korlátozás (csak 4 tengelyes)",
    },
    {
      m: /seregélyesi/i,
      zone: "Székesfehérvár",
      tip: "3 oldalra",
      note: "Seregélyesi út: szűk lerakó, oldalra billentés szükséges",
    },
  ];
  function addrRules(o: { zip?: string; city?: string; addr?: string }) {
    const key = `${o.zip} ${o.city || ""} ${o.addr || ""}`;
    return ADDRRULE.filter((r) => r.m.test(key) || r.m.test(o.zip || ""));
  }
  const isLeave = (d: Driver, date: Date) =>
    S.leave.find(
      (l) => l.d === d.id && iso(date) >= l.from && iso(date) <= l.to,
    );
  const DR = (id: string | null | undefined) =>
      S.drivers.find((d) => d.id === id)!,
    TR = (id: string | null | undefined) => S.trucks.find((t) => t.id === id)!;
  const truckFtKm = (t: Truck) =>
    memo(`ftkm|${t.id}`, () => {
      const cm = costModel();
      return Math.round(
        cm.ftPerKm * (t.cons / 34) * (t.euro === "EURO V" ? 1.06 : 1),
      );
    });
  /* időmodell: rakodás 20 perc, lerakás 15 perc, oda 52 km/h, vissza üresen 58 km/h */
  function tripTimes(f: Transport) {
    const o = S.orders.find((x) => x.id === f.order);
    const km = f.km || distKm(o ? o.zip : "8000");
    const drive = km / 52 + km / 58;
    return { km, drive, dur: 0.33 + 0.25 + drive };
  }
  function dayTrips(date: Date, filter?: (f: Transport) => boolean) {
    return S.transports.filter(
      (f) =>
        f.status !== "Törölve" &&
        iso(f.date) === iso(date) &&
        (!filter || filter(f)),
    );
  }
  function weekDrive(d: Driver, date: Date, exclude?: string) {
    const m = mondayOf(date),
      cur = mondayOf(TODAY);
    let base = 0;
    if (iso(m) === iso(cur)) base = d.weekH;
    else if (m > cur) {
      base = 0;
    }
    for (let x = new Date(m); iso(x) < iso(date); x = addDays(x, 1)) {
      if (iso(x) >= iso(TODAY)) base += driverDay(d.id, x, exclude).drive;
    }
    return base;
  }
  function ext10Count(d: Driver, date: Date, exclude?: string) {
    const m = mondayOf(date);
    let n = 0;
    for (let x = new Date(m); iso(x) < iso(date); x = addDays(x, 1))
      if (driverDay(d.id, x, exclude).drive > 9) n++;
    return n;
  }
  // Read-only memo, active only while suggest() evaluates pairs (no state changes in between).
  let readMemo: Map<string, unknown> | null = null;
  function memo<T>(key: string, fn: () => T): T {
    if (!readMemo) return fn();
    if (!readMemo.has(key)) readMemo.set(key, fn());
    return readMemo.get(key) as T;
  }
  function driverDay(dId: string, date: Date, exclude?: string) {
    return memo(`dd|${dId}|${iso(date)}|${exclude}`, () =>
      driverDayRaw(dId, date, exclude),
    );
  }
  function driverDayRaw(dId: string, date: Date, exclude?: string) {
    const ts = dayTrips(date, (f) => f.driverId === dId && f.id !== exclude);
    return {
      drive: ts.reduce((a, f) => a + (f.drive || 0), 0),
      work: ts.reduce((a, f) => a + (f.dur || 0), 0),
      end: ts.reduce((m, f) => Math.max(m, (f.start || 6) + (f.dur || 0)), 6),
      n: ts.length,
    };
  }
  function truckDay(tId: string, date: Date, exclude?: string) {
    return memo(`td|${tId}|${iso(date)}|${exclude}`, () =>
      truckDayRaw(tId, date, exclude),
    );
  }
  function truckDayRaw(tId: string, date: Date, exclude?: string) {
    const ts = dayTrips(date, (f) => f.truck === tId && f.id !== exclude);
    return {
      work: ts.reduce((a, f) => a + (f.dur || 0), 0),
      end: ts.reduce((m, f) => Math.max(m, (f.start || 6) + (f.dur || 0)), 6),
      n: ts.length,
      km: ts.reduce((a, f) => a + (f.km || 0) * 2, 0),
    };
  }
  /* Javaslatmotor: kemény feltételek + költség-pontszám */
  function evaluate(f: Transport, t: Truck, d: Driver) {
    const o: Partial<Order> = S.orders.find((x) => x.id === f.order) || {};
    const tt = tripTimes(f);
    const hard: string[] = [],
      soft: string[] = [];
    let cost = 0;
    const date = f.date;
    const rules = addrRules(o);
    if (t.cap < f.planned)
      hard.push(`teherbírás ${t.cap} t < ${fmt(f.planned, 1)} t`);
    rules.forEach((r) => {
      if (r.maxGross && parseFloat(t.gross) > r.maxGross)
        hard.push(`${r.zone}: max. ${r.maxGross} t össztömeg`);
      if (r.needPermit && !/budapest/i.test(t.permit))
        hard.push(`${r.zone}: nincs behajtási engedély`);
      if (r.euro && t.euro !== r.euro)
        hard.push(`${r.zone}: ${r.euro} szükséges`);
      if (r.tip && t.tip !== r.tip)
        hard.push(`lerakó: ${r.tip} billentés szükséges`);
    });
    if (t.mot < iso(date)) hard.push("lejárt műszaki vizsga");
    const wo =
      S.wos &&
      S.wos.find(
        (w) =>
          w.status !== "Lezárva" &&
          S.machines.find((m) => m.id === w.machine) &&
          w.machine === t.id &&
          iso(w.due) === iso(date),
      );
    if (wo) hard.push("szervizen ezen a napon");
    if (date.getDay() === 0) hard.push("vasárnapi kamionstop (7,5 t felett)");
    if (d.lic === "C" && t.type !== "4 tengelyes billencs")
      hard.push(`${d.name}: C kategória, CE kell`);
    if (!d.skills.includes(t.type)) {
      soft.push(`nem gyakorlott ${t.type} típuson`);
      cost += 6000;
    }
    const lv = isLeave(d, date);
    if (lv) hard.push(`${d.name}: ${lv.kind.toLowerCase()}`);
    if (d.avail === "Betegszabadság") hard.push(`${d.name}: betegszabadság`);
    if (d.card < iso(date)) hard.push("lejárt sofőrkártya");
    if (d.gki < iso(date)) hard.push("lejárt GKI");
    if (
      /tiltva/.test(d.custPref) &&
      d.custPref.startsWith((f.clientName || "").split(" ")[0])
    )
      hard.push(`${d.name}: ügyfél-tiltás`);
    const dd = driverDay(d.id, date, f.id),
      td = truckDay(t.id, date, f.id);
    const start = Math.max(f.prefStart || 6, dd.end, td.end);
    let dur = tt.dur;
    const contBreak = dd.drive + tt.drive > 4.5 && dd.drive <= 4.5;
    if (contBreak) {
      dur += 0.75;
      soft.push("45 perces szünet beiktatva (4,5 h vezetés)");
    }
    const dayLimit = d.avail === "Csak délelőtt" ? 13 : 6 + d.maxDay;
    const prev = driverDay(d.id, addDays(date, -1));
    const restH = prev.n ? start + 24 - prev.end : 99;
    if (restH < 9)
      hard.push(
        `napi pihenő ${fmt(restH, 1)} h < 9 h (előző nap ${fmtH(prev.end)}-ig dolgozott)`,
      );
    else if (restH < 11)
      soft.push(`csökkentett napi pihenő (${fmt(restH, 1)} h)`);
    const dTot = dd.drive + tt.drive;
    if (dTot > 10)
      hard.push(`napi vezetési idő túllépés (${fmt(dTot, 1)} h > 10 h)`);
    else if (dTot > 9) {
      if (ext10Count(d, date, f.id) >= 2)
        hard.push(
          `napi vezetési idő ${fmt(dTot, 1)} h — a heti 2 db 10 órás hosszabbítás elfogyott`,
        );
      else soft.push("10 órás hosszabbítás (heti 2-ből)");
    }
    const wk = weekDrive(d, date, f.id) + dTot;
    if (start + dur > dayLimit)
      hard.push(`munkaidő-keret: ${fmtH(start + dur)} > ${fmtH(dayLimit)}`);
    if (wk > 56) hard.push(`heti vezetési idő ${fmt(wk, 1)} h > 56 h`);
    const prevWk =
      iso(mondayOf(date)) === iso(mondayOf(TODAY))
        ? d.fortH - d.weekH
        : iso(addDays(mondayOf(date), -7)) === iso(mondayOf(TODAY))
          ? weekDrive(d, addDays(mondayOf(date), -1)) +
            driverDay(d.id, addDays(mondayOf(date), -1)).drive
          : 0;
    if (prevWk + wk > 90)
      hard.push(`kéthetes vezetési idő ${fmt(prevWk + wk, 1)} h > 90 h`);
    const ftkm = truckFtKm(t);
    cost += tt.km * 2 * ftkm;
    const empty = (t.cap - f.planned) / t.cap;
    if (empty > 0.1) {
      cost += empty * tt.km * 2 * ftkm * 0.8;
      soft.push(`kihasználtság ${pct(f.planned / t.cap)}`);
    }
    if (dd.work + dur > 8) {
      const ot = Math.min(dur, dd.work + dur - 8);
      cost += ot * d.rate * 0.5;
      soft.push(`${fmt(ot, 1)} h túlóra`);
      if (d.ot + ot > d.otCap) {
        cost += 20000;
        soft.push("havi túlóra-keret közel");
      }
    }
    if (t.fuel < 25) {
      cost += 4000;
      soft.push("alacsony üzemanyagszint — tankolás 20 perc");
    }
    if (t.home !== S.products.find((p) => p.id === f.pid)!.depot.slice(0, 3)) {
      cost += 18 * 2 * ftkm;
      soft.push("állás a másik bányában — 18 km üresjárat");
    }
    if (
      d.custPref &&
      /előnyben|helyismeret/.test(d.custPref) &&
      d.custPref.startsWith((f.clientName || "").split(" ")[0])
    ) {
      cost -= 5000;
      soft.push("ügyfél-preferencia ✓");
    }
    cost += (90 - d.eco) * 120;
    cost += Math.max(0, start - 7) * 2200;
    if (start + dur > 16) cost += (start + dur - 16) * 3000;
    const avgWork =
      S.drivers.reduce((a, x) => a + driverDay(x.id, date).work, 0) /
      S.drivers.length;
    cost += Math.max(0, dd.work - avgWork) * 900;
    return {
      t,
      d,
      ok: !hard.length,
      hard,
      soft,
      cost: Math.round(cost),
      start,
      dur,
      drive: tt.drive,
      km: tt.km,
      end: start + dur,
      score: 0,
    };
  }
  type Evaluation = ReturnType<typeof evaluate>;
  function suggest(f: Transport, n = 3) {
    const all: Evaluation[] = [];
    readMemo = new Map();
    try {
      S.trucks.forEach((t) =>
        S.drivers.forEach((d) => all.push(evaluate(f, t, d))),
      );
    } finally {
      readMemo = null;
    }
    const ok = all.filter((x) => x.ok).sort((a, b) => a.cost - b.cost);
    const best = ok[0] ? ok[0].cost : 0;
    ok.forEach(
      (x) =>
        (x.score = Math.max(
          1,
          Math.round(100 - ((x.cost - best) / Math.max(best, 1)) * 100),
        )),
    );
    return {
      top: ok.slice(0, n),
      rejected: all.filter((x) => !x.ok),
      okCount: ok.length,
      total: all.length,
    };
  }
  function assign(
    f: Transport,
    tId: string,
    dId: string,
    by?: string,
    startOverride?: number | null,
  ) {
    const t = TR(tId),
      d = DR(dId);
    const ev = evaluate(f, t, d);
    const old = f.truck;
    f.truck = t.id;
    f.driverId = d.id;
    f.driver = d.name;
    f.start = startOverride != null ? startOverride : ev.start;
    f.dur = ev.dur;
    f.drive = ev.drive;
    f.km = ev.km;
    f.warn = ev.hard.slice();
    if (f.ekaer && f.ekaer.number && old && old !== t.id)
      ekaerModify(f, `rendszám → ${t.id}`);
    if (by)
      log(
        by,
        `${f.id}: ${t.id} · ${d.name} · ${fmtH(f.start)}–${fmtH(f.start + f.dur)}${ev.hard.length ? " (felülbírálva: " + ev.hard.join("; ") + ")" : ""}`,
        f.id,
      );
    return ev;
  }
  function autoAssignDay(
    date: Date,
    onlyUnaccepted = true,
    moveOn = false,
    depth = 0,
  ): { ok: number; fail: number; moved: number } {
    const ts = dayTrips(
      date,
      (f) =>
        f.status === "Javasolt" ||
        (!onlyUnaccepted && f.status === "Tervezett"),
    ).sort(
      (a, b) =>
        (a.prefStart || 6) - (b.prefStart || 6) || b.planned - a.planned,
    );
    ts.forEach((f) => {
      f.driverId = null;
      f.truck = null;
      f.start = null;
    });
    let ok = 0,
      fail = 0;
    const moved: Transport[] = [];
    ts.forEach((f) => {
      const s = suggest(f, 1);
      if (s.top[0]) {
        assign(f, s.top[0].t.id, s.top[0].d.id);
        f.warn = [];
        ok++;
      } else if (moveOn && depth < 4) {
        let nd = addDays(f.date, 1);
        if (nd.getDay() === 0) nd = addDays(nd, 1);
        f.date = nd;
        f.prefStart = 6;
        moved.push(f);
        fail++;
      } else {
        f.warn = ["nincs szabályos kiosztás — áttenni másik napra"];
        fail++;
      }
    });
    if (moved.length) {
      log(
        "AI · Fuvarszervező",
        `${moved.length} forduló kapacitás hiányában a következő munkanapra téve`,
      );
      const nds = [...new Set(moved.map((f) => iso(f.date)))];
      nds.forEach((x) =>
        autoAssignDay(new Date(x + "T09:00"), true, true, depth + 1),
      );
    }
    return { ok, fail, moved: moved.length };
  }
  let acceptTrip = function (f: Transport, by?: string): boolean {
    if (!f.truck || !f.driverId) return false;
    f.status = "Tervezett";
    if (f.ekaer.required && !f.ekaer.number) ekaerSubmit(f.id, true);
    log(
      by || "Diszpécser (ember)",
      `Fuvar elfogadva, a sofőr appjába elküldve`,
      f.id,
    );
    return true;
  };
  /* új planTransports: fordulók, javaslat, diszpécseri elfogadásra */
  planTransports = function (oid) {
    const o = S.orders.find((x) => x.id === oid)!;
    let made = 0;
    const rules = addrRules(o);
    const maxCap = rules.some((r) => r.maxGross) ? 19 : 25;
    let day = new Date(o.date);
    if (day.getDay() === 0) day = addDays(day, 1);
    let perDay = 0;
    o.lines.forEach((l) => {
      let rest = l.qty - (o.planned[l.pid] || 0) - (o.delivered[l.pid] || 0);
      while (rest > 0.01) {
        const t = Math.min(maxCap, rest);
        if (perDay >= (maxCap < 25 ? 8 : 10)) {
          day = addDays(day, 1);
          if (day.getDay() === 0) day = addDays(day, 1);
          perDay = 0;
        }
        const f: Transport = {
          id: nid("F", (n) => "F-2026-" + n),
          order: o.id,
          clientId: o.clientId,
          clientName: o.clientName,
          pid: l.pid,
          planned: t,
          truck: null,
          driver: "",
          driverId: null,
          date: new Date(day),
          prefStart: 6 + perDay * 0.4,
          status: "Javasolt",
          net: null,
          depot: P(l.pid).depot,
          ekaer: ekaerCheck(o, l.pid, t),
          km: distKm(o.zip),
        };
        S.transports.unshift(f);
        o.planned[l.pid] = (o.planned[l.pid] || 0) + t;
        rest -= t;
        made++;
        perDay++;
      }
    });
    const days = [
      ...new Set(
        S.transports
          .filter((f) => f.order === oid && f.status === "Javasolt")
          .map((f) => iso(f.date)),
      ),
    ];
    days.forEach((d) => autoAssignDay(new Date(d + "T09:00"), true, true));
    o.status = "Ütemezve";
    log(
      "AI · Fuvarszervező",
      `${made} forduló, ${days.length} napra; kiosztási javaslat kész, diszpécseri elfogadásra vár`,
      o.id,
    );
    return made;
  };

  /* ---- nézet állapota ---- */
  const DISP = {
    tab: "day",
    date: new Date(TODAY),
    week: new Date(TODAY),
    sel: null as string | null,
    rows: "truck",
  };
  function dispTab(k: string) {
    DISP.tab = k;
    render();
  }
  function dispDay(n: number) {
    DISP.date = addDays(DISP.date, n);
    DISP.sel = null;
    render();
  }
  function dispSetDay(v: string) {
    DISP.date = new Date(v + "T09:00");
    DISP.sel = null;
    render();
  }
  function dispSelect(id: string) {
    DISP.sel = id;
    render();
  }
  function dispGoto(d: string, id?: string) {
    DISP.date = new Date(d + "T09:00");
    DISP.tab = "day";
    if (id) DISP.sel = id;
    render();
  }
  function dispWeek(n: number) {
    DISP.week = addDays(DISP.week, n);
    render();
  }
  function dispPick(fid: string, tId: string, dId: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    assign(f, tId, dId, "Diszpécser (ember)");
    f.warn = [];
    render();
    toast("Kiosztva. Elfogadás után megy a sofőrnek.");
  }
  // X.dacc of round 4, replaced by the contract-aware version below (round 4, szerződés).
  let dispAccept = function (fid: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    if (f.warn && f.warn.length && !f._ovr) {
      f._ovr = true;
      toast(
        "Ütközés van. Kattintson újra az elfogadáshoz (felülbírálás, naplózva).",
      );
      return;
    }
    acceptTrip(f);
    render();
    toast("Elfogadva, EKÁER és sofőr app frissítve.");
  };
  function dispAcceptAll() {
    const ts = dayTrips(
      DISP.date,
      (f) => f.status === "Javasolt" && !(f.warn && f.warn.length),
    );
    ts.forEach((f) => acceptTrip(f, "Diszpécser (ember)"));
    render();
    toast(`${ts.length} fuvar elfogadva.`);
  }
  function dispAuto() {
    const r = autoAssignDay(DISP.date);
    log(
      "AI · Fuvarszervező",
      `Napi kiosztás újraszámolva: ${r.ok} kiosztva, ${r.fail} nem osztható`,
    );
    render();
    toast(
      `${r.ok} fuvar kiosztva${r.fail ? ", " + r.fail + " nem osztható" : ""}.`,
    );
  }
  function dispSave(
    fid: string,
    v: {
      date: string;
      start: string;
      truck: string;
      driver: string;
      qty: string;
    },
  ) {
    const f = S.transports.find((x) => x.id === fid)!;
    const nd = new Date(v.date + "T09:00");
    const [hh, mm] = v.start.split(":").map(Number);
    const q = +v.qty;
    const o = S.orders.find((x) => x.id === f.order)!;
    if (q !== f.planned) {
      o.planned[f.pid] += q - f.planned;
      f.planned = q;
      f.ekaer = Object.assign(ekaerCheck(o, f.pid, q), {
        number: f.ekaer.number,
        status: f.ekaer.number
          ? f.ekaer.status
          : ekaerCheck(o, f.pid, q).status,
        job: f.ekaer.job,
      });
      if (f.ekaer.number) ekaerModify(f, `mennyiség ${tn(q)}`);
    }
    f.date = nd;
    const ev = assign(f, v.truck, v.driver, "Diszpécser (ember)", hh + mm / 60);
    DISP.date = nd;
    render();
    toast(
      ev.hard.length ? "Mentve, de szabályt sért: " + ev.hard[0] : "Mentve.",
    );
  }
  function dispRows(v: string) {
    DISP.rows = v;
    render();
  }
  function listTruck(fid: string, v: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    const ev = assign(
      f,
      v,
      f.driverId || S.drivers[0].id,
      "Diszpécser (ember)",
    );
    render();
    toast(ev.hard.length ? "Szabálysértés: " + ev.hard[0] : "Jármű módosítva.");
  }
  function listDriver(fid: string, v: string) {
    const f = S.transports.find((x) => x.id === fid)!;
    const ev = assign(f, f.truck || S.trucks[0].id, v, "Diszpécser (ember)");
    render();
    toast(ev.hard.length ? "Szabálysértés: " + ev.hard[0] : "Sofőr módosítva.");
  }
  function setResource(
    kind: "t" | "d",
    id: string,
    k: string,
    value: string,
    isNumber: boolean,
  ) {
    const o = (kind === "t" ? S.trucks : S.drivers).find(
      (x) => x.id === id,
    )! as unknown as Record<string, unknown> & {
      id?: string;
      name?: string;
    };
    o[k] = isNumber ? +value : value;
    log("Diszpécser (ember)", `${o.id || o.name}: ${k} = ${value}`);
    S.transports
      .filter((f) => f.status === "Javasolt" || f.status === "Tervezett")
      .forEach((f) => {
        if (f.truck && f.driverId)
          f.warn = evaluate(f, TR(f.truck), DR(f.driverId)).hard;
      });
    render();
    toast("Mentve; a tervek újraellenőrizve.");
  }
  function toggleLeave(dId: string, d: string) {
    const dr = DR(dId);
    const i = S.leave.findIndex((l) => l.d === dId && d >= l.from && d <= l.to);
    if (i >= 0) {
      S.leave.splice(i, 1);
    } else S.leave.push({ d: dId, from: d, to: d, kind: "Szabadság" });
    const date = new Date(d + "T09:00");
    const hit = dayTrips(
      date,
      (f) => f.driverId === dId && f.status !== "Lezárva",
    );
    hit.forEach((f) => {
      f.warn = evaluate(f, TR(f.truck), dr).hard;
    });
    log(
      "Diszpécser (ember)",
      `${dr.name}: ${i >= 0 ? "szabadság törölve" : "szabadság"} ${d}`,
    );
    render();
    toast(
      hit.length
        ? `${hit.length} fuvar érintett — futtassa újra a kiosztást.`
        : "Mentve.",
    );
  }
  function addTruck() {
    const n = S.trucks.length + 1;
    S.trucks.push({
      id: "ÚJ-" + n,
      name: "Új jármű",
      type: "4 tengelyes billencs",
      cap: 19,
      gross: "32 t / 4",
      vol: 16,
      tip: "hátra",
      cons: 32,
      fuel: 50,
      svcKm: 30000,
      mot: iso(addDays(TODAY, 365)),
      tacho: iso(addDays(TODAY, 90)),
      toll: "J4",
      euro: "EURO VI",
      permit: "",
      km: 0,
      home: "POL",
    });
    render();
  }
  function addDriver() {
    const n = S.drivers.length + 1;
    S.drivers.push({
      id: "D" + n,
      name: "Új sofőr " + n,
      lic: "CE",
      card: iso(addDays(TODAY, 900)),
      gki: iso(addDays(TODAY, 900)),
      weekH: 0,
      fortH: 0,
      restEnd: "05:00",
      maxDay: 12,
      ot: 0,
      otCap: 24,
      avail: "Elérhető",
      skills: "nyerges billencs",
      regions: "Fejér",
      custPref: "",
      eco: 80,
      rate: 2500,
      perTrip: 2300,
      home: "Polgárdi",
    });
    render();
  }
  function telemPos(t: Truck) {
    const tp = (S.telem || {})[t.id];
    return tp ? `${tp.place} · ${tp.speed} km/h` : "—";
  }
  function itsyncClick() {
    itrackSync();
    render();
    toast("iTrack: pozíció, km, üzemanyagszint, fogyasztás frissítve.");
  }
  /** Drag on the timeline (bindTimeline): new row key and start hour. */
  function dragTrip(fid: string, rowKey: string, hour: number) {
    const f = S.transports.find((x) => x.id === fid)!;
    const tId = DISP.rows === "truck" ? rowKey : f.truck || S.trucks[0].id,
      dId = DISP.rows === "truck" ? f.driverId || S.drivers[0].id : rowKey;
    const ev = assign(
      f,
      tId,
      dId,
      "Diszpécser (húzással)",
      Math.max(5, Math.min(18, hour)),
    );
    DISP.sel = f.id;
    render();
    toast(
      ev.hard.length
        ? "Áthelyezve, de szabályt sért: " + ev.hard[0]
        : `Áthelyezve: ${tId} · ${fmtH(f.start!)}`,
    );
  }

  /* ================= 5. KÖR: VALÓS LÉPTÉK (brief) — adatok ================= */
  /* 20 tehergépkocsi, 20 sofőr, 8 rakodógép-kezelő, 3 szerelő; valós frakciók */
  {
    const extraT: [
      string,
      string,
      string,
      number,
      string,
      number,
      string,
      number,
    ][] = [
      [
        "MPK-101",
        "MAN TGS 41.440 8×4 billencs",
        "4 tengelyes billencs",
        19,
        "32 t / 4",
        16,
        "3 oldalra",
        31.0,
      ],
      [
        "MPK-102",
        "MAN TGS 41.440 8×4 billencs",
        "4 tengelyes billencs",
        19,
        "32 t / 4",
        16,
        "3 oldalra",
        31.4,
      ],
      [
        "MPK-103",
        "Scania G450 + Schmitz billencs",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        34.1,
      ],
      [
        "MPK-104",
        "Scania G450 + Schmitz billencs",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        33.8,
      ],
      [
        "MPK-105",
        "Volvo FMX 500 + Kässbohrer",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        35.2,
      ],
      [
        "MPK-106",
        "Volvo FMX 460 8×4 billencs",
        "4 tengelyes billencs",
        19,
        "32 t / 4",
        16,
        "3 oldalra",
        32.0,
      ],
      [
        "MPK-107",
        "Mercedes Arocs 4142 8×4",
        "4 tengelyes billencs",
        19,
        "32 t / 4",
        16,
        "3 oldalra",
        31.6,
      ],
      [
        "MPK-108",
        "Mercedes Arocs 3346 + Meiller pótkocsi",
        "pótkocsis szerelvény",
        25,
        "40 t / 6",
        26,
        "3 oldalra",
        36.4,
      ],
      [
        "MPK-109",
        "DAF CF 480 + Wielton billencs",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        34.9,
      ],
      [
        "MPK-110",
        "DAF CF 480 + Wielton billencs",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        35.3,
      ],
      [
        "MPK-111",
        "Iveco S-Way + Schwarzmüller",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        34.4,
      ],
      [
        "MPK-112",
        "Renault T 480 + Schmitz",
        "nyerges billencs",
        25,
        "40 t / 5",
        24,
        "hátra",
        35.0,
      ],
      [
        "MPK-113",
        "MAN TGS 35.440 8×4 billencs",
        "4 tengelyes billencs",
        19,
        "32 t / 4",
        16,
        "3 oldalra",
        30.8,
      ],
      [
        "MPK-114",
        "Scania P410 8×4 billencs",
        "4 tengelyes billencs",
        19,
        "32 t / 4",
        16,
        "3 oldalra",
        31.9,
      ],
    ];
    extraT.forEach(([id, name, type, cap, gross, vol, tip, cons], i) => {
      S.trucks.push({
        id,
        name,
        type,
        cap,
        gross,
        vol,
        tip,
        cons,
        fuel: 30 + ((i * 17) % 60),
        svcKm: 4000 + ((i * 3700) % 26000),
        mot: iso(addDays(TODAY, 40 + i * 23)),
        tacho: iso(addDays(TODAY, 12 + i * 6)),
        toll: "J4",
        euro: i % 5 === 4 ? "EURO V" : "EURO VI",
        permit: i % 3 === 0 ? "Budapest P+ (12 t felett)" : "",
        km: 150000 + i * 21000,
        home: i % 4 === 3 ? "CSU" : "POL",
      });
      S.machines.push({
        id,
        name: `${name} (${id})`,
        stage: "fuvar",
        h: 150 + (i % 5) * 8,
        dep: 850000 + (i % 4) * 90000,
        fuel: 4600 + (i % 5) * 300,
        parts: 260000 + (i % 3) * 80000,
        next: 4000 + ((i * 3700) % 26000),
        svcEvery: 30000,
        km: 9200 + (i % 6) * 700,
        toll: 420000,
      });
    });
    S.trucks.forEach(
      (t) =>
        (t.tare =
          t.type === "4 tengelyes billencs"
            ? 12.6
            : t.type === "pótkocsis szerelvény"
              ? 14.4
              : 15.2),
    );
    const names = [
      "Bognár Ferenc",
      "Fekete István",
      "Lakatos Gyula",
      "Pintér Sándor",
      "Balogh Norbert",
      "Juhász Tibor",
      "Mészáros Dániel",
      "Simon Attila",
      "Farkas Róbert",
      "Papp Krisztián",
      "Takács József",
      "Szűcs Márk",
      "Oláh Gábor",
    ];
    names.forEach((n, i) =>
      S.drivers.push({
        id: "D" + (8 + i),
        name: n,
        lic: i % 4 === 2 ? "C" : "CE",
        card: iso(addDays(TODAY, 200 + i * 45)),
        gki: iso(addDays(TODAY, 90 + i * 60)),
        weekH: 14 + ((i * 7) % 30),
        fortH: 40 + ((i * 9) % 40),
        restEnd: "05:00",
        maxDay: 12,
        ot: (i * 5) % 20,
        otCap: 24,
        avail: i === 6 ? "Szabadság" : "Elérhető",
        skills:
          i % 4 === 2
            ? "4 tengelyes billencs"
            : "nyerges billencs, 4 tengelyes billencs, pótkocsis szerelvény",
        regions: i % 2 ? "Fejér, Veszprém" : "Fejér, Budapest",
        custPref: "",
        eco: 72 + ((i * 5) % 22),
        rate: 2450 + (i % 4) * 60,
        perTrip: 2300,
        home: [
          "Polgárdi",
          "Székesfehérvár",
          "Lepsény",
          "Füle",
          "Kisláng",
          "Enying",
        ].at(i % 6)!,
      }),
    );
    // termékek: a brief frakciói
    const p4 = S.products.find((p) => p.id === "p4")!;
    p4.name = "0/4 zúzalék (kőliszt-homok)";
    S.products.push(
      {
        id: "p9",
        name: "4/11 zúzalék",
        vtsz: "2517 10",
        price: 8200,
        factor: 1.6,
        depot: "POL-2",
        min: 300,
        src: "own",
        aliases: ["4/11"],
      },
      {
        id: "p10",
        name: "11/22 zúzalék",
        vtsz: "2517 10",
        price: 8600,
        factor: 1.5,
        depot: "POL-2",
        min: 300,
        src: "own",
        aliases: ["11/22"],
      },
      {
        id: "p11",
        name: "22/63 zúzottkő",
        vtsz: "2517 10",
        price: 6800,
        factor: 1.1,
        depot: "POL-2",
        min: 500,
        src: "own",
        aliases: ["22/63"],
      },
    );
    // 20 autóhoz igazított volumen (szeptember): ×1,45
    Object.keys(S.vol).forEach((k) => {
      const v = S.vol[k];
      S.vol[k] = [
        Math.round(v[0] * 1.2),
        Math.round(v[1] * 1.45),
        Math.round(v[2] * 1.45),
      ];
    });
    Object.assign(S.vol, {
      p9: [900, 2600, 2450],
      p10: [700, 1900, 1800],
      p11: [1400, 4300, 4100],
    });
    S.pnl.rev = S.pnl.rev.map((v) => +(v * 1.62).toFixed(1));
    S.pnl.cost = S.pnl.cost.map((v) => +(v * 1.62).toFixed(1));
    // létszám a brief szerint (40 fő)
    S.staff = [
      { name: "Dózerkezelő", stage: "kitermeles", gross: 690000, h: 176 },
      {
        name: "Rakodógép-kezelő, törő (2 fő)",
        stage: "toro",
        gross: 1290000,
        h: 340,
      },
      {
        name: "Rakodógép-kezelő, rakodás (5 fő)",
        stage: "rakodas",
        gross: 3250000,
        h: 880,
      },
      {
        name: "Gépkocsivezető (20 fő)",
        stage: "fuvar",
        gross: 12600000,
        h: 3700,
      },
      { name: "Szerelő (3 fő)", stage: "rezsi", gross: 2160000, h: 504 },
      { name: "Fuvarszervező", stage: "rezsi", gross: 720000, h: 168 },
      { name: "Irodavezető", stage: "rezsi", gross: 780000, h: 168 },
      { name: "EKÁER/admin (2 fő)", stage: "rezsi", gross: 1040000, h: 336 },
      { name: "Könyvelő", stage: "rezsi", gross: 690000, h: 168 },
      {
        name: "Vevőkezelés, bányai admin (2 fő)",
        stage: "rezsi",
        gross: 1040000,
        h: 336,
      },
      { name: "Hulladéklerakó-kezelő", stage: "rezsi", gross: 480000, h: 168 },
      { name: "Menedzsment", stage: "rezsi", gross: 1300000, h: 168 },
    ];
    S.overhead = S.overhead.filter((o) => !/dömper|kotró/i.test(o[0]));
    Object.keys(BUDGET).forEach(
      (k) => (BUDGET[k] = Math.round(BUDGET[k] * 1.55)),
    );
    // kompatibilis gépek
    const ALL = S.machines.filter((m) => m.stage !== "fuvar").map((m) => m.id),
      RAK = ["RAK-01", "RAK-02", "RAK-03"];
    const CMP: Record<string, string[]> = {
      s1: ["minden gép és jármű"],
      s2: ["tehergépkocsik", ...RAK],
      s3: [...RAK, "DOZ-01", "TOR-01"],
      s4: ALL,
      s5: ALL,
      s6: ["TOR-01"],
      s7: ["OSZT-01"],
      s8: ["DOZ-01"],
      s9: RAK,
    };
    S.parts.forEach((p) => (p.compat = CMP[p.id] || ALL));
    if (RECIPE["TOR-01 + OSZT-01 · osztályozott frakciók"])
      SITE_OF["TOR-01 + OSZT-01 · osztályozott frakciók"] = "POL";
  }

  /* ================= 4. KÖR: SZERZŐDÉS, TIG, SOFŐR APP, IKTATÁS ================= */
  S.registry = [];
  SEQ.IK = 0;
  async function sha256(s: string) {
    try {
      return await env.sha256(s);
    } catch {
      let h = 0;
      for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
      return "fnv" + Math.abs(h).toString(16);
    }
  }
  function fileDoc(
    type: string,
    ref: string,
    title: string,
    content: string,
    by: string,
  ) {
    const no = "IK-2026-" + String(++SEQ.IK).padStart(4, "0");
    const r = { no, date: now(), type, ref, title, by, hash: "…" };
    S.registry.unshift(r);
    pending.push(
      sha256(content + "|" + no).then((h) => {
        r.hash = h;
        render();
      }),
    );
    log("Iktató", `${type} iktatva: ${no} — ${title}`, ref);
    return no;
  }
  /* ---- szerződés ---- */
  S.ctemplate = CONTRACT_TEMPLATE;
  S.contracts = [];
  SEQ.SZE = 0;
  function contractText(c: {
    id: string;
    order: string;
    template: string;
    created: Date;
  }) {
    const o = S.orders.find((x) => x.id === c.order)!;
    const q: Pick<Quote, "pr"> = S.quotes.find((x) => x.id === o.quote) || {
      pr: {
        lines: [],
        freightNet: 0,
        net: 0,
        gross: 0,
        freightPerT: 0,
      } as unknown as PriceResult,
    };
    const cl: Partial<Client> = C(o.clientId) || {};
    const map: Record<string, string> = {
      szerzodesszam: c.id,
      ajanlatszam: o.quote,
      megrendelesszam: o.id,
      vevo_nev: o.clientName,
      vevo_cim: cl.zip ? `${cl.zip} ${cl.city}` : "",
      vevo_adoszam: cl.tax || "magánszemély",
      szallitasi_cim: `${o.zip} ${o.city || ""} ${o.addr || ""}`.trim(),
      tetelek: q.pr.lines
        .map(
          (l) =>
            `  – ${l.name}: ${tn(l.qty)} × ${ft(l.unitNet)}/t = ${ft(l.net)}`,
        )
        .join("\n"),
      fuvar: `${ft(q.pr.freightPerT)}/t, összesen ${ft(q.pr.freightNet)}`,
      osszeg_netto: ft(q.pr.net),
      osszeg_brutto: ft(q.pr.gross),
      teljesitesi_idoszak: `${ds(o.date)} – ${ds(addDays(o.date, 21))}`,
      fizetesi_hatarido: cl.end
        ? "előre utalás vagy készpénz rakodáskor"
        : `számla kelte + ${cl.payDays} nap, átutalással`,
      datum: ds(c.created),
    };
    return c.template.replace(
      /\{\{(\w+)\}\}/g,
      (_, k: string) => map[k] ?? `{{${k}}}`,
    );
  }
  function createContract(o: Order) {
    if (S.contracts.some((c) => c.order === o.id)) return;
    const c = {
      id: "SZE-2026-" + String(++SEQ.SZE).padStart(3, "0"),
      order: o.id,
      clientId: o.clientId,
      clientName: o.clientName,
      created: new Date(TODAY),
      template: S.ctemplate,
      status: "Piszkozat",
      history: [] as [Date, string, string][],
      sent: undefined as Date | undefined,
    };
    S.contracts.unshift(c);
    c.history.push([
      now(),
      "AI · Szerződéskészítő",
      "Szerződés a sablonból, a megrendelés adataival",
    ]);
    if (mode("contract") === "auto") {
      c.status = "Kiküldve";
      c.sent = now();
      c.history.push([
        now(),
        "Rendszer",
        "E-mailben kiküldve, aláírási link a vevői portálon",
      ]);
      log(
        "AI · Szerződéskészítő",
        `Szerződés kiküldve aláírásra: ${c.id}`,
        o.id,
      );
    } else {
      approval(
        "contract",
        c.id,
        `Szerződés — ${o.clientName}`,
        "A házirend szerint a szerződést ember küldi ki",
        "Ellenőrizze a tételeket, majd hagyja jóvá a kiküldést",
      );
    }
    return c;
  }
  function signContract(
    c: State["contracts"][number],
    how: string,
    signer: string,
    sig: string,
  ) {
    c.status =
      how === "e" ? "Aláírva (elektronikusan)" : "Aláírt példány feltöltve";
    c.signed = now();
    c.signer = signer;
    c.sig = sig;
    c.how = how;
    c.history.push([
      now(),
      `Vevő (${signer})`,
      how === "e"
        ? "Elektronikusan aláírva a portálon"
        : "Aláírt, lefotózott példány feltöltve",
    ]);
    c.ik = fileDoc(
      "Szerződés",
      c.id,
      `${c.id} · ${c.clientName}`,
      contractText(c) + (sig || ""),
      how === "e" ? "Vevői portál" : "Feltöltés",
    );
    c.status = "Iktatva";
    c.history.push([now(), "Iktató", `Iktatószám: ${c.ik}`]);
  }
  S.agents.push(
    {
      id: "contract",
      name: "Szerződéskészítő",
      does: "Elfogadott ajánlatból sablon alapján szerződést készít, kiküldi, figyeli az aláírást, iktat.",
      mode: "auto",
    },
    {
      id: "tig",
      name: "Teljesítésigazoló",
      does: "A teljesített megrendelésből vagy elszámolási időszakból TIG-et készít, aláírásra küldi, elfogadás után indítja a számlát.",
      mode: "auto",
    },
  );
  PHASES.splice(3, 0, [
    "Szerződés",
    "Szerződéskészítő",
    "sablonból szerződés, kiküldés, aláírás-figyelés, iktatás",
    "szerződés nélküli első fuvar (házirend)",
  ]);
  PHASES.splice(9, 0, [
    "Teljesítésigazolás",
    "Teljesítésigazoló",
    "TIG a teljesített fordulókból, e-aláírás vagy fotó, iktatás",
    "vevői kifogás",
  ]);
  S.policy.requireContract = true;
  {
    const _q2o = quoteToOrder;
    quoteToOrder = function (qid) {
      const o = _q2o(qid);
      if (o) createContract(o);
      return o;
    };
  }
  {
    const _acc = acceptTrip;
    acceptTrip = function (f, by) {
      const c = S.contracts.find((x) => x.order === f.order);
      if (S.policy.requireContract && c && c.status !== "Iktatva" && !f._cOvr) {
        f.warn = [
          ...(f.warn || []).filter((w) => !/szerződés/.test(w)),
          "a szerződés még nincs aláírva",
        ];
        return false;
      }
      return _acc(f, by);
    };
  }
  dispAccept = function (fid) {
    const f = S.transports.find((x) => x.id === fid)!;
    const c = S.contracts.find((x) => x.order === f.order);
    if (c && c.status !== "Iktatva" && !f._cOvr) {
      f._cOvr = true;
      f.warn = [...(f.warn || []), "a szerződés még nincs aláírva"];
      render();
      toast(
        "A szerződés nincs aláírva. Újabb kattintás: elfogadás kivételként (naplózva).",
      );
      return;
    }
    if (
      f.warn &&
      f.warn.filter((w) => !/szerződés/.test(w)).length &&
      !f._ovr
    ) {
      f._ovr = true;
      toast(
        "Ütközés van. Kattintson újra az elfogadáshoz (felülbírálás, naplózva).",
      );
      return;
    }
    acceptTrip(f);
    render();
    toast("Elfogadva, EKÁER és sofőr app frissítve.");
  };

  /* ---- TIG ---- */
  S.tigs = [];
  SEQ.TIG = 0;
  function createTIG(oid: string, why?: string) {
    const o = S.orders.find((x) => x.id === oid)!;
    const fs = S.transports.filter(
      (f) => f.order === oid && f.status === "Lezárva" && !f.tig,
    );
    if (!fs.length) return null;
    const t = {
      id: "TIG-2026-" + String(++SEQ.TIG).padStart(3, "0"),
      order: oid,
      clientId: o.clientId,
      clientName: o.clientName,
      from: new Date(Math.min(...fs.map((f) => +f.date))),
      to: new Date(Math.max(...fs.map((f) => +f.date))),
      trips: fs.map((f) => f.id),
      created: now(),
      status: "Aláírásra vár",
      history: [
        [now(), "AI · Teljesítésigazoló", why || "TIG a lezárt fordulókból"],
      ] as [Date, string, string][],
    };
    fs.forEach((f) => (f.tig = t.id));
    S.tigs.unshift(t);
    log(
      "AI · Teljesítésigazoló",
      `${t.id} elkészült (${fs.length} forduló), aláírásra elküldve a vevőnek`,
      oid,
    );
    return t;
  }
  function tigLines(t: State["tigs"][number]) {
    const o = S.orders.find((x) => x.id === t.order)!;
    const fs = t.trips.map((id) => S.transports.find((f) => f.id === id)!);
    const rows = fs.map((f) => {
      const l = o.lines.find((x) => x.pid === f.pid)!;
      return {
        f,
        dn: S.docs.find((d) => d.id === f.dn),
        price: l.unitNet,
        net: f.net! * l.unitNet,
      };
    });
    const tons = fs.reduce((a, f) => a + f.net!, 0),
      prod = rows.reduce((a, r) => a + r.net, 0),
      fr = tons * (o.freightPerT || 0);
    const wmin = fs.reduce((a, f) => a + (f.wait || 0), 0),
      extra = Math.max(0, wmin - fs.length * 30);
    return {
      rows,
      tons,
      prod,
      fr,
      wait: (extra / 60) * 18000,
      total: prod + fr + (extra / 60) * 18000,
    };
  }
  function acceptTIG(
    t: State["tigs"][number],
    how: string,
    signer: string,
    sig: string,
  ) {
    t.status =
      how === "photo" ? "Elfogadva (aláírt fotó)" : "Elfogadva (e-aláírás)";
    t.signer = signer;
    t.sig = sig;
    t.signedAt = now();
    t.history.push([
      now(),
      signer,
      how === "photo"
        ? "Aláírt TIG fotója feltöltve"
        : how === "device"
          ? "Aláírva a sofőr tabletjén átvételkor"
          : "Elektronikusan elfogadva a portálon",
    ]);
    t.ik = fileDoc(
      "Teljesítésigazolás",
      t.id,
      `${t.id} · ${t.clientName}`,
      JSON.stringify(t.trips) + (sig || ""),
      signer,
    );
    if (mode("billing") !== "off") {
      invoiceOrder(t.order);
      t.history.push([now(), "AI · Számlázó", "Számla a TIG alapján"]);
    }
  }
  function onOrderComplete(o: Order) {
    createTIG(o.id, "A megrendelés teljesült — TIG az összes fordulóról");
  }
  function tigOk(f: Transport) {
    const t = S.tigs.find((x) => x.id === f.tig);
    return !!t && /^Elfogadva/.test(t.status);
  }

  /* ---- Sofőr app (átvétel, aláírás, fotó) ---- */
  const DRV = { id: "D1" };
  function setDriverApp(id: string) {
    DRV.id = id;
    render();
  }
  /** X.pod: sig and tsig are the canvas data URLs (null when the pad is empty). */
  function recordPod(
    fid: string,
    name: string,
    waitMin: string,
    sig: string | null,
    tsig: string | null,
  ) {
    const f = S.transports.find((x) => x.id === fid)!;
    if (!sig) {
      toast("Az átvevő aláírása hiányzik (vagy töltsön fel fotót).");
      return;
    }
    f.pod = {
      name,
      t: now(),
      img: sig,
      how: "e-aláírás a sofőr tabletjén",
      gps: "iTrack pozíció a lerakón",
    };
    f.wait = +waitMin || 0;
    const dn = S.docs.find((x) => x.id === f.dn);
    if (dn) {
      dn.pod = f.pod;
      dn.status2 = "Átvéve";
    }
    log(
      `Sofőr (${f.driver})`,
      `Átvétel rögzítve: ${f.pod.name}, várakozás ${f.wait} perc`,
      f.id,
    );
    if (tsig) {
      const t = S.tigs.find((x) => x.id === f.tig);
      if (t) acceptTIG(t, "device", f.pod.name, tsig);
    }
    render();
    toast(tsig ? "Átvétel és TIG aláírva, számla indul." : "Átvétel rögzítve.");
  }
  /** data-photo inputs; img is the resized data URL. */
  function photoUpload(
    kind: "pod" | "tig" | "contract" | "extdn",
    id: string | undefined,
    img: string,
    name: string,
  ) {
    if (kind === "pod") {
      const f = S.transports.find((x) => x.id === id)!;
      f.pod = {
        name: "papíron aláírva",
        t: now(),
        img,
        how: "aláírt szállítólevél fotója",
        photo: true,
      };
      const dn = S.docs.find((x) => x.id === f.dn);
      if (dn) {
        dn.pod = f.pod;
        dn.status2 = "Átvéve";
      }
      fileDoc(
        "Aláírt szállítólevél (fotó)",
        f.id,
        `${dn ? dn.number : f.id} — ${name}`,
        img.slice(0, 2000),
        `Sofőr (${f.driver})`,
      );
      toast("Fotó csatolva és iktatva.");
    }
    if (kind === "tig") {
      const tg = S.tigs.find((x) => x.id === id)!;
      acceptTIG(tg, "photo", "papíron aláírt példány", img);
      toast("Aláírt TIG csatolva, számla indul.");
    }
    if (kind === "contract") {
      const c = S.contracts.find((x) => x.id === id)!;
      signContract(c, "photo", "aláírt papírpéldány", img);
      toast("Aláírt szerződés feltöltve és iktatva.");
    }
    if (kind === "extdn") {
      S.extdn.unshift({ t: now(), img, name });
      log("Raktáros (ember)", `Külsős szállítólevél rögzítve: ${name}`);
      toast("Külsős szállítólevél csatolva.");
    }
    render();
  }
  S.extdn = [];

  /* ---- Szerződések nézet ---- */
  const CS = { sub: "list" };
  function setContractTab(k: string) {
    CS.sub = k;
    render();
  }
  function openContract(id: string) {
    ui.sel.contract = id;
    CS.sub = "list";
    render();
  }
  function sendContract(id: string) {
    const c = S.contracts.find((x) => x.id === id)!;
    c.status = "Kiküldve";
    c.sent = now();
    c.history.push([now(), "Értékesítő (ember)", "Kiküldve aláírásra"]);
    S.approvals
      .filter((a) => a.refId === c.id && a.status === "Vár")
      .forEach((a) => (a.status = "Jóváhagyva"));
    render();
  }
  function remindContract(id: string) {
    const c = S.contracts.find((x) => x.id === id)!;
    c.history.push([
      now(),
      "AI · Szerződéskészítő",
      "Emlékeztető e-mail az aláírásról",
    ]);
    render();
    toast("Emlékeztető elküldve.");
  }
  function contractPortal(id: string) {
    const c = S.contracts.find((x) => x.id === id)!;
    ui.sel.portal = c.clientId;
    go("portal");
  }
  function saveTemplate(text: string) {
    S.ctemplate = text;
    log("Tulajdonos", "Szerződéssablon módosítva");
    toast("Sablon mentve.");
  }

  /* ---- TIG nézet ---- */
  function openTig(id: string) {
    ui.sel.tig = id;
    render();
  }
  function makeTig(oid: string) {
    const t = createTIG(oid, "Kézzel indított TIG a lezárt fordulókról");
    ui.sel.tig = t && t.id;
    render();
  }
  function signTig(id: string, name: string, sig: string | null) {
    const t = S.tigs.find((x) => x.id === id)!;
    if (!sig) {
      toast("Az aláírás hiányzik.");
      return;
    }
    acceptTIG(t, "e", name, sig);
    render();
    toast("Teljesítés elfogadva, iktatva, számla elindult.");
  }
  function objectTig(id: string) {
    const t = S.tigs.find((x) => x.id === id)!;
    t.status = "Kifogásolva";
    const L = tigLines(t);
    const noPod = L.rows.filter((r) => !r.f.pod).map((r) => r.f.id);
    t.objection = `Vevő: „Az egyik forduló nem érkezett meg.” — Ellenőrzés: ${noPod.length ? `átvételi aláírás nélküli fordulók: ${noPod.join(", ")}; iTrack szerint mindegyik jármű 15 percnél tovább állt a lerakó POI-ján. Javaslat: az iTrack-útvonal és a mérlegjegy megküldése a vevőnek, TIG változatlan újraküldése.` : "minden fordulóhoz van átvételi aláírás — javaslat: az aláírt szállítólevelek megküldése, TIG változatlan újraküldése."}`;
    t.history.push([now(), "Vevő", "Kifogás"]);
    render();
  }
  /* ---- portál: szerződés és TIG aláírása ---- */
  function portalSignContract(
    id: string,
    name: string,
    agreed: boolean,
    sig: string | null,
  ) {
    if (!agreed) {
      toast("Jelölje be a nyilatkozatot.");
      return;
    }
    if (!sig) {
      toast("Az aláírás hiányzik.");
      return;
    }
    const c = S.contracts.find((x) => x.id === id)!;
    signContract(c, "e", name, sig);
    render();
    toast("Szerződés aláírva és iktatva.");
  }
  function openTigFromPortal(id: string) {
    ui.sel.tig = id;
    go("tig");
  }

  /* ================= 4. KÖR: TELEMATIKA (iTrack WebService) ================= */
  const GEO: Record<string, [number, number, string]> = {
    POL: [47.058, 18.305, "Polgárdi bánya"],
    CSU: [47.083, 18.262, "Csúcsoshegy"],
    BAL: [46.93, 17.75, "Balatonrendes"],
    "8000": [47.19, 18.41, "Székesfehérvár"],
    "1134": [47.53, 19.07, "Budapest XIII."],
    "8600": [46.905, 18.05, "Siófok"],
    "8200": [47.09, 17.91, "Veszprém"],
    "8156": [46.96, 18.39, "Kisláng"],
  };
  const geoOf = (zip: string) =>
    GEO[zip] || GEO[String(zip).slice(0, 1) === "1" ? "1134" : "8000"];
  /* útvonal-pontok: egyenes + enyhe ív, valódi rendszerben az iTrack pozíciólista */
  function routePts(
    a: [number, number, string],
    b: [number, number, string],
    n = 24,
  ) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const bend = Math.sin(Math.PI * t) * 0.04 * (b[1] > a[1] ? 1 : -1);
      pts.push([
        a[0] + (b[0] - a[0]) * t + bend,
        a[1] + (b[1] - a[1]) * t - bend * 0.5,
      ]);
    }
    return pts;
  }
  S.telem = {};
  S.trips = [];
  S.tEvents = [];
  S.refuels = [];
  function itrackSync() {
    S.trucks.forEach((t, i) => {
      const tr = S.transports
        .filter(
          (f) =>
            f.truck === t.id &&
            iso(f.date) === iso(TODAY) &&
            f.status !== "Törölve",
        )
        .sort((a, b) => (a.start || 0) - (b.start || 0));
      const moving =
        tr.find((f) => f.status === "Lezárva" && !f.pod) ||
        tr.find((f) => f.status === "Úton");
      const home = GEO[t.home] || GEO.POL;
      let pos: [number, number] | [number, number, string] = home,
        place = home[2] + " (telephely)",
        speed = 0;
      if (moving) {
        const o = S.orders.find((x) => x.id === moving.order)!;
        const dst = geoOf(o.zip);
        const p = routePts(home, dst)[14];
        pos = p;
        place = `úton → ${dst[2]}`;
        speed = 62 + i * 3;
      }
      S.telem[t.id] = {
        lat: pos[0],
        lon: pos[1],
        place,
        speed,
        ign: speed > 0,
        fuel: t.fuel,
        odo: t.km,
        upd: "ma 09:0" + i,
      };
    });
    log(
      "Integráció",
      "iTrack WebService szinkron: járműlista, utolsó pozíciók, sebesség, mérőcsatornák (üzemanyagszint, km-óra), tankolások",
    );
  }
  /* havi statisztikák (szeptember + október eddig), a lezárt fordulókból és szimulált iTrack-eseményekből */
  function buildTelemStats() {
    S.trips = [];
    S.tEvents = [];
    S.refuels = [];
    const done = S.transports.filter((f) => f.status === "Lezárva");
    done.forEach((f, i) => {
      const o = S.orders.find((x) => x.id === f.order)!;
      const a = GEO[P(f.pid).depot.slice(0, 3)] || GEO.POL,
        b = geoOf(o.zip);
      const t = TR(f.truck) || S.trucks[0];
      const km = (f.km || distKm(o.zip)) * 2;
      const l = ((km * t.cons) / 100) * (1 + (f.net || f.planned) / 80);
      const stopMin = (f.wait || 20) + 15;
      S.trips.push({
        fid: f.id,
        truck: f.truck,
        driver: f.driverId,
        date: f.date,
        km,
        l,
        pts: routePts(a, b),
        from: a[2],
        to: b[2],
        stopMin,
        maxSpeed: 82 + (i % 4) * 3,
        idle: 8 + (i % 5) * 3,
      });
    });
    // szintetikus havi összesítők (élesben: GET útvonalak + események intervallumra)
    const base: Record<string, [number, number]> = {
      "RKX-412": [5120, 11],
      "SMP-118": [4870, 19],
      "PLG-305": [4410, 7],
      "PLG-411": [3020, 5],
      "SMP-207": [2780, 9],
      "RKX-530": [2550, 14],
    };
    S.tstats = S.trucks.map((t, i) => {
      const [km, ev] = base[t.id] || [1000, 3];
      const own = S.trips.filter((x) => x.truck === t.id);
      const kmT = km + own.reduce((a, x) => a + x.km, 0);
      const cons = t.cons * (1 + ((i % 3) - 1) * 0.04);
      const fuelL = (kmT * cons) / 100;
      const tankL = fuelL * (t.id === "SMP-118" ? 1.07 : 1.005);
      return {
        id: t.id,
        km: kmT,
        hours: kmT / 49,
        cons,
        fuelL,
        tankL,
        diff: tankL - fuelL,
        idlePct: 9 + ((i * 3) % 11),
        over: ev,
        harsh: Math.round(ev * 0.6),
        stops: Math.round(kmT / 38),
      };
    });
    S.dstats = S.drivers.map((d, i) => {
      const km = [4980, 4620, 3960, 4300, 1200, 2700, 3100][i] || 2000;
      return {
        id: d.id,
        km,
        drive: km / 49,
        eco: d.eco,
        over: [6, 17, 3, 9, 2, 12, 5][i] ?? 2 + ((i * 7) % 14),
        harsh: [3, 9, 2, 5, 1, 8, 3][i] ?? 1 + ((i * 3) % 8),
        idle: [7, 14, 6, 9, 8, 12, 7][i] ?? 5 + ((i * 5) % 9),
        cons:
          [33.1, 36.2, 30.0, 33.9, 34.5, 31.8, 33.0][i] ??
          (S.trucks[i]?.cons || 33),
      };
    });
    S.refuels = [
      {
        t: "2026-10-01 06:12",
        truck: "SMP-118",
        where: "Polgárdi kúttartály",
        l: 410,
        erp: 410,
        ok: true,
      },
      {
        t: "2026-10-02 14:40",
        truck: "SMP-118",
        where: "MOL Székesfehérvár (kártya)",
        l: 180,
        erp: 260,
        ok: false,
      },
      {
        t: "2026-10-02 05:58",
        truck: "RKX-412",
        where: "Polgárdi kúttartály",
        l: 395,
        erp: 395,
        ok: true,
      },
      {
        t: "2026-10-03 06:05",
        truck: "PLG-305",
        where: "Polgárdi kúttartály",
        l: 310,
        erp: 310,
        ok: true,
      },
    ];
    S.tEvents = [
      {
        t: "10-02 11:24",
        truck: "SMP-118",
        drv: "D2",
        ev: "Gyorshajtás 98 km/h (M7, 90 km/h tehergépkocsi-korlát)",
      },
      { t: "10-02 13:02", truck: "SMP-118", drv: "D2", ev: "Hirtelen fékezés" },
      {
        t: "10-01 09:47",
        truck: "RKX-530",
        drv: "D7",
        ev: "Alapjárat 34 perc a lerakón",
      },
      {
        t: "10-03 07:15",
        truck: "RKX-412",
        drv: "D1",
        ev: "POI-érkezés: V-Híd, Váci út 45. (lerakó)",
      },
      {
        t: "10-03 08:10",
        truck: "RKX-412",
        drv: "D1",
        ev: "POI-távozás: V-Híd — tartózkodás 55 perc → állásidő 25 perc",
      },
    ];
  }
  const TSUB = { sel: null as string | null };
  function selectTrip(id: string | null) {
    TSUB.sel = id || null;
    render();
  }

  /* ================= 4. KÖR: SZÁLLÍTÓLEVÉL ÉS SZÁMLA KÜLÖN MENÜ ================= */
  const DNF = { q: "", st: "", client: "" },
    INVF = { tab: "out", q: "", type: "" };
  const dnState = (d: Doc) =>
    d.status === "Sztornó"
      ? "Sztornó"
      : S.transports.find((f) => f.id === d.ref)?.inv
        ? "Számlázva"
        : d.pod
          ? "Átvéve (aláírva)"
          : d.number
            ? "Úton / átvételre vár"
            : "Kiállításra vár";
  function dnRows() {
    return S.docs
      .filter((d) => d.type === "Szállítólevél")
      .filter((d) => {
        const s = dnState(d);
        return (
          (!DNF.st || s === DNF.st) &&
          (!DNF.client || d.clientName === DNF.client) &&
          (!DNF.q ||
            (String(d.number) + d.ref + d.order)
              .toLowerCase()
              .includes(DNF.q.toLowerCase()))
        );
      });
  }
  function setDnFilter(k: "q" | "st" | "client", v: string) {
    DNF[k] = v;
    render();
  }
  function openDn(id: string) {
    ui.sel.dnd = id;
    render();
  }
  function resendDn(id: string) {
    const x = S.docs.find((y) => y.id === id)!;
    job(
      "Billingo",
      "Szállítólevél újraküldése",
      x.id + "-r" + env.now(),
      { endpoint: `POST /v3/documents/${x.id}/send` },
      () => "elküldve",
    );
    toast("Újraküldve.");
    render();
  }
  function correctDn(id: string) {
    const x = S.docs.find((y) => y.id === id)!;
    x.qty = +(x.qty! - 0.2).toFixed(2);
    x.amount = x.qty * (x.amount / (x.qty + 0.2));
    job(
      "Billingo",
      "Szállítólevél módosítás",
      x.id + "-m" + env.now(),
      { qty: x.qty },
      () => "módosítva",
    );
    log(
      "Diszpécser (ember)",
      `Tömeg-korrekció: ${x.number} → ${fmt(x.qty, 2)} t (mérlegjegy újramérés)`,
      x.id,
    );
    render();
  }
  function stornoDn(id: string) {
    const x = S.docs.find((y) => y.id === id)!;
    x.status = "Sztornó";
    job(
      "Billingo",
      "Szállítólevél sztornó",
      x.id + "-s",
      { endpoint: `POST /v3/documents/${x.id}/cancel` },
      () => "sztornózva",
    );
    log("Diszpécser (ember)", `Szállítólevél sztornózva: ${x.number}`, x.id);
    render();
  }

  /* ---- Számlák ---- */
  S.inbound = [
    {
      id: "BE-1",
      sup: "MOL Nagykereskedelem",
      no: "MOL-2026-884120",
      date: "2026-10-01",
      net: 16020000,
      due: "2026-10-16",
      po: "PO-2026-19",
      item: "Gázolaj 28 600 l",
      rec: "28 600 l bevételezve",
      status: "Egyeztetve",
    },
    {
      id: "BE-2",
      sup: "Fuchs Hungária",
      no: "FU-26-11873",
      date: "2026-09-29",
      net: 612000,
      due: "2026-10-29",
      po: "PO-2026-17",
      item: "Hidraulikaolaj 400 l",
      rec: "380 l bevételezve",
      status: "Eltérés: 20 l",
    },
    {
      id: "BE-3",
      sup: "Bányarobbantó Kft.",
      no: "BR-2026-0931",
      date: "2026-09-30",
      net: 4200000,
      due: "2026-10-15",
      po: "keretszerződés",
      item: "Szeptemberi robbantások (3 alkalom)",
      rec: "robbantási napló: 3 alkalom",
      status: "Egyeztetve",
    },
    {
      id: "BE-4",
      sup: "Sandvik márkaszerviz",
      no: "SV-2026-3304",
      date: "2026-10-02",
      net: 2850000,
      due: "2026-11-01",
      po: "—",
      item: "Ütőléc-készlet QI440",
      rec: "nincs bevételezés",
      status: "Rendelés nélkül",
    },
  ];
  function invType(d: Doc) {
    return (
      d.kind ||
      (d.ref === "szeptemberi teljesítés"
        ? "Gyűjtőszámla (havi)"
        : "Számla (TIG alapján)")
    );
  }
  function setInvTab(k: string) {
    INVF.tab = k;
    render();
  }
  function setInvFilter(k: "q" | "type", v: string) {
    INVF[k] = v;
    render();
  }
  function markPaid(id: string) {
    const x = S.docs.find((y) => y.id === id)!;
    x.paid = true;
    x.status = "Kiegyenlítve";
    log("Pénzügy (ember)", `Kiegyenlítés kézzel: ${x.number}`, x.id);
    render();
  }
  function correctInvoice(id: string) {
    const x = S.docs.find((y) => y.id === id)!;
    const c: Doc = {
      id: nid("SZ", (n) => "SZ-" + n),
      type: "Számla",
      kind: "Helyesbítő számla",
      ref: x.number!,
      order: x.order,
      clientName: x.clientName,
      amount: -Math.round(x.amount * 0.02),
      gross: -Math.round(x.amount * 0.02 * 1.27),
      items: [
        {
          name: `Helyesbítés ${x.number}: tömeg-korrekció`,
          unit_price: -Math.round(x.amount * 0.02),
          unit_price_type: "net",
          quantity: 1,
          unit: "tétel",
          vat: "27%",
        },
      ],
      created: now(),
      status: "Sorban (Billingo)",
      nav: "—",
      payload: { type: "modification", original: x.number },
    };
    S.docs.unshift(c);
    job("Billingo", "Helyesbítő számla", c.id, c.payload, () => {
      c.status = "Billingóban kiállítva";
      c.number = "MP-2026-" + String(++SEQ.SZ).padStart(4, "0");
      c.nav = "Befogadva";
      return c.number;
    });
    ui.sel.doc = c.id;
    render();
  }
  function newAdvance() {
    const c = C("c4")!;
    const d: Doc = {
      id: nid("SZ", (n) => "SZ-" + n),
      type: "Számla",
      kind: "Díjbekérő",
      ref: "A-2026-92 (magánszemély)",
      order: "—",
      clientName: c.name,
      amount: 143021,
      gross: Math.round(143021 * 1.27),
      items: [
        {
          name: "0/1 mosott homok 15 t + fuvar (előre fizetés)",
          unit_price: 143021,
          unit_price_type: "net",
          quantity: 1,
          unit: "tétel",
          vat: "27%",
        },
      ],
      created: now(),
      due: addDays(TODAY, 3),
      status: "Sorban (Billingo)",
      nav: "nem NAV-köteles (díjbekérő)",
      payload: { type: "proforma" },
    };
    S.docs.unshift(d);
    job("Billingo", "Díjbekérő", d.id, d.payload, () => {
      d.status = "Billingóban kiállítva";
      d.number = "MP-E-2026-0007";
      return d.number;
    });
    ui.sel.doc = d.id;
    render();
    toast("Díjbekérő kiküldve; a fuvar a befizetés után szabadul fel.");
  }
  function approveInbound(id: string) {
    const b = S.inbound.find((x) => x.id === id)!;
    b.status = "Fizetésre jóváhagyva";
    log("Pénzügy (ember)", `Bejövő számla fizetésre jóváhagyva: ${b.no}`);
    render();
  }

  /* ================= 4. KÖR: BÉRSZÁMFEJTÉS (bérelőkészítés) ================= */
  const PAYCFG: Record<string, number | boolean> & {
    szja: number;
    tb: number;
    szocho: number;
    ot: number;
    night: number;
    shift: number;
    sunday: number;
    divisor: number;
    minWage: number;
    guaranteed: number;
    ecoHi: number;
    ecoMid: number;
  } = {
    szja: 0.15,
    tb: 0.185,
    szocho: 0.13,
    ot: 0.5,
    night: 0.15,
    shift: 0.3,
    sunday: 0.5,
    divisor: 174,
    minWage: 322800,
    guaranteed: 373200,
    ecoHi: 30000,
    ecoMid: 15000,
    waitPaid: true,
  };
  S.employees = [
    ...S.drivers.map((d, i) => ({
      id: d.id,
      name: d.name,
      role: "Gépkocsivezető",
      stage: "fuvar" as const,
      kind: "driver" as const,
      rate: d.rate,
      perTrip: d.perTrip,
      att: [196, 214, 171, 188, 96, 176, 192][i] ?? 168 + ((i * 13) % 40),
      drive: [148, 163, 124, 139, 61, 118, 145][i] ?? 120 + ((i * 11) % 40),
      night: [6, 14, 0, 4, 0, 2, 8][i] ?? (i * 5) % 9,
      trips: [92, 98, 74, 86, 38, 70, 81][i] ?? 70 + ((i * 7) % 28),
      tripsOk:
        [92, 96, 74, 86, 38, 69, 81][i] ??
        70 + ((i * 7) % 28) - (i % 3 === 0 ? 1 : 0),
      wait: [9, 6, 4, 7, 1, 5, 6][i] ?? 3 + (i % 6),
      leave: [0, 0, 1, 0, 9, 0, 0][i] ?? (i === 13 ? 5 : 0),
      eco: d.eco,
      sunday: 0,
    })),
    {
      id: "E1",
      name: "Kovács Imre",
      role: "Bányamester",
      stage: "kitermeles",
      kind: "monthly",
      gross: 950000,
      att: 182,
      night: 0,
      leave: 0,
    },
    {
      id: "E2",
      name: "Farkas Tamás",
      role: "Kotrógépkezelő",
      stage: "kitermeles",
      kind: "monthly",
      gross: 680000,
      att: 189,
      night: 0,
      leave: 0,
    },
    {
      id: "E3",
      name: "Balogh Sándor",
      role: "Fúrómester",
      stage: "kitermeles",
      kind: "monthly",
      gross: 650000,
      att: 160,
      night: 0,
      leave: 1,
    },
    {
      id: "E4",
      name: "Pap József",
      role: "Törőkezelő",
      stage: "toro",
      kind: "monthly",
      gross: 620000,
      att: 194,
      night: 22,
      shiftH: 64,
      leave: 0,
    },
    {
      id: "E5",
      name: "Lakatos Ernő",
      role: "Törőkezelő",
      stage: "toro",
      kind: "monthly",
      gross: 620000,
      att: 201,
      night: 30,
      shiftH: 72,
      leave: 0,
    },
    {
      id: "E6",
      name: "Simon Dávid",
      role: "Rakodógépkezelő",
      stage: "rakodas",
      kind: "monthly",
      gross: 640000,
      att: 190,
      night: 0,
      leave: 0,
    },
    {
      id: "E7",
      name: "Szűcs Anna",
      role: "Mérlegkezelő",
      stage: "rakodas",
      kind: "monthly",
      gross: 520000,
      att: 176,
      night: 0,
      leave: 0,
    },
    {
      id: "E8",
      name: "Major Gergely",
      role: "Gépszerelő",
      stage: "rezsi",
      kind: "monthly",
      gross: 720000,
      att: 186,
      night: 0,
      leave: 0,
      woH: 118,
    },
    {
      id: "E9",
      name: "Fodor Nóra",
      role: "Értékesítő-diszpécser",
      stage: "rezsi",
      kind: "monthly",
      gross: 700000,
      att: 172,
      night: 0,
      leave: 0,
    },
    {
      id: "E10",
      name: "Bíró Katalin",
      role: "Pénzügy-admin",
      stage: "rezsi",
      kind: "monthly",
      gross: 620000,
      att: 168,
      night: 0,
      leave: 0,
    },
  ];
  S.payroll = {
    period: "2026. szeptember",
    status: "Előkészítve",
    work: 168,
    steps: [
      [
        "Előkészítve",
        "ma 06:00",
        "Rendszer: jelenlét, tachográf/iTrack, TIG, munkalap, műszaknapló beolvasva",
      ],
    ],
    periodKey: "szept",
  };
  /* élő időszak: október 1–3., a rendszer saját adataiból */
  function liveEmp(e: Employee): Employee {
    if (e.kind === "driver") {
      const ts = S.transports.filter(
        (f) =>
          f.driverId === e.id &&
          f.status !== "Törölve" &&
          f.status !== "Javasolt" &&
          iso(f.date) >= "2026-10-01" &&
          iso(f.date) <= iso(TODAY),
      );
      const done = ts.filter((f) => f.status === "Lezárva");
      const days = new Set(ts.map((f) => iso(f.date))).size;
      const work = ts.reduce((a, f) => a + (f.dur || 0), 0) + days * 1.0;
      const night = ts.reduce((a, f) => {
        const s0 = f.start || 6,
          e0 = s0 + (f.dur || 0);
        return a + Math.max(0, 6 - s0) + Math.max(0, e0 - 22);
      }, 0);
      const lv = S.leave.find((l) => l.d === e.id);
      return {
        ...e,
        att: Math.round(work * 10) / 10,
        drive: Math.round(ts.reduce((a, f) => a + (f.drive || 0), 0) * 10) / 10,
        night: Math.round(night * 10) / 10,
        trips: done.length,
        tripsOk: done.filter((f) => f.pod || tigOk(f)).length,
        wait: Math.round(ts.reduce((a, f) => a + (f.wait || 0), 0) / 6) / 10,
        leave: S.leave.filter(
          (l) => l.d === e.id && l.from <= iso(TODAY) && l.to >= "2026-10-01",
        ).length
          ? Math.min(
              2,
              Math.round(
                (Math.min(+new Date(lv!.to), +TODAY) -
                  Math.max(+new Date(lv!.from), +new Date("2026-10-01"))) /
                  864e5,
              ) + 1,
            )
          : 0,
        live: ts,
      };
    }
    const sat = (S.shifts || []).filter((x) => iso(x.date) === iso(TODAY));
    const crush =
      /törő/i.test(e.role) && sat.some((x) => x.recipe.startsWith("TOR-01"));
    const quarry =
      e.role === "Bányamester" && sat.some((x) => x.site === "CSU");
    const sh = crush
      ? sat.find((x) => x.recipe.startsWith("TOR-01"))!.hours
      : quarry
        ? 9
        : 0;
    return { ...e, att: 16 + sh, night: 0, shiftH: 0, leave: 0 };
  }
  function empsFor() {
    return S.payroll.periodKey === "okt"
      ? S.employees.map(liveEmp)
      : S.employees;
  }
  function payCalc(e: Employee) {
    const L: [string, number, string][] = [];
    const add = (n: string, v: number, src: string) => {
      L.push([n, Math.round(v), src]);
    };
    const W = S.payroll.work;
    if (e.kind === "driver") {
      const rate = e.rate!;
      const reg = Math.min(e.att, W - e.leave * 8);
      add(
        "Alapbér (órabér × ledolgozott rendes óra)",
        rate * reg,
        "jelenléti terminál",
      );
      if (e.leave)
        add(
          `Távolléti díj (${e.leave} nap szabadság)`,
          rate * 8 * e.leave,
          "szabadság-nyilvántartás",
        );
      const ot = Math.max(0, e.att - W);
      if (ot)
        add(
          `Túlóra ${fmt(ot, 1)} h (+50%)`,
          ot * rate * (1 + PAYCFG.ot),
          `jelenlét − ${W} h`,
        );
      if (e.night)
        add(
          `Éjszakai pótlék ${e.night} h (+15%)`,
          e.night * rate * PAYCFG.night,
          "iTrack menetidő 22–06",
        );
      add(
        `Teljesítménybér ${e.tripsOk} igazolt forduló × ${ft(e.perTrip)}`,
        e.tripsOk! * e.perTrip!,
        "átvétel/TIG-gel igazolt fordulók",
      );
      const eco =
        S.payroll.periodKey === "okt"
          ? 0
          : e.eco! >= 85
            ? PAYCFG.ecoHi
            : e.eco! >= 75
              ? PAYCFG.ecoMid
              : 0;
      if (eco)
        add(`Eco-prémium (iTrack eco-pont ${e.eco})`, eco, "iTrack események");
    } else {
      const hr = e.gross! / PAYCFG.divisor;
      add(
        S.payroll.periodKey === "okt"
          ? "Időarányos alapbér (2 munkanap)"
          : "Havi alapbér",
        S.payroll.periodKey === "okt" ? hr * 16 : e.gross!,
        "munkaszerződés",
      );
      const ot = Math.max(0, e.att - W);
      if (ot)
        add(
          `Túlóra ${fmt(ot, 1)} h (+50%)`,
          ot * hr * (1 + PAYCFG.ot),
          `jelenlét − ${W} h`,
        );
      if (e.shiftH)
        add(
          `Műszakpótlék ${e.shiftH} h (+30%, 18–06)`,
          e.shiftH * hr * PAYCFG.shift,
          "műszaknapló",
        );
      if (e.night && !e.shiftH)
        add(
          `Éjszakai pótlék ${e.night} h`,
          e.night * hr * PAYCFG.night,
          "jelenlét",
        );
    }
    const gross = L.reduce((a, x) => a + x[1], 0);
    const szja = gross * PAYCFG.szja,
      tb = gross * PAYCFG.tb;
    return {
      lines: L,
      gross,
      szja,
      tb,
      net: gross - szja - tb,
      szocho: gross * PAYCFG.szocho,
      cost: gross * (1 + PAYCFG.szocho),
    };
  }
  function payChecks() {
    const o: ["warn" | "bad", Employee, string][] = [];
    empsFor().forEach((e) => {
      const c = payCalc(e);
      if (e.kind === "driver") {
        if (e.att - e.drive! > (S.payroll.periodKey === "okt" ? 8 : 60))
          o.push([
            "warn",
            e,
            `jelenlét ${e.att} h, menetidő ${e.drive} h — ${e.att - e.drive!} h rakodás/várakozás; ellenőrizendő`,
          ]);
        if (e.trips! > e.tripsOk!)
          o.push([
            "warn",
            e,
            `${e.trips! - e.tripsOk!} forduló átvételi igazolás nélkül — a teljesítménybérbe nem számít bele, amíg nincs TIG/aláírt szállítólevél`,
          ]);
        const ot = e.att - S.payroll.work;
        if (ot > 40)
          o.push([
            "bad",
            e,
            `havi túlóra ${ot} h — éves 250 h keret mellett ütemesen túllépi`,
          ]);
        if (
          S.payroll.periodKey === "szept" &&
          e.drive! > DR(e.id).weekH * 4.3 + 20
        )
          o.push([
            "warn",
            e,
            "tachográf szerinti vezetési idő eltér a heti összesítőtől",
          ]);
      } else {
        if (e.shiftH && e.att > 200)
          o.push([
            "warn",
            e,
            `${e.att} h jelenlét; 12 órás műszakok 11 óránál rövidebb pihenővel (műszaknapló 09.18–19.)`,
          ]);
      }
      if (
        S.payroll.periodKey === "szept" &&
        c.gross < PAYCFG.guaranteed &&
        e.leave < 5
      )
        o.push([
          "bad",
          e,
          `bruttó ${ft(c.gross)} a garantált bérminimum alatt`,
        ]);
    });
    return o;
  }
  const PAY = { sel: "D1" };
  function payCSV() {
    return [
      "torzsszam;nev;munkakor;alapber;tulora;potlek;teljesitmenyber;premium;brutto",
      ...empsFor().map((e) => {
        const c = payCalc(e);
        const g = (k: RegExp) =>
          c.lines.filter((l) => k.test(l[0])).reduce((a, l) => a + l[1], 0);
        return [
          `[${e.id}]`,
          e.name,
          e.role,
          g(/Alapbér|Havi alapbér|Távolléti/),
          g(/Túlóra/),
          g(/pótlék/),
          g(/Teljesítmény/),
          g(/prémium/i),
          c.gross,
        ].join(";");
      }),
    ].join("\n");
  }
  const timeHM = () =>
    now().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  function paySelect(id: string) {
    PAY.sel = id;
    render();
  }
  function payAi() {
    S.payroll.status = "AI-ellenőrzés kész";
    S.payroll.steps.push([
      "AI-ellenőrzés kész",
      "ma 06:05",
      `${payChecks().length} tétel ellenőrzésre jelölve`,
    ]);
    log(
      "AI · Bérelőkészítő",
      `Szeptemberi bérek ellenőrizve: ${payChecks().length} figyelmeztetés`,
    );
    render();
  }
  function payOk() {
    S.payroll.status = "Jóváhagyva";
    S.payroll.steps.push(["Jóváhagyva", timeHM(), "Ügyvezető jóváhagyta"]);
    log("Tulajdonos", "Szeptemberi bérelőkészítés jóváhagyva");
    render();
  }
  async function payExport() {
    S.payroll.status = "Exportálva";
    S.payroll.steps.push([
      "Exportálva",
      timeHM(),
      "CSV a bérszámfejtő programnak (Nexon / Kulcs-Bér import)",
    ]);
    log("Pénzügy (ember)", "Bérfeladás exportálva");
    render();
    try {
      if (ui.download)
        await ui.download("berfeladas_2026_09.csv", "﻿" + payCSV());
    } catch {
      /* the demo ignores a failed download */
    }
  }
  function setPayPeriod(v: "szept" | "okt") {
    S.payroll.periodKey = v;
    S.payroll.period = v === "okt" ? "2026. október 1–3." : "2026. szeptember";
    // V.payroll sets this on every render; the period select is the only thing that changes it.
    S.payroll.work = v === "okt" ? 16 : 168;
    render();
  }
  function setPayCfgPct(k: string, v: string) {
    PAYCFG[k] = +v / 100;
    render();
  }
  function setPayCfg(k: string, v: string) {
    PAYCFG[k] = +v;
    render();
  }
  S.agents.push({
    id: "payroll",
    name: "Bérelőkészítő",
    does: "Jelenlétből, menetidőből, igazolt fordulókból, munkalapokból bért előkészít, eltéréseket jelez, exportál.",
    mode: "suggest",
  });
  PHASES.push([
    "Bérszámfejtés",
    "Bérelőkészítő",
    "jelenlét + menetidő + igazolt fordulók → bérjegyzék-előnézet, ellenőrzés",
    "vezetői jóváhagyás, export",
  ]);

  /* ================= 4. KÖR: QR-KÓDOS RAKTÁR ================= */
  S.locs = [
    { id: "MUH-A1", name: "Műhely raktár A/1 polc" },
    { id: "MUH-A2", name: "Műhely raktár A/2 polc" },
    { id: "MUH-B1", name: "Műhely raktár B/1 (nagy alkatrész)" },
    { id: "OLAJ", name: "Olajraktár" },
    { id: "KUT", name: "Kúttartály (25 m³)" },
    { id: "CSU-K", name: "Csúcsoshegy konténer" },
  ];
  const PLOC: Record<string, string> = {
    s1: "KUT",
    s2: "OLAJ",
    s3: "OLAJ",
    s4: "OLAJ",
    s5: "MUH-A2",
    s6: "MUH-B1",
    s7: "MUH-B1",
    s8: "MUH-A1",
    s9: "MUH-B1",
  };
  S.parts.forEach((p) => (p.loc = PLOC[p.id] || "MUH-A1"));
  S.projects = [
    { id: "REKULT", name: "Csúcsoshegy rekultiváció (2026)" },
    { id: "BANYAUT", name: "Bányaút-karbantartás" },
    { id: "TORO-FELUJ", name: "QI440 törő felújítás" },
  ];
  S.units = [
    { id: "MUHELY", name: "Műhely (általános)" },
    { id: "TOROUZEM", name: "Törőüzem" },
    { id: "IRODA", name: "Iroda" },
  ];
  interface QrTarget {
    code: string;
    kind: string;
    name: string;
    ref: string;
  }
  function qrTargets(): QrTarget[] {
    return [
      ...S.machines.map((m) => ({
        code: (m.stage === "fuvar" ? "MP-JMU-" : "MP-GEP-") + m.id,
        kind: m.stage === "fuvar" ? "Tehergépkocsi" : "Gép",
        name: m.name,
        ref: m.id,
      })),
      ...S.projects.map((p) => ({
        code: "MP-PRJ-" + p.id,
        kind: "Projekt",
        name: p.name,
        ref: p.id,
      })),
      ...S.units.map((u) => ({
        code: "MP-EGY-" + u.id,
        kind: "Egység",
        name: u.name,
        ref: u.id,
      })),
      ...(S.wos || [])
        .filter((w) => w.status !== "Lezárva")
        .map((w) => ({
          code: "MP-ML-" + w.id.slice(3),
          kind: "Munkalap",
          name: `${w.id} · ${S.machines.find((m) => m.id === w.machine)!.name}`,
          ref: w.id,
        })),
    ];
  }
  const qrItems = (): QrTarget[] =>
    S.parts.map((p) => ({
      code: "MP-CIKK-" + p.id.toUpperCase(),
      kind: "Cikk",
      name: p.name,
      ref: p.id,
    }));
  const qrLocs = (): QrTarget[] =>
    S.locs.map((l) => ({
      code: "MP-HELY-" + l.id,
      kind: "Raktárhely",
      name: l.name,
      ref: l.id,
    }));
  const qrPOs = (): QrTarget[] =>
    (S.pos || [])
      .filter((p) => p.status === "Megrendelve (PO)")
      .map((p) => ({
        code: "MP-PO-" + p.id.slice(3),
        kind: "Beszerzési rendelés",
        name: `${p.id} · ${p.name}`,
        ref: p.id,
      }));
  function qrLookup(codeIn: string) {
    const code = String(codeIn || "")
      .trim()
      .toUpperCase();
    return [...qrItems(), ...qrLocs(), ...qrTargets(), ...qrPOs()].find(
      (x) => x.code === code,
    );
  }
  S.qrlog = [];
  const SCAN_MSG: Record<string, string> = {
    receive: "Olvassa be a rendelés vagy a cikk QR-kódját.",
    issue: "Olvassa be a cikk QR-kódját.",
    move: "Olvassa be a cikket.",
    count: "Olvassa be a raktárhely QR-kódját.",
  };
  let SCAN = {
    mode: "issue",
    item: null as QrTarget | null,
    target: null as QrTarget | null,
    loc: null as QrTarget | null,
    po: null as QrTarget | null,
    qty: "" as string | number,
    msg: "Olvassa be a cikk QR-kódját.",
    count: {} as Record<string, number>,
  };
  function scanInput(raw: string) {
    const x = qrLookup(raw);
    if (!x) {
      SCAN.msg = `Ismeretlen kód: ${raw}`;
      return;
    }
    if (SCAN.mode === "receive") {
      if (x.kind === "Beszerzési rendelés") {
        SCAN.po = x;
        const po = S.pos.find((p) => p.id === x.ref)!;
        SCAN.item = qrItems().find((i) => i.ref === po.sid) || null;
        SCAN.qty = po.qty;
        SCAN.msg = `Rendelés: ${po.name}, ${fmt(po.qty)} — olvassa be a raktárhelyet.`;
      } else if (x.kind === "Cikk") {
        SCAN.item = x;
        SCAN.msg = "Mennyiség, majd raktárhely QR.";
      } else if (x.kind === "Raktárhely") {
        SCAN.loc = x;
        SCAN.msg = SCAN.item
          ? "Ellenőrizze a mennyiséget és rögzítse."
          : "Olvassa be a cikket.";
      } else
        SCAN.msg = "Bevételezésnél cikk, rendelés vagy raktárhely kód kell.";
    } else if (SCAN.mode === "issue") {
      if (x.kind === "Cikk") {
        SCAN.item = x;
        SCAN.msg =
          "Mennyiség, majd a cél QR-kódja (gép, tehergépkocsi, projekt, egység, munkalap).";
      } else if (
        ["Gép", "Tehergépkocsi", "Projekt", "Egység", "Munkalap"].includes(
          x.kind,
        )
      ) {
        SCAN.target = x;
        SCAN.msg = SCAN.item ? "Rögzítheti a kiadást." : "Olvassa be a cikket.";
      } else SCAN.msg = "Kiadásnál cikk és cél kód kell; raktárhely nem.";
    } else if (SCAN.mode === "move") {
      if (x.kind === "Cikk") {
        SCAN.item = x;
        SCAN.msg = "Olvassa be az új raktárhelyet.";
      } else if (x.kind === "Raktárhely") {
        SCAN.loc = x;
        SCAN.msg = "Rögzítheti az áthelyezést.";
      }
    } else if (SCAN.mode === "count") {
      if (x.kind === "Raktárhely") {
        SCAN.loc = x;
        SCAN.count = {};
        SCAN.msg = `Leltár: ${x.name}. Olvassa be a polcon lévő cikkeket, adja meg a darabszámot.`;
      } else if (x.kind === "Cikk") {
        if (!SCAN.loc) {
          SCAN.msg = "Először a raktárhelyet olvassa be.";
          return;
        }
        SCAN.item = x;
        SCAN.msg = "Írja be a megszámolt mennyiséget, majd Rögzítés.";
      }
    }
  }
  function scanCommit() {
    const p = SCAN.item && S.parts.find((x) => x.id === SCAN.item!.ref);
    const q = +SCAN.qty;
    if (SCAN.mode === "issue") {
      if (!p || !SCAN.target || !(q > 0)) {
        toast("Cikk, mennyiség és cél kell.");
        return;
      }
      if (q > p.qty) {
        toast(`Nincs elég készlet (${fmt(p.qty)} ${p.unit}).`);
        return;
      }
      const t = SCAN.target;
      let costTo = "";
      if (t.kind === "Gép" || t.kind === "Tehergépkocsi") {
        issuePart(p.id, q, t.ref);
        costTo = "gépköltség";
      } else if (t.kind === "Munkalap") {
        const w = S.wos.find((x) => x.id === t.ref)!;
        issuePart(p.id, q, w.machine);
        costTo = `munkalap ${w.id} → ${w.machine}`;
      } else {
        p.qty -= q;
        (S.projCost = S.projCost || []).push({
          t: now(),
          ref: t.ref,
          kind: t.kind,
          cost: q * p.price,
          item: p.name,
          qty: q,
        });
        costTo = t.kind === "Projekt" ? "projektköltség" : "egység rezsije";
      }
      S.qrlog.unshift({
        t: now(),
        mode: "Kiadás",
        item: p.name,
        code: SCAN.item!.code,
        qty: q,
        unit: p.unit,
        to: `${t.kind}: ${t.name}`,
        tcode: t.code,
        cost: q * p.price,
        costTo,
      });
      toast(`Kiadva: ${fmt(q)} ${p.unit} → ${t.name}`);
    }
    if (SCAN.mode === "receive") {
      if (!p || !SCAN.loc || !(q > 0)) {
        toast("Cikk, mennyiség és raktárhely kell.");
        return;
      }
      p.qty += q;
      p.loc = SCAN.loc.ref;
      if (SCAN.po) {
        const po = S.pos.find((x) => x.id === SCAN.po!.ref)!;
        po.status = "Beérkezett";
        po.recvQty = q;
      }
      S.qrlog.unshift({
        t: now(),
        mode: "Bevételezés",
        item: p.name,
        code: SCAN.item!.code,
        qty: q,
        unit: p.unit,
        to: `Raktárhely: ${SCAN.loc.name}`,
        tcode: SCAN.loc.code,
        cost: q * p.price,
        costTo: SCAN.po ? `rendelés ${SCAN.po.ref}` : "rendelés nélkül",
      });
      log(
        "Raktáros (QR)",
        `Bevételezés ${fmt(q)} ${p.unit} ${p.name} → ${SCAN.loc.name}`,
      );
      toast("Bevételezve.");
    }
    if (SCAN.mode === "move") {
      if (!p || !SCAN.loc) {
        toast("Cikk és új raktárhely kell.");
        return;
      }
      const from = p.loc;
      p.loc = SCAN.loc.ref;
      S.qrlog.unshift({
        t: now(),
        mode: "Áthelyezés",
        item: p.name,
        code: SCAN.item!.code,
        qty: p.qty,
        unit: p.unit,
        to: `${from} → ${SCAN.loc.ref}`,
        tcode: SCAN.loc.code,
        cost: 0,
        costTo: "—",
      });
      toast("Áthelyezve.");
    }
    if (SCAN.mode === "count") {
      if (!p || !(q >= 0)) {
        toast("Cikk és mennyiség kell.");
        return;
      }
      const diff = q - p.qty;
      S.qrlog.unshift({
        t: now(),
        mode: "Leltár",
        item: p.name,
        code: SCAN.item!.code,
        qty: q,
        unit: p.unit,
        to: `${SCAN.loc!.name}: könyvi ${fmt(p.qty)}, eltérés ${diff > 0 ? "+" : ""}${fmt(diff)}`,
        tcode: SCAN.loc!.code,
        cost: diff * p.price,
        costTo: diff ? "leltáreltérés → jóváhagyás" : "egyezik",
      });
      if (diff)
        approval(
          "inv",
          "QRCNT-" + p.id,
          `Leltáreltérés — ${p.name}`,
          `QR-leltár: mért ${fmt(q)} / könyvi ${fmt(p.qty)} ${p.unit}`,
          "Javaslat: a kiadási napló ellenőrzése az utolsó leltár óta, majd helyesbítés",
        );
      toast(diff ? "Eltérés: jóváhagyásra küldve." : "Egyezik.");
    }
    SCAN.item = null;
    SCAN.target = null;
    SCAN.po = null;
    SCAN.qty = "";
    if (SCAN.mode !== "count") SCAN.loc = null;
    SCAN.msg = "Kész. Következő cikk.";
    render();
  }
  const QS = { sub: "scan" };
  function setQrTab(k: string) {
    QS.sub = k;
    render();
  }
  function setScanMode(k: string) {
    SCAN = {
      mode: k,
      item: null,
      target: null,
      loc: null,
      po: null,
      qty: "",
      msg: SCAN_MSG[k],
      count: {},
    };
    render();
  }
  /** X.qscan / qrform submit: qty is the current value of the quantity field, if shown. */
  function qrScan(code: string, qty?: string, toScanTab = true) {
    if (qty !== undefined) SCAN.qty = qty;
    if (toScanTab) QS.sub = "scan";
    scanInput(code);
    render();
  }
  function qrCommit(qty?: string) {
    if (qty !== undefined) SCAN.qty = qty;
    scanCommit();
  }
  /** decodeQR result from a photo; null when no code was found. */
  function qrPhoto(code: string | null) {
    if (code) {
      scanInput(code);
      render();
      toast("QR beolvasva: " + code);
    } else toast("Nem találtam QR-kódot a képen.");
  }

  /* ================= 4. KÖR: ÖSSZEKÖTÉS ================= */
  {
    const _counts = counts;
    counts = function () {
      const c = _counts();
      c.pend = S.transports.filter((f) => f.status === "Javasolt").length;
      c.tig = S.tigs.filter((t) => t.status === "Aláírásra vár").length;
      c.con = S.contracts.filter(
        (x) => x.status === "Kiküldve" || x.status === "Piszkozat",
      ).length;
      return c;
    };
  }
  const _dec4 = decide;
  decide = function (id, ok) {
    const a = S.approvals.find((x) => x.id === id);
    if (a && a.kind === "contract") {
      if (ok) sendContract(a.refId);
      a.status = ok ? "Jóváhagyva" : "Elutasítva";
      render();
      return;
    }
    if (a && a.kind === "inv" && String(a.refId).startsWith("QRCNT-")) {
      if (ok) {
        const p = S.parts.find((x) => x.id === a.refId.slice(6))!;
        const l = S.qrlog.find((x) => x.item === p.name && x.mode === "Leltár");
        if (l) p.qty = l.qty;
        log("Tulajdonos", `Leltár-helyesbítés: ${p.name}`);
      }
      a.status = ok ? "Jóváhagyva" : "Elutasítva";
      render();
      return;
    }
    _dec4(id, ok);
  };
  const SIG_SVG = (n: string) =>
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="70"><path d="M10 50 C 30 10, 45 70, 60 35 S 90 20, 100 45 S 140 60, 150 30 S 190 25, 200 48 L 245 40" fill="none" stroke="#1d3a6e" stroke-width="2.4"/><text x="12" y="66" font-size="9" fill="#555">${n}</text></svg>`,
    );
  {
    const _seed4 = seed;
    seed = function () {
      _seed4();
      const vh = S.orders.find((o) => o.quote === "A-2026-81")!;
      const cv = S.contracts.find((c) => c.order === vh.id);
      if (cv) {
        cv.created = addDays(TODAY, -6);
        signContract(
          cv,
          "e",
          "Dr. Fekete Ildikó beszerzési igazgató",
          SIG_SVG("Dr. Fekete Ildikó"),
        );
      }
      S.transports
        .filter((f) => f.order === vh.id && f.status === "Lezárva")
        .forEach((f, i) => {
          if (i < 2) {
            f.pod = {
              name: "Kovács Ferenc építésvezető",
              t: addDays(f.date, 0),
              img: SIG_SVG("Kovács F."),
              how: "e-aláírás a sofőr tabletjén",
              gps: "iTrack: lerakó POI",
            };
            f.wait = [55, 25][i];
            const dn = S.docs.find((d) => d.id === f.dn);
            if (dn) dn.pod = f.pod;
          }
        });
      autoAssignDay(TODAY, true, true);
      S.transports
        .filter(
          (f) =>
            f.order === vh.id &&
            iso(f.date) === iso(TODAY) &&
            f.status === "Javasolt",
        )
        .forEach((f) => acceptTrip(f, "Diszpécser (ember)"));
      const first = S.transports
        .filter(
          (f) =>
            f.order === vh.id &&
            f.status === "Tervezett" &&
            iso(f.date) === iso(TODAY),
        )
        .sort((a, b) => a.start! - b.start!)[0];
      if (first) closeTransport(first.id, 24.8, 0);
      createTIG(vh.id, "Napi TIG (keretszerződés, október 1–3.)");
      // további megrendelések a hétre
      const ap = S.approvals.find(
        (a) =>
          a.kind === "quote" &&
          a.status === "Vár" &&
          S.quotes.find(
            (q) =>
              q.id === a.refId &&
              q.clientId === "c2" &&
              q.pr.lines.length === 2,
          ),
      );
      if (ap) _dec4(ap.id, true);
      const mk = (qid: string, date: string, sign: string | null) => {
        const q = S.quotes.find((x) => x.id === qid);
        if (!q || q.orderId) return;
        q.status = "Kiküldve";
        const o = quoteToOrder(qid)!;
        o.date = new Date(date + "T08:00");
        const c = S.contracts.find((x) => x.order === o.id);
        if (sign && c) signContract(c, "e", sign, SIG_SVG(sign));
        planTransports(o.id);
        return o;
      };
      const q89 = S.quotes.find(
        (q) => q.clientId === "c2" && q.pr.lines.length === 2,
      );
      if (q89) mk(q89.id, "2026-10-06", null);
      const q91 = S.quotes.find(
        (q) =>
          q.clientId === "c2" &&
          q.pr.lines.length === 1 &&
          q.pr.lines[0].qty === 75,
      );
      if (q91) mk(q91.id, "2026-10-07", "Tóth Gábor ügyvezető");
      mk("A-2026-79", "2026-10-07", "Horváth Ádám ügyvezető");
      S.qrlog.push(
        {
          t: addDays(TODAY, -1),
          mode: "Kiadás",
          item: "Hidraulikaolaj HV46",
          code: "MP-CIKK-S3",
          qty: 40,
          unit: "l",
          to: "Gép: TOR-01 Sandvik QI440 röpítőtörő",
          tcode: "MP-GEP-TOR-01",
          cost: 58000,
          costTo: "gépköltség",
        },
        {
          t: addDays(TODAY, -1),
          mode: "Bevételezés",
          item: "Kenőzsír EP2",
          code: "MP-CIKK-S5",
          qty: 50,
          unit: "kg",
          to: "Raktárhely: Műhely raktár A/2 polc",
          tcode: "MP-HELY-MUH-A2",
          cost: 95000,
          costTo: "rendelés PO-2026-17",
        },
      );
      itrackSync();
      buildTelemStats();
      S.audit.sort((a, b) => msBetween(b.t, a.t));
    };
  }

  /* ================= 5. KÖR: BRIEF-BŐVÍTÉSEK ================= */
  /* ---- dolgozók a brief szerint (20 nem sofőr) ---- */
  S.employees = [
    ...S.employees.filter((e) => e.kind === "driver"),
    {
      id: "E1",
      name: "Kovács Imre",
      role: "Dózerkezelő",
      stage: "kitermeles",
      kind: "monthly",
      gross: 690000,
      att: 182,
      night: 0,
      leave: 0,
    },
    {
      id: "E2",
      name: "Pap József",
      role: "Rakodógép-kezelő (törő)",
      stage: "toro",
      kind: "monthly",
      gross: 645000,
      att: 194,
      night: 22,
      shiftH: 64,
      leave: 0,
    },
    {
      id: "E3",
      name: "Lakatos Ernő",
      role: "Rakodógép-kezelő (törő)",
      stage: "toro",
      kind: "monthly",
      gross: 645000,
      att: 201,
      night: 30,
      shiftH: 72,
      leave: 0,
    },
    ...[
      "Simon Dávid",
      "Farkas Tamás",
      "Balogh Sándor",
      "Kelemen Áron",
      "Vincze Zsolt",
    ].map((n, i) => ({
      id: "E" + (4 + i),
      name: n,
      role: "Rakodógép-kezelő",
      stage: "rakodas" as const,
      kind: "monthly" as const,
      gross: 650000,
      att: [190, 184, 176, 188, 172].at(i)!,
      night: 0,
      leave: i === 2 ? 1 : 0,
    })),
    {
      id: "E9",
      name: "Major Gergely",
      role: "Szerelő",
      stage: "rezsi",
      kind: "monthly",
      gross: 720000,
      att: 186,
      night: 0,
      leave: 0,
      woH: 118,
    },
    {
      id: "E10",
      name: "Nagy Levente",
      role: "Szerelő",
      stage: "rezsi",
      kind: "monthly",
      gross: 720000,
      att: 178,
      night: 0,
      leave: 0,
    },
    {
      id: "E11",
      name: "Szabó Bálint",
      role: "Szerelő",
      stage: "rezsi",
      kind: "monthly",
      gross: 720000,
      att: 170,
      night: 0,
      leave: 0,
    },
    {
      id: "E12",
      name: "Zoli",
      role: "Fuvarszervező",
      stage: "rezsi",
      kind: "monthly",
      gross: 720000,
      att: 180,
      night: 0,
      leave: 0,
    },
    {
      id: "E13",
      name: "Andi",
      role: "Irodavezető",
      stage: "rezsi",
      kind: "monthly",
      gross: 780000,
      att: 170,
      night: 0,
      leave: 0,
    },
    {
      id: "E14",
      name: "Tóth Erika",
      role: "EKÁER/admin",
      stage: "rezsi",
      kind: "monthly",
      gross: 520000,
      att: 168,
      night: 0,
      leave: 0,
    },
    {
      id: "E15",
      name: "Kis Bernadett",
      role: "EKÁER/admin",
      stage: "rezsi",
      kind: "monthly",
      gross: 520000,
      att: 168,
      night: 0,
      leave: 0,
    },
    {
      id: "E16",
      name: "Szilvi",
      role: "Könyvelő",
      stage: "rezsi",
      kind: "monthly",
      gross: 690000,
      att: 168,
      night: 0,
      leave: 0,
    },
    {
      id: "E17",
      name: "Misi",
      role: "Vevőkezelés, bányai admin",
      stage: "rezsi",
      kind: "monthly",
      gross: 560000,
      att: 172,
      night: 0,
      leave: 0,
    },
    {
      id: "E18",
      name: "Horváth Judit",
      role: "Vevőkezelés, bányai admin",
      stage: "rezsi",
      kind: "monthly",
      gross: 480000,
      att: 168,
      night: 0,
      leave: 0,
    },
    {
      id: "E19",
      name: "Fodor Lajos",
      role: "Hulladéklerakó-kezelő",
      stage: "rezsi",
      kind: "monthly",
      gross: 480000,
      att: 176,
      night: 0,
      leave: 0,
    },
    {
      id: "E20",
      name: "Matyi",
      role: "Bánya és raktár (menedzsment)",
      stage: "rezsi",
      kind: "monthly",
      gross: 1300000,
      att: 168,
      night: 0,
      leave: 0,
    },
  ];

  /* ---- EKÁER: az ügynök előkészít, az EKÁER-admin küldi be ---- */
  {
    const _ekS5 = ekaerSubmit;
    ekaerSubmit = function (fid, silent, approved) {
      const f = S.transports.find((x) => x.id === fid);
      if (!f || !f.ekaer.required || f.ekaer.number) return;
      if (!approved && mode("ekaer") !== "auto") {
        if (!f.ekaer.prepared) {
          f.ekaer.prepared = now();
          f.ekaer.status = "Admin-jóváhagyásra vár";
          log(
            "AI · EKÁER-ügyintéző",
            "Bejelentés előkészítve, EKÁER-admin jóváhagyására vár",
            f.id,
          );
        }
        return;
      }
      f.ekaer.prepared = null;
      return _ekS5(fid, silent);
    };
  }
  const AE = S.agents.find((a) => a.id === "ekaer")!;
  AE.does =
    "Fuvaronként eldönti a kötelezettséget és előkészíti a bejelentést; a beküldést az EKÁER-admin hagyja jóvá (csoportosan).";
  PHASES.forEach((p) => {
    if (p[0] === "EKÁER") {
      p[2] =
        "kötelezettség-döntés, bejelentés előkészítése, módosítás, lezárás";
      p[3] = "minden beküldés (EKÁER-admin, egy kattintással)";
    }
  });
  /** X.eksend: ids are the checked .ekchk boxes. */
  function ekaerSendSelected(ids: string[]) {
    if (!ids.length) {
      toast("Jelöljön ki legalább egy bejelentést.");
      return;
    }
    ids.forEach((id) => ekaerSubmit(id, true, true));
    log(
      "EKÁER-admin (ember)",
      `${ids.length} EKÁER-bejelentés jóváhagyva és beküldve`,
    );
    render();
    toast(`${ids.length} bejelentés beküldve.`);
  }
  {
    const _cnt5 = counts;
    counts = function () {
      const c = _cnt5();
      c.ek = S.transports.filter(
        (f) =>
          f.ekaer &&
          f.ekaer.prepared &&
          !f.ekaer.number &&
          f.status !== "Törölve",
      ).length;
      c.mlog = (S.wos || []).filter((w) => w.status === "Hibajegy").length;
      return c;
    };
  }

  /* ---- Gépüzemnapló + gépkezelő app ---- */
  S.mlog = [];
  SEQ.ML5 = 0;
  const IDLE = [
    "várakozás anyagra / autóra",
    "meghibásodás",
    "tervezett karbantartás",
    "időjárás",
    "egyéb",
  ];
  function mlogAdd(e: MachineLog) {
    e.id = "GN-" + String(++SEQ.ML5).padStart(4, "0");
    S.mlog.unshift(e);
    const m = S.machines.find((x) => x.id === e.machine);
    if (m && e.run) m.next = Math.max(0, m.next - e.run);
    return e;
  }
  const lastHours = (mid: string) => {
    const l = S.mlog.find((x) => x.machine === mid);
    return l
      ? l.hEnd
      : (
          {
            "DOZ-01": 6412,
            "TOR-01": 3184,
            "OSZT-01": 2920,
            "RAK-01": 8841,
            "RAK-02": 10220,
            "RAK-03": 12904,
          } as Record<string, number>
        )[mid] || 1000;
  };
  const OPA = { op: "E2", machine: "OSZT-01", photo: null as string | null };
  function setOperator(id: string) {
    OPA.op = id;
    render();
  }
  function setOperatorMachine(id: string) {
    OPA.machine = id;
    render();
  }
  function setOperatorPhoto(img: string) {
    OPA.photo = img;
    toast("Fotó csatolva.");
  }
  /** closeShift5: the operator app form values. */
  function closeShift(v: {
    machine: string;
    hours: string;
    idle: string;
    reason: string;
    fault: boolean;
    faultText: string;
    feed?: string;
  }) {
    const m = S.machines.find((x) => x.id === v.machine)!;
    const op = S.employees.find((e) => e.id === OPA.op)!;
    const h0 = lastHours(m.id),
      h1 = +v.hours;
    if (!(h1 > h0)) {
      toast(`Az óraállás nem lehet kisebb az előzőnél (${fmt(h0, 1)}).`);
      return;
    }
    const span = h1 - h0,
      idle = +v.idle || 0;
    const e: MachineLog = {
      date: new Date(TODAY),
      machine: m.id,
      operator: op.name,
      src: m.src === "szalagmérleg" ? "szalagmérleg + kezelő" : m.src!,
      hStart: h0,
      hEnd: h1,
      run: span,
      idle,
      idleReason: idle ? v.reason : "",
      fault: v.fault ? v.faultText || "hiba, leírás nélkül" : "",
      photo: OPA.photo,
      prod: null,
    };
    if (m.id === "OSZT-01") {
      e.prod = { p4: 420, p9: 180, p10: 260, p11: 510 };
      Object.entries(e.prod).forEach(([pid, t]) =>
        move(TODAY, pid, P(pid).depot, t, "gyártás", e.id || "GN"),
      );
    }
    if (m.id === "TOR-01" && v.feed !== undefined && v.feed !== null)
      e.feed = +v.feed;
    mlogAdd(e);
    OPA.photo = null;
    log(
      `${op.name} (gépkezelő app)`,
      `Műszak lezárva: ${m.id}, ${fmt(span, 1)} üzemóra, ${fmt(idle, 1)} h állás${e.fault ? " · HIBA" : ""}`,
      e.id,
    );
    if (e.fault) {
      const w = newJM(m.id, `Hibajegy: ${e.fault}`, "Hibajegy", e.id);
      log(
        "AI · Karbantartás-tervező",
        `Hibajegyből munkalap: ${w.id} (${m.id}); szerelő értesítve`,
        w.id,
      );
    }
    render();
    toast(
      e.fault ? "Műszak lezárva, hibajegy a szerelőknek." : "Műszak lezárva.",
    );
  }

  /* ---- Munkalap (JM) + szerelő app ---- */
  SEQ.JM = 86;
  function newJM(mid: string, name: string, status: string, ref?: string) {
    const w = {
      id: "JM-2026-" + String(++SEQ.JM).padStart(4, "0"),
      machine: mid,
      name,
      due: new Date(TODAY),
      kit: [],
      hours: 0,
      status: status || "Tervezett",
      mech: [] as string[],
      used: [] as State["wos"][number]["used"],
      start: null,
      end: null,
      ref,
    };
    S.wos.unshift(w);
    return w;
  }
  const MCH = { me: "E9", sel: null as string | null };
  function setMechanic(id: string) {
    MCH.me = id;
    render();
  }
  function selectWo(id: string) {
    MCH.sel = id;
    render();
  }
  function compatOK(p: { compat?: string[] }, mid: string) {
    const c = p.compat || [];
    return (
      c.some((x) => /minden/.test(x)) ||
      c.includes(mid) ||
      (c.includes("tehergépkocsik") && S.trucks.some((t) => t.id === mid))
    );
  }
  const empName = (id: string) => S.employees.find((e) => e.id === id)!.name;
  // V.mechapp backfills these on every render; seeded ML- work orders have neither.
  function woBackfill(w: State["wos"][number]) {
    w.mech ??= [];
    w.used ??= [];
  }
  function woStart(id: string) {
    const w = S.wos.find((x) => x.id === id)!;
    woBackfill(w);
    w.start = now();
    w.mech = [MCH.me];
    w.status = "Folyamatban";
    if (!w.id.startsWith("JM")) {
      w.jm = w.id;
    }
    log(`${empName(MCH.me)} (szerelő app)`, "Munka megkezdve", w.id);
    render();
  }
  function woJoin(id: string) {
    const w = S.wos.find((x) => x.id === id)!;
    woBackfill(w);
    w.mech!.push(MCH.me);
    render();
  }
  function woPart(id: string, sid: string, qIn: string) {
    const w = S.wos.find((x) => x.id === id)!;
    woBackfill(w);
    const p = S.parts.find((x) => x.id === sid)!;
    const q = +qIn;
    if (!(q > 0) || q > p.qty) {
      toast("Nincs elég készlet.");
      return;
    }
    if (!compatOK(p, w.machine) && !w._ovr) {
      w._ovr = true;
      toast(
        `${p.name} nem kompatibilis a ${w.machine} géppel. Újabb kattintás: kivét mégis.`,
      );
      return;
    }
    issuePart(p.id, q, w.machine);
    w.used!.push({
      sid: p.id,
      name: p.name,
      q,
      unit: p.unit,
      cost: q * p.price,
    });
    S.qrlog.unshift({
      t: now(),
      mode: "Kiadás",
      item: p.name,
      code: "MP-CIKK-" + p.id.toUpperCase(),
      qty: q,
      unit: p.unit,
      to: `Munkalap: ${w.id} → ${w.machine}`,
      tcode: "MP-ML-" + w.id,
      cost: q * p.price,
      costTo: `munkalap ${w.id} → gépköltség`,
    });
    render();
  }
  function woClose(id: string, hours: string, done: string) {
    const w = S.wos.find((x) => x.id === id)!;
    woBackfill(w);
    const m = S.machines.find((x) => x.id === w.machine)!;
    w.end = now();
    w.hours = +hours || 1;
    w.done = done;
    const rate = (720000 * 1.13) / 168;
    w.labor = w.hours * w.mech!.length * rate;
    S.issues.push({
      t: now(),
      sid: "s4",
      qty: 0,
      machine: m.id,
      cost: w.labor,
      labor: true,
    });
    if (/szerviz/.test(w.name)) m.next = m.svcEvery;
    w.status = "Lezárva";
    log(
      `${empName(MCH.me)} (szerelő app)`,
      `Munkalap lezárva: ${w.id}, ${fmt(w.hours, 1)} h × ${w.mech!.length} szerelő, alkatrész ${ft(w.used!.reduce((a, u) => a + u.cost, 0))}`,
      w.id,
    );
    MCH.sel = null;
    render();
    toast("Munkalap lezárva, költség a gépen.");
  }

  /* ---- Mérleg rendszámfelismeréssel ---- */
  S.anpr = [];
  S.loadWait = [];
  interface ScaleCur {
    plate: string;
    kind: "own" | "waste" | "unknown";
    fid?: string;
    conf: number;
    gross: number;
    wait: number;
  }
  const SCALE = { cur: null as ScaleCur | null, q: 0 };
  function anprQueue() {
    const own = S.transports
      .filter((f) => iso(f.date) === iso(TODAY) && f.status === "Tervezett")
      .sort((a, b) => (a.start || 0) - (b.start || 0));
    const out: { plate: string; kind: ScaleCur["kind"]; fid?: string }[] =
      own.map((f) => ({ plate: f.truck!, kind: "own", fid: f.id }));
    out.splice(1, 0, { plate: "KZT-482", kind: "waste" });
    out.splice(3, 0, { plate: "ABC-123", kind: "unknown" });
    return out;
  }
  const clockHM = () =>
    now().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  function scaleArrive() {
    const q = anprQueue();
    const done = new Set(S.anpr.map((a) => a.plate + (a.fid || "")));
    const nx = q.find((x) => !done.has(x.plate + (x.fid || "")));
    if (!nx) {
      toast("Nincs több mai érkező jármű.");
      return;
    }
    const f = nx.fid && S.transports.find((x) => x.id === nx.fid);
    const t = f && TR(f.truck);
    const wait = 8 + ((S.anpr.length * 7) % 19);
    SCALE.cur = {
      ...nx,
      conf: nx.kind === "unknown" ? 61 : 96 + (S.anpr.length % 4),
      gross:
        f && t
          ? +(t.tare! + f.planned + ((S.anpr.length % 3) - 1) * 0.35).toFixed(2)
          : nx.kind === "waste"
            ? 36.4
            : 28.1,
      wait,
    };
    render();
  }
  function scaleNext() {
    const c = SCALE.cur!;
    S.anpr.unshift({
      t: clockHM(),
      plate: c.plate,
      conf: c.conf,
      fid: c.fid,
      match: c.fid || "",
      exc: c.kind === "unknown" ? "ismeretlen rendszám" : "félreállítva",
    });
    SCALE.cur = null;
    render();
  }
  function scaleFix(plateIn: string) {
    const p = (plateIn || "").toUpperCase().trim();
    const f = S.transports.find(
      (x) =>
        x.truck === p && iso(x.date) === iso(TODAY) && x.status === "Tervezett",
    );
    if (!f) {
      toast("Ehhez a rendszámhoz nincs mai elfogadott fuvar.");
      return;
    }
    SCALE.cur = {
      plate: p,
      kind: "own",
      fid: f.id,
      conf: 100,
      gross: +(TR(p).tare! + f.planned).toFixed(2),
      wait: SCALE.cur!.wait,
    };
    log("Mérlegkezelő (ember)", `Rendszám kézzel javítva: ${p}`);
    render();
  }
  function scaleOk() {
    const c = SCALE.cur!;
    const f = S.transports.find((x) => x.id === c.fid)!;
    const t = TR(f.truck);
    const net = +(c.gross - t.tare!).toFixed(2);
    closeTransport(f.id, net, 0);
    S.loadWait.push({ t: now(), min: c.wait, truck: t.id });
    S.anpr.unshift({
      t: clockHM(),
      plate: c.plate,
      conf: c.conf,
      fid: f.id,
      match: `${f.id} · ${f.clientName}`,
      net,
      wait: c.wait,
      done: true,
    });
    log(
      "Mérleg (automatikus)",
      `Rendszám ${c.plate} → ${f.id}; nettó ${fmt(net, 2)} t → szállítólevél`,
      f.id,
    );
    SCALE.cur = null;
    render();
  }
  function scaleToWaste() {
    const c = SCALE.cur!;
    WASTE.pre = { plate: c.plate, gross: c.gross };
    S.anpr.unshift({
      t: clockHM(),
      plate: c.plate,
      conf: c.conf,
      match: "hulladék-beszállítás",
      done: false,
    });
    SCALE.cur = null;
    WASTE.tab = "new";
    go("waste");
  }

  /* ---- Hulladéklerakó ---- */
  S.wcodes = [
    {
      code: "17 05 04",
      name: "Föld és kövek (nem veszélyes)",
      price: 2400,
      ok: true,
    },
    {
      code: "17 01 07",
      name: "Beton, tégla, cserép keveréke",
      price: 3600,
      ok: true,
    },
    { code: "17 01 01", name: "Beton", price: 3100, ok: true },
    {
      code: "17 09 04",
      name: "Kevert építési-bontási hulladék",
      price: 0,
      ok: false,
    },
  ];
  S.wpart = [
    {
      id: "W1",
      name: "Fejér-Bontó Kft.",
      kuj: "[KÜJ a felmérésből]",
      ktj: "[KTJ a felmérésből]",
      plates: ["KZT-482", "KZT-519"],
      codes: ["17 05 04", "17 01 07"],
    },
    {
      id: "W2",
      name: "V-Híd Építő Zrt.",
      kuj: "[KÜJ]",
      ktj: "[KTJ]",
      plates: ["VHD-114"],
      codes: ["17 05 04", "17 01 01"],
    },
    {
      id: "W3",
      name: "Polgárdi Önkormányzat",
      kuj: "[KÜJ]",
      ktj: "[KTJ]",
      plates: ["POL-001"],
      codes: ["17 05 04"],
    },
  ];
  S.wlog = [];
  SEQ.HL = 40;
  S.wpolicy = { tax: 0 };
  function wasteAdd(e: WasteEntry) {
    e.id = "HL-2026-" + String(++SEQ.HL).padStart(4, "0");
    const c = S.wcodes.find((x) => x.code === e.code)!;
    e.fee = e.net * c.price;
    e.taxFee = e.net * S.wpolicy.tax;
    S.wlog.unshift(e);
    return e;
  }
  const WASTE = {
    tab: "list",
    pre: null as { plate: string; gross: number } | null,
    photo: null as string | null,
  };
  function setWasteTab(k: string) {
    WASTE.tab = k;
    render();
  }
  function setWasteTax(v: string) {
    S.wpolicy.tax = +v;
    render();
  }
  function wasteCsv() {
    return [
      "sorszam;datum;partner;rendszam;hulladekkod;netto_t;kisero_dok",
      ...S.wlog.map((w) =>
        [
          w.id,
          iso(w.date),
          S.wpart.find((p) => p.id === w.partner)!.name,
          w.plate,
          w.code,
          String(w.net).replace(".", ","),
          w.doc,
        ].join(";"),
      ),
    ].join("\n");
  }
  async function wasteCsvDownload() {
    const rows = wasteCsv();
    try {
      if (ui.download) {
        await ui.download("hulladek_nyilvantartas_2026_10.csv", "﻿" + rows);
        return;
      }
    } catch {
      /* falls through to the demo's toast */
    }
    toast("A letöltés ebben a nézetben nem érhető el.");
  }
  function wasteInvoice(pid: string) {
    const p = S.wpart.find((x) => x.id === pid)!;
    const ws = S.wlog.filter((w) => w.partner === p.id && !w.inv);
    const by: Record<string, number> = {};
    ws.forEach((w) => {
      by[w.code] = (by[w.code] || 0) + w.net;
    });
    const items: InvoiceItem[] = Object.entries(by).map(([k, t]) => ({
      name: `Hulladékátvétel ${k} — ${S.wcodes.find((c) => c.code === k)!.name}`,
      unit_price: S.wcodes.find((c) => c.code === k)!.price,
      unit_price_type: "net",
      quantity: +t.toFixed(2),
      unit: "t",
      vat: "27%",
    }));
    const net = items.reduce((a, i) => a + i.unit_price * i.quantity, 0);
    const doc: Doc = {
      id: nid("SZ", (n) => "SZ-" + n),
      type: "Számla",
      kind: "Gyűjtőszámla (havi)",
      ref: `hulladéklerakó, ${ws.length} beszállítás`,
      order: "—",
      clientName: p.name,
      amount: net,
      gross: net * 1.27,
      items,
      created: now(),
      due: addDays(TODAY, 15),
      status: "Sorban (Billingo)",
      nav: "—",
      payload: { type: "invoice", items },
    };
    S.docs.unshift(doc);
    job("Billingo", "Számla kiállítás", doc.id, doc.payload, () => {
      doc.status = "Billingóban kiállítva";
      doc.number = "MP-2026-" + String(++SEQ.SZ).padStart(4, "0");
      doc.nav = "Befogadva";
      return doc.number;
    });
    ws.forEach((w) => (w.inv = doc.id));
    log(
      "AI · Számlázó",
      `Hulladéklerakó gyűjtőszámla: ${p.name}, ${ft(net)} nettó`,
    );
    render();
    toast("Számla kiállítva.");
  }
  function setWastePhoto(img: string) {
    WASTE.photo = img;
    toast("Dokumentum-fotó csatolva.");
  }
  /** wform submit. */
  function submitWaste(v: {
    partner: string;
    plate: string;
    code: string;
    doc: string;
    gross: string;
    tare: string;
  }) {
    const code = v.code;
    const c = S.wcodes.find((x) => x.code === code)!;
    const p = S.wpart.find((x) => x.id === v.partner)!;
    if (!c.ok) {
      toast(
        `A ${code} kód nem szerepel a fogadási engedélyben — a beszállítás nem fogadható.`,
      );
      log(
        "Hulladék-nyilvántartó (AI)",
        `Elutasítva: ${code} (${p.name}) — engedélyen kívüli kód`,
      );
      return;
    }
    if (!p.codes.includes(code)) {
      toast(
        `${p.name} szerződésében nincs ${code}; rögzítve, de jóváhagyásra küldve.`,
      );
      approval(
        "inv",
        "W-" + code,
        `Hulladék szerződésen kívüli kóddal — ${p.name}`,
        `${code} nincs a partner szerződésében`,
        "Javaslat: szerződésmódosítás vagy eseti díj",
      );
    }
    const g = +v.gross,
      t = +v.tare;
    const e = wasteAdd({
      date: new Date(TODAY),
      partner: p.id,
      plate: v.plate.toUpperCase(),
      code,
      gross: g,
      tare: t,
      net: +(g - t).toFixed(2),
      doc: v.doc,
      photo: WASTE.photo,
    });
    WASTE.photo = null;
    WASTE.pre = null;
    const a = S.anpr.find((x) => x.plate === e.plate && !x.done);
    if (a) {
      a.done = true;
      a.net = e.net;
      a.match = `${e.id} · hulladék`;
    }
    log(
      "Hulladéklerakó (ember)",
      `Beszállítás: ${p.name}, ${code}, ${fmt(e.net, 2)} t`,
      e.id,
    );
    WASTE.tab = "list";
    render();
    toast("Rögzítve.");
  }

  /* ---- Bejövő számla → gép (költséghely-szabály) ---- */
  S.inbound.push(
    {
      id: "BE-5",
      sup: "Komatsu márkaszerviz",
      no: "KM-2026-0912",
      date: "2026-10-02",
      net: 1240000,
      due: "2026-11-01",
      po: "—",
      item: "D61PX hidraulikaszivárgás javítása, kiszállással",
      rec: "munkalap nincs",
      status: "Rendelés nélkül",
    },
    {
      id: "BE-6",
      sup: "Gumiker Kft.",
      no: "GK-26-5521",
      date: "2026-10-01",
      net: 2900000,
      due: "2026-10-31",
      po: "PO-2026-16",
      item: "2 db 23.5R25 abroncs",
      rec: "2 db bevételezve (QR)",
      status: "Egyeztetve",
    },
  );
  function aiMach(b: Inbound): { m: string | null; why: string } {
    const txt = (b.item + " " + b.sup).toLowerCase();
    const hit = S.machines
      .filter((m) => m.stage !== "fuvar")
      .find((m) => {
        const n = m.name.toLowerCase();
        return (
          txt.includes(m.id.toLowerCase()) ||
          n
            .split(" ")
            .filter((w) => w.length > 3 && /\d/.test(w))
            .some((w) => txt.includes(w.toLowerCase()))
        );
      });
    if (hit)
      return {
        m: hit.id,
        why: `a tételben a ${hit.name.split(" ").slice(1, 3).join(" ")} típusjel szerepel`,
      };
    if (/gázolaj|üzemanyag/.test(txt))
      return {
        m: "KÚT",
        why: "üzemanyag: a kúttartályba; gépre az RFID-tankoláskor kerül",
      };
    if (/robbant/.test(txt))
      return { m: "—", why: "nem gépköltség: kitermelés költséghely" };
    if (/23\.5r25|abroncs/.test(txt))
      return {
        m: "RAK-01",
        why: "a 23.5R25 abroncs a RAK-01…03 rakodókhoz kompatibilis; a QR-kiadás dönti el a gépet",
      };
    if (/hidraulika/.test(txt))
      return { m: "TOR-01", why: "QR-kiadás 10. 02.: 40 l HV46 → TOR-01" };
    return { m: null, why: "nem találtam gépet" };
  }
  S.inbound.forEach((b) => {
    b.ai = aiMach(b);
  });
  function setInboundMachine(id: string, v: string) {
    const b = S.inbound.find((x) => x.id === id)!;
    b.mach = v || null;
    log(
      "Pénzügy (ember)",
      `Bejövő számla költséghelye: ${b.no} → ${b.mach || "—"}`,
    );
    render();
  }
  function acceptInboundAi(id: string) {
    const b = S.inbound.find((x) => x.id === id)!;
    b.mach = b.ai!.m;
    log("Pénzügy (ember)", `AI-javaslat elfogadva: ${b.no} → ${b.mach}`);
    render();
  }

  /* ---- RFID-tankolás, kártyaimport, kompatibilis gépek ---- */
  S.fuelLog = [];
  function rfidFill(mid: string, l: number, silent?: boolean) {
    const tag = "RFID-" + mid;
    issuePart(
      "s1",
      l,
      S.machines.find((m) => m.id === mid)
        ? mid
        : S.machines.find((m) => m.id === mid)?.id || mid,
    );
    S.fuelLog.unshift({ t: clockHM(), tag, m: mid, l, cost: l * S.diesel });
    if (!silent) log("Kút (RFID, automatikus)", `${mid} → ${l} l`);
  }
  function submitRfid(mid: string, l: number) {
    if (!(l > 0)) return;
    rfidFill(mid, l);
    render();
    toast(`${mid}: ${l} l, költség a gépen.`);
  }
  function cardImport() {
    S.cardImp = [
      {
        truck: "SMP-118",
        where: "MOL Székesfehérvár",
        l: 260,
        cost: 260 * 612,
        it: 180,
        ok: false,
      },
      {
        truck: "MPK-103",
        where: "Shell Polgárdi",
        l: 310,
        cost: 310 * 609,
        it: 308,
        ok: true,
      },
      {
        truck: "RKX-530",
        where: "OMV Siófok",
        l: 290,
        cost: 290 * 615,
        it: 291,
        ok: true,
      },
    ];
    log(
      "Pénzügy (import)",
      "Üzemanyagkártya-export betöltve: 3 tankolás, 1 eltérés",
    );
    render();
  }

  /* ---- Közvetlen megrendelés, projekt, PDF/Excel ---- */
  {
    const _parse5 = parseInquiry;
    parseInquiry = function (text, from) {
      const r = _parse5(text, from);
      const pm = text.match(/projekt\s*[:\-–]?\s*([^\n;]{3,60})/i);
      r.project = pm ? pm[1].trim() : "";
      return r;
    };
  }
  function directOrder(id: string) {
    const inq = S.inquiries.find((x) => x.id === id)!;
    const ex = inq.ex!;
    const pr = priceEngine({
      clientId: ex.clientId,
      lines: ex.lines,
      zip: ex.zip,
    });
    const q: Quote = {
      id: nid("A", (n) => "A-2026-" + n),
      inq: inq.id,
      clientId: ex.clientId,
      clientName: C(ex.clientId)!.name,
      zip: ex.zip,
      city: ex.city,
      addr: ex.addr,
      date: ex.date || addDays(TODAY, 2),
      pr,
      created: now(),
      valid: addDays(TODAY, 14),
      status: "Kiküldve",
      direct: true,
    };
    S.quotes.unshift(q);
    const o = quoteToOrder(q.id)!;
    o.project = ex.project || "";
    q.status = "Megrendelve";
    inq.status = "Közvetlen megrendelés";
    inq.directOrder = o.id;
    S.approvals
      .filter((a) => a.refId === inq.quoteId && a.status === "Vár")
      .forEach((a) => (a.status = "Elutasítva"));
    const oq = S.quotes.find((x) => x.id === inq.quoteId);
    if (oq && !oq.orderId) oq.status = "Felülírva";
    log(
      "Vevőkezelés (ember)",
      `Közvetlen megrendelés ajánlat nélkül: ${o.id}${o.project ? " · projekt: " + o.project : ""}`,
      o.id,
    );
    render();
    toast(`Megrendelés: ${o.id}; szerződés és fuvarjavaslat indul.`);
  }

  /* ---- Napi tonnacél → autók, fordulók, sofőrök ---- */
  const CAP = {
    target: 600,
    oid: null as string | null,
    zip: "8000",
    pid: "p11",
    date: iso(addDays(TODAY, 3)),
  };
  function capacityPlan(
    target: number,
    zip: string,
    _pid: string,
    date: string,
  ) {
    const d = new Date(date + "T09:00");
    const o = { zip, city: "", addr: "" };
    const rules = addrRules(o);
    const km = distKm(zip);
    const cyc = 0.58 + km / 52 + km / 58,
      drv = km / 52 + km / 58;
    const rows: { t: Truck; d: Driver; trips: number; tons: number }[] = [];
    let left = target;
    const trucks = [...S.trucks]
      .filter((t) => !(t.mot < date))
      .filter(
        (t) =>
          !rules.some(
            (r) =>
              (r.maxGross && parseFloat(t.gross) > r.maxGross) ||
              (r.needPermit && !/budapest/i.test(t.permit)) ||
              (r.euro && t.euro !== r.euro) ||
              (r.tip && t.tip !== r.tip),
          ),
      )
      .map((t) => {
        const td = truckDay(t.id, d);
        return { t, free: Math.max(0, 18 - Math.max(6, td.end)) };
      })
      .filter((x) => x.free > cyc)
      .sort((a, b) => b.t.cap - a.t.cap || truckFtKm(a.t) - truckFtKm(b.t));
    const usedD = new Set<string>();
    for (const x of trucks) {
      if (left <= 0.1) break;
      const dr = S.drivers
        .filter(
          (q) =>
            !usedD.has(q.id) &&
            !isLeave(q, d) &&
            q.avail !== "Betegszabadság" &&
            !(q.lic === "C" && x.t.type !== "4 tengelyes billencs"),
        )
        .map((q) => ({ q, dd: driverDay(q.id, d) }))
        .filter((z) => z.dd.drive + drv <= 9)
        .sort((a, b) => a.dd.work - b.dd.work || b.q.eco - a.q.eco)[0];
      if (!dr) continue;
      const byTime = Math.floor(x.free / cyc),
        byDrive = Math.floor((9 - dr.dd.drive) / drv);
      const trips = Math.min(byTime, byDrive, Math.ceil(left / x.t.cap));
      if (trips < 1) continue;
      const tons = Math.min(left, trips * x.t.cap);
      rows.push({ t: x.t, d: dr.q, trips, tons });
      left -= tons;
      usedD.add(dr.q.id);
    }
    return { rows, left: Math.max(0, left), km, cyc, trucks: trucks.length };
  }
  function setCap(k: "oid" | "date" | "target" | "zip", v: string) {
    if (k === "oid") CAP.oid = v || null;
    else if (k === "target") CAP.target = +v;
    else CAP[k] = v;
    render();
  }
  function capMake() {
    const o = S.orders.find((x) => x.id === CAP.oid)!;
    const pid = o.lines[0].pid;
    const plan = capacityPlan(+CAP.target, o.zip, pid, CAP.date);
    const d = new Date(CAP.date + "T09:00");
    let n = 0;
    plan.rows.forEach((r) => {
      for (let i = 0; i < r.trips; i++) {
        const t = Math.min(r.t.cap, r.tons - i * r.t.cap);
        if (t <= 0.1) break;
        const f: Transport = {
          id: nid("F", (x) => "F-2026-" + x),
          order: o.id,
          clientId: o.clientId,
          clientName: o.clientName,
          pid,
          planned: t,
          truck: null,
          driver: "",
          driverId: null,
          date: d,
          prefStart: 6,
          status: "Javasolt",
          net: null,
          depot: P(pid).depot,
          ekaer: ekaerCheck(o, pid, t),
          km: distKm(o.zip),
        };
        S.transports.unshift(f);
        o.planned[pid] = (o.planned[pid] || 0) + t;
        assign(f, r.t.id, r.d.id);
        n++;
      }
    });
    log(
      "AI · Fuvarszervező",
      `Tonnacélból ${n} fuvarjavaslat: ${o.id}, ${CAP.date}`,
      o.id,
    );
    DISP.tab = "day";
    DISP.date = d;
    render();
    toast(`${n} fuvar javasolva.`);
  }

  /* ---- Napi anyagmérleg ---- */
  const MB = { date: iso(TODAY) };
  function setMbDate(v: string) {
    MB.date = v;
    render();
  }

  /* ---- Tulajdonosi „Ma” nézet ---- */
  function todaySummary() {
    const d = iso(TODAY),
      cm = costModel();
    const tr = S.transports.filter(
      (f) =>
        iso(f.date) === d && f.status !== "Törölve" && f.status !== "Javasolt",
    );
    const done = tr.filter((f) => f.status === "Lezárva");
    const tons = done.reduce((a, f) => a + (f.net || 0), 0);
    const rev = done.reduce((a, f) => {
      const o = S.orders.find((x) => x.id === f.order)!;
      const l = o.lines.find((x) => x.pid === f.pid)!;
      return a + f.net! * (l.unitNet + (o.freightPerT || 0));
    }, 0);
    const cost = done.reduce(
      (a, f) => a + f.net! * cm.unit[f.pid] + (f.km || 0) * 2 * cm.ftPerKm,
      0,
    );
    const feed = (S.shifts || [])
      .filter((x) => iso(x.date) === d)
      .reduce((a, x) => a + x.inT, 0);
    const ml = S.mlog.filter((x) => iso(x.date) === d);
    const prodByM: Record<string, number> = {};
    (S.shifts || [])
      .filter((x) => iso(x.date) === d)
      .forEach((x) => {
        const k = x.recipe.split(" ")[0];
        prodByM[k] = (prodByM[k] || 0) + x.out.reduce((a, o) => a + o.t, 0);
      });
    ml.filter((x) => x.prod).forEach((x) => {
      prodByM[x.machine] =
        (prodByM[x.machine] || 0) +
        Object.values(x.prod!).reduce((a, v) => a + v, 0);
    });
    const working = new Set(tr.map((f) => f.truck)).size;
    const lw = S.loadWait.filter((x) => iso(x.t) === d);
    const dw = done.filter((f) => f.wait);
    const ar = S.docs.filter(
      (x) =>
        x.type === "Számla" && !x.paid && x.status !== "Sztornó" && x.number,
    );
    return {
      d,
      feed,
      prodByM,
      tons,
      rev,
      margin: rev - cost,
      trucks: S.trucks.length,
      working,
      trips: tr.length,
      tripsDone: done.length,
      loadWait: lw.length
        ? lw.reduce((a, x) => a + x.min, 0) / lw.length
        : null,
      dropWait: dw.length
        ? dw.reduce((a, f) => a + f.wait!, 0) / dw.length
        : null,
      fuel: S.fuelLog.reduce((a, x) => a + x.l, 0),
      idle: ml.reduce((a, x) => a + x.idle, 0),
      idleWhy: ml
        .filter((x) => x.idle)
        .map((x) => `${x.machine}: ${fmt(x.idle, 1)} h (${x.idleReason})`),
      faults: ml.filter((x) => x.fault).map((x) => `${x.machine}: ${x.fault}`),
      service: (S.wos || [])
        .filter(
          (w) =>
            w.status !== "Lezárva" &&
            (w.status !== "Tervezett" || iso(w.due) <= d),
        )
        .map((w) => `${w.machine} (${w.id}, ${w.status.toLowerCase()})`),
      ar: ar.reduce((a, x) => a + x.gross!, 0),
      overdue: ar
        .filter((x) => x.due && x.due < TODAY)
        .reduce((a, x) => a + x.gross!, 0),
      stock: S.products.map((p) => ({ name: p.name, t: stockOf(p.id) })),
      cust: custProfit()
        .slice(0, 4)
        .map((c) => ({ name: c.name, pct: c.margin / c.rev })),
      mach: cm.mach
        .filter((m) => m.stage !== "fuvar")
        .map((m) => ({ id: m.id, perH: m.perH })),
    };
  }
  {
    const _et5 = erpTools;
    erpTools = function () {
      return [
        ..._et5(),
        {
          name: "mai_nap",
          description:
            "A mai nap összefoglalója: kitermelés, termelés gépenként, kiszállított tonna, árbevétel, fedezet, autók, várakozás, gépállás okokkal, hibák, szerviz, kintlévőség.",
          execute: () => {
            const s = todaySummary();
            return { ...s, stock: undefined, cust: undefined };
          },
        },
        {
          name: "gepnaplo",
          description:
            "Gépüzemnapló az elmúlt napokra: gép, kezelő, üzemóra, állásidő és oka, hiba, termelés frakciónként; összevetve a tervvel (OSZT-01 terv: 1500 t/műszak, TOR-01 terv: 220 t/óra).",
          execute: () =>
            S.mlog.slice(0, 20).map((x) => ({
              nap: iso(x.date),
              gep: x.machine,
              uzem: x.run,
              allas: x.idle,
              ok: x.idleReason,
              hiba: x.fault,
              termeles: x.prod,
              feladas: x.feed,
            })),
        },
      ];
    };
  }
  /** X.ask5: the "Ma" view's question with its own prompt. */
  async function askToday(q: string) {
    const SAMPLE = ui.sample;
    if (!SAMPLE) return;
    S.ask = { q, a: "", busy: true };
    render();
    try {
      const { text } = await SAMPLE(
        `Te a Mészkő-Polgár Kft. ERP-rendszerének AI-asszisztense vagy. A tulajdonos kérdésére válaszolj magyarul, legfeljebb 6 rövid mondatban, konkrét számokkal; csak az eszközök adataira támaszkodj, és ha valami nem derül ki, mondd meg. Zárd egy javasolt teendővel.\n\nKérdés: ${q}`,
        {
          tools: erpTools(),
          onText: ({ text }) => {
            S.ask.a = text;
          },
        },
      );
      S.ask.a = text;
    } catch (e) {
      S.ask.a = errField(e, "text") || "A válasz nem érkezett meg.";
    }
    S.ask.busy = false;
    render();
  }
  /** X.askq after round 5: the "Ma" view uses askToday, other views ask(). */
  function askQuick(q: string) {
    S.ask.q = q;
    if (ui.route === "today") {
      void askToday(q);
    } else {
      render();
      void ask(q);
    }
  }

  /* ---- navigáció, ügynökök ---- */
  S.agents.push(
    {
      id: "waste",
      name: "Hulladék-nyilvántartó",
      does: "A mérlegből és a kísérő dokumentumból rögzíti a beszállítást, ellenőrzi a fogadási engedélyt, havi nyilvántartást és számlát készít.",
      mode: "suggest",
    },
    {
      id: "invoicein",
      name: "Bejövőszámla-olvasó",
      does: "Kiolvassa a szállítói számlát, gépet vagy munkalapot javasol; gépazonosító nélkül nem enged könyvelést.",
      mode: "suggest",
    },
  );
  PHASES.push(
    [
      "Mérlegelés",
      "Mérleg (automatikus)",
      "rendszám → fuvar → nettó tömeg → szállítólevél",
      "ismeretlen rendszám, túltöltés, hiányzó EKÁER",
    ],
    [
      "Gépüzemnapló, szerviz",
      "Karbantartás-tervező",
      "műszakzárásból üzemóra, állásidő, hibajegy → munkalap",
      "munkalap lezárása (szerelő)",
    ],
    [
      "Hulladéklerakó",
      "Hulladék-nyilvántartó",
      "beszállítás, engedély-ellenőrzés, nyilvántartás, számla",
      "nem engedélyezett kód",
    ],
    [
      "Bejövő számla",
      "Bejövőszámla-olvasó",
      "kiolvasás, gép/munkalap-javaslat, 3-utas egyeztetés",
      "költséghely elfogadása, fizetés",
    ],
  );

  /* ---- seed ---- */
  {
    const _seed5 = seed;
    seed = function () {
      _seed5();
      const y = addDays(TODAY, -1);
      (
        [
          [
            "DOZ-01",
            "Kovács Imre",
            "kezelői jelentés",
            6403.2,
            6412,
            0.4,
            "várakozás anyagra / autóra",
            "",
            null,
          ],
          [
            "TOR-01",
            "Pap József",
            "kezelői + rakodómérleg",
            3175.1,
            3184,
            0.9,
            "meghibásodás",
            "",
            null,
          ],
          [
            "RAK-01",
            "Simon Dávid",
            "kezelői + kanálmérleg",
            8832.3,
            8841,
            0.3,
            "várakozás anyagra / autóra",
            "",
            null,
          ],
        ] as [
          string,
          string,
          string,
          number,
          number,
          number,
          string,
          string,
          null,
        ][]
      ).forEach(([m, op, src, h0, h1, idle, why, f]) => {
        const e = mlogAdd({
          date: y,
          machine: m,
          operator: op,
          src,
          hStart: h0,
          hEnd: h1,
          run: h1 - h0,
          idle,
          idleReason: why,
          fault: f || "",
          prod: null,
        });
        if (m === "TOR-01") e.feed = 1640;
      });
      const oz = mlogAdd({
        date: y,
        machine: "OSZT-01",
        operator: "Lakatos Ernő",
        src: "szalagmérleg + kezelő",
        hStart: 2910.6,
        hEnd: 2920,
        run: 9.4,
        idle: 0.6,
        idleReason: "várakozás anyagra / autóra",
        fault: "",
        prod: { p4: 420, p9: 180, p10: 260, p11: 510 },
      });
      Object.entries(oz.prod!).forEach(([pid, t]) =>
        move(y, pid, P(pid).depot, t, "gyártás", oz.id),
      );
      mlogAdd({
        date: new Date(TODAY),
        machine: "DOZ-01",
        operator: "Kovács Imre",
        src: "kezelői jelentés",
        hStart: 6412,
        hEnd: 6417.5,
        run: 5.5,
        idle: 2.1,
        idleReason: "meghibásodás",
        fault: "hidraulika szivárog a bal emelőhengernél",
        prod: null,
      });
      newJM(
        "DOZ-01",
        "Hibajegy: hidraulika szivárog a bal emelőhengernél",
        "Hibajegy",
        "GN-0006",
      );
      (
        [
          ["RAK-01", 237],
          ["TOR-01", 410],
          ["DOZ-01", 198],
          ["RAK-02", 205],
        ] as [string, number][]
      ).forEach(([m, l]) => rfidFill(m, l, true));
      S.loadWait.push({ t: new Date(TODAY), min: 12, truck: "RKX-412" });
      S.anpr.push({
        t: "06:41",
        plate: "RKX-412",
        conf: 98,
        fid: "",
        match: "V-Híd · 1. forduló",
        net: 24.8,
        wait: 12,
        done: true,
      });
      (
        [
          ["W1", "KZT-482", "17 05 04", 36.2, 14.2, "SZJ-2026-091", -2],
          ["W1", "KZT-519", "17 01 07", 31.5, 14.0, "SZJ-2026-092", -2],
          ["W2", "VHD-114", "17 05 04", 33.9, 14.6, "SZJ-2026-094", -1],
          ["W3", "POL-001", "17 05 04", 18.4, 9.1, "SZJ-2026-095", -1],
          ["W1", "KZT-482", "17 01 07", 35.0, 14.2, "SZJ-2026-096", 0],
        ] as [string, string, string, number, number, string, number][]
      ).forEach(([p, pl, c, g, t, doc, dd]) =>
        wasteAdd({
          date: addDays(TODAY, dd),
          partner: p,
          plate: pl,
          code: c,
          gross: g,
          tare: t,
          net: +(g - t).toFixed(2),
          doc,
          photo: null,
        }),
      );
      AE.mode = "suggest";
      S.transports
        .filter(
          (f) =>
            f.ekaer &&
            f.ekaer.required &&
            !f.ekaer.number &&
            f.truck &&
            f.status !== "Lezárva" &&
            f.status !== "Törölve",
        )
        .slice(0, 6)
        .forEach((f) => ekaerSubmit(f.id, true));
      S.audit.sort((a, b) => msBetween(b.t, a.t));
    };
  }

  /* ---- bootstrap ---- */
  SEEDING = true;
  seed();
  SEEDING = false;

  // Patched bindings are read through getters so callers always get the final version.
  const q = {
    P,
    C,
    D,
    DR,
    TR,
    stockOf,
    reservedOf,
    costModel,
    distKm,
    priceEngine: (a: PriceArgs) => priceEngine(a),
    counts: () => counts(),
    cashflow,
    insights,
    reorderSuggestions,
    ekaerPayload,
    custProfit,
    overdueOf,
    withSim,
    contractText,
    tigLines,
    tigOk,
    addrRules,
    isLeave,
    truckFtKm,
    dayTrips,
    driverDay,
    truckDay,
    weekDrive,
    evaluate,
    suggest,
    telemPos,
    geoOf,
    dnState,
    dnRows,
    invType,
    empsFor,
    payCalc,
    payChecks,
    payCSV,
    qrTargets,
    qrItems,
    qrLocs,
    qrPOs,
    lastHours,
    compatOK,
    anprQueue,
    capacityPlan,
    todaySummary,
    wasteCsv,
    mode,
  };
  const actions = {
    submitWebInquiry,
    submitStockMove,
    submitIssue,
    setAgentMode,
    setPolicy,
    setPolicyPct,
    swapTruck,
    setSimEkaer,
    setSimBillingo,
    setTargetMargin,
    setMinMargin,
    cancelTransport,
    stornoInvoice,
    selectJob,
    retryClick,
    retryAll,
    syncClick,
    openReport,
    emailInquiry,
    selectInquiry,
    openQuote,
    approveQuote,
    repriceQuote,
    orderFromQuote,
    planClick,
    invoiceClick,
    selectTransport,
    ekaerClick,
    closeClick,
    selectDoc,
    issueClick,
    poClick,
    receivePo,
    setPrice,
    decide: (id: string, ok: boolean) => decide(id, ok),
    ask,
    askQuick,
    claudeParse,
    setSim,
    resetSim,
    fileInquiry,
    closeWoClick,
    submitTransfer,
    submitSurvey,
    submitTank,
    setPortalClient,
    portalAccept,
    portalReorder,
    submitShift,
    submitLab,
    dispTab,
    dispDay,
    dispSetDay,
    dispSelect,
    dispGoto,
    dispWeek,
    dispPick,
    dispAccept: (fid: string) => dispAccept(fid),
    dispAcceptAll,
    dispAuto,
    dispSave,
    dispRows,
    listTruck,
    listDriver,
    setResource,
    toggleLeave,
    addTruck,
    addDriver,
    itsyncClick,
    dragTrip,
    setDriverApp,
    recordPod,
    photoUpload,
    setContractTab,
    openContract,
    sendContract,
    remindContract,
    contractPortal,
    saveTemplate,
    openTig,
    makeTig,
    signTig,
    objectTig,
    portalSignContract,
    openTigFromPortal,
    selectTrip,
    setDnFilter,
    openDn,
    resendDn,
    correctDn,
    stornoDn,
    setInvTab,
    setInvFilter,
    markPaid,
    correctInvoice,
    newAdvance,
    approveInbound,
    paySelect,
    payAi,
    payOk,
    payExport,
    setPayPeriod,
    setPayCfgPct,
    setPayCfg,
    setQrTab,
    setScanMode,
    qrScan,
    qrCommit,
    qrPhoto,
    ekaerSendSelected,
    setOperator,
    setOperatorMachine,
    setOperatorPhoto,
    closeShift,
    setMechanic,
    selectWo,
    woStart,
    woJoin,
    woPart,
    woClose,
    scaleArrive,
    scaleNext,
    scaleFix,
    scaleOk,
    scaleToWaste,
    setWasteTab,
    setWasteTax,
    wasteCsvDownload,
    wasteInvoice,
    setWastePhoto,
    submitWaste,
    setInboundMachine,
    acceptInboundAi,
    submitRfid,
    cardImport,
    directOrder,
    setCap,
    capMake,
    setMbDate,
  };
  // View state of the demo's module-level `let` variables (DISP, SCAN, CAP, …).
  const view = {
    DISP,
    get SCAN() {
      return SCAN;
    },
    get SIM() {
      return SIM;
    },
    CAP,
    MB,
    PAY,
    PAYCFG,
    OPA,
    MCH,
    DRV,
    WASTE,
    SCALE,
    TSUB,
    INVF,
    DNF,
    CS,
    QS,
  };
  const consts = { BUDGET, PHASES, RECIPE, IDLE, GEO, SIG_SVG };

  return {
    q,
    actions,
    view,
    consts,
    get version() {
      return version;
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    onToast(l: (m: string) => void) {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    /** Resolves when async work started by actions (SHA-256 hashes) has settled. */
    settled: () => Promise.all(pending),
    TODAY,
    S,
    get SEQ() {
      return SEQ;
    },
    ui,
    render,
    toast,
    go,
  };
}

export type Demo = ReturnType<typeof createDemo>;
export type { Driver, Truck };
