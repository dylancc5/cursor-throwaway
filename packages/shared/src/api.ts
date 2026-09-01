import { z } from "zod";

export const CapTypeSchema = z.enum(["percent", "dollars", "session_tokens"]);
export type CapType = z.infer<typeof CapTypeSchema>;

export const ModelPreferenceSchema = z.enum([
  "fastest_pool",
  "cursor_models",
  "other_models",
]);
export type ModelPreference = z.infer<typeof ModelPreferenceSchema>;

export const BurnConfigSchema = z.object({
  cap: z.object({
    type: CapTypeSchema,
    value: z.number().positive(),
  }),
  modelPreference: ModelPreferenceSchema,
  initialConcurrency: z.number().int().min(1).max(40).optional(),
});
export type BurnConfig = z.infer<typeof BurnConfigSchema>;

export const AuthLoginResponseSchema = z.object({
  sessionId: z.string(),
  loginUrl: z.string().url(),
});
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;

export const AuthStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("logged-in"),
    email: z.string().optional(),
    sessionId: z.string(),
  }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);
export type AuthStatus = z.infer<typeof AuthStatusSchema>;

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
  snapshot: z
    .object({
      tokens: z.number(),
      costCents: z.number(),
      tokensPerSec: z.number(),
      activeAgents: z.number(),
      completedRuns: z.number(),
      concurrency: z.number(),
    })
    .optional(),
});
export type BurnStatusResponse = z.infer<typeof BurnStatusResponseSchema>;
