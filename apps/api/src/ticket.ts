import { Inject, Injectable } from "@nestjs/common";
import type { WeighingDto } from "@mine-erp/contracts";
import { COMPANY } from "@mine-erp/domain/ekaer";
import { ENV, type Env } from "./env.ts";

// Issuer: the company data shared with EKÁER (packages/domain/ekaer).
// shortcut: one issuer; the three firms sharing the scale need a per-weighing seller later (T-035).
const ISSUER = COMPANY;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const kg = (n: number | null) =>
  n == null ? "—" : `${new Intl.NumberFormat("hu-HU").format(n)} kg`;
const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("hu-HU", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Budapest",
      }).format(new Date(iso))
    : "—";

/** Printable A4 weigh ticket; every user-typed value is escaped. A void ticket carries a SZTORNÓ stamp. */
export function renderTicketHtml(w: WeighingDto): string {
  const row = (label: string, value: string) =>
    `<tr><th>${label}</th><td>${value}</td></tr>`;
  const text = (v: string | null) => (v ? esc(v) : "—");
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><title>${esc(w.ticketNumber)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 11pt; color: #111; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h1 { font-size: 20pt; margin: 0; }
  .no { font-size: 14pt; font-weight: bold; text-align: right; white-space: nowrap; padding-left: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #ccc; vertical-align: top; }
  th { width: 38%; font-weight: normal; color: #444; }
  .net td { font-size: 18pt; font-weight: bold; }
  .sign { display: flex; gap: 40px; margin-top: 60px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 9pt; }
  .void { position: fixed; top: 40%; left: 10%; transform: rotate(-20deg); font-size: 72pt; color: rgba(200,0,0,.35); border: 6px solid rgba(200,0,0,.35); padding: 0 20px; }
  footer { margin-top: 24px; font-size: 8pt; color: #666; }
</style></head><body>
${w.status === "void" ? `<div class="void">SZTORNÓ</div>` : ""}
<header>
  <div><h1>Mérlegjegy</h1>${esc(ISSUER.name)} · Telephely: ${esc(`${ISSUER.site.zipCode} ${ISSUER.site.city}, ${ISSUER.site.street}`)}<br>Székhely: ${esc(ISSUER.seat)} · Adószám: ${esc(ISSUER.taxNumber)}</div>
  <div class="no">${esc(w.ticketNumber)}</div>
</header>
<table>
  ${w.shipment ? row("Szállítás", esc(w.shipment.registryNumber) + (w.shipment.status === "cancelled" ? " (sztornó)" : "")) : ""}
  ${row("Rendszám", esc(w.plate))}
  ${row("Pótkocsi", text(w.trailerPlate))}
  ${row("Vevő", text(w.customer))}
  ${row("Anyag", text(w.material))}
  ${row("Első mérés", `${kg(w.firstKg)} · ${when(w.firstAt)}`)}
  ${row(w.savedTare ? "Tára (mentett)" : "Második mérés", w.savedTare ? kg(w.tareKg) : `${kg(w.secondKg)} · ${when(w.secondAt)}`)}
  ${row("Bruttó", kg(w.grossKg))}
  ${row("Tára", kg(w.tareKg))}
  <tr class="net"><th>Nettó</th><td>${kg(w.netKg)}</td></tr>
  ${row("Megjegyzés", text(w.note))}
  ${w.ekaer?.status === "active" && w.ekaer.tcn ? row("EKÁER-szám", esc(w.ekaer.tcn)) : ""}
  ${w.status === "void" ? row("Sztornó oka", text(w.voidReason)) : ""}
</table>
<div class="sign"><div>Mérlegkezelő</div><div>Gépkocsivezető</div></div>
<footer>Készült a Mészkő-Polgár ERP-ben. A tömegek egész kilogrammban.</footer>
</body></html>`;
}

/** HTML → PDF through the local Gotenberg service (infra/docker-compose.yml). */
@Injectable()
export class TicketPdf {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async render(w: WeighingDto): Promise<Buffer> {
    const form = new FormData();
    form.append(
      "files",
      new Blob([renderTicketHtml(w)], { type: "text/html" }),
      "index.html",
    );
    form.append("paperWidth", "8.27");
    form.append("paperHeight", "11.7");
    form.append("preferCssPageSize", "true");
    const res = await fetch(
      `${this.env.GOTENBERG_URL}/forms/chromium/convert/html`,
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) throw new Error(`Gotenberg: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
