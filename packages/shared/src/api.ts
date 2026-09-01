import { z } from "zod";

export const CapTypeSchema = z.enum(["percent", "dollars", "session_tokens"]);
export type CapType = z.infer<typeof CapTypeSchema>;

export const ModelPreferenceSchema = z.enum([
  "fastest_pool",
  "cursor_models",
  "other_models",
]);
export type ModelPreference = z.infer<typeof ModelPreferenceSchema>;

export const BurnCapConfigSchema = z.object({
  type: CapTypeSchema,
  value: z.number().positive(),
});

export const BurnConfigSchema = z.object({
  cap: BurnCapConfigSchema,
  modelPreference: ModelPreferenceSchema.default("fastest_pool"),
  initialConcurrency: z.number().int().min(1).max(40).optional().default(20),
});
export type BurnConfig = z.infer<typeof BurnConfigSchema>;

export const AuthLoginResponseSchema = z.object({
  sessionId: z.string(),
  loginUrl: z.string().url(),
});
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;
export type LoginResponse = AuthLoginResponse;

export const AuthStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("logged-in"),
    email: z.string().optional(),
    sessionId: z.string(),
  }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("error"), message: z.string().optional() }),
]);
export type AuthStatus = z.infer<typeof AuthStatusSchema>;
export type AuthStatusResponse = AuthStatus;

export const BurnStartRequestSchema = BurnConfigSchema;
export type BurnStartRequest = z.infer<typeof BurnStartRequestSchema>;

export const BurnStatusResponseSchema = z.object({
  sessionId: z.string(),
  status: z.enum([
    "authenticating",
    "idle",
    "burning",
    "paused",
    "stopped",
    "error",
  ]),
  email: z.string().optional(),
  config: BurnConfigSchema.optional(),
  accountUsageAvailable: z.boolean().optional(),
  session: z.object({
    tokens: z.number(),
    costCents: z.number(),
    tokensPerSec: z.number(),
  }),
  account: z
    .object({
      totalPercent: z.number(),
      autoPercent: z.number(),
      apiPercent: z.number(),
      includedSpendCents: z.number(),
      limitCents: z.number(),
    })
    .optional(),
  cap: z.object({
    type: z.string(),
    target: z.number(),
    current: z.number(),
    remaining: z.number(),
  }),
  activeAgents: z.number(),
  targetConcurrency: z.number(),
  at: z.string(),
});
export type BurnStatusResponse = z.infer<typeof BurnStatusResponseSchema>;

export interface LogoutResponse {
  ok: boolean;
}

export interface StartBurnResponse {
  ok: boolean;
  accountUsageAvailable?: boolean;
}

export interface StopBurnResponse {
  ok: boolean;
}

export interface PauseBurnResponse {
  ok: boolean;
}

export interface ResumeBurnResponse {
  ok: boolean;
}
