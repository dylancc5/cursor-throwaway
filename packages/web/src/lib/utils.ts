import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokens(tokens: number): string {
  if (isNaN(tokens) || tokens === null || tokens === undefined) return '0';
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(2)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toLocaleString();
}

export function formatCurrency(cents: number): string {
  if (isNaN(cents) || cents === null || cents === undefined) return '$0.00';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function formatRate(tokensPerSec: number): string {
  if (isNaN(tokensPerSec) || tokensPerSec === null || tokensPerSec === undefined || tokensPerSec <= 0) {
    return '0 tok/s';
  }
  if (tokensPerSec >= 1_000_000) {
    return `${(tokensPerSec / 1_000_000).toFixed(2)}M tok/s`;
  }
  if (tokensPerSec >= 1_000) {
    return `${(tokensPerSec / 1_000).toFixed(1)}k tok/s`;
  }
  return `${Math.round(tokensPerSec)} tok/s`;
}

export function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatPercentage(pct: number): string {
  if (isNaN(pct) || pct === null || pct === undefined) return '0.0%';
  return `${pct.toFixed(1)}%`;
}

export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  } catch {
    return isoString;
  }
}
