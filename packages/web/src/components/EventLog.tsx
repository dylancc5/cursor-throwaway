'use client';

import React, { useMemo, useState } from 'react';
import type { BurnEvent } from '@cursor-burner/shared';
import type { BurnEventWithId } from '@/lib/sse-hook';
import { formatTimestamp, formatTokens } from '@/lib/utils';
import {
  AlertCircle,
  ArrowDownCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  Filter,
  Play,
  RefreshCw,
  Search,
  Sliders,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';

interface EventLogProps {
  events: BurnEventWithId[];
  onClear?: () => void;
}

export function EventLog({ events, onClear }: EventLogProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter((item) => {
      const { type } = item.event;
      if (filterType === 'agent' && !type.startsWith('agent.')) return false;
      if (filterType === 'run' && !type.startsWith('run.')) return false;
      if (filterType === 'concurrency' && type !== 'concurrency.adjusted' && type !== 'rate_limit') return false;
      if (filterType === 'error' && type !== 'error') return false;
      if (filterType === 'snapshot' && type !== 'usage.snapshot') return false;

      if (searchQuery.trim()) {
        const str = JSON.stringify(item.event).toLowerCase();
        return str.includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [events, filterType, searchQuery]);

  const renderBadge = (event: BurnEvent) => {
    switch (event.type) {
      case 'session.started':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            <Play className="h-2.5 w-2.5" /> START
          </span>
        );
      case 'session.stopped':
        return (
          <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
            STOP ({event.reason})
          </span>
        );
      case 'agent.spawned':
        return (
          <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
            <Bot className="h-2.5 w-2.5" /> SPAWN #{event.workerId}
          </span>
        );
      case 'agent.recycled':
        return (
          <span className="flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
            <RefreshCw className="h-2.5 w-2.5" /> RECYCLE
          </span>
        );
      case 'run.started':
        return (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
            RUN START
          </span>
        );
      case 'run.completed':
        return (
          <span className="flex items-center gap-1 rounded bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/20">
            <Zap className="h-2.5 w-2.5" /> +{formatTokens(event.usage.totalTokens)} tok
          </span>
        );
      case 'concurrency.adjusted':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            <Sliders className="h-2.5 w-2.5" /> CONCURRENCY {event.from} &rarr; {event.to}
          </span>
        );
      case 'rate_limit':
        return (
          <span className="flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
            <AlertCircle className="h-2.5 w-2.5" /> 429 BACKOFF ({event.retryInMs}ms)
          </span>
        );
      case 'usage.snapshot':
        return (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            SNAPSHOT
          </span>
        );
      case 'error':
        return (
          <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-400">
            ERROR
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            {(event as any).type}
          </span>
        );
    }
  };

  const renderSummary = (event: BurnEvent) => {
    switch (event.type) {
      case 'run.completed':
        return (
          <span className="text-slate-300 font-mono text-xs">
            Worker #{event.workerId} finished turn in {event.durationMs}ms ({event.usage.outputTokens} output tokens)
          </span>
        );
      case 'run.started':
        return (
          <span className="text-slate-400 font-mono text-xs">
            Worker #{event.workerId} ({event.model}) executing prompt...
          </span>
        );
      case 'agent.spawned':
        return (
          <span className="text-slate-300 font-mono text-xs">
            Agent {event.agentId.slice(0, 14)} spawned with model {event.model}
          </span>
        );
      case 'concurrency.adjusted':
        return <span className="text-amber-300/90 font-mono text-xs">{event.reason}</span>;
      case 'rate_limit':
        return (
          <span className="text-rose-300 font-mono text-xs">
            Cursor Cloud Agent rate limit exceeded. Concurrency reduced to {event.concurrency}.
          </span>
        );
      case 'usage.snapshot':
        return (
          <span className="text-slate-400 font-mono text-xs">
            Rate: {event.session.tokensPerSec.toLocaleString()} tok/s | Total: {formatTokens(event.session.tokens)} | Active: {event.activeAgents}
          </span>
        );
      default:
        return <span className="text-slate-400 font-mono text-xs">{JSON.stringify(event)}</span>;
    }
  };

  return (
    <div className="glass-panel flex flex-col rounded-xl p-5">
      {/* Header with Search and Filter bar */}
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Live Telemetry Feed
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
            {filteredEvents.length} events
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg border border-slate-800 bg-slate-900/80 pl-8 pr-3 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
            {['all', 'run', 'agent', 'concurrency', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`rounded px-2 py-1 font-mono text-[11px] capitalize transition-colors ${
                  filterType === f
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Clear button */}
          {onClear && (
            <button
              onClick={onClear}
              title="Clear event history"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-rose-500/30 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      <div className="mt-3 flex max-h-[420px] min-h-[260px] flex-col overflow-y-auto font-mono text-xs divide-y divide-slate-800/40">
        {filteredEvents.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-slate-500">
            <Filter className="h-6 w-6 mb-2 opacity-50" />
            <p>No events matching current filter</p>
          </div>
        ) : (
          filteredEvents.map((item) => {
            const isExpanded = expandedId === item.id;
            const eventTime = 'at' in item.event ? formatTimestamp(item.event.at as string) : '--:--:--';

            return (
              <div
                key={item.id}
                className="group flex flex-col py-2 px-1 transition-colors hover:bg-slate-900/40"
              >
                <div
                  className="flex items-center justify-between cursor-pointer gap-2"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                    <button className="text-slate-600 group-hover:text-slate-400">
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <span className="text-[11px] text-slate-500 shrink-0">{eventTime}</span>
                    {renderBadge(item.event)}
                    <div className="truncate">{renderSummary(item.event)}</div>
                  </div>
                </div>

                {/* Expanded Raw JSON View */}
                {isExpanded && (
                  <div className="mt-2 rounded-md bg-slate-950/80 p-3 border border-slate-800 text-[11px] text-cyan-200/80 overflow-x-auto">
                    <pre>{JSON.stringify(item.event, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-500 font-mono">
        <span>Displaying last 200 events</span>
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          SSE Streaming Active
        </span>
      </div>
    </div>
  );
}
