'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { LoginButton } from '@/components/LoginButton';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Lock,
  Radio,
  Shield,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {/* Hero Section with Telemetry Grid Background */}
      <main className="relative flex-1 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-radial-gradient pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 text-center">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-mono font-medium text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Maximize Pro Plan Usage Before Monthly Expiry</span>
          </div>

          {/* Main Title */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl font-sans">
            Consume Cursor Pro Usage{' '}
            <span className="shimmer-text block mt-1">at Maximum Velocity.</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed">
            Deploy parallel cloud agents to burn unused Pro quotas into valuable research and code generations before the billing cycle resets, backed by <strong>real-time live observability</strong> and <strong>hard safety caps</strong>.
          </p>

          {/* CTA Box */}
          <div className="mt-10 flex flex-col items-center justify-center">
            <LoginButton className="text-base py-4 px-8 shadow-[0_0_35px_rgba(6,182,212,0.5)]" />
            <p className="mt-3 text-xs text-slate-500 font-mono">
              Zero disk persistence • AES-256 in-memory session bridge • Instant auto-halt
            </p>
          </div>

          {/* Live Metric Preview Cards */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="glass-panel rounded-xl p-4 text-left border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.06)]">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                <Zap className="h-4 w-4" /> Peak Burn Rate
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-white">~35,000</div>
              <div className="text-[11px] text-slate-400 font-mono">tokens / sec</div>
            </div>

            <div className="glass-panel rounded-xl p-4 text-left border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.06)]">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <Bot className="h-4 w-4" /> Agent Swarm
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-white">20 - 40</div>
              <div className="text-[11px] text-slate-400 font-mono">parallel cloud agents</div>
            </div>

            <div className="glass-panel rounded-xl p-4 text-left border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.06)]">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                <Gauge className="h-4 w-4" /> Observability
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-white">&lt; 100ms</div>
              <div className="text-[11px] text-slate-400 font-mono">SSE telemetry latency</div>
            </div>

            <div className="glass-panel rounded-xl p-4 text-left border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.06)]">
              <div className="flex items-center gap-1.5 text-xs text-purple-400 font-mono">
                <Shield className="h-4 w-4" /> Safety Cap
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-white">100% Guaranteed</div>
              <div className="text-[11px] text-slate-400 font-mono">Zero on-demand overages</div>
            </div>
          </div>

          {/* Architecture Feature Grid */}
          <div className="mt-20 text-left">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Observability & Control Features</h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 font-mono">
                Engineered for precision tracking across every agent turn and token
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Feature 1 */}
              <div className="glass-panel relative rounded-2xl p-6 transition-all hover:border-cyan-500/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">Live Time-Series Charting</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Real-time visualization of aggregate token throughput, burn velocity (tokens/sec), and prompt completions over rolling 60-second telemetry windows.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass-panel relative rounded-2xl p-6 transition-all hover:border-emerald-500/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">Multi-Agent Swarm Grid</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Monitor individual cloud agents across multi-turn loops. Track 5-turn recycling cadences, model assignments, and individual token loads in real time.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass-panel relative rounded-2xl p-6 transition-all hover:border-purple-500/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">Triple Cap Guardrails</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Set safety caps by Monthly Total %, Dollar budget, or Raw token counts. Automated poller instantly signals orchestrator to halt all workers once reached.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-background/80 py-6 text-center font-mono text-xs text-slate-500">
        <p>Cursor Usage Burner • Track 1 Web & Observability Suite • Designed for Pro Accounts</p>
      </footer>
    </div>
  );
}
