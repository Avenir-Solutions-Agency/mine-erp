import { COMPANY } from "@mine-erp/domain/ekaer";
import { esc, kg, when } from "./ticket.ts";

export interface DeliveryNoteData {
  number: string;
  cancelled: boolean;
  shippedAt: string;
  plate: string;
  trailerPlate: string | null;
  customer: { name: string; taxNumber: string | null; address: string | null };
  product: { name: string; vtsz: string | null };
  netKg: number;
  ticketNumber: string;
  ekaerTcn: string | null;
}

/** Printable A4 delivery note (szállítólevél); every user-typed value is escaped. */
export function renderDeliveryNoteHtml(d: DeliveryNoteData): string {
  const text = (v: string | null) => (v ? esc(v) : "—");
  const site = `${COMPANY.site.zipCode} ${COMPANY.site.city}, ${COMPANY.site.street}`;
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><title>${esc(d.number)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 11pt; color: #111; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h1 { font-size: 20pt; margin: 0; }
  .no { font-size: 14pt; font-weight: bold; text-align: right; white-space: nowrap; padding-left: 16px; }
  .parties { display: flex; gap: 16px; margin-top: 14px; }
  .parties div { flex: 1; border: 1px solid #ccc; padding: 8px; }
  .parties b { display: block; font-size: 9pt; color: #444; font-weight: normal; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #ccc; }
  th { font-size: 9pt; color: #444; font-weight: normal; }
  .num { text-align: right; }
  .meta td:first-child { width: 38%; color: #444; }
  .sign { display: flex; gap: 24px; margin-top: 60px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 9pt; }
  .void { position: fixed; top: 40%; left: 10%; transform: rotate(-20deg); font-size: 72pt; color: rgba(200,0,0,.35); border: 6px solid rgba(200,0,0,.35); padding: 0 20px; }
  footer { margin-top: 24px; font-size: 8pt; color: #666; }
</style></head><body>
${d.cancelled ? `<div class="void">SZTORNÓ</div>` : ""}
<header>
  <div><h1>Szállítólevél</h1>Kelt: ${esc(when(d.shippedAt))}</div>
  <div class="no">${esc(d.number)}</div>
</header>
<div class="parties">
  <div><b>Eladó / feladó</b>${esc(COMPANY.name)}<br>${esc(COMPANY.seat)}<br>Adószám: ${esc(COMPANY.taxNumber)}<br>Felrakodás: ${esc(site)}</div>
  <div><b>Vevő / átvevő</b>${esc(d.customer.name)}<br>${text(d.customer.address)}<br>Adószám: ${text(d.customer.taxNumber)}</div>
</div>
<table>
  <tr><th>Termék</th><th>VTSZ</th><th class="num">Nettó tömeg</th><th class="num">Tonna</th></tr>
  <tr><td>${esc(d.product.name)}</td><td>${text(d.product.vtsz)}</td><td class="num">${kg(d.netKg)}</td><td class="num">${(d.netKg / 1000).toLocaleString("hu-HU", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t</td></tr>
</table>
<table class="meta">
  <tr><td>Rendszám</td><td>${esc(d.plate)}${d.trailerPlate ? ` · pótkocsi ${esc(d.trailerPlate)}` : ""}</td></tr>
  <tr><td>Mérlegjegy</td><td>${esc(d.ticketNumber)}</td></tr>
  <tr><td>EKÁER-szám</td><td>${text(d.ekaerTcn)}</td></tr>
</table>
<div class="sign"><div>Feladó</div><div>Fuvarozó / gépkocsivezető</div><div>Átvevő (név, aláírás, dátum)</div></div>
<footer>Készült a Mészkő-Polgár ERP-ben. A tömeg a hitelesített mérlegelés nettó eredménye, egész kilogrammban.</footer>
</body></html>`;
}
