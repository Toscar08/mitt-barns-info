/**
 * The two subscription plans. Amounts are in öre, including 25 % VAT.
 * The webhook only grants access for exactly these amounts, and the database checks them again.
 */
export const PLANS = {
  monthly: { amount: 3900, interval: "month" },
  yearly: { amount: 34900, interval: "year" },
} as const;

export type Plan = keyof typeof PLANS;

export const kronor = (ore: number) => Math.round(ore / 100);

/** What the yearly plan costs per month, rounded down, for the "29 kr/mån" line. */
export const yearlyPerMonth = Math.floor(PLANS.yearly.amount / 100 / 12);

/** How much cheaper a year is than twelve months, in whole percent. */
export const yearlySaving = Math.round((1 - PLANS.yearly.amount / (PLANS.monthly.amount * 12)) * 100);

/** Which plan a verified amount belongs to, or null if it matches none. */
export function planForAmount(amount: number, interval: string | null | undefined): Plan | null {
  for (const [plan, info] of Object.entries(PLANS) as [Plan, (typeof PLANS)[Plan]][]) {
    if (info.amount === amount && (!interval || info.interval === interval)) return plan;
  }
  return null;
}
