// Simulated scale agent: sends the pretend indicator's weight to the API four times a second.
// Keys: 1 = empty truck on (~14 t), 2 = loaded truck on (~38.5 t), 0 = truck off, q = quit.
import { emitKeypressEvents } from "node:readline";
import { indicatorKg, type Load } from "./simulator.ts";

const api = process.env.API_BASE_URL ?? "http://localhost:4000";
const token = process.env.SCALE_AGENT_TOKEN;
if (!token) {
  console.error("SCALE_AGENT_TOKEN is not set (see .env.example).");
  process.exit(1);
}

const LOADS: Record<string, number> = { "0": 0, "1": 14200, "2": 38560 };
let load: Load = { kg: 0, since: Date.now() };
let status = "indul";

async function send() {
  const kg = indicatorKg(load, Date.now());
  try {
    const res = await fetch(`${api}/scale/readings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ kg }),
      signal: AbortSignal.timeout(1000),
    });
    status = res.ok ? "kapcsolódva" : `API hiba ${res.status}`;
  } catch {
    status = "az API nem érhető el";
  }
  process.stdout.write(
    `\r${String(kg).padStart(7)} kg · ${status} · [1] üres [2] rakott [0] le [q] kilép   `,
  );
}

setInterval(() => void send(), 250);

emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on(
  "keypress",
  (key: string | undefined, info: { ctrl?: boolean; name?: string }) => {
    if (key === "q" || (info.ctrl && info.name === "c")) process.exit(0);
    if (key && key in LOADS) load = { kg: LOADS[key]!, since: Date.now() };
  },
);
