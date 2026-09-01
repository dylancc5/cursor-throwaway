#!/usr/bin/env node
/**
 * Dashboard RPC spike — run with:
 *   CURSOR_API_KEY=... npm run spike:dashboard -w @cursor-burner/api
 *
 * Documents whether GetCurrentPeriodUsage works with a user-minted API key.
 */
import { fetchCurrentPeriodUsage } from "./dashboard-poller.js";

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  console.error("Set CURSOR_API_KEY to run the dashboard spike.");
  process.exit(1);
}

const usage = await fetchCurrentPeriodUsage(apiKey);
if (!usage) {
  console.log("SPIKE RESULT: FAILED — dashboard RPC unavailable with user API key");
  console.log("Fallback: enforce percent caps only when account data is present;");
  console.log("dollar and session_tokens caps still work via SDK session metrics.");
  process.exit(0);
}

console.log("SPIKE RESULT: SUCCESS — dashboard RPC works with user API key");
console.log(JSON.stringify(usage, null, 2));
