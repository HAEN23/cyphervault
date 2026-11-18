"use client";
import { useState } from "react";
import type { SeriesPoint } from "@/lib/api";

const W = 260;
const H = 90;

/** Barras de una sola serie; el color sale de `currentColor` (el mismo de la tarjeta). */
export default function StatChart({ data, unit }: { data: SeriesPoint[]; unit: "hour" | "day" }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;

  const max = Math.max(1, ...data.map((p) => p.v));
  const slot = W / data.length;
  const barW = Math.max(2, slot - 2); // 2px de separación entre barras
  const fmt = (t: string) =>
    new Date(t).toLocaleString("es-MX", unit === "hour" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
  const shown = hover ?? data.length - 1;

  return (
    <div>
      <p className="text-xs text-slate-400 mb-2 h-4">
        <span className="text-white font-semibold">{data[shown].v}</span>
        {" · "}
        {unit === "hour" ? `de ${fmt(new Date(Date.parse(data[shown].t) - 3600e3).toISOString())} a ${fmt(data[shown].t)}` : fmt(data[shown].t)}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24"
        role="img"
        aria-label={data.map((p) => `${fmt(p.t)}: ${p.v}`).join(", ")}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} className="stroke-slate-700" strokeWidth="1" />
        {data.map((p, i) => {
          const h = p.v === 0 ? 0 : Math.max(3, (p.v / max) * (H - 4));
          return (
            <g key={p.t} onMouseEnter={() => setHover(i)}>
              {/* zona de hover más grande que la barra */}
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              <rect
                x={i * slot + 1}
                y={H - 1 - h}
                width={barW}
                height={h}
                rx="2"
                fill="currentColor"
                opacity={hover === null || hover === i ? 0.9 : 0.4}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{fmt(data[0].t)}</span>
        <span>{unit === "hour" ? "ahora" : "hoy"}</span>
      </div>
    </div>
  );
}
