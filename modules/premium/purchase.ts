import { httpsCallable } from 'firebase/functions';

import { functions } from '@/firebase/config';

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
  monthly: { key: 'monthly', label: 'Monthly', priceInr: 149, billing: 'per month', recurring: true },
  yearly: { key: 'yearly', label: 'Yearly', priceInr: 999, billing: 'per year', recurring: true, savingsLabel: 'Save 44%' },
  lifetime: { key: 'lifetime', label: 'Lifetime', priceInr: 1999.99, billing: 'one-time', recurring: false },
};

export type CreateOrderResult = { orderId: string; amount: number; currency: string; keyId: string; planKey: PlanKey };

/** Calls the createOrder Cloud Function for the one-time `lifetime` plan — never creates a
 * Razorpay order or touches the key secret client-side. Requires sign-in (enforced server-side). */
export function createPremiumOrder(): Promise<CreateOrderResult> {
  return httpsCallable<{ planKey: PlanKey }, CreateOrderResult>(functions, 'createOrder')({ planKey: 'lifetime' }).then(
    (result) => result.data
  );
}

export type VerifyPaymentInput = { orderId: string; paymentId: string; signature: string };
export type VerifyResult = { ok: boolean };

/** Calls the verifyPayment Cloud Function, which recomputes the HMAC signature server-side
 * (using the key secret) before marking the account premium in Firestore. */
export function verifyPremiumPayment(payload: VerifyPaymentInput): Promise<VerifyResult> {
  return httpsCallable<VerifyPaymentInput, VerifyResult>(functions, 'verifyPayment')(payload).then((result) => result.data);
}

export type CreateSubscriptionResult = { subscriptionId: string; keyId: string; planKey: 'monthly' | 'yearly' };

/** Calls the createSubscription Cloud Function for a recurring plan. Requires the Razorpay
 * account to have Subscriptions enabled — see functions/index.js's comment on createSubscription
 * for the current activation status. */
export function createPremiumSubscription(planKey: 'monthly' | 'yearly'): Promise<CreateSubscriptionResult> {
  return httpsCallable<{ planKey: 'monthly' | 'yearly' }, CreateSubscriptionResult>(functions, 'createSubscription')({
    planKey,
  }).then((result) => result.data);
}

export type VerifySubscriptionInput = { subscriptionId: string; paymentId: string; signature: string };

export function verifyPremiumSubscription(payload: VerifySubscriptionInput): Promise<VerifyResult> {
  return httpsCallable<VerifySubscriptionInput, VerifyResult>(functions, 'verifySubscriptionPayment')(payload).then(
    (result) => result.data
  );
}
