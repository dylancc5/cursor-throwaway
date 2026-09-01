'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Flame, LogOut, Radio, Sparkles, ToggleLeft, ToggleRight, User } from 'lucide-react';
import type { ConnectionState } from '@/lib/sse-hook';

interface NavbarProps {
  email?: string;
  isMock?: boolean;
  onToggleMock?: () => void;
  connectionState?: ConnectionState;
  onLogout?: () => void;
  activeAgentsCount?: number;
}

export function Navbar({
  email,
  isMock = false,
  onToggleMock,
  connectionState = 'connected',
  onLogout,
  activeAgentsCount = 0,
}: NavbarProps) {
  const router = useRouter();

  const handleDefaultLogout = () => {
    localStorage.removeItem('cursor_session_id');
    localStorage.removeItem('cursor_user_email');
    localStorage.removeItem('cursor_is_mock');
    if (onLogout) onLogout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Flame className="h-5 w-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black tracking-wider text-white">
                CURSOR BURNER
              </span>
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.2 font-mono text-[10px] font-bold text-cyan-400 border border-cyan-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Cloud Agent Fast-Pool Consumer</p>
          </div>
        </Link>

        {/* Right Action Items */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Mock vs Live Indicator */}
          {onToggleMock && (
            <button
              onClick={onToggleMock}
              title="Toggle between Live API and Simulation Engine"
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors ${
                isMock
                  ? 'border-purple-500/30 bg-purple-950/30 text-purple-300'
                  : 'border-cyan-500/30 bg-cyan-950/30 text-cyan-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{isMock ? 'Simulation Mode' : 'Live Backend'}</span>
              {isMock ? (
                <ToggleRight className="h-4 w-4 text-purple-400" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-cyan-400" />
              )}
            </button>
          )}

          {/* SSE Connection State */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionState === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden md:inline text-[11px] text-slate-400">
              {connectionState === 'connected'
                ? 'SSE Live'
                : connectionState === 'connecting'
                ? 'Reconnecting'
                : 'Offline'}
            </span>
          </div>

          {/* User Account Info */}
          {email && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline font-mono text-xs text-slate-300 truncate max-w-[160px]">
                {email}
              </span>
              <button
                onClick={handleDefaultLogout}
                title="Disconnect Account"
                className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
