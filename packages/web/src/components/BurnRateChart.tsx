'use client';

import React, { useMemo } from 'react';
import { formatRate } from '@/lib/utils';
import { Activity, Zap } from 'lucide-react';

interface BurnRateChartProps {
  history: Array<{ time: string; rate: number; tokens: number }>;
  currentRate: number;
}

export function BurnRateChart({ history, currentRate }: BurnRateChartProps) {
  const points = useMemo(() => {
    if (history.length === 0) return [];
    return history.map((item) => item.rate);
  }, [history]);

  const maxRate = useMemo(() => {
    if (points.length === 0) return 30000;
    const max = Math.max(...points, currentRate, 10000);
    return Math.ceil(max * 1.15); // Add headroom
  }, [points, currentRate]);

  const avgRate = useMemo(() => {
    if (points.length === 0) return 0;
    const sum = points.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / points.length);
  }, [points]);

  // SVG Area path generation
  const width = 600;
  const height = 180;
  const paddingBottom = 25;
  const paddingTop = 15;
  const chartHeight = height - paddingBottom - paddingTop;

  const { pathData, areaData, currentPointCoord } = useMemo(() => {
    if (history.length < 2) {
      return { pathData: '', areaData: '', currentPointCoord: null };
    }

    const stepX = width / (history.length - 1);
    const coords = history.map((item, idx) => {
      const x = idx * stepX;
      const normalizedY = item.rate / maxRate;
      const y = paddingTop + chartHeight - normalizedY * chartHeight;
      return { x, y };
    });

    // Build SVG Path
    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Smooth cubic bezier curve
      const prev = coords[i - 1];
      const curr = coords[i];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr.y;
      path += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }

    const area = `${path} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;
    const lastCoord = coords[coords.length - 1];

    return { pathData: path, areaData: area, currentPointCoord: lastCoord };
  }, [history, maxRate, chartHeight, paddingTop, height, paddingBottom]);

  return (
    <div className="glass-panel flex flex-col justify-between rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Real-time Burn Rate
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1 text-slate-400">
            <span>Avg:</span>
            <span className="text-slate-200 font-bold">{formatRate(avgRate)}</span>
          </div>
          <div className="flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-400 border border-cyan-500/20">
            <Zap className="h-3 w-3" />
            <span className="font-bold">{formatRate(currentRate)}</span>
          </div>
        </div>
      </div>

      {/* Live SVG Graph */}
      <div className="relative mt-3 w-full h-[180px] overflow-hidden">
        {history.length < 2 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 font-mono">
            Waiting for telemetry data stream...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            <line
              x1="0"
              y1={paddingTop}
              x2={width}
              y2={paddingTop}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1={paddingTop + chartHeight / 2}
              x2={width}
              y2={paddingTop + chartHeight / 2}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1={height - paddingBottom}
              x2={width}
              y2={height - paddingBottom}
              stroke="rgba(255,255,255,0.1)"
            />

            {/* Area Fill */}
            <path d={areaData} fill="url(#rateGradient)" />

            {/* Main Sparkline Stroke */}
            <path
              d={pathData}
              fill="transparent"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />

            {/* Current Point Pulse */}
            {currentPointCoord && (
              <g>
                <circle
                  cx={currentPointCoord.x}
                  cy={currentPointCoord.y}
                  r="6"
                  fill="#06b6d4"
                  className="animate-ping opacity-75"
                />
                <circle
                  cx={currentPointCoord.x}
                  cy={currentPointCoord.y}
                  r="4"
                  fill="#ffffff"
                  stroke="#06b6d4"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-500 font-mono">
        <span>Timeline (Last 60s)</span>
        <span>Peak: {formatRate(maxRate)}</span>
      </div>
    </div>
  );
}
