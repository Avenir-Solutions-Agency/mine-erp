// Incoming invoice portal: the boss's demo (mpkft-szamlaportal-demo.netlify.app), ported verbatim.
// Every invoice is assigned to one cost carrier (truck, machine, person or cost centre).

export type CarrierType =
  "Tehergépkocsi" | "Munkagép" | "Bérelt eszköz" | "Személy" | "Költséghely";

export interface Carrier {
  id: string;
  name: string;
  type: CarrierType;
  /** Nicknames and abbreviations; they help match the handwritten note. */
  aliases: string[];
  note?: string;
}

export interface CarrierCandidate {
  carrier: string;
  /** Percent, 0–100. */
  confidence: number;
  why: string;
}

/** auto: assigned (by AI or by a person); review: waits for a person; unassigned: a person cleared it. */
export type InvoiceStatus = "auto" | "review" | "unassigned";

export interface InvoiceLine {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  net: number;
  vat: number;
  gross: number;
}

export interface IncomingInvoice {
  id: string;
  supplier: string;
  taxNumber: string;
  number: string;
  /** Issue and delivery date, YYYY-MM-DD. */
  date: string;
  due: string;
  payment: string;
  category: string;
  net: number;
  vat: number;
  gross: number;
  handwriting: string;
  warning?: string;
  note?: string;
  candidates: CarrierCandidate[];
  status: InvoiceStatus;
  assigned: string | null;
  lines: InvoiceLine[];
}

export interface InvoicePortal {
  carriers: Carrier[];
  invoices: IncomingInvoice[];
}

type LineTuple = [string, number, string, number, number, number, number];
const lines = (rows: LineTuple[]): InvoiceLine[] =>
  rows.map(([name, qty, unit, unitPrice, net, vat, gross]) => ({
    name,
    qty,
    unit,
    unitPrice,
    net,
    vat,
    gross,
  }));

