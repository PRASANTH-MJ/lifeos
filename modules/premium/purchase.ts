import { httpsCallable } from 'firebase/functions';

import { functions } from '@/firebase/config';

export const PREMIUM_PRICE_INR = 500;
export const PREMIUM_PRICE_PAISE = PREMIUM_PRICE_INR * 100;

export type CreateOrderResult = { orderId: string; amount: number; currency: string; keyId: string };

/** Calls the createOrder Cloud Function (functions/index.js) — never creates a Razorpay order or
 * touches the key secret client-side. Requires the user to be signed in (enforced server-side). */
export function createPremiumOrder(): Promise<CreateOrderResult> {
  return httpsCallable<undefined, CreateOrderResult>(functions, 'createOrder')().then((result) => result.data);
}

export type VerifyPaymentInput = { orderId: string; paymentId: string; signature: string };
export type VerifyPaymentResult = { ok: boolean };

/** Calls the verifyPayment Cloud Function, which recomputes the HMAC signature server-side
 * (using the key secret) before marking the account premium in Firestore. */
export function verifyPremiumPayment(payload: VerifyPaymentInput): Promise<VerifyPaymentResult> {
  return httpsCallable<VerifyPaymentInput, VerifyPaymentResult>(functions, 'verifyPayment')(payload).then((result) => result.data);
}
