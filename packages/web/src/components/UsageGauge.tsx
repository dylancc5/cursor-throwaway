'use client';

import React from 'react';
import type { CapStatus } from '@cursor-throwaway/shared';
import { formatCurrency, formatPercentage, formatTokens } from '@/lib/utils';
import { Flame, ShieldAlert, Target } from 'lucide-react';

interface UsageGaugeProps {
  cap: CapStatus | null;
  isRunning?: boolean;
}

export function UsageGauge({ cap, isRunning = false }: UsageGaugeProps) {
  const current = cap?.current ?? 0;
  const target = cap?.target ?? 100;
  const type = cap?.type ?? 'percent';

  const percentage = Math.min(100, Math.max(0, target > 0 ? (current / target) * 100 : 0));
  const remaining = cap?.remaining ?? Math.max(0, target - current);

  // SVG circle calculations
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const isNearLimit = percentage >= 90;
  const isCapHit = percentage >= 100;

  const formatValue = (val: number) => {
    if (type === 'dollars') return formatCurrency(val * 100);
    if (type === 'session_tokens') return formatTokens(val);
    return formatPercentage(val);
  };

  const ringColor = isCapHit
    ? '#f43f5e' // Rose
    : isNearLimit
    ? '#f59e0b' // Amber
    : '#06b6d4'; // Cyan

  return (
    <div className="glass-panel relative flex flex-col items-center justify-between rounded-xl p-6 text-center">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Cap Progress
          </span>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-cyan-400 border border-cyan-500/20">
          Target: {formatValue(target)}
        </span>
      </div>

      {/* Radial Progress Ring */}
      <div className="relative my-4 flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90 transform">
          {/* Background Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
              filter: `drop-shadow(0 0 10px ${ringColor}66)`,
            }}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1">
            {isRunning && <Flame className="h-5 w-5 text-amber-400 animate-bounce" />}
            <span className="font-mono text-3xl font-extrabold tracking-tight text-white">
              {percentage.toFixed(1)}%
            </span>
          </div>
          <span className="mt-1 font-mono text-xs text-slate-400">
            {formatValue(current)} / {formatValue(target)}
          </span>
          {isCapHit ? (
            <span className="mt-2 flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-400">
              <ShieldAlert className="h-3 w-3" /> Cap Reached
            </span>
          ) : (
            <span className="mt-1.5 font-mono text-[11px] text-slate-500">
              Remaining: {formatValue(remaining)}
            </span>
          )}
        </div>
      </div>

      <div className="w-full rounded-lg bg-slate-900/60 p-2.5 text-xs text-slate-400 border border-slate-800/80 flex items-center justify-between">
        <span className="text-slate-500">Enforcement:</span>
        <span className="font-medium text-slate-300">
          Auto-halts agents when cap reached
        </span>
      </div>
    </div>
  );
}
