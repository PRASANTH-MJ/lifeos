export type PlanKey = 'monthly' | 'quarterly' | 'halfYearly' | 'yearly' | 'familyHalfYearly' | 'familyYearly' | 'lifetime';

export type PlanInfo = {
  key: PlanKey;
  label: string;
  priceInr: number;
  billing: string;
  recurring: boolean;
  savingsLabel?: string;
  /** Set only for the two family plans — one flat price covers this many accounts (the
   * subscriber + invited members), not per-member pricing. See modules/family/ for the
   * invite/membership flow this powers. */
  maxMembers?: number;
};

/** Up to this many accounts (the subscriber included) share one Family plan — see
 * functions/index.js's FAMILY_MAX_MEMBERS, which must be kept in sync with this by hand (Cloud
 * Functions can't import client modules). */
export const FAMILY_MAX_MEMBERS = 5;

// Savings labels are computed against the monthly price times the tier's length, not hardcoded,
// so they always stay honest if the monthly price ever changes again without every tier being
// updated in lockstep.
const MONTHLY_PRICE_INR = 149;
function savingsLabel(priceInr: number, months: number): string {
  const percent = Math.round((1 - priceInr / (MONTHLY_PRICE_INR * months)) * 100);
  return `Save ${percent}%`;
}

export const PLANS: Record<PlanKey, PlanInfo> = {
  monthly: { key: 'monthly', label: 'Monthly', priceInr: MONTHLY_PRICE_INR, billing: 'per month', recurring: true },
  quarterly: {
    key: 'quarterly',
    label: '3 Months',
    priceInr: 299,
    billing: 'per 3 months',
    recurring: true,
    savingsLabel: savingsLabel(299, 3),
  },
  halfYearly: {
    key: 'halfYearly',
    label: '6 Months',
    priceInr: 599,
    billing: 'per 6 months',
    recurring: true,
    savingsLabel: savingsLabel(599, 6),
  },
  yearly: {
    key: 'yearly',
    label: 'Yearly',
    priceInr: 999,
    billing: 'per year',
    recurring: true,
    savingsLabel: savingsLabel(999, 12),
  },
  // Kept only so an existing lifetime purchaser's already-granted `plan: 'lifetime'` still
  // resolves to a label (app/premium.tsx's "You're on Flowsy Pro" screen) — no longer offered as
  // a purchase option (see PURCHASABLE_PLANS below and billingService.ts's fetchCurrentOffering).
  lifetime: { key: 'lifetime', label: 'Lifetime', priceInr: 3499, billing: 'one-time', recurring: false },
  // Family plans: one flat price covers the subscriber + up to FAMILY_MAX_MEMBERS-1 invited
  // members (see modules/family/ for the invite flow) — not priced per member, deliberately
  // simpler to build/explain than a scale-with-member-count model, matching how Spotify/YouTube
  // family plans work.
  familyHalfYearly: {
    key: 'familyHalfYearly',
    label: 'Family · 6 Months',
    priceInr: 1499,
    billing: 'per 6 months',
    recurring: true,
    maxMembers: FAMILY_MAX_MEMBERS,
  },
  familyYearly: {
    key: 'familyYearly',
    label: 'Family · Yearly',
    priceInr: 2499,
    billing: 'per year',
    recurring: true,
    maxMembers: FAMILY_MAX_MEMBERS,
  },
};

/** Pro is subscription-only going forward — the one-time lifetime purchase is retired for new
 * buyers (existing lifetime purchasers keep their access forever; PLANS above still needs their
 * key for display). app/premium.tsx renders these four plan cards.
 *
 * IMPORTANT — mobile purchases go through Google Play Billing (react-native-iap), which reads its
 * OWN real price from whatever subscription product is configured in Google Play Console (see
 * billingService.ts's PLAN_TO_PRODUCT_ID) — the `priceInr` values above are display-only
 * fallbacks shown before that live price loads. Adding 'quarterly' here does NOT make it
 * purchasable on Android until a matching `flowsy_quarterly` subscription product exists in Play
 * Console, and the real monthly/halfYearly/yearly prices there must be updated by hand to match
 * these new values too — this file alone cannot change what Google actually charges. */
export const PURCHASABLE_PLANS: PlanKey[] = ['monthly', 'quarterly', 'halfYearly', 'yearly'];

/** Shown in a separate "Family Plan" section on app/premium.tsx, not mixed into the individual
 * plan cards above — a family plan is a different kind of purchase (grants premium to a whole
 * group via invites, see modules/family/) rather than just a longer individual billing period. */
export const FAMILY_PLANS: PlanKey[] = ['familyHalfYearly', 'familyYearly'];

// Purchasing goes directly through Google Play Billing via react-native-iap — see
// modules/premium/billingService.ts. There's no third-party billing SaaS in the loop anymore:
// react-native-iap talks to Play Billing on-device, and a Firebase Cloud Function
// (verifyAndGrantPurchase) does the real server-to-server verification against the Google Play
// Developer API before Firestore's users/{uid} is ever updated — see billingService.ts's
// purchasePlanPackage()/restorePurchases() for exactly how those two steps fit together. Whether
// the real purchase button can be shown is not a static flag: app/premium.tsx fetches the three
// live Play Console products on mount and only shows it once that succeeds, falling back to a
// coming-soon card otherwise (e.g. before the developer has created the Play Console products
// billingService.ts documents).
