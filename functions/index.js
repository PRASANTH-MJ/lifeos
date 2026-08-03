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

const PREMIUM_PRICE_PAISE = 50000; // ₹500, one-time, lifetime

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

async function markPremium(uid, paymentId) {
  await db.collection('users').doc(uid).set(
    { premium: true, premiumSince: new Date().toISOString(), lastPaymentId: paymentId },
    { merge: true }
  );
}

/** Creates a Razorpay order for the ₹500 lifetime premium purchase. The order is also recorded
 * in Firestore (`orders/{orderId}`) so verifyPayment/razorpayWebhook can confirm which account it
 * belongs to — Razorpay does not carry order-level `notes` through to the payment entity, so this
 * mapping is the source of truth, not `notes`. */
exports.createOrder = onCall({ secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUid(request);
  const keyId = RAZORPAY_KEY_ID.value();
  const keySecret = RAZORPAY_KEY_SECRET.value();
  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basicAuth}` },
    body: JSON.stringify({ amount: PREMIUM_PRICE_PAISE, currency: 'INR', notes: { uid } }),
  });

  if (!response.ok) {
    throw new HttpsError('internal', `Razorpay order creation failed: ${await response.text()}`);
  }

  const order = await response.json();

  await db.collection('orders').doc(order.id).set({
    uid,
    amount: order.amount,
    status: 'created',
    createdAt: new Date().toISOString(),
  });

  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId };
});

/** Called by the client right after Razorpay's checkout reports success. Recomputes the HMAC
 * signature server-side (the only place the key secret ever lives) and cross-checks the order
 * belongs to the calling account before marking it premium — signature validity alone only proves
 * *a* payment happened, not that *this caller* is the one who made it. */
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

  await db.collection('orders').doc(orderId).update({ status: 'verified', paymentId });
  await markPremium(uid, paymentId);

  return { ok: true };
});

/** Safety net for the case where the app dies between a successful Razorpay payment and the
 * client's own verifyPayment call completing — Razorpay's `payment.captured` webhook independently
 * marks the same account premium using the orders/{orderId} mapping recorded in createOrder. */
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
      await db.collection('orders').doc(orderId).update({ status: 'captured', paymentId: payment.id });
      await markPremium(orderDoc.data().uid, payment.id);
    }
  }

  res.status(200).send('ok');
});
