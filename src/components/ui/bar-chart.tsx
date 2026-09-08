"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  secondary?: number;
}

/**
 * Minimal, dependency-free SVG bar chart. One primary series (optionally a
 * stacked secondary), rounded bars, hover tooltips, animated on mount.
 */
export function BarChart({ data, height = 160, formatValue = (v) => String(v), className, tone = "brand", secondaryLabel, primaryLabel }: { data: BarDatum[]; height?: number; formatValue?: (v: number) => string; className?: string; tone?: "brand" | "driver" | "ink"; secondaryLabel?: string; primaryLabel?: string }) {
  const [active, setActive] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value + (d.secondary ?? 0)));
  const color = tone === "driver" ? "#f97316" : tone === "ink" ? "#0a0a0a" : "#2fc24c";
  const secondaryColor = tone === "driver" ? "#fed7aa" : tone === "ink" ? "#d4d4d8" : "#afecbb";
  const n = Math.max(1, data.length);
  const W = 100;
  // proportional gutter so 4–12 bars all read well (bar ≈ 2× gap)
  const gap = W / (n * 3 + 1);
  const barW = gap * 2;
  const yTicks = [0, 0.5, 1];
  return (
    <div className={cn("relative w-full select-none", className)} style={{ height }} onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-label="Bar chart" role="img">
        {yTicks.map((t) => (
          <line key={t} x1={0} x2={W} y1={100 - t * 92} y2={100 - t * 92} stroke="#e4e4e7" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const x = gap + i * (barW + gap);
          const h1 = (d.value / max) * 92;
          const h2 = ((d.secondary ?? 0) / max) * 92;
          const isActive = active === i;
          return (
            <g key={d.label} onMouseEnter={() => setActive(i)} onTouchStart={() => setActive(i)}>
              <rect x={x - gap / 2} y={0} width={barW + gap} height={100} fill="transparent" />
              {h2 > 0 && <motion.rect x={x} width={barW} rx={1.5} fill={secondaryColor} initial={{ attrY: 100, height: 0 }} animate={{ attrY: 100 - h1 - h2, height: h2 }} transition={{ duration: 0.5, delay: i * 0.03 }} />}
              <motion.rect x={x} width={barW} rx={1.5} fill={color} opacity={active == null || isActive ? 1 : 0.45} initial={{ attrY: 100, height: 0 }} animate={{ attrY: 100 - h1, height: Math.max(h1, d.value > 0 ? 1 : 0) }} transition={{ duration: 0.5, delay: i * 0.03 }} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between px-[2%] text-[10px] font-medium text-muted">
        {data.map((d, i) => (
          <span key={d.label} className={cn("flex-1 text-center", active === i && "text-ink font-semibold")}>
            {d.label}
          </span>
        ))}
      </div>
      {active != null && data[active] && (
        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-float">
          {data[active].label}: {formatValue(data[active].value)}
          {data[active].secondary != null && secondaryLabel ? ` · ${secondaryLabel} ${formatValue(data[active].secondary!)}` : ""}
          {primaryLabel && data[active].secondary != null ? ` (${primaryLabel})` : ""}
        </div>
      )}
    </div>
  );
}
