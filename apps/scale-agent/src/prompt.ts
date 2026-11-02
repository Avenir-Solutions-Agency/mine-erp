// Terminal questions for the PORTAL AI bridge, so nobody has to edit files on site.
// Addresses are remembered in the user's home folder; secrets never are.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const SAVED = join(homedir(), ".mine-erp-portal.json");
type Saved = Partial<Record<"apiUrl" | "portalUrl", string>>;

export function loadSaved(): Saved {
  try {
    return JSON.parse(readFileSync(SAVED, "utf8")) as Saved;
  } catch {
    return {};
  }
}

export function save(saved: Saved) {
  writeFileSync(SAVED, JSON.stringify(saved, null, 2));
}

/** Visible question; Enter keeps the value in brackets. */
export async function ask(question: string, fallback: string) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} [${fallback}]: `)).trim();
  rl.close();
  return answer || fallback;
}

/** Hidden question for keys and tokens: nothing is echoed, a paste works. */
export function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(`${question}: `);
    let value = "";
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          return resolve(value.trim());
        }
        if (c === "\u0003") process.exit(130);
        value = c === "\u007f" ? value.slice(0, -1) : value + c;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}
