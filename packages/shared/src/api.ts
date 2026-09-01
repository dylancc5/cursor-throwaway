import { z } from 'zod';
import type { AuthSession, BurnConfig, BurnSnapshot } from './types.js';

export const CapTypeSchema = z.enum(['percent', 'dollars', 'session_tokens']);
export const ModelPreferenceSchema = z.enum(['fastest_pool', 'cursor_models', 'other_models']);

export const BurnCapConfigSchema = z.object({
  type: CapTypeSchema,
  value: z.number().positive(),
});

export const BurnConfigSchema = z.object({
  cap: BurnCapConfigSchema,
  modelPreference: ModelPreferenceSchema.default('fastest_pool'),
  initialConcurrency: z.number().min(1).max(50).optional().default(20),
});

export const LoginRequestSchema = z.object({
  redirectUrl: z.string().url().optional(),
});

export interface LoginResponse {
  sessionId: string;
  loginUrl: string;
  expiresInSeconds?: number;
}

export type AuthStatusResponse = AuthSession;

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export type StartBurnRequest = BurnConfig;

export interface StartBurnResponse {
  sessionId: string;
  status: 'started';
  config: BurnConfig;
  startedAt: string;
}

export interface StopBurnResponse {
  sessionId: string;
  status: 'stopped';
  reason: string;
  stoppedAt: string;
}

export interface PauseBurnResponse {
  sessionId: string;
  status: 'paused';
}

export type BurnStatusResponse = BurnSnapshot;
