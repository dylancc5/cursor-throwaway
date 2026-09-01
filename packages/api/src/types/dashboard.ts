export interface DashboardPlanUsage {
  totalSpend?: number;
  includedSpend?: number;
  bonusSpend?: number;
  limit?: number;
  totalPercentUsed?: number;
  autoPercentUsed?: number;
  apiPercentUsed?: number;
}

export interface GetCurrentPeriodUsageResponse {
  planUsage?: DashboardPlanUsage;
}

export interface DashboardUsage {
  totalPercent: number;
  autoPercent: number;
  apiPercent: number;
  includedSpendCents: number;
  limitCents: number;
}
