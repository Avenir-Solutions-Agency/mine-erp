/**
 * Supabase sends the QR code as "data:image/svg+xml;utf-8,<svg …>" with raw markup, which
 * browsers do not render; re-encode it as a standard data URL.
 */
export function svgDataUrl(qr: string): string {
  const svg = qr.replace(/^data:image\/svg\+xml[^,]*,/, "");
  return svg.startsWith("<")
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    : qr;
}
