// Golden snapshot of the original demo after its bootstrap (seed + daily run).
// Run with the Playwright MCP `browser_run_code_unsafe` tool (filename = this file) while
// docs/reference is served at http://127.0.0.1:8765 (python3 -m http.server 8765).
// Time and randomness are pinned so the TypeScript engine can be compared 1:1.
async (page) => {
  await page.addInitScript(() => {
    const RealDate = Date;
    const NOW = new RealDate("2026-10-03T09:30:00").getTime();
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(NOW);
        else super(...args);
      }
      static now() {
        return NOW;
      }
    }
    window.Date = FixedDate;
    let seed = 42;
    Math.random = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto("http://127.0.0.1:8765/demo.html");
  return await page.evaluate(() => {
    const seen = new WeakSet();
    const plain = (v) => {
      if (v instanceof Date) return { $date: v.toISOString() };
      if (typeof v === "function") return undefined;
      if (v && typeof v === "object") {
        if (seen.has(v)) return { $ref: true };
        seen.add(v);
        if (Array.isArray(v)) {
          const a = v.map((x) => (typeof x === "function" ? null : plain(x)));
          seen.delete(v);
          return a;
        }
        const o = {};
        for (const [k, x] of Object.entries(v)) {
          const p = plain(x);
          if (p !== undefined) o[k] = p;
        }
        seen.delete(v);
        return o;
      }
      return v;
    };
    // eslint-disable-next-line no-undef
    return JSON.stringify({ S: plain(S), SEQ: plain(SEQ) });
  });
};
