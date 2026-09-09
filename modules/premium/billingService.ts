import { useEffect } from 'react';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import {
  ErrorCode,
  finishTransaction,
  fetchProducts,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type ProductSubscriptionAndroid,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';

import { functions } from '@/firebase/config';
import type { PlanKey } from './purchase';

/**
 * Maps our PlanKey (see purchase.ts) to the exact Google Play Console product id. Unlike the old
 * RevenueCat setup, there's no dashboard-side indirection (Offering/Package/Entitlement) anymore —
 * these are the literal product ids react-native-iap fetches and purchases directly against Play
 * Billing, and the same ids the server-side verifyAndGrantPurchase callable (functions/index.js,
 * built by a separate agent per the shared contract) verifies against the Play Developer API. The
 * only setup left to do outside of code is Google Play Console → Monetization → Products: create
 * six subscriptions (`flowsy_monthly`, `flowsy_quarterly`, `flowsy_half_yearly`, `flowsy_yearly`,
 * `flowsy_family_half_yearly`, `flowsy_family_yearly`) and one one-time "Managed product"
 * (`flowsy_lifetime`, no longer sold — see purchase.ts's PURCHASABLE_PLANS), priced to match
 * modules/premium/purchase.ts's PLANS.
 *
 * `flowsy_quarterly`/`flowsy_family_half_yearly`/`flowsy_family_yearly` do not exist yet — each
 * must be created fresh in Play Console (Monetization → Subscriptions → Create subscription) with
 * exactly that product id before it can appear as purchasable on Android at all; until then,
 * fetchCurrentOffering's request for it below will simply come back without a match and
 * packageForPlan(products, plan) will resolve null, same as any other not-yet-configured product
 * (app/premium.tsx already treats `available: false` as "show a disabled/coming-soon state" rather
 * than crashing).
 */
const PLAN_TO_PRODUCT_ID: Record<PlanKey, string> = {
  monthly: 'flowsy_monthly',
  quarterly: 'flowsy_quarterly',
  halfYearly: 'flowsy_half_yearly',
  yearly: 'flowsy_yearly',
  familyHalfYearly: 'flowsy_family_half_yearly',
  familyYearly: 'flowsy_family_yearly',
  lifetime: 'flowsy_lifetime',
};

const PLAN_TYPE: Record<PlanKey, 'in-app' | 'subs'> = {
  monthly: 'subs',
  quarterly: 'subs',
  halfYearly: 'subs',
  yearly: 'subs',
  familyHalfYearly: 'subs',
  familyYearly: 'subs',
  lifetime: 'in-app',
};

/** A fetched, purchasable product — either the one-time lifetime product or a subscription. */
export type PlanProduct = Product | ProductSubscriptionAndroid;

let connected = false;

/**
 * Opens the connection to Google Play Billing (react-native-iap's `initConnection`). Call once
 * near the root (see app/_layout.tsx's useBillingSync below) — safe to call again, it's a no-op
 * once already connected.
 *
 * No Expo config plugin and no app.json changes are needed for Android: react-native-iap ships no
 * `app.plugin.js` at all, and its own `AndroidManifest.xml` is empty. The Play Billing `BILLING`
 * permission it needs comes in transitively through its native dependency on Google's Play
 * Billing Library (`io.github.hyochan.openiap:openiap-google`), and Gradle's manifest merger folds
 * that permission into the app's final merged manifest during any native build (including `eas
 * build`'s prebuild+Gradle pass) — same mechanism as RevenueCat's SDK before it, nothing to
 * declare ourselves.
 */
export async function configureBilling(): Promise<void> {
  if (connected || Platform.OS !== 'android') return;
  try {
    await initConnection();
    connected = true;
  } catch {
    // Best-effort — e.g. Play Store unavailable (emulator without Play Services, or the device is
    // offline at launch). Leaves `connected` false, which fetchCurrentOffering() below treats the
    // same as "purchasing isn't available yet" and callers fall back to the coming-soon card.
  }
}

/**
 * Fetches the six purchasable subscription products (monthly/quarterly/half-yearly/yearly plus
 * the two family plans). Returns null both when the billing connection hasn't been established
 * and when the fetch itself fails — callers (see app/premium.tsx) treat either as "purchasing
 * isn't available yet" and fall back to the coming-soon card, rather than showing a button that
 * would just error on tap.
 *
 * The one-time `flowsy_lifetime` product is no longer offered (Pro is subscription-only now) — see
 * purchase.ts's PLANS comment. `lifetime` stays in PlanKey/PLAN_TO_PRODUCT_ID purely so existing
 * lifetime purchasers' already-granted `plan: 'lifetime'` still resolves to a label; it's just
 * never fetched or purchasable here anymore.
 */
export async function fetchCurrentOffering(): Promise<PlanProduct[] | null> {
  if (!connected) return null;
  try {
    const subs = await fetchProducts({
      skus: [
        PLAN_TO_PRODUCT_ID.monthly,
        PLAN_TO_PRODUCT_ID.quarterly,
        PLAN_TO_PRODUCT_ID.halfYearly,
        PLAN_TO_PRODUCT_ID.yearly,
        PLAN_TO_PRODUCT_ID.familyHalfYearly,
        PLAN_TO_PRODUCT_ID.familyYearly,
      ],
      type: 'subs',
    });
    const products = (subs ?? []) as PlanProduct[];
    return products.length > 0 ? products : null;
  } catch {
    return null;
  }
}

/** Finds the product matching a given plan on an already-fetched product list (see PLAN_TO_PRODUCT_ID above). */
export function packageForPlan(products: PlanProduct[] | null, plan: PlanKey): PlanProduct | null {
  if (!products) return null;
  const targetId = PLAN_TO_PRODUCT_ID[plan];
  return products.find((product) => product.id === targetId) ?? null;
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

/**
 * Requests a purchase via Play Billing and waits for react-native-iap's purchase-updated listener
 * to report back the specific purchase this request produced. The returned promise never rejects
 * with the raw store error — see purchasePlanPackage below, which is the function callers should
 * actually use.
 */
function requestAndAwaitPurchase(product: PlanProduct): Promise<Purchase> {
  return new Promise((resolve, reject) => {
    const updateSub = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== product.id) return; // some other pending purchase replaying; not ours
      cleanup();
      resolve(purchase);
    });
    const errorSub = purchaseErrorListener((error) => {
      if (error.productId && error.productId !== product.id) return;
      cleanup();
      reject(error);
    });

    function cleanup() {
      updateSub.remove();
      errorSub.remove();
    }

    const request =
      product.type === 'subs'
        ? {
            request: {
              google: {
                skus: [product.id],
                subscriptionOffers: subscriptionOffersFor(product as ProductSubscriptionAndroid),
              },
            },
            type: 'subs' as const,
          }
        : { request: { google: { skus: [product.id] } }, type: 'in-app' as const };

    requestPurchase(request).catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

/** Play Billing requires the specific base-plan/offer token when a subscription product has one. */
function subscriptionOffersFor(product: ProductSubscriptionAndroid): { sku: string; offerToken: string }[] {
  const offerToken = product.subscriptionOffers?.[0]?.offerTokenAndroid;
  return offerToken ? [{ sku: product.id, offerToken }] : [];
}

/**
 * Buys a product via Play Billing, then — only once react-native-iap's purchase-updated listener
 * confirms the purchase — calls the verifyAndGrantPurchase Cloud Function (see the shared
 * client/server contract) with `{ productId, purchaseToken }`. Firestore's `users/{uid}.premium`
 * only flips once that callable succeeds; the client never grants entitlement on its own say-so.
 *
 * Never throws — errors (including a user-cancelled dialog) come back as a typed result so the
 * caller can decide what to show (or not show) the user.
 */
export async function purchasePlanPackage(product: PlanProduct): Promise<PurchaseResult> {
  try {
    const purchase = await requestAndAwaitPurchase(product);
    const verification = await verifyAndGrant(purchase.productId, purchase.purchaseToken);

    if (verification.status === 'error') {
      return {
        ok: false,
        cancelled: false,
        message: 'Something went wrong verifying your purchase. Please try again, or use Restore Purchases.',
      };
    }

    // The store-side purchase genuinely completed either way (granted or not) — finish it so it
    // doesn't replay on next launch or auto-refund after 3 days unacknowledged. Only a thrown
    // verification (the 'error' branch above) skips this, so Restore Purchases can retry it later.
    await finishTransaction({ purchase, isConsumable: false }).catch(() => {});

    if (verification.status === 'not_granted') {
      return {
        ok: false,
        cancelled: false,
        message: friendlyNotGrantedMessage(verification.reason),
      };
    }

    return { ok: true };
  } catch (error) {
    const err = error as PurchaseError | undefined;
    if (err?.code === ErrorCode.UserCancelled) {
      return { ok: false, cancelled: true, message: 'Purchase cancelled.' };
    }
    return { ok: false, cancelled: false, message: friendlyPurchaseError(err) };
  }
}

/** Maps verifyAndGrantPurchase's non-throwing `granted: false` outcomes to plain text — same
 * style as friendlyPurchaseError below. `reason` is only ever `'test_purchase'` today (see
 * functions/index.js), but any other/absent reason (e.g. an expired/pending/on-hold subscription
 * state) falls through to a generic message. */
function friendlyNotGrantedMessage(reason: string | undefined): string {
  switch (reason) {
    case 'test_purchase':
      return 'This looks like a test purchase, so Pro wasn’t granted. Real purchases will unlock Pro normally.';
    default:
      return 'Your purchase didn’t qualify for Pro access right now. If you were charged, please contact support.';
  }
}

/** Maps react-native-iap's error codes to plain text — mirrors the style of
 * modules/auth/useAuth.ts's friendlyAuthError, which does the same for Firebase Auth codes. */
function friendlyPurchaseError(err: PurchaseError | undefined): string {
  switch (err?.code) {
    case ErrorCode.AlreadyOwned:
      return 'You already own this plan. Try restoring your purchase instead.';
    case ErrorCode.NetworkError:
      return 'No internet connection. Please try again.';
    case ErrorCode.BillingUnavailable:
    case ErrorCode.ServiceError:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ServiceTimeout:
      return 'Google Play had a problem processing this purchase. Please try again in a moment.';
    case ErrorCode.ItemUnavailable:
      return 'This plan isn’t available for purchase right now.';
    case ErrorCode.DeferredPayment:
    case ErrorCode.Pending:
      return 'Payment is pending approval — you’ll be upgraded once it completes.';
    default:
      return 'Something went wrong with the purchase. Please try again.';
  }
}

/** Shape of the verifyAndGrantPurchase callable's resolved (non-throwing) response — see
 * functions/index.js. `granted` is the only field that matters for entitlement; `reason` is only
 * ever `'test_purchase'` today (license-tester/promo purchases), and `subscriptionStatus` isn't
 * currently surfaced to the user but is kept here for forward-compatibility. */
type VerifyAndGrantResponse = { granted: boolean; reason?: string; plan?: string; subscriptionStatus?: string };

/** Outcome of calling verifyAndGrant(): `'error'` means the callable itself threw (network error,
 * server-side HttpsError, etc) — the caller can't tell if anything was granted and should let the
 * user retry/restore. `'granted'`/`'not_granted'` mean the callable resolved normally and its
 * `granted` boolean is the ground truth — a resolved `granted: false` (e.g. a test purchase, or an
 * expired/pending/on-hold subscription state — see functions/index.js's
 * mapSubscriptionState/mapProductPurchaseState) is NOT an error and must never be reported to the
 * user as a successful purchase/restore. */
type VerifyAndGrantOutcome =
  | { status: 'granted' }
  | { status: 'not_granted'; reason?: string }
  | { status: 'error' };

/** Calls the shared verifyAndGrantPurchase Cloud Function — see the client/server contract this
 * migration was built against. Region matches the existing revenuecatWebhook (us-central1); the
 * client sends only `{ productId, purchaseToken }`, never a uid (the server derives identity from
 * the caller's Firebase Auth token, not from anything client-supplied). Safe to call more than
 * once for the same purchaseToken — the server treats it as idempotent, which restorePurchases()
 * below relies on.
 *
 * Reads the callable's actual response `data` rather than treating "didn't throw" as success: the
 * callable can resolve normally with `granted: false` (test/promo purchases, or a
 * subscription that's expired/pending/on-hold) without ever throwing. */
async function verifyAndGrant(
  productId: string,
  purchaseToken: string | null | undefined
): Promise<VerifyAndGrantOutcome> {
  if (!purchaseToken) return { status: 'error' };
  try {
    const callVerifyAndGrantPurchase = httpsCallable<{ productId: string; purchaseToken: string }, VerifyAndGrantResponse>(
      functions,
      'verifyAndGrantPurchase'
    );
    const response = await callVerifyAndGrantPurchase({ productId, purchaseToken });
    if (response.data?.granted) return { status: 'granted' };
    return { status: 'not_granted', reason: response.data?.reason };
  } catch {
    return { status: 'error' };
  }
}

export type RestoreResult = { found: boolean };

/** Re-syncs purchase state from the store for a "Restore purchases" affordance: lists whatever
 * non-consumable/active-subscription purchases Play Billing still has on file for this Google
 * account (react-native-iap's getAvailablePurchases()) and re-runs each one through
 * verifyAndGrantPurchase — safe because that callable is idempotent per the shared contract, which
 * is exactly what restoring is: calling the same grant path again for a purchase that may already
 * be recorded. Returns null on outright failure (e.g. not connected), otherwise `{ found }` telling
 * the caller whether at least one purchase verified successfully. */
export async function restorePurchases(): Promise<RestoreResult | null> {
  if (!connected) return null;
  try {
    const purchases = await getAvailablePurchases();
    let found = false;
    for (const purchase of purchases) {
      const verification = await verifyAndGrant(purchase.productId, purchase.purchaseToken);
      if (verification.status === 'error') continue; // leave unfinished so a later restore can retry it

      // Finish it either way — the store-side purchase is genuinely resolved once the server has
      // responded, even when it didn't grant Pro (e.g. a test purchase, or a lapsed subscription
      // still sitting in Play's purchase history).
      await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
      if (verification.status === 'granted') {
        found = true;
      }
    }
    return { found };
  } catch {
    return null;
  }
}

/** Mounted once near the root (see app/_layout.tsx, alongside usePremium()/useAvatarSync()) —
 * opens the Play Billing connection on first mount. Unlike RevenueCat there's no appUserID to keep
 * in step with the signed-in Firebase user: the server derives identity from the caller's Firebase
 * Auth token (request.auth.uid) on every verifyAndGrantPurchase call, not from any client-supplied
 * identifier, so there's nothing to link here. The actual entitlement write-back still flows
 * Firestore → usePremium(); this hook only owns the billing connection, not premium status itself. */
export function useBillingSync(): void {
  useEffect(() => {
    configureBilling();
  }, []);
}
