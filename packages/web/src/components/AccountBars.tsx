'use client';

import React from 'react';
import type { AccountUsage } from '@cursor-burner/shared';
import { formatPercentage } from '@/lib/utils';
import { CreditCard, Info, Sparkles } from 'lucide-react';

interface AccountBarsProps {
  account?: AccountUsage;
}

export function AccountBars({ account }: AccountBarsProps) {
  if (!account) {
    return (
      <div className="glass-panel flex flex-col justify-between rounded-xl p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Account Usage
          </span>
        </div>

        <div className="my-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold">Account Period Usage Unavailable</p>
              <p className="mt-1 text-slate-400">
                Cursor Dashboard RPC is unauthenticated for this API key. Displaying session burn telemetry only.
              </p>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono text-center">
          Pro plan allowance: 100% fast pool included
        </div>
      </div>
    );
  }

  const { totalPercent, autoPercent, apiPercent } = account;

  const getBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]';
    if (pct >= 70) return 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]';
    return 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]';
  };

  return (
    <div className="glass-panel flex flex-col justify-between rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Billing Period Usage
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <Sparkles className="h-3 w-3" /> Live RPC
        </span>
      </div>

      <div className="my-3 space-y-4">
        {/* Total Spending Bar */}
        <div>
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Total Spending %</span>
            <span className="font-mono text-white font-bold">{formatPercentage(totalPercent)}</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-700 rounded-full ${getBarColor(totalPercent)}`}
              style={{ width: `${Math.min(100, totalPercent)}%` }}
            />
          </div>
        </div>

        {/* Auto Agent % */}
        <div>
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-400">Cloud Agent Pool</span>
            <span className="font-mono text-slate-300">{formatPercentage(autoPercent)}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-700 rounded-full"
              style={{ width: `${Math.min(100, autoPercent)}%` }}
            />
          </div>
        </div>

        {/* API Composer % */}
        <div>
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-400">Composer / Other Models</span>
            <span className="font-mono text-slate-300">{formatPercentage(apiPercent)}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-700 rounded-full"
              style={{ width: `${Math.min(100, apiPercent)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400 font-mono">
        <span>Included Cap: $20.00</span>
        <span className="text-slate-500">Resets monthly</span>
      </div>
    </div>
  );
}
