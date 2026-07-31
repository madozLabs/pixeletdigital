"use client";

import { useId, useState } from "react";

import { formatXof } from "../billing/_lib/money";

export type TrendPoint = Readonly<{
  label: string;
  revenueCents: number;
  expenseCents: number;
}>;

export type CategoryPoint = Readonly<{
  categoryId: string;
  categoryLabel: string;
  amountCents: number;
}>;

// Validated pair (see dataviz skill palette.md, categorical slots 1-2):
// worst adjacent CVD ΔE 24.7 light / 26.8 dark, normal-vision ΔE 33.6 / 31.8
// -- both well clear of the 8/15 floors. Fixed identity, never rank-based:
// Revenue is always blue, Expenses is always orange, regardless of which
// is bigger in a given range.
const CHART_STYLE = `
.finance-viz {
  color-scheme: light;
  --surface-1: #fcfcfb;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #898781;
  --grid-line: #e1e0d9;
  --baseline: #c3c2b7;
  --series-revenue: #2a78d6;
  --series-expense: #eb6834;
  --sequential-1: #2a78d6;
  --good: #0ca30c;
  --critical: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .finance-viz {
    color-scheme: dark;
    --surface-1: #1a1a19;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --grid-line: #2c2c2a;
    --baseline: #383835;
    --series-revenue: #3987e5;
    --series-expense: #d95926;
    --sequential-1: #3987e5;
    --good: #0ca30c;
    --critical: #e66767;
  }
}
:root[data-theme="dark"] .finance-viz {
  color-scheme: dark;
  --surface-1: #1a1a19;
  --text-primary: #ffffff;
  --text-secondary: #c3c2b7;
  --text-muted: #898781;
  --grid-line: #2c2c2a;
  --baseline: #383835;
  --series-revenue: #3987e5;
  --series-expense: #d95926;
  --sequential-1: #3987e5;
  --good: #0ca30c;
  --critical: #e66767;
}
.finance-viz { position: relative; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.finance-viz svg { display: block; width: 100%; height: auto; overflow: visible; }
.finance-viz text { fill: var(--text-secondary); font-size: 11px; }
.finance-viz .finance-viz__axis-label { fill: var(--text-muted); }
.finance-viz__legend { display: flex; gap: 1rem; margin-bottom: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); }
.finance-viz__legend-item { display: inline-flex; align-items: center; gap: 0.4rem; }
.finance-viz__legend-swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.finance-viz__tooltip {
  position: absolute;
  pointer-events: none;
  background: var(--surface-1);
  color: var(--text-primary);
  border: 1px solid var(--grid-line);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  white-space: nowrap;
  transform: translate(-50%, -110%);
  z-index: 5;
}
.finance-viz__hit { fill: transparent; }
.finance-viz__hit:hover ~ .finance-viz__bar-group { opacity: 1; }
`;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatCompact(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

// Rounded-top, square-bottom bar: the only mark shape this skill's mark
// spec allows (4px data-end radius at the top, square at the baseline).
function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  if (height <= 0) return "";
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 44 };