export function seedInvoicePortal(): InvoicePortal {
  const carriers: Carrier[] = [
    {
      id: "c1",
      name: "ICU-897",
      type: "Tehergépkocsi",
      aliases: ["ICU 897", "ICU897"],
      note: "kistehergépkocsi (benzines)",
    },
    {
      id: "c2",
      name: "UZT-243",
      type: "Tehergépkocsi",
      aliases: ["UZT 243", "UZT243"],
      note: "nyerges billencs",
    },
    {
      id: "c3",
      name: "Volvo EC180 kotró",
      type: "Munkagép",
      aliases: ["Volvo 180", "EC180", "kotró"],
    },
    {
      id: "c4",
      name: "Aggregátor (benzines)",
      type: "Munkagép",
      aliases: ["aggregátor", "aggregator", "agregátor"],
    },
    {
      id: "c5",
      name: "Bérelt gép",
      type: "Bérelt eszköz",
      aliases: ["bérelt gép", "bérelt", "MP 70"],
    },
    {
      id: "c6",
      name: "Radics Mihály",
      type: "Személy",
      aliases: ["Misi", "Miska"],
    },
    { id: "c7", name: "Reni", type: "Személy", aliases: ["Reni", "Renáta"] },
    {
      id: "c8",
      name: "Polgárdi bánya – általános",
      type: "Költséghely",
      aliases: ["bánya", "iroda"],
    },
  ];
  const invoices: Omit<IncomingInvoice, "assigned">[] = [
    {
      id: "i1",
      supplier: "JSI-AUTÓ Kft.",
      taxNumber: "13136464-2-07",
      number: "EVS-HUF/65009",
      date: "2026-10-24",
      due: "2026-11-03",
      payment: "átutalás",
      net: 55335,
      vat: 14942,
      gross: 70277,
      category: "Járműszerviz",
      handwriting: "UZT 243 · MP?0 · Bérelt gép",
      warning:
        "A számla 2 oldalas („Oldal 1/2”), a második oldal hiányzik a szkenből. Kérjük pótolni.",
      candidates: [
        {
          carrier: "c2",
          confidence: 58,
          why: "kézírás „UZT 243” – a 3. karakter bizonytalan",
        },
        { carrier: "c5", confidence: 34, why: "„Bérelt gép” felirat" },
      ],
      status: "review",
      lines: lines([
        [
          "F17109 tárcsáról gumiköpeny le-felszerelés",
          1,
          "db",
          28783,
          28783,
          7771,
          36554,
        ],
        ["O-gyűrű 325T 10mm", 2, "db", 3388.19, 6776, 1830, 8606],
        ["Radiáltapasz TL142 TIP-TOP", 1, "db", 3474, 3474, 938, 4412],
        ["Beépítés", 1, "db", 5906, 5906, 1595, 7501],
        ["Radiáltapasz TL120", 1, "db", 1732.28, 1732, 468, 2200],
        ["Beépítés", 1, "db", 3466, 3466, 936, 4402],
        ["Radiáltapasz TL114", 1, "db", 1732.28, 1732, 468, 2200],
        ["Beépítés", 1, "db", 3466, 3466, 936, 4402],
      ]),
    },
    {
      id: "i2",
      supplier: "Némethné Abt Erika e.v.",
      taxNumber: "46050571-1-27",
      number: "NAER-2026-435",
      date: "2026-10-15",
      due: "2026-10-15",
      payment: "bankkártya",
      net: 20000,
      vat: 0,
      gross: 20000,
      category: "Bérlet",
      handwriting: "VOLVO 180",
      candidates: [
        {
          carrier: "c3",
          confidence: 91,
          why: "alias „Volvo 180” pontos egyezés",
        },
      ],
      status: "auto",
      lines: lines([
        ["Utánfutó bérleti díj (AAM)", 1, "alkalom", 20000, 20000, 0, 20000],
      ]),
    },
    {
      id: "i3",
      supplier: "Kiss Judit e.v.",
      taxNumber: "59161066-2-27",
      number: "KJ-2026-51",
      date: "2026-10-15",
      due: "2026-10-15",
      payment: "bankkártya",
      net: 5268,
      vat: 1422,
      gross: 6690,
      category: "Egyéb beszerzés",
      handwriting: "Misi",
      candidates: [
        { carrier: "c6", confidence: 88, why: "alias „Misi” pontos egyezés" },
      ],
      status: "auto",
      lines: lines([["Bőr szájkosár", 1, "db", 5268, 5268, 1422, 6690]]),
    },
    {
      id: "i4",
      supplier: "Top Service Hungária Kft. (Mister Minit)",
      taxNumber: "12003897-2-42",
      number: "TS074-2026-521",
      date: "2026-10-17",
      due: "2026-10-17",
      payment: "bankkártya",
      net: 30709,
      vat: 8291,
      gross: 39000,
      category: "Egyéb beszerzés",
      handwriting: "Reni",
      note: "Kártyás bizonylat csatolva (OTP, 2026-10-17 11:50, 39 000 Ft) – összeg egyezik.",
      candidates: [
        { carrier: "c7", confidence: 86, why: "alias „Reni” pontos egyezés" },
      ],
      status: "auto",
      lines: lines([
        ["[50-3109] BKS kulcsmásolás", 10, "db", 3070.87, 30709, 8291, 39000],
      ]),
    },
    {
      id: "i5",
      supplier: "MPH Power Zrt. (Jumbo Shop, Nagykanizsa)",
      taxNumber: "14968455-2-44",
      number: "A/A14100113/2258/00008",
      date: "2026-10-04",
      due: "2026-10-04",
      payment: "bankkártya",
      net: 11393,
      vat: 3076,
      gross: 14469,
      category: "Üzemanyag",
      handwriting: "aggregátor",
      candidates: [
        {
          carrier: "c4",
          confidence: 93,
          why: "alias „aggregátor” egyezés; benzin, nem gázolaj – összhangban",
        },
      ],
      status: "auto",
      lines: lines([
        [
          "Jumbo Extra 100/E5 szuperbenzin",
          20.41,
          "l",
          708.9,
          11393,
          3076,
          14469,
        ],
      ]),
    },
    {
      id: "i6",
      supplier: "MOL Retail Zrt. (Székesfehérvár, Balatoni út)",
      taxNumber: "17781774-5-44",
      number: "A06000966/2321/00021",
      date: "2026-10-02",
      due: "2026-10-02",
      payment: "bankkártya",
      net: 5102,
      vat: 1377,
      gross: 6479,
      category: "Üzemanyag",
      handwriting: "ICU 897",
      candidates: [
        {
          carrier: "c1",
          confidence: 72,
          why: "rendszám-minta; a kézírás „ICU” / „ICL” olvasat között bizonytalan",
        },
        {
          carrier: "c4",
          confidence: 18,
          why: "benzin – az aggregátor is benzines",
        },
      ],
      status: "review",
      lines: lines([["EVO 95 benzin", 10.22, "l", 634, 5102, 1377, 6479]]),
    },
  ];
  return {
    carriers,
    invoices: invoices.map((i) => ({
      ...i,
      assigned: i.status === "auto" ? (i.candidates[0]?.carrier ?? null) : null,
    })),
  };
}

