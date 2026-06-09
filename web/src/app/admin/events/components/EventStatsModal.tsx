"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { X, TrendingUp, Users, Calendar } from "lucide-react";
import { api } from "../../api";
import styles from "./EventStatsModal.module.css";

interface EventStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
}

export default function EventStatsModal({
  isOpen,
  onClose,
  event,
}: EventStatsModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !event) return;
    
    const fetchEventStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const statsData = await api.getEventStats(event.id);
        setData(statsData);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement des statistiques.");
      } finally {
        setLoading(false);
      }
    };

    fetchEventStats();
  }, [isOpen, event]);

  const svgWidth = 500;
  const svgHeight = 200;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxValue = useMemo(() => {
    if (data.length === 0) return 10;
    const max = Math.max(...data.map((d) => d.value));
    return max === 0 ? 10 : Math.ceil(max * 1.15);
  }, [data]);

  const points = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((item, idx) => {
      const x = paddingLeft + (idx / (data.length - 1 || 1)) * chartWidth;
      const y = svgHeight - paddingBottom - (item.value / maxValue) * chartHeight;
      return { x, y, raw: item };
    });
  }, [data, maxValue, chartWidth, chartHeight]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (data.length === 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const relativeX = mouseX - paddingLeft;
    const indexRatio = relativeX / chartWidth;
    let idx = Math.round(indexRatio * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));

    setHoveredIdx(idx);
    setTooltipPos({ x: mouseX, y: mouseY - 15 });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, p, idx) => {
      const command = idx === 0 ? "M" : "L";
      return `${acc} ${command} ${p.x} ${p.y}`;
    }, "");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const bottomY = svgHeight - paddingBottom;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [points, linePath]);

  if (!isOpen || !event) return null;

  const totalRegistered = data.length > 0 ? data[data.length - 1].value : 0;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className={styles.modalCloseBtn}
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {/* Header */}
        <h3 className={styles.modalTitle}>
          <TrendingUp className="w-5.5 h-5.5 text-rose-500" />
          Statistiques de Fréquentation
        </h3>
        <p className={styles.subtitle}>
          Événement : <span className={styles.subtitleHighlight}>{event.name}</span>
        </p>

        {loading ? (
          <div className={styles.loaderWrapper}>
            <div className={styles.loader} />
            <span className="text-xs text-slate-400 font-bold">Chargement des données...</span>
          </div>
        ) : error ? (
          <div className={styles.errorMessage}>
            {error}
          </div>
        ) : (
          <div className={styles.contentWrapper}>
            
            {/* KPI Row */}
            <div className={styles.kpiRow}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiIconBoxRose}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className={styles.kpiLabel}>Inscrits Totaux</p>
                  <p className={styles.kpiValue}>{totalRegistered}</p>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiIconBoxViolet}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className={styles.kpiLabel}>Statut</p>
                  <p className="text-sm font-black text-white uppercase tracking-wider mt-0.5">
                    {event.is_active ? (
                      <span className={styles.kpiValueActive}>Actif</span>
                    ) : (
                      <span className={styles.kpiValueInactive}>Inactif</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div ref={containerRef} className={styles.chartCard}>
              <p className={styles.chartCardTitle}>Évolution des inscriptions (cumulée)</p>
              
              <div className={styles.chartContainer}>
                {data.length === 0 ? (
                  <div className={styles.emptyState}>
                    Aucune inscription enregistrée pour le moment.
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
                      <linearGradient id="event-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = paddingTop + ratio * chartHeight;
                      const value = Math.round(maxValue * (1 - ratio));
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
                          <text
                            x={paddingLeft - 8}
                            y={y + 3}
                            fill="#475569"
                            fontSize="8"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    })}

                    {/* Labels */}
                    {points.map((p, idx) => {
                      const interval = Math.ceil(points.length / 4);
                      if (idx % interval !== 0 && idx !== points.length - 1) return null;
                      return (
                        <text
                          key={idx}
                          x={p.x}
                          y={svgHeight - 10}
                          fill="#475569"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {p.raw.label}
                        </text>
                      );
                    })}

                    {/* Area path */}
                    <path d={areaPath} fill="url(#event-gradient)" style={{ pointerEvents: "none" }} />

                    {/* Line path */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2"
                      style={{ pointerEvents: "none" }}
                    />

                    {/* Hover indicator */}
                    {hoveredIdx !== null && points[hoveredIdx] && (
                      <g>
                        <line
                          x1={points[hoveredIdx].x}
                          y1={paddingTop}
                          x2={points[hoveredIdx].x}
                          y2={svgHeight - paddingBottom}
                          stroke="#334155"
                          strokeWidth="1"
                          style={{ pointerEvents: "none" }}
                        />
                        <circle
                          cx={points[hoveredIdx].x}
                          cy={points[hoveredIdx].y}
                          r="5"
                          fill="#EF4444"
                          stroke="#0f172a"
                          strokeWidth="1.5"
                          style={{ pointerEvents: "none" }}
                        />
                      </g>
                    )}
                  </svg>
                )}

                {/* Tooltip */}
                {hoveredIdx !== null && data[hoveredIdx] && (
                  <div
                    className={styles.tooltip}
                    style={{
                      left: `${(tooltipPos.x / svgWidth) * 100}%`,
                      top: `${(tooltipPos.y / svgHeight) * 100}%`,
                      transform: "translate(-50%, -100%)",
                      minWidth: "100px",
                    }}
                  >
                    <p className={styles.tooltipLabel}>{data[hoveredIdx].label}</p>
                    <div className={styles.tooltipRow}>
                      <span className={styles.tooltipRowName}>Participants</span>
                      <span className={styles.tooltipValue}>{data[hoveredIdx].value}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <button
            onClick={onClose}
            className={styles.btnCancel}
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
