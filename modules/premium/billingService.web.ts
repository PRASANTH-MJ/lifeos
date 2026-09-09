import { useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';

import { auth, firestore, functions } from '@/firebase/config';
import type { PlanKey } from './purchase';

/**
 * Web build of this module — Metro/Expo picks this file automatically when bundling for web
 * (the `.web.ts` suffix), so `react-native-iap` (which has zero web support and was crashing the
 * entire web export via app/_layout.tsx's useBillingSync, since every route sits under that root
 * layout) is never imported into the web bundle at all. Same exported names/shapes as
 * billingService.ts so app/premium.tsx needs no platform-specific branching — only what happens
 * inside purchasePlanPackage differs: Play Billing there, Razorpay Checkout (the same
 * createRazorpayOrder/verifyRazorpayPayment callables website/index.html already uses) here.
 */

// Must match functions/index.js's PLAN_PRICE_INR (the actual amount Razorpay charges) and
// modules/premium/purchase.ts's PLANS (the shared display copy) — kept in sync by hand across all
// three, same as that file's own doc comment already notes.
const PLAN_PRICE_INR: Record<PlanKey, number> = {
  monthly: 149,
  quarterly: 299,
  halfYearly: 599,
  yearly: 999,
  familyHalfYearly: 1499,
  familyYearly: 2499,
  lifetime: 3499,
};

/** Web has no store product catalog to fetch (unlike Play Billing, where a product might not
 * have propagated yet) — the six purchasable plans are always "available" here. Lifetime is
 * retired (Pro is subscription-only now — see purchase.ts's PURCHASABLE_PLANS) and no longer
 * offered here either; PLAN_PRICE_INR keeps its entry only so an existing lifetime purchaser's
 * plan label still resolves. */
export type PlanProduct = { id: PlanKey };

const ALL_PLANS: PlanProduct[] = [
  { id: 'monthly' },
  { id: 'quarterly' },
  { id: 'halfYearly' },
  { id: 'yearly' },
  { id: 'familyHalfYearly' },
  { id: 'familyYearly' },
];

let razorpayScriptPromise: Promise<void> | null = null;

/** Loads Razorpay's Checkout script once (it's not an npm package — Razorpay only ships this as
 * a hosted <script> tag). Safe to call repeatedly; only injects the tag on the first call. */
function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment provider. Check your connection.'));
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

/** Preloads the Razorpay script — mirrors the native configureBilling()'s "get ready early"
 * role, so clicking a plan doesn't also have to wait for the script to download first. */
export async function configureBilling(): Promise<void> {
  await loadRazorpayScript().catch(() => {});
}

/** Always resolves with all three plans — there's no propagation-delay concept on this path the
 * way there is with Play Console products, so app/premium.tsx's "coming soon" fallback branch
 * should never actually trigger on web. */
export async function fetchCurrentOffering(): Promise<PlanProduct[] | null> {
  return ALL_PLANS;
}

export function packageForPlan(products: PlanProduct[] | null, plan: PlanKey): PlanProduct | null {
  if (!products) return null;
  return products.find((product) => product.id === plan) ?? null;
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

type RazorpayCheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
};

// Public value — safe to embed client-side, same key already live in website/index.html. Swap
// for the rzp_live_... key in both places once the Razorpay website/app verification is
// approved; no other code changes needed on either side.
const RAZORPAY_KEY_ID = 'rzp_live_TRX7SkkH72jfQV';

export async function purchasePlanPackage(product: PlanProduct): Promise<PurchaseResult> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, cancelled: false, message: 'Please sign in first.' };
  }

  try {
    await loadRazorpayScript();

    const createOrder = httpsCallable<{ plan: PlanKey }, { orderId: string; amountPaise: number }>(
      functions,
      'createRazorpayOrder'
    );
    const { data: order } = await createOrder({ plan: product.id });

    return await new Promise<PurchaseResult>((resolve) => {
      const Razorpay = (window as any).Razorpay;
      const rzp = new Razorpay({
        key: RAZORPAY_KEY_ID,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        name: 'Flowsy',
        description: `${product.id} plan`,
        prefill: { email: user.email ?? undefined },
        handler: async (response) => {
          try {
            const verify = httpsCallable<
              { orderId: string; paymentId: string; signature: string },
              { granted: boolean; reason?: string }
            >(functions, 'verifyRazorpayPayment');
            const { data: result } = await verify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            resolve(
              result.granted
                ? { ok: true }
                : {
                    ok: false,
                    cancelled: false,
                    message: 'Payment received but verification failed — contact support with payment ID ' + response.razorpay_payment_id,
                  }
            );
          } catch {
            resolve({
              ok: false,
              cancelled: false,
              message: 'Payment received but verification failed — contact support with payment ID ' + response.razorpay_payment_id,
            });
          }
        },
        modal: {
          ondismiss: () => resolve({ ok: false, cancelled: true, message: 'Purchase cancelled.' }),
        },
      } satisfies RazorpayCheckoutOptions);
      rzp.open();
    });
  } catch (error) {
    return { ok: false, cancelled: false, message: (error as Error)?.message || 'Something went wrong. Please try again.' };
  }
}

export type RestoreResult = { found: boolean };

/** There's no store-side "restore" concept for Razorpay the way Play Billing has a purchase
 * history to re-query — premium status here is just whatever Firestore already says, and
 * usePremium()'s listener already reflects that live. This exists only so the same "Restore
 * Purchases" button in app/premium.tsx has something sensible to do on web: re-check the current
 * status once, for someone who paid but suspects the verification call didn't land. */
export async function restorePurchases(): Promise<RestoreResult | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    return { found: Boolean(snap.data()?.premium) };
  } catch {
    return null;
  }
}

export function useBillingSync(): void {
  useEffect(() => {
    configureBilling();
  }, []);
}
