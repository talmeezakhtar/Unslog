import { useState, type ReactNode } from 'react';

/**
 * Hand-rolled SVG charts, one series each (one hue, no legend needed; the title names it).
 * Each mark has a hover tooltip and a larger invisible hit area, and values are also printed
 * as text so the chart never relies on colour or hover alone.
 */

interface Tip {
  x: number;
  y: number;
  text: string;
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  );
}

/** Horizontal bars: magnitude by category, sorted. `highlight` marks some rows (e.g. your skills). */
export function HBarChart({
  rows,
  format = (n) => String(n),
  highlight,
  label,
  width = 640,
}: {
  rows: Array<{ label: string; value: number; tip?: string }>;
  format?: (n: number) => string;
  highlight?: (label: string) => boolean;
  label: string;
  /** Drawing width in px. Use ~440 for charts in half-width panels so text stays readable. */
  width?: number;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const rowH = 30;
  const labelW = width < 500 ? 110 : 150;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barW = width - labelW - 56;
  return (
    <figure className="chart" aria-label={label} style={{ margin: 0 }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${rows.length * rowH}`} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const w = Math.max(2, (r.value / max) * barW);
          const y = i * rowH;
          return (
            <g key={r.label}>
              <text x={labelW - 10} y={y + rowH / 2 + 4} textAnchor="end">
                {r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}
              </text>
              <path className={`bar ${highlight?.(r.label) ? 'is-mine' : ''}`} d={roundedRight(labelW, y + 6, w, rowH - 12, 4)} />
              <text className="value" x={labelW + w + 8} y={y + rowH / 2 + 4}>
                {format(r.value)}
              </text>
              <rect
                className="hit"
                x={0}
                y={y}
                width={width}
                height={rowH}
                onMouseMove={(e) => setTip(tipAt(e, r.tip ?? `${r.label}: ${format(r.value)}`))}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </figure>
  );
}

/** Vertical columns over time (one bar per period). */
export function ColumnChart({ rows, label, format = (n) => String(n), width = 640 }: { rows: Array<{ label: string; value: number }>; label: string; format?: (n: number) => string; width?: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const height = Math.round(width * 0.4);
  const bottom = 24;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barW = Math.min(36, (width - 28) / Math.max(rows.length, 1) - 6);
  const ticks = niceTicks(max);
  const y = (v: number) => (height - bottom) * (1 - v / ticks[ticks.length - 1]!);
  return (
    <figure className="chart" style={{ margin: 0 }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={28} x2={width} y1={y(t)} y2={y(t)} />
            <text x={0} y={y(t) + 4}>
              {t}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = 28 + i * ((width - 28) / rows.length) + ((width - 28) / rows.length - barW) / 2;
          const top = y(r.value);
          return (
            <g key={r.label}>
              <path className="bar" d={roundedTop(x, top, barW, height - bottom - top, 4)} />
              {(i === 0 || i === rows.length - 1 || rows.length <= 8) && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle">
                  {r.label}
                </text>
              )}
              <rect className="hit" x={x - 4} y={0} width={barW + 8} height={height} onMouseMove={(e) => setTip(tipAt(e, `${r.label}: ${format(r.value)}`))} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </figure>
  );
}

/** Low–high range per category, drawn as a whisker with its midpoint (never floating bars). */
export function RangeChart({ rows, label, format, width = 640 }: { rows: Array<{ label: string; low: number; high: number; tip: string }>; label: string; format: (n: number) => string; width?: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const labelW = width < 500 ? 130 : 170;
  const rowH = 34;
  const lo = Math.min(...rows.map((r) => r.low));
  const hi = Math.max(...rows.map((r) => r.high));
  const pad = (hi - lo) * 0.08 || 1000;
  const x = (v: number) => labelW + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (width - labelW - 20);
  return (
    <figure className="chart" style={{ margin: 0 }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${rows.length * rowH + 20}`} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const cy = i * rowH + rowH / 2;
          const mid = (r.low + r.high) / 2;
          return (
            <g key={r.label}>
              <text x={labelW - 10} y={cy + 4} textAnchor="end">
                {r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label}
              </text>
              <line className="whisker" x1={x(r.low)} x2={x(r.high)} y1={cy} y2={cy} />
              <line className="whisker" x1={x(r.low)} x2={x(r.low)} y1={cy - 6} y2={cy + 6} />
              <line className="whisker" x1={x(r.high)} x2={x(r.high)} y1={cy - 6} y2={cy + 6} />
              <circle className="mid" cx={x(mid)} cy={cy} r={5} />
              <rect className="hit" x={0} y={i * rowH} width={width} height={rowH} onMouseMove={(e) => setTip(tipAt(e, r.tip))} />
            </g>
          );
        })}
        <text x={labelW} y={rows.length * rowH + 16}>
          {format(lo)}
        </text>
        <text x={width - 20} y={rows.length * rowH + 16} textAnchor="end">
          {format(hi)}
        </text>
      </svg>
      <Tooltip tip={tip} />
    </figure>
  );
}

/** A plain table of the same numbers, for screen readers and anyone who prefers figures. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <details>
      <summary className="small muted">Show as table</summary>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function tipAt(e: React.MouseEvent<SVGElement>, text: string): Tip {
  const fig = (e.currentTarget.ownerSVGElement ?? e.currentTarget).closest('figure')!;
  const box = fig.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top, text };
}

function niceTicks(max: number): number[] {
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => max / s <= 5) ?? step * 10;
  const top = Math.ceil(max / nice) * nice;
  const out: number[] = [];
  for (let v = 0; v <= top; v += nice) out.push(v);
  return out;
}

function roundedRight(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
