import type { DashboardUsage, GetCurrentPeriodUsageResponse } from "../types/dashboard.js";

const DASHBOARD_URL =
  "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";

export async function fetchCurrentPeriodUsage(
  apiKey: string,
): Promise<DashboardUsage | null> {
  try {
    const response = await fetch(DASHBOARD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GetCurrentPeriodUsageResponse;
    const plan = data.planUsage;
    if (!plan) {
      return null;
    }

    return {
      totalPercent: plan.totalPercentUsed ?? 0,
      autoPercent: plan.autoPercentUsed ?? 0,
      apiPercent: plan.apiPercentUsed ?? 0,
      includedSpendCents: Math.round((plan.includedSpend ?? 0) * 100),
      limitCents: Math.round((plan.limit ?? 0) * 100),
    };
  } catch {
    return null;
  }
}
