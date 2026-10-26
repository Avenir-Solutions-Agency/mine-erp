// Display helpers of the demo (docs/reference/demo.html lines 150–158), unchanged in behaviour.

// Cached Intl formatters: same output as toLocaleString / toLocaleDateString, without rebuilding one per call.
const numberFormats = new Map<number, Intl.NumberFormat>();
export const fmt = (n: number | null | undefined, d = 0): string => {
  let f = numberFormats.get(d);
  if (!f) {
    f = new Intl.NumberFormat("hu-HU", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    numberFormats.set(d, f);
  }
  return f.format(Number(n || 0));
};
export const ft = (n: number | null | undefined): string => fmt(n) + " Ft";
export const tn = (n: number | null | undefined): string => fmt(n, 1) + " t";
export const mft = (n: number): string => fmt(n / 1e6, 1) + " M Ft";
export const pct = (n: number): string => fmt(n * 100, 1) + " %";
const dateFormat = new Intl.DateTimeFormat("hu-HU");
export const ds = (d: Date | string | number): string =>
  dateFormat.format(new Date(d));
export const addDays = (d: Date | string | number, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// Memoised by timestamp: the dispatch engine calls this for every trip in every evaluation.
const isoCache = new Map<number, string>();
export const iso = (d: Date | string | number): string => {
  const x = new Date(d);
  const k = x.getTime();
  let s = isoCache.get(k);
  if (s === undefined) {
    s =
      x.getFullYear() +
      "-" +
      String(x.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(x.getDate()).padStart(2, "0");
    isoCache.set(k, s);
  }
  return s;
};
export const fmtH = (h: number): string => {
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  return (
    String(hh).padStart(2, "0") +
    ":" +
    String(mm === 60 ? 0 : mm).padStart(2, "0")
  );
};
export const mondayOf = (d: Date | string | number): Date => {
  const x = new Date(d);
  const k = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - k);
  x.setHours(9, 0, 0, 0);
  return x;
};
/** Milliseconds between two dates, the demo's `(a-b)` on Date objects. */
export const msBetween = (a: Date, b: Date): number =>
  a.getTime() - b.getTime();

export const stageName = (s: string): string | undefined =>
  (
    ({
      kitermeles: "Kitermelés",
      toro: "Törés-osztályozás",
      rakodas: "Rakodás-mérlegelés",
      fuvar: "Fuvar",
      rezsi: "Rezsi",
    }) as Record<string, string>
  )[s];

export const kindName = (k: string): string | undefined =>
  (
    ({
      quote: "Árajánlat",
      invoice: "Számla",
      po: "Beszerzés",
      price: "Árazás",
      over: "Túlszállítás",
      int: "Integráció",
      dun: "Követeléskezelés",
      inv: "Leltár",
      wo: "Karbantartás",
      contract: "Szerződés",
    }) as Record<string, string>
  )[k];

/** Demo stPill() status → pill class ('' = neutral). */
export const STATUS_CLASS: Record<string, string> = {
  Kiküldve: "ok",
  Megrendelve: "acc",
  "Jóváhagyásra vár": "ai",
  Piszkozat: "",
  "Ajánlat kiküldve": "ok",
  "Hiányos — visszakérdezés": "warn",
  Új: "acc",
  Lezárva: "ok",
  Úton: "acc",
  Tervezett: "",
  "Billingóban kiállítva": "ok",
  Bejelentve: "ok",
  Bejelentendő: "warn",
  "Nem szükséges": "",
  Teljesítve: "ok",
  Ütemezve: "acc",
  Visszaigazolva: "acc",
  Vár: "ai",
  Jóváhagyva: "ok",
  Elutasítva: "bad",
  "Megrendelve (PO)": "acc",
  Beérkezett: "ok",
  "Kézi feldolgozásra vár": "warn",
  Javasolt: "ai",
  "Aláírásra vár": "ai",
  Iktatva: "ok",
  Kifogásolva: "bad",
  "Elfogadva (e-aláírás)": "ok",
  "Elfogadva (aláírt fotó)": "ok",
  Átvéve: "ok",
  "Átvéve (aláírva)": "ok",
  "Úton / átvételre vár": "warn",
  Számlázva: "acc",
  "Kiállításra vár": "warn",
  Felülírva: "",
  "Aláírva (elektronikusan)": "ok",
  "Aláírt példány feltöltve": "ok",
  Exportálva: "ok",
  "Sorban (Billingo)": "warn",
  Újrapróbálás: "warn",
  Hiba: "bad",
  Kiegyenlítve: "ok",
  Törölve: "",
  Lejárt: "bad",
  Késik: "warn",
  Sztornó: "bad",
};
