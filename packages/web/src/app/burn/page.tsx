'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BurnConfig, BurnSessionStatus } from '@cursor-throwaway/shared';
import { Navbar } from '@/components/Navbar';
import { StatCard } from '@/components/StatCard';
import { UsageGauge } from '@/components/UsageGauge';
import { AccountBars } from '@/components/AccountBars';
import { BurnRateChart } from '@/components/BurnRateChart';
import { AgentGrid } from '@/components/AgentGrid';
import { EventLog } from '@/components/EventLog';
import { BurnControls } from '@/components/BurnControls';
import { CapConfigForm } from '@/components/CapConfigForm';
import { useBurnEvents } from '@/lib/sse-hook';
import { formatCurrency, formatDuration, formatRate, formatTokens } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Coins,
  Cpu,
  Flame,
  Layers,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function BurnDashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>('pro-user@cursor.com');
  const [sessionId, setSessionId] = useState<string>('mock-session');
  const [isMock, setIsMock] = useState<boolean>(true);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Read stored auth session state on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('cursor_session_id');
    const storedEmail = localStorage.getItem('cursor_user_email');
    const storedMock = localStorage.getItem('cursor_is_mock');

    if (storedSession) setSessionId(storedSession);
    if (storedEmail) setEmail(storedEmail);
    if (storedMock !== null) setIsMock(storedMock === 'true');
  }, []);

  const {
    connectionState,
    events,
    snapshot,
    agents,
    burnRateHistory,
    error,
    startBurn,
    stopBurn,
    pauseBurn,
    resumeBurn,
    clearEvents,
  } = useBurnEvents({ sessionId, isMock });

  const status: BurnSessionStatus = snapshot?.status || 'idle';
  const isRunning = status === 'running';

  // Elapsed timer ticker
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const handleStartWithConfig = (config: BurnConfig) => {
    setElapsedSeconds(0);
    startBurn(config);
  };

  const toggleMockMode = () => {
    const nextMock = !isMock;
    setIsMock(nextMock);
    localStorage.setItem('cursor_is_mock', nextMock.toString());
  };

  const handleLogout = () => {
    localStorage.removeItem('cursor_session_id');
    localStorage.removeItem('cursor_user_email');
    localStorage.removeItem('cursor_is_mock');
    router.push('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        email={email}
        isMock={isMock}
        onToggleMock={toggleMockMode}
        connectionState={connectionState}
        onLogout={handleLogout}
        activeAgentsCount={agents.length}
      />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="flex-1">
              <span className="font-bold">Error:</span> {error}
            </div>
          </div>
        )}

        {/* Dashboard Header Bar */}
        <div className="glass-panel flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Flame className={`h-6 w-6 ${isRunning ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              </div>
              {isRunning && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white font-sans">
                  Observability Control Deck
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    isRunning
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : status === 'paused'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Session: <span className="text-slate-200">{sessionId}</span> • Elapsed: <span className="text-cyan-400 font-bold">{formatDuration(elapsedSeconds)}</span>
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <BurnControls
              status={status}
              onOpenConfig={() => setIsConfigOpen(true)}
              onStop={stopBurn}
              onPause={pauseBurn}
              onResume={resumeBurn}
            />
          </div>
        </div>

        {/* Primary Metric StatCards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Tokens Burned"
            value={formatTokens(snapshot?.session.tokens || 0)}
            subValue={`Cumulative Session Output`}
            icon={<Layers className="h-4 w-4" />}
            variant="cyan"
          />

          <StatCard
            label="Current Burn Rate"
            value={formatRate(snapshot?.session.tokensPerSec || 0)}
            subValue={isRunning ? 'Active Swarm Velocity' : 'Swarm Offline'}
            icon={<Zap className="h-4 w-4" />}
            variant="amber"
          />

          <StatCard
            label="Session Spend Value"
            value={formatCurrency(snapshot?.session.costCents || 0)}
            subValue="Equivalent Pro Usage Value"
            icon={<Coins className="h-4 w-4" />}
            variant="emerald"
          />

          <StatCard
            label="Active Cloud Agents"
            value={`${snapshot?.activeAgents || 0} / ${snapshot?.targetConcurrency || 20}`}
            subValue="Parallel Worker Threads"
            icon={<Bot className="h-4 w-4" />}
            variant="purple"
          />
        </div>

        {/* Middle Telemetry Row (Cap Progress, Account Spending, Burn Rate Chart) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cap Progress Ring (4 cols) */}
          <div className="lg:col-span-4 flex flex-col">
            <UsageGauge
              cap={
                snapshot?.cap || {
                  type: 'percent',
                  target: 95,
                  current: 0,
                  remaining: 95,
                }
              }
              isRunning={isRunning}
            />
          </div>

          {/* Account Usage Breakdown (3 cols) */}
          <div className="lg:col-span-3 flex flex-col">
            <AccountBars account={snapshot?.account} />
          </div>

          {/* Burn Rate Time-Series Chart (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <BurnRateChart
              history={burnRateHistory}
              currentRate={snapshot?.session.tokensPerSec || 0}
            />
          </div>
        </div>

        {/* Active Cloud Agent Swarm Grid */}
        <AgentGrid
          agents={agents}
          targetConcurrency={snapshot?.targetConcurrency || 20}
        />

        {/* Real-time Event Log */}
        <EventLog events={events} onClear={clearEvents} />
      </main>

      {/* Cap Configuration Modal */}
      <CapConfigForm
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onStart={handleStartWithConfig}
        initialConfig={{
          cap: { type: 'percent', value: 95 },
          modelPreference: 'fastest_pool',
          initialConcurrency: 20,
        }}
      />
    </div>
  );
}
