import { Pill, type PillTone } from "@/components/ui/pill";

// Demo stPill() mapping (docs/demo-inventory part 1, "App shell & navigation"). Unknown → neutral.
const STATUS_TONE: Record<string, PillTone> = {};
const groups: [PillTone, string[]][] = [
  [
    "success",
    [
      "Kiküldve",
      "Ajánlat kiküldve",
      "Lezárva",
      "Billingóban kiállítva",
      "Bejelentve",
      "Teljesítve",
      "Jóváhagyva",
      "Beérkezett",
      "Iktatva",
      "Elfogadva (e-aláírás)",
      "Elfogadva (aláírt fotó)",
      "Átvéve",
      "Átvéve (aláírva)",
      "Aláírva (elektronikusan)",
      "Aláírt példány feltöltve",
      "Exportálva",
      "Kiegyenlítve",
    ],
  ],
  [
    "accent",
    [
      "Megrendelve",
      "Új",
      "Úton",
      "Ütemezve",
      "Visszaigazolva",
      "Megrendelve (PO)",
      "Számlázva",
    ],
  ],
  ["ai", ["Jóváhagyásra vár", "Vár", "Javasolt", "Aláírásra vár"]],
  [
    "warning",
    [
      "Hiányos — visszakérdezés",
      "Bejelentendő",
      "Kézi feldolgozásra vár",
      "Úton / átvételre vár",
      "Kiállításra vár",
      "Sorban (Billingo)",
      "Újrapróbálás",
      "Késik",
    ],
  ],
  ["destructive", ["Elutasítva", "Kifogásolva", "Hiba", "Lejárt", "Sztornó"]],
];
for (const [tone, statuses] of groups)
  for (const s of statuses) STATUS_TONE[s] = tone;

export function statusTone(status: string): PillTone {
  return STATUS_TONE[status] ?? "neutral";
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={statusTone(status)}>{status}</Pill>;
}
