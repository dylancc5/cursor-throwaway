'use client';

import React from 'react';
import type { AgentWorkerState } from '@cursor-throwaway/shared';
import { formatTokens } from '@/lib/utils';
import { Bot, Cpu, RefreshCw, Sparkles } from 'lucide-react';

interface AgentGridProps {
  agents: AgentWorkerState[];
  targetConcurrency?: number;
}

export function AgentGrid({ agents, targetConcurrency = 20 }: AgentGridProps) {
  const activeCount = agents.filter((a) => a.status === 'working' || a.status === 'spawning').length;

  return (
    <div className="glass-panel flex flex-col rounded-xl p-5">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Active Agent Swarm
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
            {activeCount} / {targetConcurrency} online
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multi-turn loop</span>
          </div>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
          <Cpu className="h-10 w-10 text-slate-700 animate-pulse" />
          <p className="mt-3 text-sm font-medium text-slate-400">No agents currently deployed</p>
          <p className="mt-1 text-xs text-slate-600">
            Click Start Burn to spawn cloud agent workers and begin token consumption
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 max-h-[380px] overflow-y-auto pr-1">
          {agents.map((agent) => {
            const isWorking = agent.status === 'working';
            const isSpawning = agent.status === 'spawning';
            const isRecycled = agent.status === 'recycled';

            return (
              <div
                key={agent.workerId}
                className={`relative flex flex-col justify-between rounded-lg border p-3 transition-all duration-300 ${
                  isWorking
                    ? 'border-cyan-500/30 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.08)]'
                    : isSpawning
                    ? 'border-amber-500/30 bg-amber-950/20 animate-pulse'
                    : isRecycled
                    ? 'border-purple-500/30 bg-purple-950/20'
                    : 'border-slate-800 bg-slate-900/40 opacity-60'
                }`}
              >
                {/* Top header */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-200">
                    #{agent.workerId.toString().padStart(2, '0')}
                  </span>
                  <span
                    className={`flex h-2 w-2 rounded-full ${
                      isWorking
                        ? 'bg-emerald-400 animate-ping'
                        : isSpawning
                        ? 'bg-amber-400'
                        : isRecycled
                        ? 'bg-purple-400'
                        : 'bg-slate-600'
                    }`}
                  />
                </div>

                {/* Model and turns */}
                <div className="my-2.5">
                  <div className="truncate font-mono text-[10px] text-cyan-300/90 font-medium">
                    {agent.model}
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Tokens:</span>
                    <span className="font-bold text-white">{formatTokens(agent.totalTokens)}</span>
                  </div>
                </div>

                {/* 5-turn Pip Meter */}
                <div className="border-t border-slate-800/80 pt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Turn {agent.turnsCompleted % 5}/5</span>
                    {isRecycled && (
                      <span className="flex items-center gap-0.5 text-purple-400">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Recycled
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((turn) => {
                      const completed = (agent.turnsCompleted % 5) >= turn;
                      return (
                        <div
                          key={turn}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            completed ? 'bg-cyan-400 shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
