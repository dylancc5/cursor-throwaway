import type {
  AccountUsage,
  BurnConfig,
  CapProgress,
  SessionMetrics,
} from "@cursor-burner/shared";

export function isCapReached(
  config: BurnConfig,
  session: SessionMetrics,
  account?: AccountUsage | null,
): boolean {
  switch (config.cap.type) {
    case "percent":
      if (!account) return false;
      return account.totalPercent >= config.cap.value;
    case "dollars":
      return session.costCents >= config.cap.value * 100;
    case "session_tokens":
      return session.tokens >= config.cap.value;
    default:
      return false;
  }
}

export function buildCapProgress(
  config: BurnConfig,
  session: SessionMetrics,
  account?: AccountUsage | null,
): CapProgress {
  let current = 0;
  switch (config.cap.type) {
    case "percent":
      current = account?.totalPercent ?? 0;
      break;
    case "dollars":
      current = session.costCents / 100;
      break;
    case "session_tokens":
      current = session.tokens;
      break;
  }

  const remaining = Math.max(0, config.cap.value - current);
  return {
    type: config.cap.type,
    target: config.cap.value,
    current,
    remaining,
  };
}