export function FinanceTrendChart({
  buckets,
}: Readonly<{ buckets: readonly TrendPoint[] }>) {
  const uid = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = niceMax(
    Math.max(1, ...buckets.flatMap((b) => [b.revenueCents, b.expenseCents])),
  );
  const groupWidth = buckets.length > 0 ? plotWidth / buckets.length : plotWidth;
  const barWidth = Math.min(24, groupWidth / 2.6);
  const gap = 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(maxValue * fraction));

  if (buckets.length === 0) {
    return <p className="admin-empty">Aucune donnée sur cette période.</p>;
  }

  const active = activeIndex !== null ? buckets[activeIndex] : null;

  return (
    <div className="finance-viz">
      <style>{CHART_STYLE}</style>
      <div className="finance-viz__legend" role="list" aria-label="Séries">
        <span className="finance-viz__legend-item" role="listitem">
          <span
            className="finance-viz__legend-swatch"
            style={{ background: "var(--series-revenue)" }}
          />
          Revenu
        </span>
        <span className="finance-viz__legend-item" role="listitem">
          <span
            className="finance-viz__legend-swatch"
            style={{ background: "var(--series-expense)" }}
          />
          Dépenses
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Revenu et dépenses par période"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {ticks.map((tick) => {
            const y = plotHeight - (tick / maxValue) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--grid-line)"
                  strokeWidth={1}
                />
                <text
                  x={-8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="finance-viz__axis-label"
                >
                  {formatCompact(tick)}
                </text>
              </g>
            );
          })}
          <line
            x1={0}
            x2={plotWidth}
            y1={plotHeight}
            y2={plotHeight}
            stroke="var(--baseline)"
            strokeWidth={1}
          />
          {buckets.map((bucket, index) => {
            const groupX = index * groupWidth;
            const revenueHeight = (bucket.revenueCents / maxValue) * plotHeight;
            const expenseHeight = (bucket.expenseCents / maxValue) * plotHeight;
            const centerX = groupX + groupWidth / 2;
            return (
              <g key={`${uid}-${index}`}>
                <rect
                  className="finance-viz__hit"
                  x={groupX}
                  y={0}
                  width={groupWidth}
                  height={plotHeight}
                  onMouseEnter={() => {
                    setActiveIndex(index);
                    setHoverX(centerX);
                  }}
                  onMouseLeave={() => setActiveIndex(null)}
                />
                <path
                  d={roundedTopBarPath(
                    centerX - barWidth - gap / 2,
                    plotHeight - revenueHeight,
                    barWidth,
                    revenueHeight,
                    4,
                  )}
                  fill="var(--series-revenue)"
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                />
                <path
                  d={roundedTopBarPath(
                    centerX + gap / 2,
                    plotHeight - expenseHeight,
                    barWidth,
                    expenseHeight,
                    4,
                  )}
                  fill="var(--series-expense)"
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                />
                <text
                  x={centerX}
                  y={plotHeight + 16}
                  textAnchor="middle"
                  className="finance-viz__axis-label"
                >
                  {bucket.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {active ? (
        <div
          className="finance-viz__tooltip"
          style={{
            left: `${((MARGIN.left + hoverX) / CHART_WIDTH) * 100}%`,
            top: 0,
          }}
        >
          <strong>{active.label}</strong>
          <br />
          Revenu : {formatXof(active.revenueCents)}
          <br />
          Dépenses : {formatXof(active.expenseCents)}
        </div>
      ) : null}
    </div>
  );
}

const CATEGORY_ROW_HEIGHT = 32;
const CATEGORY_MARGIN = { top: 8, right: 56, bottom: 8, left: 140 };

export function FinanceCategoryChart({
  categories,
}: Readonly<{ categories: readonly CategoryPoint[] }>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (categories.length === 0) {
    return <p className="admin-empty">Aucune dépense sur cette période.</p>;
  }

  const maxValue = niceMax(Math.max(...categories.map((c) => c.amountCents)));
  const plotWidth = CHART_WIDTH - CATEGORY_MARGIN.left - CATEGORY_MARGIN.right;
  const chartHeight =
    categories.length * CATEGORY_ROW_HEIGHT +
    CATEGORY_MARGIN.top +
    CATEGORY_MARGIN.bottom;

  return (
    <div className="finance-viz">
      <style>{CHART_STYLE}</style>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
        role="img"
        aria-label="Dépenses par catégorie"
      >
        <g transform={`translate(${CATEGORY_MARGIN.left},${CATEGORY_MARGIN.top})`}>
          {categories.map((category, index) => {
            const y = index * CATEGORY_ROW_HEIGHT;
            const barHeight = Math.min(24, CATEGORY_ROW_HEIGHT - 8);
            const barWidth = Math.max(
              2,
              (category.amountCents / maxValue) * plotWidth,
            );
            const isActive = activeId === null || activeId === category.categoryId;
            return (
              <g key={category.categoryId}>
                <rect
                  className="finance-viz__hit"
                  x={-CATEGORY_MARGIN.left}
                  y={y}
                  width={CHART_WIDTH}
                  height={CATEGORY_ROW_HEIGHT}
                  onMouseEnter={() => setActiveId(category.categoryId)}
                  onMouseLeave={() => setActiveId(null)}
                />
                <text
                  x={-8}
                  y={y + CATEGORY_ROW_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {category.categoryLabel}
                </text>
                <rect
                  x={0}
                  y={y + (CATEGORY_ROW_HEIGHT - barHeight) / 2}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill="var(--sequential-1)"
                  opacity={isActive ? 1 : 0.45}
                />
                <text
                  x={barWidth + 8}
                  y={y + CATEGORY_ROW_HEIGHT / 2}
                  dominantBaseline="middle"
                  className="finance-viz__axis-label"
                >
                  {formatXof(category.amountCents)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
