export type PlanKey = 'monthly' | 'yearly' | 'lifetime';

export type PlanInfo = {
  key: PlanKey;
  label: string;
  priceInr: number;
  billing: string;
  recurring: boolean;
  savingsLabel?: string;
};

export const PLANS: Record<PlanKey, PlanInfo> = {
  monthly: { key: 'monthly', label: 'Monthly', priceInr: 199, billing: 'per month', recurring: true },
  yearly: { key: 'yearly', label: 'Yearly', priceInr: 899, billing: 'per year', recurring: true, savingsLabel: 'Save 62%' },
  lifetime: { key: 'lifetime', label: 'Lifetime', priceInr: 1999, billing: 'one-time', recurring: false },
};

/** Purchasing is on hold — Razorpay was removed (Google Play policy requires Google Play Billing
 * for in-app digital-good purchases on Android, not a third-party gateway), and Play Billing
 * itself needs a Play Console developer account + app listing + in-app products created there
 * before any client code can call it, let alone be tested — Play Billing purchases don't even
 * function on a directly-installed APK outside Play's own distribution. See app/premium.tsx for
 * the placeholder shown in the meantime. */
export function purchasingAvailable(): boolean {
  return false;
}
