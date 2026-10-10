import { useMemo } from 'react';

export interface Pt { x: number; y: number; label?: string }

/** Gráfico de linha minimalista, escala automática, eixos discretos. */
export function LineChart({ points, height = 170, fmtY, fmtX, emptyText }: {
  points: Pt[]; height?: number; fmtY: (n: number) => string; fmtX: (n: number) => string; emptyText: string;
}) {
  const W = 340, padL = 38, padR = 10, padT = 12, padB = 24;
  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.1);
    y0 = Math.max(0, y0 - pad); y1 = y1 + pad;
    const sx = (x: number) => padL + (x1 === x0 ? (W - padL - padR) / 2 : ((x - x0) / (x1 - x0)) * (W - padL - padR));
    const sy = (y: number) => padT + (1 - (y - y0) / (y1 - y0 || 1)) * (height - padT - padB);
    const ticks = [0, 0.5, 1].map((f) => y0 + (y1 - y0) * f);
    return { sx, sy, x0, x1, ticks };
  }, [points, height]);
  if (!geo) return <div className="muted center" style={{ padding: 24 }}>{emptyText}</div>;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${geo.sx(p.x).toFixed(1)},${geo.sy(p.y).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img">
      {geo.ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={geo.sy(t)} y2={geo.sy(t)} className="grid" />
          <text x={padL - 6} y={geo.sy(t) + 3.5} textAnchor="end" className="axis">{fmtY(t)}</text>
        </g>
      ))}
      <path d={d} className="line" />
      {points.map((p, i) => (
        <circle key={i} cx={geo.sx(p.x)} cy={geo.sy(p.y)} r={i === points.length - 1 ? 3.6 : 2.4} className="dot" />
      ))}
      <text x={padL} y={height - 6} className="axis">{fmtX(geo.x0)}</text>
      <text x={W - padR} y={height - 6} textAnchor="end" className="axis">{fmtX(geo.x1)}</text>
    </svg>
  );
}

export function BarChart({ data, height = 120, fmtX }: {
  data: { x: string; y: number; hi?: boolean }[]; height?: number; fmtX?: (s: string) => string;
}) {
  const W = 340, padB = 20, padT = 14;
  const max = Math.max(1, ...data.map((d) => d.y));
  const bw = (W - 12) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img">
      {data.map((d, i) => {
        const h = (d.y / max) * (height - padB - padT);
        const x = 6 + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.18} y={height - padB - h} width={bw * 0.64} height={Math.max(h, d.y ? 1.5 : 0)} rx={2} className={d.hi ? 'bar hi' : 'bar'} />
            {d.y > 0 && <text x={x + bw / 2} y={height - padB - h - 4} textAnchor="middle" className="axis">{d.y}</text>}
            {(data.length <= 8 || i % 2 === 0) && (
              <text x={x + bw / 2} y={height - 5} textAnchor="middle" className="axis">{fmtX ? fmtX(d.x) : d.x}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
