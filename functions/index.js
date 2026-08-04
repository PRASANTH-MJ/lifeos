const crypto = require('crypto');

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

initializeApp();
const db = getFirestore();

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

// One-time purchase plans (Razorpay Orders API) — amounts in paise.
const ONE_TIME_PLANS = {
  lifetime: { amountPaise: 199999, description: 'LifeOS Pro — lifetime access' },
};

// Recurring plans (Razorpay Subscriptions API) — amounts in paise. `totalCount` is Razorpay's
// required max-billing-cycles field; there's no literal "forever," so these are generously long
// (10 years monthly, 20 years yearly) and the subscription is cancellable any time regardless.
const RECURRING_PLANS = {
  monthly: { amountPaise: 14900, period: 'monthly', interval: 1, name: 'LifeOS Pro Monthly', totalCount: 120 },
  yearly: { amountPaise: 99900, period: 'yearly', interval: 1, name: 'LifeOS Pro Yearly', totalCount: 20 },
};

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

function razorpayAuthHeader(keyId, keySecret) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function markPremium(uid, plan, extra = {}) {
  await db.collection('users').doc(uid).set(
    { premium: true, plan, premiumSince: new Date().toISOString(), ...extra },
    { merge: true }
  );
}

/** Creates a Razorpay order for a one-time plan (today: `lifetime` only). The order is also
 * recorded in Firestore (`orders/{orderId}`) so verifyPayment/razorpayWebhook can confirm which
 * account it belongs to — Razorpay does not carry order-level `notes` through to the payment
 * entity, so this mapping is the source of truth, not `notes`. */
exports.createOrder = onCall({ secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUid(request);
  const planKey = request.data?.planKey ?? 'lifetime';
  const plan = ONE_TIME_PLANS[planKey];
  if (!plan) throw new HttpsError('invalid-argument', `Unknown one-time plan: ${planKey}`);

  const keyId = RAZORPAY_KEY_ID.value();
  const keySecret = RAZORPAY_KEY_SECRET.value();

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: razorpayAuthHeader(keyId, keySecret) },
    body: JSON.stringify({ amount: plan.amountPaise, currency: 'INR', notes: { uid, planKey } }),
  });

  if (!response.ok) {
    throw new HttpsError('internal', `Razorpay order creation failed: ${await response.text()}`);
  }

  const order = await response.json();

  await db.collection('orders').doc(order.id).set({
    uid,
    planKey,
    amount: order.amount,
    status: 'created',
    createdAt: new Date().toISOString(),
  });

  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId, planKey };
});

/** Called by the client right after Razorpay's checkout reports success for a one-time order.
 * Recomputes the HMAC signature server-side (the only place the key secret ever lives) and
 * cross-checks the order belongs to the calling account before marking it premium — signature
 * validity alone only proves *a* payment happened, not that *this caller* is the one who made it. */
exports.verifyPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUid(request);
  const { orderId, paymentId, signature } = request.data ?? {};
  if (!orderId || !paymentId || !signature) {
    throw new HttpsError('invalid-argument', 'Missing orderId, paymentId, or signature.');
  }

  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET.value()).update(`${orderId}|${paymentId}`).digest('hex');
  if (expected !== signature) {
    throw new HttpsError('permission-denied', 'Payment signature did not match.');
  }

  const orderDoc = await db.collection('orders').doc(orderId).get();
  if (!orderDoc.exists || orderDoc.data().uid !== uid) {
    throw new HttpsError('permission-denied', 'This order does not belong to the signed-in account.');
  }

  const planKey = orderDoc.data().planKey ?? 'lifetime';
  await db.collection('orders').doc(orderId).update({ status: 'verified', paymentId });
  await markPremium(uid, planKey, { lastPaymentId: paymentId });

  return { ok: true };
});

/** Looks up this plan's Razorpay plan_id, creating it on first use and caching the id in
 * Firestore (`config/razorpayPlans`) so it's only ever created once per Razorpay account —
 * Razorpay has no "get or create" endpoint, so this is the idempotency layer for that. */
async function resolveRazorpayPlanId(planKey, keyId, keySecret) {
  const plan = RECURRING_PLANS[planKey];
  const cacheDoc = db.collection('config').doc('razorpayPlans');
  const cached = await cacheDoc.get();
  const existingId = cached.data()?.[planKey];
  if (existingId) return existingId;

  const response = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: razorpayAuthHeader(keyId, keySecret) },
    body: JSON.stringify({
      period: plan.period,
      interval: plan.interval,
      item: { name: plan.name, amount: plan.amountPaise, currency: 'INR' },
    }),
  });
  if (!response.ok) {
    throw new HttpsError('internal', `Razorpay plan creation failed: ${await response.text()}`);
  }
  const created = await response.json();
  await cacheDoc.set({ [planKey]: created.id }, { merge: true });
  return created.id;
}

