import { SalesNetworkRole } from "@prisma/client";

/** BDE monthly revenue target (₹) — shown on BDE dashboard. */
export const BDE_DEFAULT_MONTHLY_REVENUE_TARGET = 30_000;

export const DEFAULT_SALES_NETWORK_TARGETS: Record<
  SalesNetworkRole,
  { monthlyRevenue: number; monthlyCustomers: number; bdeCreation: number; consecutiveMonths: number }
> = {
  [SalesNetworkRole.BOSS]: {
    monthlyRevenue: 0,
    monthlyCustomers: 0,
    bdeCreation: 0,
    consecutiveMonths: 3,
  },
  [SalesNetworkRole.RSM]: {
    monthlyRevenue: 500_000,
    monthlyCustomers: 20,
    bdeCreation: 4,
    consecutiveMonths: 3,
  },
  [SalesNetworkRole.BDM]: {
    monthlyRevenue: 200_000,
    monthlyCustomers: 10,
    bdeCreation: 3,
    consecutiveMonths: 3,
  },
  [SalesNetworkRole.BDE]: {
    monthlyRevenue: BDE_DEFAULT_MONTHLY_REVENUE_TARGET,
    monthlyCustomers: 5,
    bdeCreation: 0,
    consecutiveMonths: 3,
  },
  [SalesNetworkRole.TECH_EXEC]: {
    monthlyRevenue: 0,
    monthlyCustomers: 0,
    bdeCreation: 0,
    consecutiveMonths: 0,
  },
};
