'use client';

import React, { useState } from 'react';
import type { BurnCapConfig, BurnConfig, CapType, ModelPreference } from '@cursor-throwaway/shared';
import { Bot, CheckCircle2, DollarSign, Layers, Percent, ShieldCheck, Sliders, Zap } from 'lucide-react';

interface CapConfigFormProps {
  initialConfig?: BurnConfig;
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: BurnConfig) => void;
}

export function CapConfigForm({
  initialConfig,
  isOpen,
  onClose,
  onStart,
}: CapConfigFormProps) {
  const [capType, setCapType] = useState<CapType>(initialConfig?.cap.type || 'percent');
  const [capValue, setCapValue] = useState<number>(initialConfig?.cap.value || 95);
  const [modelPreference, setModelPreference] = useState<ModelPreference>(
    initialConfig?.modelPreference || 'fastest_pool'
  );
  const [concurrency, setConcurrency] = useState<number>(
    initialConfig?.initialConcurrency || 20
  );
  const [confirmed, setConfirmed] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTypeChange = (type: CapType) => {
    setCapType(type);
    if (type === 'percent') setCapValue(95);
    else if (type === 'dollars') setCapValue(15);
    else if (type === 'session_tokens') setCapValue(10000000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;

    const config: BurnConfig = {
      cap: {
        type: capType,
        value: Number(capValue),
      },
      modelPreference,
      initialConcurrency: Number(concurrency),
    };

    onStart(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="glass-panel-glow relative w-full max-w-xl rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Configure Burn Session</h2>
              <p className="text-xs text-slate-400">Set safety cap & concurrency before launching agent swarm</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Cap Type Selection */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              1. Choose Cap Metric
            </label>
            <div className="mt-2.5 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('percent')}
                className={`flex flex-col items-center rounded-xl border p-3.5 text-center transition-all ${
                  capType === 'percent'
                    ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Percent className="h-5 w-5 mb-1.5 text-cyan-400" />
                <span className="text-xs font-bold">Spending %</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Cursor monthly cap</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('dollars')}
                className={`flex flex-col items-center rounded-xl border p-3.5 text-center transition-all ${
                  capType === 'dollars'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <DollarSign className="h-5 w-5 mb-1.5 text-emerald-400" />
                <span className="text-xs font-bold">Dollar Budget</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Max session cost</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('session_tokens')}
                className={`flex flex-col items-center rounded-xl border p-3.5 text-center transition-all ${
                  capType === 'session_tokens'
                    ? 'border-purple-500 bg-purple-500/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Layers className="h-5 w-5 mb-1.5 text-purple-400" />
                <span className="text-xs font-bold">Total Tokens</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Raw token count</span>
              </button>
            </div>
          </div>

          {/* Cap Value Input & Presets */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                2. Target Threshold
              </label>
              <span className="font-mono text-xs text-cyan-400">
                Halts when reaching {capValue}
                {capType === 'percent' ? '%' : capType === 'dollars' ? '$' : ' tokens'}
              </span>
            </div>

            <div className="mt-2 flex gap-3">
              <input
                type="number"
                min="1"
                value={capValue}
                onChange={(e) => setCapValue(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-4 py-2.5 font-mono text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Presets */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Quick presets:</span>
              {capType === 'percent' &&
                [80, 90, 95, 99].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCapValue(val)}
                    className="rounded bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    {val}%
                  </button>
                ))}
              {capType === 'dollars' &&
                [5, 10, 15, 20].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCapValue(val)}
                    className="rounded bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    ${val}
                  </button>
                ))}
              {capType === 'session_tokens' &&
                [
                  { label: '5M', v: 5000000 },
                  { label: '10M', v: 10000000 },
                  { label: '25M', v: 25000000 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setCapValue(item.v)}
                    className="rounded bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Model Preference & Concurrency */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                3. Model Priority
              </label>
              <select
                value={modelPreference}
                onChange={(e) => setModelPreference(e.target.value as ModelPreference)}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="fastest_pool">⚡ Fastest Pool (Auto-rank)</option>
                <option value="cursor_models">🎯 Cursor Composer 2.5 (Fast)</option>
                <option value="other_models">💎 Opus & Claude 3.7 Priority</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  4. Parallel Workers
                </label>
                <span className="font-mono text-xs text-cyan-400 font-bold">{concurrency} agents</span>
              </div>
              <div className="mt-3.5 flex items-center gap-3">
                <input
                  type="range"
                  min="3"
                  max="40"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Safety Checkbox */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-cyan-400"
              />
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">
                  Confirm automatic halt safety check
                </span>
                <p className="mt-0.5 text-slate-400">
                  The orchestrator will actively monitor burn metrics and immediately stop all cloud agents once the {capValue}{capType === 'percent' ? '%' : capType === 'dollars' ? '$' : ' tok'} cap is reached.
                </p>
              </div>
            </label>
          </div>

          {/* Submit / Start Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-800 px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!confirmed}
              className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                confirmed
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:brightness-110'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Zap className="h-4 w-4" />
              Launch Burn Swarm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