/** Creates a Razorpay subscription for a recurring plan (`monthly` or `yearly`). Requires the
 * Razorpay account to have Subscriptions enabled (a separate product from Orders, gated behind
 * account activation/KYC — the same activation this account was still missing as of the last
 * check, so this endpoint will 500 on the Plans API call until that's done; Orders/`lifetime`
 * work today regardless). */
exports.createSubscription = onCall({ secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUid(request);
  const planKey = request.data?.planKey;
  const plan = RECURRING_PLANS[planKey];
  if (!plan) throw new HttpsError('invalid-argument', `Unknown recurring plan: ${planKey}`);

  const keyId = RAZORPAY_KEY_ID.value();
  const keySecret = RAZORPAY_KEY_SECRET.value();
  const planId = await resolveRazorpayPlanId(planKey, keyId, keySecret);

  const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: razorpayAuthHeader(keyId, keySecret) },
    body: JSON.stringify({ plan_id: planId, customer_notify: 1, total_count: plan.totalCount, notes: { uid, planKey } }),
  });
  if (!response.ok) {
    throw new HttpsError('internal', `Razorpay subscription creation failed: ${await response.text()}`);
  }
  const subscription = await response.json();

  await db.collection('subscriptions').doc(subscription.id).set({
    uid,
    planKey,
    status: 'created',
    createdAt: new Date().toISOString(),
  });

  return { subscriptionId: subscription.id, keyId, planKey };
});

/** Same shape as verifyPayment, but for the subscription checkout flow. Razorpay's signature
 * formula for subscriptions puts `payment_id` first (`payment_id|subscription_id`) — the reverse
 * of the one-time-order formula (`order_id|payment_id`) above; easy to get backwards, so called
 * out explicitly here. */
exports.verifySubscriptionPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUid(request);
  const { subscriptionId, paymentId, signature } = request.data ?? {};
  if (!subscriptionId || !paymentId || !signature) {
    throw new HttpsError('invalid-argument', 'Missing subscriptionId, paymentId, or signature.');
  }

  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET.value()).update(`${paymentId}|${subscriptionId}`).digest('hex');
  if (expected !== signature) {
    throw new HttpsError('permission-denied', 'Payment signature did not match.');
  }

  const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
  if (!subDoc.exists || subDoc.data().uid !== uid) {
    throw new HttpsError('permission-denied', 'This subscription does not belong to the signed-in account.');
  }

  const planKey = subDoc.data().planKey;
  await db.collection('subscriptions').doc(subscriptionId).update({ status: 'active', lastPaymentId: paymentId });
  await markPremium(uid, planKey, { subscriptionId, subscriptionStatus: 'active', lastPaymentId: paymentId });

  return { ok: true };
});

/** Safety net for the case where the app dies between a successful Razorpay payment and the
 * client's own verify call completing, and the system of record for subscription renewals /
 * cancellations going forward (those only ever arrive via webhook, never a client call).
 *
 * Cancellation/halt handling here is intentionally simple for a first cut: access is revoked
 * immediately rather than tracked against the paid-through period end. A cancelled subscription
 * still active until its `current_end` would need that date read from the webhook payload and
 * checked before revoking — worth revisiting once real subscribers exist. */
exports.razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value()).update(req.rawBody).digest('hex');

  if (!signature || signature !== expected) {
    res.status(400).send('Invalid signature');
    return;
  }

  const event = req.body;

  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const orderDoc = orderId ? await db.collection('orders').doc(orderId).get() : null;
    if (orderDoc?.exists) {
      const planKey = orderDoc.data().planKey ?? 'lifetime';
      await db.collection('orders').doc(orderId).update({ status: 'captured', paymentId: payment.id });
      await markPremium(orderDoc.data().uid, planKey, { lastPaymentId: payment.id });
    }
  }

  if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
    const subscription = event.payload?.subscription?.entity;
    const subDoc = subscription ? await db.collection('subscriptions').doc(subscription.id).get() : null;
    if (subDoc?.exists) {
      await db.collection('subscriptions').doc(subscription.id).update({ status: 'active' });
      await markPremium(subDoc.data().uid, subDoc.data().planKey, {
        subscriptionId: subscription.id,
        subscriptionStatus: 'active',
      });
    }
  }

  if (event.event === 'subscription.cancelled' || event.event === 'subscription.halted' || event.event === 'subscription.completed') {
    const subscription = event.payload?.subscription?.entity;
    const subDoc = subscription ? await db.collection('subscriptions').doc(subscription.id).get() : null;
    if (subDoc?.exists) {
      await db.collection('subscriptions').doc(subscription.id).update({ status: event.event });
      await db.collection('users').doc(subDoc.data().uid).set(
        { premium: false, subscriptionStatus: event.event },
        { merge: true }
      );
    }
  }

  res.status(200).send('ok');
});
