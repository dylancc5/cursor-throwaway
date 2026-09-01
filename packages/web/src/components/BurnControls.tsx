'use client';

import React from 'react';
import type { BurnSessionStatus } from '@cursor-throwaway/shared';
import { Flame, Pause, Play, Square, Zap } from 'lucide-react';

interface BurnControlsProps {
  status: BurnSessionStatus;
  onOpenConfig: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  isLoading?: boolean;
}

export function BurnControls({
  status,
  onOpenConfig,
  onStop,
  onPause,
  onResume,
  isLoading = false,
}: BurnControlsProps) {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdleOrStopped = status === 'idle' || status === 'stopped' || status === 'error';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isIdleOrStopped && (
        <button
          onClick={onOpenConfig}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <Flame className="h-4 w-4 text-amber-300 animate-pulse" />
          <span>Start Burn</span>
        </button>
      )}

      {isRunning && (
        <>
          <button
            onClick={onPause}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all hover:bg-amber-500/20 active:scale-95"
          >
            <Pause className="h-4 w-4" />
            <span>Pause</span>
          </button>

          <button
            onClick={onStop}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all hover:bg-rose-500/20 active:scale-95"
          >
            <Square className="h-4 w-4" />
            <span>Halt Swarm</span>
          </button>
        </>
      )}

      {isPaused && (
        <>
          <button
            onClick={onResume}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-500 active:scale-95"
          >
            <Play className="h-4 w-4" />
            <span>Resume</span>
          </button>

          <button
            onClick={onStop}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95"
          >
            <Square className="h-4 w-4" />
            <span>Halt Swarm</span>
          </button>
        </>
      )}
    </div>
  );
}
