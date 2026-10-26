import { fmt } from "@mine-erp/domain/demo";

// SVG charts of the demo (barChart, lineChart, nice), same geometry. Colours are CSS variables.
export interface Series {
  n: string;
  c: string;
  v: number[];
  area?: boolean;
}

function nice(r: number) {
  const raw = r / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const svgText = "fill-muted-foreground font-mono";

export function BarChart({
  labels,
  series,
  h = 200,
  fmtY = (v) => fmt(v),
  stack = false,
}: {
  labels: string[];
  series: Series[];
  h?: number;
  fmtY?: (v: number) => string;
  stack?: boolean;
}) {
  const W = 640,
    H = h,
    pl = 44,
    pb = 22,
    pt = 10,
    pr = 8;
  const max =
    Math.max(
      ...labels.map((_, i) =>
        stack
          ? series.reduce((a, s) => a + s.v[i], 0)
          : Math.max(...series.map((s) => s.v[i])),
      ),
    ) * 1.1 || 1;
  const step = nice(max);
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const bw = (W - pl - pr) / labels.length;
  const gw = stack ? bw * 0.55 : (bw * 0.75) / series.length;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        className={svgText}
        fontSize={10}
      >
        <g className="stroke-border">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} />
              <text
                x={pl - 6}
                y={y(v) + 3}
                textAnchor="end"
                className="stroke-none"
              >
                {fmtY(v)}
              </text>
            </g>
          ))}
        </g>
        {labels.map((l, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {series.map((s, j) => {
                const v = s.v[i];
                const x = stack
                  ? pl + i * bw + (bw - gw) / 2
                  : pl + i * bw + bw * 0.125 + j * gw;
                const y0 = stack ? y(acc + v) : y(v);
                const hh = stack ? y(acc) - y(acc + v) : y(0) - y(v);
                acc += stack ? v : 0;
                return (
                  <rect
                    key={j}
                    x={x}
                    y={y0}
                    width={gw - 2}
                    height={Math.max(0, hh)}
                    rx={2}
                    fill={s.c}
                  >
                    <title>{`${l} · ${s.n}: ${fmtY(v)}`}</title>
                  </rect>
                );
              })}
              <text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle">
                {l}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({
  labels,
  series,
  h = 200,
  fmtY = (v) => fmt(v),
  zero = true,
  mark,
}: {
  labels: string[];
  series: Series[];
  h?: number;
  fmtY?: (v: number) => string;
  zero?: boolean;
  mark?: { v: number; l: string };
}) {
  const W = 640,
    H = h,
    pl = 50,
    pb = 22,
    pt = 12,
    pr = 26;
  const all = series.flatMap((s) => s.v);
  let mn = Math.min(...all, zero ? 0 : Infinity),
    mx = Math.max(...all);
  const step = nice(mx - mn || 1);
  mn = Math.floor(mn / step) * step;
  mx = Math.ceil(mx / step) * step;
  const x = (i: number) => pl + ((W - pl - pr) * i) / (labels.length - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn || 1));
  const ticks: number[] = [];
  for (let v = mn; v <= mx + 1e-9; v += step) ticks.push(v);
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        className={svgText}
        fontSize={10}
      >
        <g className="stroke-border">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} />
              <text
                x={pl - 6}
                y={y(v) + 3}
                textAnchor="end"
                className="stroke-none"
              >
                {fmtY(v)}
              </text>
            </g>
          ))}
        </g>
        {labels.map((l, i) =>
          i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const pts = s.v.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const last = s.v.length - 1;
          return (
            <g key={si}>
              {s.area ? (
                <polygon
                  points={`${x(0)},${y(Math.max(mn, 0))} ${pts} ${x(last)},${y(Math.max(mn, 0))}`}
                  fill={s.c}
                  opacity={0.12}
                />
              ) : null}
              <polyline points={pts} fill="none" stroke={s.c} strokeWidth={2} />
              <circle cx={x(last)} cy={y(s.v[last])} r={3.5} fill={s.c} />
            </g>
          );
        })}
        {mark ? (
          <g>
            <line
              x1={pl}
              x2={W - pr}
              y1={y(mark.v)}
              y2={y(mark.v)}
              stroke="var(--destructive)"
              strokeDasharray="4 4"
            />
            <text
              x={W - pr}
              y={y(mark.v) - 4}
              textAnchor="end"
              style={{ fill: "var(--destructive)" }}
            >
              {mark.l}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