function update(
  p: InvoicePortal,
  id: string,
  patch: Partial<IncomingInvoice>,
): InvoicePortal {
  return {
    ...p,
    invoices: p.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  };
}

/** A person picks the carrier; that settles the invoice. */
export function assignCarrier(
  p: InvoicePortal,
  invoiceId: string,
  carrierId: string,
): InvoicePortal {
  if (!p.carriers.some((c) => c.id === carrierId)) return p;
  return update(p, invoiceId, { assigned: carrierId, status: "auto" });
}

/** Approves the current assignment; an invoice without one stays as it is. */
export function approveInvoice(p: InvoicePortal, id: string): InvoicePortal {
  const inv = p.invoices.find((i) => i.id === id);
  if (!inv?.assigned) return p;
  return update(p, id, { status: "auto" });
}

export function unassignInvoice(p: InvoicePortal, id: string): InvoicePortal {
  return update(p, id, { assigned: null, status: "unassigned" });
}

export function invoiceKpis(p: InvoicePortal) {
  return {
    count: p.invoices.length,
    gross: p.invoices.reduce((s, i) => s + i.gross, 0),
    auto: p.invoices.filter((i) => i.status === "auto").length,
    pending: p.invoices.filter((i) => !i.assigned).length,
  };
}

export interface InvoiceLineRow extends InvoiceLine {
  invoice: IncomingInvoice;
}

export function invoiceLineRows(p: InvoicePortal): InvoiceLineRow[] {
  return p.invoices.flatMap((invoice) =>
    invoice.lines.map((l) => ({ ...l, invoice })),
  );
}

/** carrier: a carrier id, "none" for unassigned, "" for all. */
export interface LineFilter {
  query: string;
  carrier: string;
  category: string;
}

export function filterLineRows(
  p: InvoicePortal,
  f: LineFilter,
): InvoiceLineRow[] {
  const q = f.query.trim().toLowerCase();
  const carrierName = (id: string | null) =>
    (id && p.carriers.find((c) => c.id === id)?.name) || "besorolatlan";
  return invoiceLineRows(p).filter(({ name, invoice: i }) => {
    const hay = [
      i.supplier,
      i.number,
      name,
      carrierName(i.assigned),
      i.category,
      i.handwriting,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!q || hay.includes(q)) &&
      (!f.carrier ||
        (f.carrier === "none" ? !i.assigned : i.assigned === f.carrier)) &&
      (!f.category || i.category === f.category)
    );
  });
}

export function sumLines(rows: InvoiceLine[]) {
  return {
    net: rows.reduce((s, r) => s + r.net, 0),
    gross: rows.reduce((s, r) => s + r.gross, 0),
  };
}

/** One row per carrier plus a last row (carrier null) for the unassigned lines. */
export function carrierTotals(p: InvoicePortal) {
  const rows = invoiceLineRows(p);
  return [...p.carriers, null].map((carrier) => {
    const own = rows.filter(
      (r) => r.invoice.assigned === (carrier?.id ?? null),
    );
    return { carrier, lines: own.length, ...sumLines(own) };
  });
}

export function invoiceCategories(p: InvoicePortal): string[] {
  return [...new Set(p.invoices.map((i) => i.category))];
}
