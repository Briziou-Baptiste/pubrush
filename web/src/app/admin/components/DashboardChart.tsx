"use client";

import React, { useState, useRef, useMemo } from "react";
import styles from "./DashboardChart.module.css";

interface DashboardChartProps {
  title: string;
  data: any[];
  period: string;
  setPeriod: (p: string) => void;
  type?: "line" | "bar";
  keys?: string[];
  labels?: string[];
  colors?: string[];
}

export default function DashboardChart({
  title,
  data = [],
  period,
  setPeriod,
  type = "line",
  keys = ["value"],
  labels = ["Valeur"],
  colors = ["#BE123C"],
}: DashboardChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const svgWidth = 500;
  const svgHeight = 200;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Find maximum value for scaling
  const maxValue = useMemo(() => {
    if (data.length === 0) return 4;
    let max = 0;
    data.forEach((item) => {
      keys.forEach((key) => {
        if (item[key] > max) max = item[key];
      });
    });
    const calculated = max === 0 ? 4 : Math.ceil(max * 1.15); // Add 15% headroom
    return Math.max(4, calculated);
  }, [data, keys]);

  // Compute X and Y coordinates for all points
  const points = useMemo(() => {
    if (data.length === 0) return [];
    
    return data.map((item, idx) => {
      let x = 0;
      if (type === "bar") {
        const slotWidth = chartWidth / data.length;
        x = paddingLeft + (idx + 0.5) * slotWidth;
      } else {
        x = paddingLeft + (idx / (data.length - 1 || 1)) * chartWidth;
      }

      const ys = keys.map((key) => {
        const value = item[key] ?? 0;
        const y = svgHeight - paddingBottom - (value / maxValue) * chartHeight;
        return y;
      });
      return { x, ys, raw: item };
    });
  }, [data, keys, maxValue, chartWidth, chartHeight, type]);

  // Handle Mouse Hover/Move for interactive Tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (data.length === 0 || !containerRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleX = rect.width ? svgWidth / rect.width : 1;
    const scaleY = rect.height ? svgHeight / rect.height : 1;

    const svgMouseX = mouseX * scaleX;
    const svgMouseY = mouseY * scaleY;

    // Convert mouseX to index in data
    const relativeX = svgMouseX - paddingLeft;
    let idx = 0;
    if (type === "bar") {
      const slotWidth = chartWidth / data.length;
      idx = Math.floor(relativeX / slotWidth);
    } else {
      const indexRatio = relativeX / chartWidth;
      idx = Math.round(indexRatio * (data.length - 1));
    }
    idx = Math.max(0, Math.min(data.length - 1, idx));

    setHoveredIdx(idx);
    
    const tooltipX = points[idx] ? points[idx].x : svgMouseX;
    setTooltipPos({ x: tooltipX, y: svgMouseY - 15 });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // Generate SVG path for line charts
  const getLinePath = (keyIdx: number) => {
    if (points.length === 0) return "";
    return points.reduce((acc, p, idx) => {
      const command = idx === 0 ? "M" : "L";
      return `${acc} ${command} ${p.x} ${p.ys[keyIdx]}`;
    }, "");
  };

  // Generate SVG area path for line charts (filled underneath)
  const getAreaPath = (keyIdx: number) => {
    if (points.length === 0) return "";
    const linePath = getLinePath(keyIdx);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const bottomY = svgHeight - paddingBottom;
    return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
  };

  const tooltipTransform = useMemo(() => {
    if (hoveredIdx === null || data.length === 0) return "translate(-50%, -100%)";
    const ratio = hoveredIdx / (data.length - 1 || 1);
    if (ratio < 0.2) return "translate(-15%, -100%)";
    if (ratio > 0.8) return "translate(-85%, -100%)";
    return "translate(-50%, -100%)";
  }, [hoveredIdx, data.length]);

  return (
    <div ref={containerRef} className={styles.chartContainer}>
      
      {/* Chart Header with Controls */}
      <div className={styles.chartHeader}>
        <h4 className={styles.chartTitle}>{title}</h4>
        
        {/* Day / Month / Year switcher buttons */}
        <div className={styles.periodControls}>
          {(["day", "month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ""}`}
            >
              {p === "day" ? "Jour" : p === "month" ? "Mois" : "An"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Rendering Container */}
      <div className={styles.chartBody}>
        {data.length === 0 ? (
          <div className={styles.emptyState}>
            Aucune donnée d'activité disponible pour cette période.
          </div>
        ) : (
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ overflow: "visible" }}
          >
            <defs>
              {/* Gradients */}
              {colors.map((color, idx) => (
                <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal Grid Lines */}
            {(() => {
              const printedValues = new Set<number>();
              return [0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = paddingTop + ratio * chartHeight;
                const value = Math.round(maxValue * (1 - ratio));
                const showLabel = !printedValues.has(value);
                printedValues.add(value);
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    {showLabel && (
                      <text
                        x={paddingLeft - 8}
                        y={y + 3}
                        fill="#475569"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        {value}
                      </text>
                    )}
                  </g>
                );
              });
            })()}

            {/* X Axis Labels */}
            {points.map((p, idx) => {
              // Show about 5-6 labels to avoid clutter
              const interval = Math.ceil(points.length / 5);
              if (idx % interval !== 0 && idx !== points.length - 1) return null;
              
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={svgHeight - 10}
                  fill="#475569"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {p.raw.label}
                </text>
              );
            })}

            {/* Line Charts */}
            {type === "line" &&
              keys.map((key, keyIdx) => (
                <g key={key}>
                  {/* Filled Area under Line */}
                  <path
                    d={getAreaPath(keyIdx)}
                    fill={`url(#gradient-${keyIdx})`}
                    style={{ pointerEvents: "none" }}
                  />
                  {/* The Line */}
                  <path
                    d={getLinePath(keyIdx)}
                    fill="none"
                    stroke={colors[keyIdx]}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: "none" }}
                  />
                  {/* Dots for all points */}
                  {points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.ys[keyIdx]}
                      r="3.5"
                      fill={colors[keyIdx]}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      style={{ pointerEvents: "none" }}
                    />
                  ))}
                </g>
              ))}

            {/* Bar Charts */}
            {type === "bar" &&
              points.map((p, pIdx) => {
                const barGroupWidth = Math.max(8, (chartWidth / points.length) * 0.65);
                const singleBarWidth = barGroupWidth / keys.length;
                const startX = p.x - barGroupWidth / 2;

                return keys.map((key, keyIdx) => {
                  const val = p.raw[key] ?? 0;
                  const barHeight = (val / maxValue) * chartHeight;
                  const x = startX + keyIdx * singleBarWidth;
                  const y = svgHeight - paddingBottom - barHeight;

                  return (
                    <rect
                      key={`${pIdx}-${key}`}
                      x={x}
                      y={y}
                      width={singleBarWidth - 1}
                      height={Math.max(2, barHeight)}
                      fill={colors[keyIdx]}
                      rx="2"
                      style={{ opacity: hoveredIdx === null || hoveredIdx === pIdx ? 1 : 0.45, transition: "opacity 0.2s" }}
                    />
                  );
                });
              })}

            {/* Interactive Hover Indicators */}
            {hoveredIdx !== null && points[hoveredIdx] && (
              <g>
                {/* Vertical Indicator Line */}
                <line
                  x1={points[hoveredIdx].x}
                  y1={paddingTop}
                  x2={points[hoveredIdx].x}
                  y2={svgHeight - paddingBottom}
                  stroke="#334155"
                  strokeWidth="1.5"
                  style={{ pointerEvents: "none" }}
                />
                
                {/* Focus Dots */}
                {type === "line" &&
                  points[hoveredIdx].ys.map((y, keyIdx) => (
                    <circle
                      key={keyIdx}
                      cx={points[hoveredIdx].x}
                      cy={y}
                      r="5.5"
                      fill={colors[keyIdx]}
                      stroke="#0f172a"
                      strokeWidth="2"
                      style={{ pointerEvents: "none" }}
                    />
                  ))}
              </g>
            )}
          </svg>
        )}

        {/* Hover Floating Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            className={styles.tooltip}
            style={{
              left: `${(tooltipPos.x / svgWidth) * 100}%`,
              top: `${(tooltipPos.y / svgHeight) * 100}%`,
              transform: tooltipTransform,
              minWidth: "120px",
            }}
          >
            <p className={styles.tooltipLabel}>
              {data[hoveredIdx].label}
            </p>
            <div className="flex flex-col gap-1">
              {keys.map((key, keyIdx) => (
                <div key={key} className={styles.tooltipRow}>
                  <span className="text-[10px] font-bold flex items-center gap-1.5" style={{ color: colors[keyIdx] }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[keyIdx] }} />
                    {labels[keyIdx]}
                  </span>
                  <span className={styles.tooltipValue}>
                    {(data[hoveredIdx][key] ?? 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer Legend (if multiple series) */}
      {keys.length > 1 && (
        <div className={styles.legendContainer}>
          {keys.map((key, idx) => (
            <div key={key} className={styles.legendItem}>
              <span className={styles.legendColorDot} style={{ backgroundColor: colors[idx] }} />
              <span className={styles.legendLabel}>{labels[idx]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
