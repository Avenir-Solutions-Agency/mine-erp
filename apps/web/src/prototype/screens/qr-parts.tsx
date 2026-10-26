"use client";

import jsQR from "jsqr";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

// Screens remount on every engine render, so generated labels are cached per code like the demo's QRCACHE.
const cache = new Map<string, string>();

/** The demo's qrImg(): a data URL once generated, '' until then (the .qrph placeholder shows). */
export function useQrImage(code: string): string {
  const [src, setSrc] = useState(() => cache.get(code) ?? "");
  useEffect(() => {
    if (cache.has(code)) return;
    let live = true;
    QRCode.toDataURL(code, {
      width: 180,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        cache.set(code, url);
        if (live) setSrc(url);
      })
      // The placeholder stays, as in the demo when QRious fails.
      .catch((err: unknown) => console.error(err));
    return () => {
      live = false;
    };
  }, [code]);
  return src;
}

/** The demo's decodeQR(): scales the photo to at most 1000 px and reads a QR code, or null. */
export function decodeQrPhoto(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * k;
        c.height = img.height * k;
        const x = c.getContext("2d");
        if (!x) return resolve(null);
        x.drawImage(img, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height);
        resolve(jsQR(d.data, c.width, c.height)?.data || null);
      };
      img.onerror = () => resolve(null);
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}
