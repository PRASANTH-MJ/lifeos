// Google Play Billing verification → Firestore entitlement write-back.
//
// Why this file looks the way it does: firestore.rules forbids the client from writing to its
// own users/{uid} doc (`allow write: if false`) — premium/plan/subscriptionStatus can only be
// granted by something using the Admin SDK, which bypasses those rules. This used to be done by
// RevenueCat (which verified the Play receipt on its own infrastructure and then called a
// webhook here). That's gone now — the client (react-native-iap) talks to Google Play directly,
// and this file does the server-to-server verification against the Play Developer API itself
// before ever writing anything to Firestore. modules/premium/usePremium.ts's onSnapshot listener
// on users/{uid} picks up the write automatically — no other client wiring needed, and that file
// is intentionally untouched by this migration.
//
// Two entry points:
//   1. verifyAndGrantPurchase (callable) — the client calls this right after a purchase
//      completes, and again for every purchase returned by getAvailablePurchases() when
//      restoring. Does the actual androidpublisher verification + Firestore write.
//   2. playRtdn (Pub/Sub trigger) — Google Play's Real-time Developer Notifications land here
//      for everything that happens *after* the initial purchase (renewals, cancellations,
//      refunds, holds, revokes, ...) without the client being involved at all.
//
// Exact manual setup this depends on (Play Console + GCP, none of it in this repo) is written up
// in full, in order, alongside this change — see the PR/commit description. Short version: the
// Cloud Functions runtime service account needs Play Console API access (Finance permissions),
// and a Pub/Sub topic literally named `playRtdn` needs to exist with Google's publisher service
// account granted `roles/pubsub.publisher` on it, wired into Play Console's RTDN setting.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Razorpay = require('razorpay');

initializeApp();
const db = getFirestore();

// Hardcoded server-side on purpose — a client-controlled request body should never get to tell
// the server which app package to verify a purchase token against.
const PACKAGE_NAME = 'com.flowsy.app';

// Must match modules/premium/purchase.ts's product ids and modules/premium/billingService.ts's
// PLAN_TO_PACKAGE_ID. Reused as-is from the RevenueCat version — this mapping never had anything
// RevenueCat-specific about it.
const PRODUCT_TO_PLAN = {
  flowsy_monthly: 'monthly',
  flowsy_quarterly: 'quarterly',
  flowsy_half_yearly: 'halfYearly',
  flowsy_yearly: 'yearly',
  flowsy_lifetime: 'lifetime',
  flowsy_family_half_yearly: 'familyHalfYearly',
  flowsy_family_yearly: 'familyYearly',
};

function planFromProductId(productId) {
  if (!productId) return null;
  // Google Play subscription product ids can come back with a ":basePlanId" suffix; our base
  // product ids (flowsy_monthly/flowsy_yearly) never contain a colon, so match the prefix.
  const base = productId.split(':')[0];
  return PRODUCT_TO_PLAN[base] ?? null;
}

// ---------------------------------------------------------------------------------------------
// androidpublisher client
// ---------------------------------------------------------------------------------------------

/** Authenticates as the Cloud Function's own attached runtime service account via Application
 * Default Credentials — no downloaded JSON key involved. This only works once that service
 * account has been added as a user in Play Console → Setup → API access, with Finance
 * permissions (see the setup checklist). Cached across warm invocations of the same instance. */
let androidPublisherClient;
async function getAndroidPublisher() {
  if (!androidPublisherClient) {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const authClient = await auth.getClient();
    androidPublisherClient = google.androidpublisher({ version: 'v3', auth: authClient });
  }
  return androidPublisherClient;
}

/** Google returns an error if the same purchase token is acknowledged twice. That's expected,
 * not exceptional: restore calls verifyAndGrantPurchase again for every purchase the user
 * already owns, and this must stay idempotent for that to work. Swallow only that specific
 * "already acknowledged" failure; anything else is a real error and should still surface. */
async function acknowledgeIdempotent(fn) {
  try {
    await fn();
  } catch (err) {
    const message = err?.response?.data?.error?.message || err?.message || '';
    if (/already\s*(been\s*)?acknowledged/i.test(message)) {
      return;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// purchaseState / subscriptionState → { premium, subscriptionStatus } mapping
//
// Shared between verifyAndGrantPurchase and playRtdn so both entry points land on the exact same
// Firestore shape for the exact same underlying Play state.
// ---------------------------------------------------------------------------------------------

/** purchases.products.get's ProductPurchase.purchaseState: 0=Purchased, 1=Canceled, 2=Pending.
 * Used for flowsy_lifetime only. */
function mapProductPurchaseState(purchaseState) {
  switch (purchaseState) {
    case 0:
      return { premium: true, subscriptionStatus: 'lifetime' };
    case 1:
      return { premium: false, subscriptionStatus: 'refunded' };
    case 2:
      return { premium: false, subscriptionStatus: 'pending' };
    default:
      return { premium: false, subscriptionStatus: 'unknown' };
  }
}

/** purchases.subscriptionsv2.get's SubscriptionPurchaseV2.subscriptionState. Used for
 * flowsy_monthly/flowsy_yearly. `expiryTimeIso` (the matching line item's expiryTime) only
 * matters for the CANCELED case — see comment below. */
function mapSubscriptionState(subscriptionState, expiryTimeIso) {
  switch (subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return { premium: true, subscriptionStatus: 'active' };
    // Payment retry window — Play is still trying to charge the user. Keep access; a renewal or
    // an expiry will follow depending on whether the retry succeeds.
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return { premium: true, subscriptionStatus: 'grace_period' };
    // Auto-renew is off, but Play (and thus the user) still honors access through the period
    // already paid for — only revoke once that period has actually elapsed. This is the direct
    // equivalent of the old RevenueCat CANCELLATION-vs-EXPIRATION split for subscriptions.
    case 'SUBSCRIPTION_STATE_CANCELED': {
      const stillEntitled = expiryTimeIso ? new Date(expiryTimeIso).getTime() > Date.now() : false;
      return stillEntitled
        ? { premium: true, subscriptionStatus: 'cancelled' }
        : { premium: false, subscriptionStatus: 'expired' };
    }
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      return { premium: false, subscriptionStatus: 'on_hold' };
    case 'SUBSCRIPTION_STATE_PAUSED':
      return { premium: false, subscriptionStatus: 'paused' };
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return { premium: false, subscriptionStatus: 'expired' };
    case 'SUBSCRIPTION_STATE_PENDING':
      return { premium: false, subscriptionStatus: 'pending' };
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
      return { premium: false, subscriptionStatus: 'pending_purchase_canceled' };
    default:
      // Covers SUBSCRIPTION_STATE_UNSPECIFIED and anything Google adds in the future that this
      // function doesn't know about yet — treat as "definitely not entitled" rather than guess.
      return { premium: false, subscriptionStatus: 'unknown' };
  }
}

// ---------------------------------------------------------------------------------------------
// Family plans — one flat-priced subscription (familyHalfYearly/familyYearly, see
// modules/premium/purchase.ts) shares premium across up to FAMILY_MAX_MEMBERS accounts via
// invite-by-username. families/{ownerUid} is keyed by the subscriber's own uid (one family per
// subscriber; a uid can only ever own one at a time, matching how a person only ever holds one
// Play/Razorpay subscription for their own account).
// ---------------------------------------------------------------------------------------------

// Must be kept in sync by hand with modules/premium/purchase.ts's identical FAMILY_MAX_MEMBERS —
// Cloud Functions can't import a client module, and this is a small enough constant that a shared
// package would be overkill for the one place it's duplicated.
const FAMILY_MAX_MEMBERS = 5;
const FAMILY_PLAN_KEYS = new Set(['familyHalfYearly', 'familyYearly']);

/** The single choke point every purchase-verification/RTDN path funnels a grant through, so the
 * family-plan cascade below is only ever implemented once. For a family-plan owner, granting
 * premium also creates/updates their families/{uid} doc (idempotent — safe to call on every
 * renewal, not just the first purchase); revoking it (a lapsed, cancelled-and-expired, refunded,
 * or forcibly revoked subscription) cascades to every invited member too — a family plan that
 * stops being paid for must not leave members with premium nobody is paying for. A member's OWN
 * separate individual subscription (if they happen to have one) is never touched here: the
 * cascade only ever revokes a uid whose users/{uid}.premiumSource is exactly 'family' and whose
 * familyId matches this owner, so it can never clobber someone else's real purchase. */
async function applyGrant(uid, plan, grant) {
  await db.collection('users').doc(uid).set({ premium: grant.premium, plan, subscriptionStatus: grant.subscriptionStatus }, { merge: true });
  if (!FAMILY_PLAN_KEYS.has(plan)) return;

  const familyRef = db.collection('families').doc(uid);
  if (grant.premium) {
    await familyRef.set(
      {
        ownerUid: uid,
        plan,
        subscriptionStatus: grant.subscriptionStatus,
        maxMembers: FAMILY_MAX_MEMBERS,
        memberUids: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  const familySnap = await familyRef.get();
  if (!familySnap.exists) return;
  await familyRef.set({ subscriptionStatus: grant.subscriptionStatus }, { merge: true });
  const memberUids = familySnap.data().memberUids || [];
  await Promise.all(
    memberUids
      .filter((memberUid) => memberUid !== uid)
      .map(async (memberUid) => {
        const memberSnap = await db.collection('users').doc(memberUid).get();
        if (memberSnap.exists && memberSnap.data().familyId === uid && memberSnap.data().premiumSource === 'family') {
          await db.collection('users').doc(memberUid).set({ premium: false, subscriptionStatus: 'revoked' }, { merge: true });
        }
      })
  );
}

/** True once `uid` actually has a live family plan to invite/manage members on — mirrors
 * usePremium.ts's own "effectively premium" definition isn't needed here since a family plan's
 * subscriptionStatus already tracks this directly (set by applyGrant on every grant/revoke). */
function familyIsActive(familyData) {
  return Boolean(familyData) && familyData.subscriptionStatus !== 'revoked' && familyData.subscriptionStatus !== 'expired';
}

exports.inviteFamilyMember = onCall({ region: 'us-central1' }, async (request) => {
  const ownerUid = request.auth?.uid;
  if (!ownerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const usernameLower = String(request.data?.username || '').trim().toLowerCase();
  if (!usernameLower) throw new HttpsError('invalid-argument', 'A username is required.');

  const familyRef = db.collection('families').doc(ownerUid);
  const familySnap = await familyRef.get();
  const familyData = familySnap.data();
  if (!familyIsActive(familyData)) {
    throw new HttpsError('failed-precondition', 'You need an active Family plan to invite members.');
  }

  const usernameDoc = await db.collection('usernames').doc(usernameLower).get();
  if (!usernameDoc.exists) throw new HttpsError('not-found', 'No user with that username.');
  const invitedUid = usernameDoc.data().uid;

  if (invitedUid === ownerUid) throw new HttpsError('invalid-argument', "You can't invite yourself.");

  const memberUids = familyData.memberUids || [];
  if (memberUids.includes(invitedUid)) {
    throw new HttpsError('already-exists', 'That person is already on your Family plan.');
  }
  if (memberUids.length >= (familyData.maxMembers || FAMILY_MAX_MEMBERS)) {
    throw new HttpsError('resource-exhausted', `Your Family plan is full (max ${familyData.maxMembers || FAMILY_MAX_MEMBERS} members).`);
  }

  const invitedUserSnap = await db.collection('users').doc(invitedUid).get();
  const invitedUserData = invitedUserSnap.data() || {};
  if (invitedUserData.premiumSource === 'family' && invitedUserData.familyId) {
    throw new HttpsError('failed-precondition', 'That person is already on another Family plan.');
  }

  const inviteId = `${ownerUid}_${invitedUid}`;
  const inviteRef = db.collection('familyInvites').doc(inviteId);
  const existingInvite = await inviteRef.get();
  if (existingInvite.exists && existingInvite.data().status === 'pending') {
    throw new HttpsError('already-exists', 'You already invited that person.');
  }

  await inviteRef.set({
    ownerUid,
    invitedUid,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  await notify(invitedUid, ownerUid, { type: 'familyInvite' });

  return { invited: true };
});

exports.respondToFamilyInvite = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const inviteId = String(request.data?.inviteId || '');
  const accept = Boolean(request.data?.accept);
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required.');

  const inviteRef = db.collection('familyInvites').doc(inviteId);
  const familyRef = await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'That invite no longer exists.');
    const invite = inviteSnap.data();
    if (invite.invitedUid !== uid) throw new HttpsError('permission-denied', 'This invite is not addressed to you.');
    if (invite.status !== 'pending') throw new HttpsError('failed-precondition', 'This invite was already resolved.');

    if (!accept) {
      tx.set(inviteRef, { status: 'declined', resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
      return null;
    }

    const familyRef = db.collection('families').doc(invite.ownerUid);
    const familySnap = await tx.get(familyRef);
    const familyData = familySnap.data();
    if (!familyIsActive(familyData)) throw new HttpsError('failed-precondition', 'That Family plan is no longer active.');
    const memberUids = familyData.memberUids || [];
    if (memberUids.includes(uid)) {
      tx.set(inviteRef, { status: 'accepted', resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
      return null;
    }
    if (memberUids.length >= (familyData.maxMembers || FAMILY_MAX_MEMBERS)) {
      throw new HttpsError('resource-exhausted', 'That Family plan is full.');
    }

    tx.set(familyRef, { memberUids: FieldValue.arrayUnion(uid), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(
      db.collection('users').doc(uid),
      {
        premium: true,
        plan: familyData.plan,
        subscriptionStatus: 'active',
        premiumSource: 'family',
        familyId: invite.ownerUid,
      },
      { merge: true }
    );
    tx.set(inviteRef, { status: 'accepted', resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
    return familyRef;
  });

  return { accepted: accept && Boolean(familyRef) };
});

exports.removeFamilyMember = onCall({ region: 'us-central1' }, async (request) => {
  const ownerUid = request.auth?.uid;
  if (!ownerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const memberUid = String(request.data?.memberUid || '');
  if (!memberUid) throw new HttpsError('invalid-argument', 'memberUid is required.');
  if (memberUid === ownerUid) throw new HttpsError('invalid-argument', "You can't remove yourself — cancel your subscription instead.");

  const familyRef = db.collection('families').doc(ownerUid);
  await db.runTransaction(async (tx) => {
    const familySnap = await tx.get(familyRef);
    const familyData = familySnap.data();
    if (!familyData) throw new HttpsError('not-found', 'You have no Family plan.');
    const memberUids = familyData.memberUids || [];
    if (!memberUids.includes(memberUid)) throw new HttpsError('not-found', 'That person is not on your Family plan.');

    tx.set(familyRef, { memberUids: FieldValue.arrayRemove(memberUid), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const memberSnap = await tx.get(db.collection('users').doc(memberUid));
    const memberData = memberSnap.data() || {};
    if (memberData.premiumSource === 'family' && memberData.familyId === ownerUid) {
      tx.set(db.collection('users').doc(memberUid), { premium: false, subscriptionStatus: 'revoked' }, { merge: true });
    }
  });

  return { removed: true };
});

exports.leaveFamilyPlan = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data() || {};
  if (userData.premiumSource !== 'family' || !userData.familyId) {
    throw new HttpsError('failed-precondition', "You're not on a Family plan.");
  }

  const familyRef = db.collection('families').doc(userData.familyId);
  await db.runTransaction(async (tx) => {
    tx.set(familyRef, { memberUids: FieldValue.arrayRemove(uid), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.collection('users').doc(uid), { premium: false, subscriptionStatus: 'revoked' }, { merge: true });
  });

  return { left: true };
});

// ---------------------------------------------------------------------------------------------
// verifyAndGrantPurchase — callable, contract shared with the client (react-native-iap) side.
// ---------------------------------------------------------------------------------------------

exports.verifyAndGrantPurchase = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = request.auth.uid;

  const { productId, purchaseToken } = request.data || {};
  if (typeof productId !== 'string' || !productId || typeof purchaseToken !== 'string' || !purchaseToken) {
    throw new HttpsError('invalid-argument', 'productId and purchaseToken are required strings.');
  }

  const plan = planFromProductId(productId);
  if (!plan) {
    throw new HttpsError('invalid-argument', `Unknown productId: ${productId}`);
  }

  // A purchaseToken is bearer data — anyone who obtains one (leaked logs, a shared license-tester
  // token, or simply the original purchaser sharing it) could otherwise call this themselves and
  // have Google re-verify it successfully, since verification only checks the token is valid, not
  // who's presenting it. Once a token is first claimed by a uid, only that same uid may re-verify
  // it (e.g. on restore-purchases) — a different uid presenting the same token is rejected outright
  // rather than being granted the same paid entitlement a second time.
  const existingTokenMapping = await db.collection('purchaseTokens').doc(purchaseToken).get();
  if (existingTokenMapping.exists && existingTokenMapping.data().uid !== uid) {
    throw new HttpsError('permission-denied', 'This purchase is already associated with a different account.');
  }

  const publisher = await getAndroidPublisher();

  let grant;
  let isTestPurchase;

  if (plan === 'lifetime') {
    const { data: purchase } = await publisher.purchases.products.get({
      packageName: PACKAGE_NAME,
      productId,
      token: purchaseToken,
    });

    // purchaseType is only present at all for a non-standard purchase (license tester, promo
    // code, rewarded-ad) — its mere presence, not any particular value, is the signal.
    isTestPurchase = purchase.purchaseType !== undefined && purchase.purchaseType !== null;
    grant = mapProductPurchaseState(purchase.purchaseState);

    if (purchase.purchaseState === 0 && purchase.acknowledgementState === 0) {
      await acknowledgeIdempotent(() =>
        publisher.purchases.products.acknowledge({
          packageName: PACKAGE_NAME,
          productId,
          token: purchaseToken,
          requestBody: {},
        })
      );
    }
  } else {
    const { data: purchase } = await publisher.purchases.subscriptionsv2.get({
      packageName: PACKAGE_NAME,
      token: purchaseToken,
    });

    // SubscriptionPurchaseV2.testPurchase is only present at all for a test transaction.
    isTestPurchase = !!purchase.testPurchase;

    const lineItem =
      (purchase.lineItems || []).find((li) => li.productId === productId) || (purchase.lineItems || [])[0];
    grant = mapSubscriptionState(purchase.subscriptionState, lineItem && lineItem.expiryTime);

    // Acknowledge once the purchase has genuinely gone through (i.e. isn't still awaiting initial
    // payment) — subscriptionsv2 has no acknowledge method of its own; this v1 endpoint is the
    // only one that exists, even though verification above used v2.
    const needsAck = ![
      'SUBSCRIPTION_STATE_PENDING',
      'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED',
      'SUBSCRIPTION_STATE_UNSPECIFIED',
      undefined,
    ].includes(purchase.subscriptionState);
    if (needsAck) {
      await acknowledgeIdempotent(() =>
        publisher.purchases.subscriptions.acknowledge({
          packageName: PACKAGE_NAME,
          subscriptionId: productId,
          token: purchaseToken,
          requestBody: {},
        })
      );
    }
  }

  // Record the token→uid mapping regardless of the current grant state (e.g. even for a
  // not-yet-active pending purchase) — this is the only way playRtdn will later be able to
  // resolve a bare purchaseToken (all RTDN payloads carry one; none carry a Firebase uid) back
  // to this Firestore user once its state changes.
  await db
    .collection('purchaseTokens')
    .doc(purchaseToken)
    .set({ uid, productId, createdAt: FieldValue.serverTimestamp() }, { merge: true });

  if (isTestPurchase) {
    // A license-tester/promo/rewarded purchase must never grant real premium in production
    // Firestore. Not an error — this is a valid, expected call — so don't throw; just don't
    // grant anything and let the client know why.
    console.warn('verifyAndGrantPurchase: test/non-standard purchase, not granting premium', {
      uid,
      productId,
    });
    return { granted: false, reason: 'test_purchase' };
  }

  await applyGrant(uid, plan, grant);

  return { granted: grant.premium, plan, subscriptionStatus: grant.subscriptionStatus };
});

// ---------------------------------------------------------------------------------------------
// playRtdn — Pub/Sub trigger for Google Play Real-time Developer Notifications.
//
// Topic name is `playRtdn` — this exact string must be the name of the Pub/Sub topic created in
// GCP and entered into Play Console's "Real-time developer notifications" field (see setup
// checklist). Payload schema and every notificationType/subscriptionState/productType value
// below is Google's documented RTDN reference — see the research notes for citations.
// ---------------------------------------------------------------------------------------------

// SubscriptionNotificationType. Only the one value we branch on specially needs a name; the
// rest just flow through the shared re-query + mapSubscriptionState path below.
const SUBSCRIPTION_NOTIFICATION_TYPE_REVOKED = 12;

/** All RTDN payloads carry a bare purchaseToken and nothing that identifies our Firebase user —
 * this is the only lookup path back to a uid. Logs and returns null (rather than throwing) if
 * unresolved, matching the existing pattern of not retry-looping Pub/Sub redelivery on something
 * that will never resolve (e.g. a token from a different app, or one that predates this
 * migration and was never written to purchaseTokens/). */
async function lookupUidForToken(purchaseToken) {
  const snap = await db.collection('purchaseTokens').doc(purchaseToken).get();
  if (!snap.exists) {
    console.warn('playRtdn: no purchaseTokens mapping for this token — dropping notification', {
      purchaseToken,
    });
    return null;
  }
  return snap.data();
}

async function handleSubscriptionNotification({ purchaseToken, notificationType }) {
  const mapping = await lookupUidForToken(purchaseToken);
  if (!mapping) return;

  // SUBSCRIPTION_REVOKED is Google forcibly pulling access (fraud/chargeback/policy) right now —
  // that's already the authoritative signal on its own, independent of whatever a re-query below
  // would report (there may be nothing left to re-query once access is revoked). Write it
  // directly rather than routing it through the query-then-map path. This is the subscription
  // equivalent of the lifetime-refund gap the old RevenueCat CANCELLATION-for-lifetime branch
  // existed to close; getting this branch wrong reintroduces exactly that gap.
  if (notificationType === SUBSCRIPTION_NOTIFICATION_TYPE_REVOKED) {
    const plan = planFromProductId(mapping.productId);
    await applyGrant(mapping.uid, plan, { premium: false, subscriptionStatus: 'revoked' });
    return;
  }

  const publisher = await getAndroidPublisher();

  let grant;
  try {
    // Per Google's guidance: the notification only says *that* something changed, not the
    // complete current state — re-query subscriptionsv2.get and treat its response, not the
    // notification payload, as the source of truth.
    const { data: purchase } = await publisher.purchases.subscriptionsv2.get({
      packageName: PACKAGE_NAME,
      token: purchaseToken,
    });
    const lineItem =
      (purchase.lineItems || []).find((li) => li.productId === mapping.productId) ||
      (purchase.lineItems || [])[0];
    grant = mapSubscriptionState(purchase.subscriptionState, lineItem && lineItem.expiryTime);
  } catch (err) {
    const status = err?.response?.status || err?.code;
    if (status === 404) {
      // Google has no record of this purchase token at all any more — a genuine "this
      // entitlement doesn't exist" signal, not a transient failure.
      console.warn('playRtdn: subscriptionsv2.get returned 404, treating as revoked', {
        purchaseToken,
        notificationType,
      });
      grant = { premium: false, subscriptionStatus: 'revoked' };
    } else {
      // A rate limit, network blip, or momentary auth failure is not evidence the subscription
      // ended — don't guess at revoking a paying subscriber's access on a transient failure.
      // Leave Firestore untouched and log for follow-up; the next RTDN event for this
      // subscription (or the next voided-purchase/revoked notification) will try again.
      console.error('playRtdn: subscriptionsv2.get failed with a non-404 error, leaving premium untouched', {
        purchaseToken,
        notificationType,
        error: err.message,
      });
      return;
    }
  }

  const plan = planFromProductId(mapping.productId);
  await applyGrant(mapping.uid, plan, grant);
}

async function handleOneTimeProductNotification({ purchaseToken }) {
  const mapping = await lookupUidForToken(purchaseToken);
  if (!mapping) return;

  const publisher = await getAndroidPublisher();
  // notificationType here is only ever PURCHASED(1) or CANCELED(2)-meaning-a-pending-purchase-
  // was-abandoned — neither is the refund signal (see handleVoidedPurchaseNotification), so
  // there's no need to branch on it: re-querying and mapping purchaseState covers both correctly.
  const { data: purchase } = await publisher.purchases.products.get({
    packageName: PACKAGE_NAME,
    productId: mapping.productId,
    token: purchaseToken,
  });
  const grant = mapProductPurchaseState(purchase.purchaseState);

  await applyGrant(mapping.uid, 'lifetime', grant);
}

async function handleVoidedPurchaseNotification({ purchaseToken, productType, refundType }) {
  const mapping = await lookupUidForToken(purchaseToken);
  if (!mapping) return;

  // Unlike the other two branches, this notification IS the source of truth already — Google is
  // directly telling us the transaction itself was voided (full refund or chargeback) — so there
  // is no "re-query and confirm" step here. productType 2 = ONE_TIME is the flowsy_lifetime
  // refund/revoke signal (NOT oneTimeProductNotification — that type never fires for a refund of
  // a completed purchase, only for an abandoned pending one). productType 1 = SUBSCRIPTION covers
  // a subscription voided outside the normal cancel/expire lifecycle, e.g. a chargeback.
  const plan = planFromProductId(mapping.productId);
  const subscriptionStatus = productType === 2 ? 'refunded' : 'revoked';
  console.log('playRtdn: voided purchase, revoking premium', {
    uid: mapping.uid,
    productType,
    refundType,
  });
  await applyGrant(mapping.uid, plan, { premium: false, subscriptionStatus });
}

exports.playRtdn = onMessagePublished({ topic: 'playRtdn', region: 'us-central1' }, async (event) => {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(event.data.message.data, 'base64').toString('utf8'));
  } catch (err) {
    // Malformed payload will never parse correctly on redelivery either — log and drop rather
    // than throwing (which would make Pub/Sub retry-loop it).
    console.error('playRtdn: could not parse RTDN payload as JSON', { error: err.message });
    return;
  }

  if (payload.testNotification) {
    // Play Console's "Send test notification" button — confirms the topic/subscription wiring
    // works end-to-end. Never represents a real purchase event.
    console.log('playRtdn: test notification received', payload.testNotification);
    return;
  }

  if (payload.subscriptionNotification) {
    await handleSubscriptionNotification(payload.subscriptionNotification);
    return;
  }

  if (payload.oneTimeProductNotification) {
    await handleOneTimeProductNotification(payload.oneTimeProductNotification);
    return;
  }

  if (payload.voidedPurchaseNotification) {
    await handleVoidedPurchaseNotification(payload.voidedPurchaseNotification);
    return;
  }

  // pendingRefundReviewNotification and anything future/unrecognized: log only, no Firestore
  // writes — mirrors the old webhook's "ack without mutating" policy for event types we don't
  // yet have defined handling for, rather than guessing at what they should do to Firestore.
  console.log('playRtdn: unhandled notification shape, ignoring', { keys: Object.keys(payload) });
});

// ---------------------------------------------------------------------------------------------
// onFeedbackCreated — emails the developer whenever a user submits in-app feedback
// (app/feedback.tsx writes to the `feedback` collection; this just watches for new documents).
//
// Sends via Gmail's own SMTP relay using the account's own address as both sender and recipient
// — no separate transactional-email service to sign up for. Requires a Gmail *App Password* (not
// the account's normal login password — Gmail's SMTP relay only accepts App Passwords, and those
// only exist once 2-Step Verification is turned on for the account):
//   1. Turn on 2-Step Verification on the Google account, if not already on.
//   2. Create an App Password: myaccount.google.com/apppasswords → app "Mail" → generate.
//   3. firebase functions:secrets:set GMAIL_APP_PASSWORD  (paste the 16-character app password)
//   4. firebase deploy --only functions:onFeedbackCreated
// ---------------------------------------------------------------------------------------------

const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const FEEDBACK_NOTIFY_ADDRESS = 'data24zone@gmail.com';

let mailTransporter;
function getMailTransporter() {
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: FEEDBACK_NOTIFY_ADDRESS, pass: GMAIL_APP_PASSWORD.value() },
    });
  }
  return mailTransporter;
}

exports.onFeedbackCreated = onDocumentCreated(
  { document: 'feedback/{feedbackId}', secrets: [GMAIL_APP_PASSWORD], region: 'us-central1' },
  async (event) => {
    const feedback = event.data?.data();
    if (!feedback) return;

    const stars = typeof feedback.rating === 'number' ? '★'.repeat(feedback.rating) + '☆'.repeat(5 - feedback.rating) : 'no rating';
    const subject = `Flowsy feedback${feedback.rating ? ` (${stars})` : ''}`;
    const text = [
      `From: ${feedback.email || 'unknown'} (uid: ${feedback.uid || 'unknown'})`,
      `Platform: ${feedback.platform || 'unknown'}  •  App version: ${feedback.appVersion || 'unknown'}`,
      `Rating: ${stars}`,
      '',
      feedback.message || '(no message)',
    ].join('\n');

    try {
      await getMailTransporter().sendMail({
        from: `Flowsy Feedback <${FEEDBACK_NOTIFY_ADDRESS}>`,
        to: FEEDBACK_NOTIFY_ADDRESS,
        replyTo: feedback.email || undefined,
        subject,
        text,
      });
    } catch (err) {
      // Feedback is already safely stored in Firestore regardless — a failed email here just
      // means checking the `feedback` collection directly instead of the inbox for this one.
      console.error('onFeedbackCreated: failed to send notification email', { error: err.message });
    }
  }
);

// ---------------------------------------------------------------------------------------------
// Razorpay — the website's (website/index.html) checkout path, parallel to the app's Google Play
// Billing path above. A purchase made here grants the exact same Firestore fields
// (users/{uid}.premium/plan/subscriptionStatus) that verifyAndGrantPurchase does, so the app's
// existing usePremium() listener picks it up identically regardless of which path was used —
// no app-side changes needed for this at all.
//
// Two entry points, mirroring Razorpay's own documented "Standard Checkout" server-side flow:
//   1. createRazorpayOrder (callable) — the website calls this first, for a signed-in user, to
//      get a Razorpay Order to open Checkout against.
//   2. verifyRazorpayPayment (callable) — called after Checkout succeeds client-side, with the
//      order id / payment id / signature Razorpay's own JS handed back. Verifies the HMAC
//      signature server-side (Razorpay's documented way to confirm a payment is genuine and
//      wasn't forged/tampered with client-side) before granting anything.
// ---------------------------------------------------------------------------------------------

// The Key ID is not sensitive — it's already embedded directly in website/index.html for
// Razorpay Checkout to use client-side. Only the Key Secret needs to stay server-side-only.
const RAZORPAY_KEY_ID = 'rzp_live_TRX7SkkH72jfQV';
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');

// Must match modules/premium/purchase.ts's PLANS — these are the website's prices, kept in sync
// with the app's Play Store prices by hand (Razorpay has no product catalog to read this from,
// unlike Play Console). This is the actual authoritative amount charged on web — there is no
// other source of truth for it, unlike Android where the real charge comes from whatever price is
// set on the matching product in Google Play Console.
const PLAN_PRICE_INR = {
  monthly: 149,
  quarterly: 299,
  halfYearly: 599,
  yearly: 999,
  lifetime: 3499,
  familyHalfYearly: 1499,
  familyYearly: 2499,
};

let razorpayClient;
function getRazorpayClient() {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET.value() });
  }
  return razorpayClient;
}

exports.createRazorpayOrder = onCall(
  { region: 'us-central1', secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = request.auth.uid;

    const plan = request.data?.plan;
    const priceInr = PLAN_PRICE_INR[plan];
    if (!priceInr) {
      throw new HttpsError('invalid-argument', `Unknown plan: ${plan}`);
    }

    const order = await getRazorpayClient().orders.create({
      amount: priceInr * 100, // Razorpay amounts are always in paise, not rupees.
      currency: 'INR',
      notes: { uid, plan },
    });

    // Recorded so verifyRazorpayPayment can look up which uid/plan this order was for — Razorpay
    // does echo `notes` back on the order object, but re-fetching the order over the network
    // during verification is an extra round-trip and an extra failure mode for no real benefit
    // when Firestore already gives us a place to keep exactly this, matching the pattern
    // purchaseTokens/{token} already uses for the Play Billing path.
    await db.collection('orders').doc(order.id).set({
      uid,
      plan,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { orderId: order.id, amountPaise: order.amount };
  }
);

exports.verifyRazorpayPayment = onCall(
  { region: 'us-central1', secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = request.auth.uid;

    const { orderId, paymentId, signature } = request.data || {};
    if (!orderId || !paymentId || !signature) {
      throw new HttpsError('invalid-argument', 'orderId, paymentId, and signature are required.');
    }

    // Razorpay's documented signature check: HMAC-SHA256 of "order_id|payment_id", keyed with the
    // account's Key Secret, must equal the signature their Checkout script returned. This is what
    // proves the payment response actually came from Razorpay and wasn't fabricated client-side —
    // the whole reason this can't just be "trust whatever the browser tells us".
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET.value())
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const signatureValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    if (!signatureValid) {
      console.warn('verifyRazorpayPayment: signature mismatch', { uid, orderId, paymentId });
      return { granted: false, reason: 'invalid_signature' };
    }

    const orderDoc = await db.collection('orders').doc(orderId).get();
    const orderData = orderDoc.data();
    if (!orderData) {
      console.warn('verifyRazorpayPayment: no matching order record', { uid, orderId });
      return { granted: false, reason: 'unknown_order' };
    }
    if (orderData.uid !== uid) {
      // The order was created for a different signed-in user than the one calling this — never
      // grant premium to whoever happens to call this with someone else's order id/signature.
      console.warn('verifyRazorpayPayment: uid mismatch between order and caller', { uid, orderUid: orderData.uid, orderId });
      throw new HttpsError('permission-denied', 'This order does not belong to the signed-in user.');
    }

    await applyGrant(uid, orderData.plan, {
      premium: true,
      subscriptionStatus: orderData.plan === 'lifetime' ? 'lifetime' : 'active',
    });

    return { granted: true, plan: orderData.plan };
  }
);

// Deletes every trace of a signed-in user's account: their synced data (users/{uid}/records/*),
// the entitlement doc itself, any orders/purchaseToken records that reference them, their
// Storage files (avatar, cloud backups), and finally the Firebase Auth account. Order matters —
// data is deleted before the Auth user, so a mid-way failure leaves the caller still signed in
// and able to retry, rather than locked out with orphaned data. Client-side, this is triggered
// only from a deliberate, typed-confirmation screen (never a plain alert/confirm) given how
// irreversible it is.
async function deleteCollectionInBatches(query, batchSize = 300) {
  // Firestore write batches cap at 500 ops; paginate well under that so a single very large
  // subcollection (e.g. thousands of synced records) doesn't need special-casing.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snapshot.size < batchSize) return;
  }
}

exports.deleteAccount = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  await deleteCollectionInBatches(db.collection('users').doc(uid).collection('records'));
  await deleteCollectionInBatches(db.collection('orders').where('uid', '==', uid));
  await deleteCollectionInBatches(db.collection('purchaseTokens').where('uid', '==', uid));
  await db.collection('users').doc(uid).delete();

  // Social data: authored posts first (each delete fires onPostDeleted, which reverse-fans-out
  // into followers' feed subcollections — deleting posts before the profile/username below is
  // what makes that cleanup actually happen), then the follow graph in both directions, this
  // user's own feed subcollection, the reserved username, and finally the public profile itself.
  const profileDoc = await db.collection('userPublicProfiles').doc(uid).get();
  await deleteCollectionInBatches(db.collection('posts').where('authorUid', '==', uid));
  await deleteCollectionInBatches(db.collection('follows').where('followerUid', '==', uid));
  await deleteCollectionInBatches(db.collection('follows').where('followedUid', '==', uid));
  await deleteCollectionInBatches(db.collection('users').doc(uid).collection('feed'));
  await deleteCollectionInBatches(db.collection('users').doc(uid).collection('likedPosts'));
  await deleteCollectionInBatches(db.collection('users').doc(uid).collection('notifications'));
  if (profileDoc.exists && profileDoc.data().usernameLower) {
    await db.collection('usernames').doc(profileDoc.data().usernameLower).delete();
  }
  await db.collection('userPublicProfiles').doc(uid).delete();

  const bucket = getStorage().bucket();
  await bucket.deleteFiles({ prefix: `avatars/${uid}/` }).catch((err) => {
    console.warn('deleteAccount: avatar cleanup failed (continuing)', uid, err.message);
  });
  await bucket.deleteFiles({ prefix: `backups/${uid}/` }).catch((err) => {
    console.warn('deleteAccount: backup cleanup failed (continuing)', uid, err.message);
  });

  await getAuth().deleteUser(uid);

  return { deleted: true };
});

// "Download my data": assembles the same account-owned data deleteAccount above knows how to
// find (see its comments for the source-of-truth mapping) into one JSON blob, server-side rather
// than the client reading every collection itself — some of these (orders/purchaseTokens,
// notifications) aren't client-readable at all under firestore.rules, and this keeps that logic
// in one place next to deleteAccount instead of duplicated against looser rules. Written to
// Storage rather than returned inline: a long-lived account's synced records alone can run well
// past a callable's response size is comfortable with. The signed URL is deliberately short-lived
// (15 min) and never persisted anywhere — a fresh call always re-uploads and re-signs rather than
// reusing a stale link, so there's nothing long-lived for a leaked URL to still be good for.
exports.exportUserData = onCall({ region: 'us-central1', timeoutSeconds: 120 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const [recordsSnap, userDoc, profileDoc, postsSnap, followingSnap, followersSnap, authUser] = await Promise.all([
    db.collection('users').doc(uid).collection('records').get(),
    db.collection('users').doc(uid).get(),
    db.collection('userPublicProfiles').doc(uid).get(),
    db.collection('posts').where('authorUid', '==', uid).get(),
    db.collection('follows').where('followerUid', '==', uid).get(),
    db.collection('follows').where('followedUid', '==', uid).get(),
    getAuth().getUser(uid),
  ]);

  // Mirrors the sync engine's own record shape (see modules/sync/syncSchema.ts's SYNC_TABLES) —
  // grouped by table, tombstoned (deleted) rows dropped since this represents current data, not
  // sync-protocol bookkeeping the account holder never asked to see.
  const recordsByTable = {};
  recordsSnap.forEach((doc) => {
    const record = doc.data();
    if (record.deleted) return;
    const table = record.table;
    if (!recordsByTable[table]) recordsByTable[table] = [];
    recordsByTable[table].push({ syncId: record.syncId, updatedAt: record.updatedAt, ...record.data });
  });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: { uid, email: authUser.email ?? null, createdAt: authUser.metadata.creationTime },
    entitlement: userDoc.exists ? userDoc.data() : null,
    publicProfile: profileDoc.exists ? profileDoc.data() : null,
    records: recordsByTable,
    posts: postsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    following: followingSnap.docs.map((doc) => doc.data()),
    followers: followersSnap.docs.map((doc) => doc.data()),
  };

  const bucket = getStorage().bucket();
  const path = `exports/${uid}/export-${Date.now()}.json`;
  const file = bucket.file(path);
  await file.save(JSON.stringify(exportPayload, null, 2), { contentType: 'application/json' });

  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });

  return { url };
});

// ---------------------------------------------------------------------------------------------
// Social: public profiles, open follow graph, posts, and a fan-out-on-write feed.
//
// This is a "follow anyone" social layer. It deliberately does not go through
// modules/sync's generic per-user Firestore sync (see db/schema.ts comment near cardio_logs for
// that engine's shape): that engine is single-writer/single-reader by design (users/{uid}/records
// is written and read by the same uid), which can't express "another user's post lands in my
// feed". Follows/posts/fan-out need actual cross-user writes, which is exactly what a rule alone
// can't safely arbitrate — hence these callables.
//
// Data model:
//   userPublicProfiles/{uid}   — discovery surface: displayName, avatarUrl, bio, usernameLower,
//                                isPrivate, and three counters (follower/following/post) that only
//                                these functions ever write (never the client directly).
//   usernames/{usernameLower}  — { uid } — a uniqueness reservation, same problem a SQL UNIQUE
//                                constraint solves; claimed/released transactionally with the
//                                profile doc so two users can never race onto the same handle.
//   follows/{followerUid}_{followedUid} — the edge. Deterministic id so "does A follow B" is a
//                                direct get(), not a query.
//   posts/{postId}             — one doc per post, owned by its author, created directly by the
//                                client (no callable needed for the write itself — only the
//                                fan-out after it, via the onPostCreated trigger below).
//   users/{uid}/feed/{postId}  — denormalized copy of posts from people {uid} follows, written
//                                ONLY by onPostCreated/onPostDeleted. This is what actually
//                                enforces "you only see people you follow" (see firestore.rules:
//                                the client can read but never write this subcollection) and
//                                sidesteps Firestore's 30-item `in`-query cap that a read-time
//                                `where('authorUid','in',[...followedUids])` feed would hit as
//                                soon as anyone follows more than 30 people.
// ---------------------------------------------------------------------------------------------

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/** "@alex"-style display name for a push body — falls back to "Someone" the same way
 * app/(tabs)/social/notifications.tsx's SocialActivityRow does when the profile hasn't loaded
 * yet (here: doesn't exist, or has no username reserved). */
async function usernameFor(uid) {
  const snap = await db.collection('userPublicProfiles').doc(uid).get();
  const usernameLower = snap.data()?.usernameLower;
  return usernameLower ? `@${usernameLower}` : 'Someone';
}

/** Title/body/deep-link route for one push notification, derived from the exact same `payload`
 * notify() already writes into the in-app notification doc — no second copy of "what happened"
 * business logic. Mirrors app/(tabs)/social/notifications.tsx's per-type rendering and
 * app/_layout.tsx's useNotificationResponseRouting, which reads `route` back off the push
 * payload's `data`. Returns null for a type this hasn't been taught to push yet, rather than
 * guessing — sendPushNotification treats that as "nothing to send". */
async function pushContentFor(payload, fromUid) {
  switch (payload.type) {
    case 'follow':
      return { title: 'New follower', body: `${await usernameFor(fromUid)} started following you`, route: `/social/profile/${fromUid}` };
    case 'like':
      return { title: 'New like', body: `${await usernameFor(fromUid)} liked your post`, route: '/social/notifications' };
    case 'comment':
      return { title: 'New comment', body: `${await usernameFor(fromUid)} commented on your post`, route: '/social/notifications' };
    case 'familyInvite':
      return { title: 'Family plan invite', body: `${await usernameFor(fromUid)} invited you to join their Family plan`, route: '/premium' };
    default:
      return null;
  }
}

/** Best-effort remote push fan-out to every device `toUid` is signed into (see
 * modules/notifications/usePushToken.ts: tokens live at users/{uid}/profile/pushTokens, same
 * doc shape as the avatar sync doc). Batched at 100 tokens per Expo's push API limit. Never
 * throws — notify()'s caller already awaited the in-app notification write above, which is the
 * part that must always succeed; a missing/expired token, a user who never granted permission,
 * or Expo's API being down should never turn into a failed follow/like/comment/nudge. */
async function sendExpoPush(tokens, content) {
  const messages = tokens.map((to) => ({ to, title: content.title, body: content.body, data: { route: content.route } }));
  for (let i = 0; i < messages.length; i += 100) {
    await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

async function sendPushNotification(toUid, fromUid, payload) {
  const tokensDoc = await db.collection('users').doc(toUid).collection('profile').doc('pushTokens').get();
  const tokens = tokensDoc.data()?.tokens;
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  const content = await pushContentFor(payload, fromUid);
  if (!content) return;

  await sendExpoPush(tokens, content);
}

/** System-initiated push — trial-ending reminders, not any user-to-user action, so this skips
 * notify()'s in-app-notification-doc + username-lookup (both keyed to a `fromUid`) and just pushes
 * directly. Best-effort like sendPushNotification: a missing/expired token never throws. */
async function sendSystemPush(toUid, content) {
  const tokensDoc = await db.collection('users').doc(toUid).collection('profile').doc('pushTokens').get();
  const tokens = tokensDoc.data()?.tokens;
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  await sendExpoPush(tokens, content);
}

/** Writes one in-app notification doc — see firestore.rules: only Admin SDK (this) can create
 * one; the client can only read its own and toggle `read`. `fromUid === toUid` never happens for
 * any current caller (liking/commenting on your own post, or following yourself, is either
 * impossible or already rejected earlier), but the guard is cheap insurance against ever
 * notifying someone about their own action. */
async function notify(toUid, fromUid, payload) {
  if (toUid === fromUid) return;
  await db.collection('users').doc(toUid).collection('notifications').add({
    fromUid,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    ...payload,
  });
  try {
    await sendPushNotification(toUid, fromUid, payload);
  } catch {
    // Push delivery is best-effort — the in-app notification above already succeeded regardless.
  }
}

/** Mirrors the `premium` flag from users/{uid} (Admin-SDK-only, see the top of this file) onto
 * userPublicProfiles/{uid} so anyone viewing a profile can see its "PRO" badge — the entitlement
 * doc itself is intentionally not client-readable for other users, so the social profile needs
 * its own denormalized copy of just this one boolean, kept in sync centrally here rather than at
 * each of the several places (purchase, RTDN, Razorpay) that can change it. */
exports.onUserEntitlementUpdated = onDocumentUpdated({ document: 'users/{uid}', region: 'us-central1' }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!!before.premium === !!after.premium) return;

  const profileRef = db.collection('userPublicProfiles').doc(event.params.uid);
  if (!(await profileRef.get()).exists) return; // No social profile yet — nothing to mirror onto.
  await profileRef.set({ isPro: !!after.premium }, { merge: true });
});

const TRIAL_DURATION_MS = 15 * 24 * 60 * 60 * 1000;

/** Grants a one-time 14-day Pro trial. Admin-SDK-only like every other write to `users/{uid}`
 * (firestore.rules denies client writes there outright) — the client can't self-grant or reset
 * its own trial by calling this repeatedly, since it's idempotent: once `trialEndsAt` exists on
 * the doc, later calls just return that same value rather than pushing it forward. Covers both a
 * brand-new signup (no doc yet) and an existing free user who's never had a trial (doc exists,
 * `trialEndsAt` absent) — either way, this is the only place `trialEndsAt` is ever written.
 * Already-premium users are left alone; there's no reason to stamp a trial deadline on an account
 * that doesn't need one. */
exports.startTrialIfEligible = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const ref = db.collection('users').doc(uid);
  const trialEndsAt = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    if (data?.premium || data?.trialEndsAt) return data?.trialEndsAt ?? null;

    const endsAt = Date.now() + TRIAL_DURATION_MS;
    tx.set(ref, { trialEndsAt: endsAt }, { merge: true });
    return endsAt;
  });

  return { trialEndsAt };
});

const TRIAL_REMINDER_WINDOW_MS = {
  threeDays: 3 * 24 * 60 * 60 * 1000,
  lookback: 2 * 24 * 60 * 60 * 1000, // catch a trial that already expired up to 2 days ago too
};
const DAY_MS = 24 * 60 * 60 * 1000;

/** Proactive trial-ending push, since the only reminder before this was the passive in-app banner
 * on Settings/Premium — someone who doesn't happen to open the app in their last few trial days
 * would otherwise lapse with zero warning. Runs daily; a single `trialReminderSent` field per user
 * tracks the most-urgent window already pushed (threeDays -> oneDay -> expired, strictly
 * increasing) so a daily cron that doesn't land on the exact hour a countdown crosses a threshold
 * still fires each window exactly once, never a duplicate. */
exports.sendTrialEndingReminders = onSchedule({ schedule: 'every 24 hours', region: 'us-central1' }, async () => {
  const now = Date.now();
  const snap = await db
    .collection('users')
    .where('trialEndsAt', '>', now - TRIAL_REMINDER_WINDOW_MS.lookback)
    .where('trialEndsAt', '<=', now + TRIAL_REMINDER_WINDOW_MS.threeDays)
    .get();

  await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      if (data.premium) return; // already converted — trialEndsAt is stale, nothing to remind them about

      const daysLeft = Math.ceil((data.trialEndsAt - now) / DAY_MS);
      const window = daysLeft <= 0 ? 'expired' : daysLeft <= 1 ? 'oneDay' : 'threeDays';
      if (data.trialReminderSent === window) return;

      const content =
        window === 'expired'
          ? {
              title: 'Your free trial has ended',
              body: "Your habits, tasks, and data are all still there — subscribe to get every Pro feature back, or keep going on the free plan's limits.",
              route: '/premium',
            }
          : window === 'oneDay'
            ? {
                title: 'Your trial ends tomorrow',
                body: "Subscribe today to keep everything you've built — your data stays either way, but Pro features lock tomorrow.",
                route: '/premium',
              }
            : {
                title: 'Your free trial ends soon',
                body: `${daysLeft} days left — subscribe now to keep unlimited habits, tasks, analytics, and more.`,
                route: '/premium',
              };

      await sendSystemPush(doc.id, content);
      await db.collection('users').doc(doc.id).set({ trialReminderSent: window }, { merge: true });
    })
  );
});

exports.claimUsername = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const usernameLower = String(request.data?.username || '').trim().toLowerCase();
  if (!USERNAME_PATTERN.test(usernameLower)) {
    throw new HttpsError('invalid-argument', 'Usernames must be 3-20 characters: lowercase letters, numbers, underscores.');
  }
  const displayName = String(request.data?.displayName || '').trim().slice(0, 60) || usernameLower;
  const bio = String(request.data?.bio || '').trim().slice(0, 160) || null;
  // Restricted to this caller's own avatar-upload Storage path (see modules/profile/avatarSync.ts,
  // which always uploads to avatars/{uid}/avatar.jpg) — same shape as firestore.rules' photoUrl
  // check on posts. Without this, avatarUrl is rendered via <Image> to every viewer of this
  // profile (components/Avatar.tsx), so an arbitrary attacker-controlled URL here would let it be
  // used as a per-viewer tracking pixel or point at oversized/non-image content.
  const rawAvatarUrl = typeof request.data?.avatarUrl === 'string' ? request.data.avatarUrl : null;
  const avatarUrlPattern = new RegExp(
    `^https://firebasestorage\\.googleapis\\.com/v0/b/lifeos-8f0bf\\.firebasestorage\\.app/o/avatars%2F${uid}%2F.*`
  );
  const avatarUrl = rawAvatarUrl && avatarUrlPattern.test(rawAvatarUrl) ? rawAvatarUrl : null;

  const usernameRef = db.collection('usernames').doc(usernameLower);
  const profileRef = db.collection('userPublicProfiles').doc(uid);
  const entitlementRef = db.collection('users').doc(uid);

  await db.runTransaction(async (tx) => {
    const [usernameDoc, profileDoc, entitlementDoc] = await Promise.all([tx.get(usernameRef), tx.get(profileRef), tx.get(entitlementRef)]);
    if (usernameDoc.exists && usernameDoc.data().uid !== uid) {
      throw new HttpsError('already-exists', 'That username is taken.');
    }

    const previous = profileDoc.exists ? profileDoc.data() : null;
    if (previous?.usernameLower && previous.usernameLower !== usernameLower) {
      tx.delete(db.collection('usernames').doc(previous.usernameLower));
    }

    tx.set(usernameRef, { uid });
    tx.set(
      profileRef,
      {
        usernameLower,
        displayName,
        bio,
        avatarUrl,
        isPrivate: previous?.isPrivate ?? false,
        isPro: previous?.isPro ?? !!entitlementDoc.data()?.premium,
        followerCount: previous?.followerCount ?? 0,
        followingCount: previous?.followingCount ?? 0,
        postCount: previous?.postCount ?? 0,
        createdAt: previous?.createdAt ?? FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { usernameLower };
});

exports.findUserByUsername = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const usernameLower = String(request.data?.username || '').trim().toLowerCase();
  if (!usernameLower) throw new HttpsError('invalid-argument', 'A username is required.');

  const usernameDoc = await db.collection('usernames').doc(usernameLower).get();
  if (!usernameDoc.exists) throw new HttpsError('not-found', 'No user with that username.');

  const targetUid = usernameDoc.data().uid;
  const profileDoc = await db.collection('userPublicProfiles').doc(targetUid).get();
  if (!profileDoc.exists) throw new HttpsError('not-found', 'No user with that username.');

  return { uid: targetUid, profile: profileDoc.data() };
});

exports.followUser = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const targetUid = String(request.data?.targetUid || '');
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');
  if (targetUid === uid) throw new HttpsError('invalid-argument', "You can't follow yourself.");

  const followRef = db.collection('follows').doc(`${uid}_${targetUid}`);
  const targetProfileRef = db.collection('userPublicProfiles').doc(targetUid);
  const myProfileRef = db.collection('userPublicProfiles').doc(uid);

  const didFollow = await db.runTransaction(async (tx) => {
    const [targetDoc, followDoc] = await Promise.all([tx.get(targetProfileRef), tx.get(followRef)]);
    if (!targetDoc.exists) throw new HttpsError('not-found', 'That user does not exist.');
    if (followDoc.exists) return false; // Already following — idempotent no-op, not an error.

    tx.set(followRef, { followerUid: uid, followedUid: targetUid, createdAt: FieldValue.serverTimestamp() });
    tx.set(targetProfileRef, { followerCount: FieldValue.increment(1) }, { merge: true });
    tx.set(myProfileRef, { followingCount: FieldValue.increment(1) }, { merge: true });
    return true;
  });

  if (didFollow) {
    await notify(targetUid, uid, { type: 'follow' });
  }

  return { following: true };
});

exports.unfollowUser = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const targetUid = String(request.data?.targetUid || '');
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');

  const followRef = db.collection('follows').doc(`${uid}_${targetUid}`);
  const targetProfileRef = db.collection('userPublicProfiles').doc(targetUid);
  const myProfileRef = db.collection('userPublicProfiles').doc(uid);

  const didUnfollow = await db.runTransaction(async (tx) => {
    const followDoc = await tx.get(followRef);
    if (!followDoc.exists) return false;
    tx.delete(followRef);
    tx.set(targetProfileRef, { followerCount: FieldValue.increment(-1) }, { merge: true });
    tx.set(myProfileRef, { followingCount: FieldValue.increment(-1) }, { merge: true });
    return true;
  });

  if (didUnfollow) {
    // Bounded to the caller's own feed subcollection — safe to run outside the transaction above.
    await deleteCollectionInBatches(db.collection('users').doc(uid).collection('feed').where('authorUid', '==', targetUid));
  }

  return { following: false };
});

// ---------------------------------------------------------------------------------------------
// Clubs: join a club, see a member roster, chat, moderate. Creating/joining/leaving all pair a
// membership-doc write with a clubs/{clubId}.memberCount update — the same "two-sided write"
// shape followUser/unfollowUser above already established needs a callable rather than
// client-writable rules, since a direct client write can't safely touch the OTHER doc's counter
// in the same operation.
// ---------------------------------------------------------------------------------------------

const CLUB_CATEGORIES = ['running', 'cycling', 'strength', 'mindfulness', 'general'];
const CLUB_MAX_CATEGORIES = 3;
const CLUB_PRIVACY_LEVELS = ['public', 'inviteOnly', 'private'];

exports.createClub = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  // Club creation is Pro-only (see app/(tabs)/social/clubs/create.tsx's client-side gate) —
  // re-verified here via Admin SDK since a modified client could otherwise skip straight to this
  // callable. "Effectively premium" mirrors modules/premium/usePremium.ts's own definition: either
  // the raw `premium` flag, or an active free trial (trialEndsAt in the future).
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data() || {};
  const trialActive = !userData.premium && typeof userData.trialEndsAt === 'number' && Date.now() < userData.trialEndsAt;
  if (!userData.premium && !trialActive) {
    throw new HttpsError('permission-denied', 'Creating a club is a Pro feature. Upgrade to create your own club.');
  }

  const name = String(request.data?.name || '').trim().slice(0, 60);
  if (!name) throw new HttpsError('invalid-argument', 'A club name is required.');
  const description = String(request.data?.description || '').trim().slice(0, 280);
  const rawCategories = Array.isArray(request.data?.categories) ? request.data.categories : [];
  const categories = [...new Set(rawCategories.map(String))].filter((c) => CLUB_CATEGORIES.includes(c)).slice(0, CLUB_MAX_CATEGORIES);
  if (categories.length === 0) throw new HttpsError('invalid-argument', 'At least one club category is required.');
  const privacy = CLUB_PRIVACY_LEVELS.includes(request.data?.privacy) ? request.data.privacy : 'public';

  const clubRef = db.collection('clubs').doc();
  await db.runTransaction(async (tx) => {
    tx.set(clubRef, {
      name,
      description,
      categories,
      privacy,
      photoUrl: null,
      memberCount: 1,
      createdBy: uid,
      admins: [uid],
      subAdmins: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(clubRef.collection('members').doc(uid), { uid, joinedAt: FieldValue.serverTimestamp() });
  });

  return { clubId: clubRef.id };
});

/** Whether uid should be treated as a FULL admin of this club: either they're actually listed in
 * `admins`, or they're the club's creator. The creator branch exists for legacy club docs created
 * before the admins/subAdmins schema shipped (or before some other data-migration gap), whose
 * `admins` array never got backfilled with the creator's uid even though every other admin-gated
 * check in this file — and setClubAdminRole's "the creator can never be demoted" rule just below —
 * assumes the creator is always a full admin. Without this fallback, the creator of such a club
 * (e.g. one predating this field) would fail every admin check here (including deleteClub) despite
 * the client's own useClub.ts isAdmin (which has the same fallback) showing them admin UI. */
function isClubAdmin(club, uid) {
  return uid === club.createdBy || (club.admins || []).includes(uid);
}

/** Promotes/demotes a uid to/from the club's `admins` array — callable only by an existing admin
 * (verified server-side, not just hidden client-side), and the creator can never be demoted since
 * every club needs at least one permanent admin. Promoting to full admin also clears the target
 * from `subAdmins` — the two tiers are disjoint, so a full admin doesn't linger tagged as a
 * sub-admin too (see setClubSubAdminRole for the narrower moderator tier). */
exports.setClubAdminRole = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const targetUid = String(request.data?.targetUid || '');
  const isAdmin = Boolean(request.data?.isAdmin);
  if (!clubId || !targetUid) throw new HttpsError('invalid-argument', 'clubId and targetUid are required.');

  const clubRef = db.collection('clubs').doc(clubId);

  await db.runTransaction(async (tx) => {
    const [clubDoc, targetMemberDoc] = await Promise.all([tx.get(clubRef), tx.get(clubRef.collection('members').doc(targetUid))]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    const club = clubDoc.data();
    if (!isClubAdmin(club, callerUid)) {
      throw new HttpsError('permission-denied', 'Only a club admin can change roles.');
    }
    if (targetUid === club.createdBy && !isAdmin) {
      throw new HttpsError('invalid-argument', "The club creator can't be demoted.");
    }
    if (!targetMemberDoc.exists) throw new HttpsError('failed-precondition', 'That person is not a member of this club.');
    tx.set(
      clubRef,
      {
        admins: isAdmin ? FieldValue.arrayUnion(targetUid) : FieldValue.arrayRemove(targetUid),
        ...(isAdmin ? { subAdmins: FieldValue.arrayRemove(targetUid) } : {}),
      },
      { merge: true }
    );
  });

  return { isAdmin };
});

/** Promotes/demotes a uid to/from the club's `subAdmins` array — the narrower moderator tier
 * (remove a member, delete a chat message/update) below full admin. Only a FULL admin may grant
 * or revoke it (a sub-admin can't promote another sub-admin, or themselves), and a uid already in
 * `admins` can't also be tagged a sub-admin — demote them to a plain member first. */
exports.setClubSubAdminRole = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const targetUid = String(request.data?.targetUid || '');
  const isSubAdmin = Boolean(request.data?.isSubAdmin);
  if (!clubId || !targetUid) throw new HttpsError('invalid-argument', 'clubId and targetUid are required.');

  const clubRef = db.collection('clubs').doc(clubId);

  await db.runTransaction(async (tx) => {
    const [clubDoc, targetMemberDoc] = await Promise.all([tx.get(clubRef), tx.get(clubRef.collection('members').doc(targetUid))]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    const club = clubDoc.data();
    if (!isClubAdmin(club, callerUid)) {
      throw new HttpsError('permission-denied', 'Only a club admin can change roles.');
    }
    if (!targetMemberDoc.exists) throw new HttpsError('failed-precondition', 'That person is not a member of this club.');
    if (isSubAdmin && isClubAdmin(club, targetUid)) {
      throw new HttpsError('invalid-argument', 'That person is already a full admin.');
    }
    tx.set(clubRef, { subAdmins: isSubAdmin ? FieldValue.arrayUnion(targetUid) : FieldValue.arrayRemove(targetUid) }, { merge: true });
  });

  return { isSubAdmin };
});

exports.joinClub = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const memberRef = clubRef.collection('members').doc(uid);
  const inviteRef = clubRef.collection('invites').doc(uid);

  await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc, inviteDoc] = await Promise.all([tx.get(clubRef), tx.get(memberRef), tx.get(inviteRef)]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    if (memberDoc.exists) return; // Already a member — idempotent no-op, not an error.
    // 'inviteOnly'/'private' both require an existing invite to join directly — re-checked here
    // (not just hidden in the UI) since a determined client could otherwise call this callable
    // straight past the invite flow. Discovery visibility is the only thing that differs between
    // those two levels (see firestore.rules' clubs/{clubId} read rule); joining works the same way.
    const privacy = clubDoc.data().privacy || 'public';
    if (privacy !== 'public' && !inviteDoc.exists) {
      throw new HttpsError('permission-denied', 'This club requires an invite to join.');
    }
    tx.set(memberRef, { uid, joinedAt: FieldValue.serverTimestamp() });
    tx.set(clubRef, { memberCount: FieldValue.increment(1) }, { merge: true });
    if (inviteDoc.exists) tx.delete(inviteRef);
  });

  return { joined: true };
});

exports.leaveClub = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const memberRef = clubRef.collection('members').doc(uid);

  await db.runTransaction(async (tx) => {
    const memberDoc = await tx.get(memberRef);
    if (!memberDoc.exists) return;
    tx.delete(memberRef);
    tx.set(clubRef, { memberCount: FieldValue.increment(-1) }, { merge: true });
  });

  return { joined: false };
});

/** Lets an existing member add someone they follow straight into the club — no invite/accept
 * step, matching the product decision for v1 (the target is trusted because the caller already
 * follows them, not because the target consented to being added). Same transactional
 * membership-doc + memberCount shape as joinClub, just with the added-uid supplied by the caller
 * instead of always being request.auth.uid — the one extra check is that the caller must
 * themselves already be a member (otherwise anyone signed in could add people to any club). */
exports.addClubMember = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const targetUid = String(request.data?.uid || '');
  if (!clubId || !targetUid) throw new HttpsError('invalid-argument', 'clubId and uid are required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const callerMemberRef = clubRef.collection('members').doc(callerUid);
  const targetMemberRef = clubRef.collection('members').doc(targetUid);

  await db.runTransaction(async (tx) => {
    const [clubDoc, callerMemberDoc, targetMemberDoc] = await Promise.all([
      tx.get(clubRef),
      tx.get(callerMemberRef),
      tx.get(targetMemberRef),
    ]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    if (!callerMemberDoc.exists) throw new HttpsError('permission-denied', 'Only existing members can add people to this club.');
    if (targetMemberDoc.exists) return; // Already a member — idempotent no-op.
    tx.set(targetMemberRef, { uid: targetUid, joinedAt: FieldValue.serverTimestamp() });
    tx.set(clubRef, { memberCount: FieldValue.increment(1) }, { merge: true });
  });

  return { added: true };
});

/** Lets an admin or sub-admin remove another member from the club — same transactional
 * membership-doc + memberCount shape as leaveClub, just triggered by someone else. A sub-admin
 * may remove ordinary members only; only a full admin may remove a sub-admin (moderating a
 * moderator), and no one can remove a full admin this way (demote via setClubAdminRole first). */
exports.removeClubMember = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const targetUid = String(request.data?.targetUid || '');
  if (!clubId || !targetUid) throw new HttpsError('invalid-argument', 'clubId and targetUid are required.');
  if (targetUid === callerUid) throw new HttpsError('invalid-argument', 'Use leaveClub to remove yourself.');

  const clubRef = db.collection('clubs').doc(clubId);
  const memberRef = clubRef.collection('members').doc(targetUid);

  await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc] = await Promise.all([tx.get(clubRef), tx.get(memberRef)]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    const club = clubDoc.data();
    const callerIsAdmin = isClubAdmin(club, callerUid);
    const callerIsSubAdmin = (club.subAdmins || []).includes(callerUid);
    if (!callerIsAdmin && !callerIsSubAdmin) {
      throw new HttpsError('permission-denied', 'Only an admin or sub-admin can remove a member.');
    }
    if (isClubAdmin(club, targetUid)) {
      throw new HttpsError('invalid-argument', 'Demote an admin before removing them.');
    }
    if (!callerIsAdmin && (club.subAdmins || []).includes(targetUid)) {
      throw new HttpsError('permission-denied', 'Only a full admin can remove a sub-admin.');
    }
    if (!memberDoc.exists) return; // Already gone — idempotent no-op.
    tx.delete(memberRef);
    tx.set(clubRef, { memberCount: FieldValue.increment(-1), subAdmins: FieldValue.arrayRemove(targetUid) }, { merge: true });
  });

  return { removed: true };
});

// ---------------------------------------------------------------------------------------------
// Club Challenges (v1): a club-scoped goal ("most cardio sessions this month") that members join
// and track against a simple leaderboard. Deliberately reuses cardioLogCount, already synced to
// userPublicProfiles for the existing trophy case (see modules/social/usePublicProfileStatsSync.ts)
// — a participant's progress is just (their current cardioLogCount) minus (the count snapshotted
// when they joined), so this needs no new per-activity cross-user writes at all, only a join-time
// snapshot. Same two-sided-write reasoning as clubs above: joining pairs a participant doc with a
// participantCount counter update.
//
// A third metricType, 'habitStreak', tracks a member's current streak on a specific *named* habit
// (e.g. "no sugar") instead of a cardio total — members create their own separate habit rather
// than sharing one, so matching is by name (case-insensitive substring, see targetHabitName and
// modules/social/usePublicProfileStatsSync.ts's habitStreaks field) rather than a shared habit id.
// It has no flat userPublicProfiles field to snapshot a startCount from, so startCount is always 0
// and progress is simply read as the participant's current matching streak (see challenge.tsx).
//
// Five more metric types back the non-cardio challenge categories added later (workout/food/
// water/meditation/breathing — see modules/clubs/types.ts's ChallengeCategory) — each maps 1:1 to
// a single real per-user counter synced onto userPublicProfiles by usePublicProfileStatsSync.js,
// same shape as 'sessions'/'distanceKm'. Mirrors modules/clubs/challengeProgress.ts's
// metricCurrentValue — keep the two in sync.
// ---------------------------------------------------------------------------------------------

const METRIC_FIELD_BY_TYPE = {
  distanceKm: 'cardioDistanceKm',
  habitStreak: null,
  workoutSessions: 'workoutLogCount',
  mealLogs: 'mealLogCount',
  waterGoalDays: 'waterGoalHitDays',
  meditationSessions: 'meditationLogCount',
  breathingSessions: 'breathingLogCount',
};

exports.createChallenge = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');
  const title = String(request.data?.title || '').trim().slice(0, 60);
  if (!title) throw new HttpsError('invalid-argument', 'A challenge title is required.');
  const description = String(request.data?.description || '').trim().slice(0, 280);
  // Eight metric types now (see modules/clubs/types.ts's ChallengeMetricType doc comment): the
  // original three cardio/habit metrics, plus one single-metric mapping per non-cardio challenge
  // category (workout/food/water/meditation/breathing) added for the club challenge categories
  // feature — each of those five reads a real per-user counter already synced onto
  // userPublicProfiles by usePublicProfileStatsSync.js, same shape as 'sessions'/'distanceKm'.
  const VALID_METRIC_TYPES = [
    'sessions',
    'distanceKm',
    'habitStreak',
    'workoutSessions',
    'mealLogs',
    'waterGoalDays',
    'meditationSessions',
    'breathingSessions',
  ];
  const metricType = VALID_METRIC_TYPES.includes(request.data?.metricType) ? request.data.metricType : 'sessions';
  const goalSessions = Number(request.data?.goalSessions);
  if (!Number.isFinite(goalSessions) || goalSessions <= 0) {
    throw new HttpsError('invalid-argument', 'goalSessions must be a positive number.');
  }
  // Only meaningful for metricType 'habitStreak' — the habit *name* to match against each
  // member's own habits (see usePublicProfileStatsSync's habitStreaks field and the matching
  // heuristic documented there), since members track their own separately-created habits, not a
  // shared one.
  const targetHabitName = String(request.data?.targetHabitName || '').trim().slice(0, 60);
  if (metricType === 'habitStreak' && !targetHabitName) {
    throw new HttpsError('invalid-argument', 'targetHabitName is required for a habit-streak challenge.');
  }
  const startDate = String(request.data?.startDate || '');
  const endDate = String(request.data?.endDate || '');
  if (!startDate || !endDate) throw new HttpsError('invalid-argument', 'startDate and endDate are required.');
  // Team assignment is a simple deterministic alternation by join order (see joinChallenge), not a
  // balancing algorithm — the creator is always the first joiner, so they anchor team 'A'.
  const teamMode = !!request.data?.teamMode;

  const clubRef = db.collection('clubs').doc(clubId);
  const challengeRef = clubRef.collection('challenges').doc();
  // Which userPublicProfiles field this challenge's progress is measured against — see
  // METRIC_FIELD_BY_TYPE above createChallenge, and usePublicProfileStatsSync for how these are
  // kept current. 'habitStreak' has no single flat field (progress is matched against the
  // habitStreaks JSON client-side, per-participant, against this challenge's targetHabitName), so
  // there's nothing to snapshot a startCount from — it's always 0, and progress is simply the
  // participant's current matching streak.
  const metricField = metricType in METRIC_FIELD_BY_TYPE ? METRIC_FIELD_BY_TYPE[metricType] : 'cardioLogCount';

  await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc, profileDoc] = await Promise.all([
      tx.get(clubRef),
      tx.get(clubRef.collection('members').doc(uid)),
      tx.get(db.collection('userPublicProfiles').doc(uid)),
    ]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    if (!memberDoc.exists) throw new HttpsError('permission-denied', 'Join the club before creating a challenge in it.');

    tx.set(challengeRef, {
      title,
      description,
      metricType,
      goalSessions,
      targetHabitName: metricType === 'habitStreak' ? targetHabitName : null,
      startDate,
      endDate,
      createdBy: uid,
      participantCount: 1,
      teamMode,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(challengeRef.collection('participants').doc(uid), {
      uid,
      startCount: metricField ? (profileDoc.data()?.[metricField] ?? 0) : 0,
      team: teamMode ? 'A' : null,
      joinedAt: FieldValue.serverTimestamp(),
    });
  });

  return { challengeId: challengeRef.id };
});

exports.joinChallenge = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const challengeId = String(request.data?.challengeId || '');
  if (!clubId || !challengeId) throw new HttpsError('invalid-argument', 'clubId and challengeId are required.');

  const challengeRef = db.collection('clubs').doc(clubId).collection('challenges').doc(challengeId);
  const participantRef = challengeRef.collection('participants').doc(uid);

  await db.runTransaction(async (tx) => {
    const [challengeDoc, participantDoc, profileDoc] = await Promise.all([
      tx.get(challengeRef),
      tx.get(participantRef),
      tx.get(db.collection('userPublicProfiles').doc(uid)),
    ]);
    if (!challengeDoc.exists) throw new HttpsError('not-found', 'That challenge does not exist.');
    if (participantDoc.exists) return; // Already joined — idempotent no-op.
    const challengeMetricType = challengeDoc.data()?.metricType;
    const metricField = challengeMetricType in METRIC_FIELD_BY_TYPE ? METRIC_FIELD_BY_TYPE[challengeMetricType] : 'cardioLogCount';
    // Deterministic round-robin by join order — participantCount before this join is exactly how
    // many people already joined (0-based index of the new joiner), so alternating on its parity
    // keeps team sizes within one of each other without any cross-team balancing logic.
    const team = challengeDoc.data()?.teamMode ? ((challengeDoc.data()?.participantCount ?? 0) % 2 === 0 ? 'A' : 'B') : null;
    tx.set(participantRef, {
      uid,
      startCount: metricField ? (profileDoc.data()?.[metricField] ?? 0) : 0,
      team,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.set(challengeRef, { participantCount: FieldValue.increment(1) }, { merge: true });
  });

  return { joined: true };
});

exports.leaveChallenge = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const challengeId = String(request.data?.challengeId || '');
  if (!clubId || !challengeId) throw new HttpsError('invalid-argument', 'clubId and challengeId are required.');

  const challengeRef = db.collection('clubs').doc(clubId).collection('challenges').doc(challengeId);
  const participantRef = challengeRef.collection('participants').doc(uid);

  await db.runTransaction(async (tx) => {
    const participantDoc = await tx.get(participantRef);
    if (!participantDoc.exists) return;
    tx.delete(participantRef);
    tx.set(challengeRef, { participantCount: FieldValue.increment(-1) }, { merge: true });
  });

  return { joined: false };
});

/** Admin-only hard delete of a challenge and its `participants` subcollection — deliberately
 * Admin-SDK-only (see firestore.rules' clubs/{clubId}/challenges/{challengeId} `allow write: if
 * false`, unchanged by this): a direct client delete can't be trusted to check the caller is an
 * admin, and Firestore rules can't cheaply verify "is this uid in the parent club doc's `admins`
 * array" AND cascade-delete a subcollection in one pass. Full-admin-only (not sub-admins) — same
 * tier as setClubAdminRole/setClubSubAdminRole, since deleting the whole challenge is a bigger
 * action than the sub-admin content-moderation canModerate() already permits (deleting a single
 * chat message/update/photo). */
exports.deleteClubChallenge = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const challengeId = String(request.data?.challengeId || '');
  if (!clubId || !challengeId) throw new HttpsError('invalid-argument', 'clubId and challengeId are required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const challengeRef = clubRef.collection('challenges').doc(challengeId);

  const clubDoc = await clubRef.get();
  if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
  if (!isClubAdmin(clubDoc.data(), uid)) {
    throw new HttpsError('permission-denied', 'Only a club admin can delete a challenge.');
  }

  await deleteCollectionInBatches(challengeRef.collection('participants'));
  await deleteCollectionInBatches(challengeRef.collection('updates'));
  await challengeRef.delete();

  return { deleted: true };
});

// ---------------------------------------------------------------------------------------------
// Club Events (v1): a scheduled, club-visible activity other members can RSVP to. No reminder
// fan-out to attendees' devices yet (that would need each attendee's own device to separately
// schedule a local notification, or a push-notification send — out of scope for v1); attendees
// just see the event and its growing RSVP count/roster in the club. Same two-sided-write shape as
// clubs/challenges above.
// ---------------------------------------------------------------------------------------------

exports.createEvent = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');
  const title = String(request.data?.title || '').trim().slice(0, 60);
  if (!title) throw new HttpsError('invalid-argument', 'An event title is required.');
  const description = String(request.data?.description || '').trim().slice(0, 280);
  const startsAtMs = Number(request.data?.startsAtMs);
  if (!Number.isFinite(startsAtMs) || startsAtMs <= 0) {
    throw new HttpsError('invalid-argument', 'startsAtMs must be a valid future timestamp.');
  }
  // Recurring events store ONE weekly "template" doc rather than one doc per occurrence — the
  // client (modules/clubs/recurringEvents.ts) computes upcoming occurrence dates from
  // recurrenceDayOfWeek, and RSVPs are tracked per-occurrence-date (see joinEvent/leaveEvent)
  // rather than once for the whole series. recurrenceDayOfWeek/anchorOccurrenceDate come from the
  // client since they're derived from the creator's *local* date, which the server can't recover
  // from a bare millisecond timestamp.
  const recurring = !!request.data?.recurring;
  let recurrenceDayOfWeek = null;
  let anchorOccurrenceDate = null;
  if (recurring) {
    recurrenceDayOfWeek = Number(request.data?.recurrenceDayOfWeek);
    if (!Number.isInteger(recurrenceDayOfWeek) || recurrenceDayOfWeek < 0 || recurrenceDayOfWeek > 6) {
      throw new HttpsError('invalid-argument', 'recurrenceDayOfWeek must be an integer 0-6.');
    }
    anchorOccurrenceDate = String(request.data?.anchorOccurrenceDate || '');
    if (!anchorOccurrenceDate) throw new HttpsError('invalid-argument', 'anchorOccurrenceDate is required for a recurring event.');
  }
  const EVENT_TYPES = ['race', 'groupWorkout', 'social', 'other'];
  const eventType = EVENT_TYPES.includes(request.data?.eventType) ? request.data.eventType : 'other';
  let capacity = null;
  if (request.data?.capacity != null) {
    const capacityNum = Number(request.data.capacity);
    if (!Number.isFinite(capacityNum) || capacityNum <= 0) throw new HttpsError('invalid-argument', 'capacity must be a positive number.');
    capacity = Math.floor(capacityNum);
  }

  const clubRef = db.collection('clubs').doc(clubId);
  const eventRef = clubRef.collection('events').doc();

  await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc] = await Promise.all([tx.get(clubRef), tx.get(clubRef.collection('members').doc(uid))]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    if (!memberDoc.exists) throw new HttpsError('permission-denied', 'Join the club before creating an event in it.');

    tx.set(eventRef, {
      title,
      description,
      startsAt: Timestamp.fromMillis(startsAtMs),
      createdBy: uid,
      // Only meaningful for a plain (non-recurring) event — a recurring template's attendee count
      // varies per occurrence, so it's read from the attendees subcollection instead (see
      // useEventAttendees), not from this counter.
      attendeeCount: 1,
      recurring,
      recurrenceDayOfWeek,
      eventType,
      capacity,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(eventRef.collection('attendees').doc(recurring ? `${uid}_${anchorOccurrenceDate}` : uid), {
      uid,
      occurrenceDate: recurring ? anchorOccurrenceDate : null,
      joinedAt: FieldValue.serverTimestamp(),
    });
  });

  return { eventId: eventRef.id };
});

exports.joinEvent = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const eventId = String(request.data?.eventId || '');
  if (!clubId || !eventId) throw new HttpsError('invalid-argument', 'clubId and eventId are required.');
  const occurrenceDate = request.data?.occurrenceDate ? String(request.data.occurrenceDate) : null;

  const eventRef = db.collection('clubs').doc(clubId).collection('events').doc(eventId);
  const attendeeRef = eventRef.collection('attendees').doc(occurrenceDate ? `${uid}_${occurrenceDate}` : uid);
  // Waitlisting only applies to a plain event's shared attendeeCount — a recurring template's
  // count isn't tracked per-occurrence (see the comment below), so there's no reliable headcount
  // to enforce capacity against for a recurring RSVP; those always succeed as before.
  const waitlistRef = eventRef.collection('waitlist').doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const [eventDoc, attendeeDoc, waitlistDoc] = await Promise.all([
      tx.get(eventRef),
      tx.get(attendeeRef),
      occurrenceDate ? Promise.resolve(null) : tx.get(waitlistRef),
    ]);
    if (!eventDoc.exists) throw new HttpsError('not-found', 'That event does not exist.');
    if (attendeeDoc.exists) return { joined: true, waitlisted: false };
    if (waitlistDoc?.exists) return { joined: false, waitlisted: true };

    const capacity = eventDoc.data()?.capacity ?? null;
    const attendeeCount = eventDoc.data()?.attendeeCount ?? 0;
    const atCapacity = !occurrenceDate && capacity != null && attendeeCount >= capacity;

    if (atCapacity) {
      tx.set(waitlistRef, { uid, occurrenceDate: null, joinedAt: FieldValue.serverTimestamp() });
      return { joined: false, waitlisted: true };
    }

    tx.set(attendeeRef, { uid, occurrenceDate, joinedAt: FieldValue.serverTimestamp() });
    // A recurring template's attendeeCount isn't incremented — each occurrence has its own
    // attendee set, so one shared counter on the template can't represent any of them correctly.
    if (!occurrenceDate) tx.set(eventRef, { attendeeCount: FieldValue.increment(1) }, { merge: true });
    return { joined: true, waitlisted: false };
  });

  return result;
});

exports.leaveEvent = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const eventId = String(request.data?.eventId || '');
  if (!clubId || !eventId) throw new HttpsError('invalid-argument', 'clubId and eventId are required.');
  const occurrenceDate = request.data?.occurrenceDate ? String(request.data.occurrenceDate) : null;

  const eventRef = db.collection('clubs').doc(clubId).collection('events').doc(eventId);
  const attendeeRef = eventRef.collection('attendees').doc(occurrenceDate ? `${uid}_${occurrenceDate}` : uid);
  const waitlistRef = eventRef.collection('waitlist').doc(uid);

  await db.runTransaction(async (tx) => {
    const [attendeeDoc, waitlistDoc] = await Promise.all([tx.get(attendeeRef), tx.get(waitlistRef)]);
    // Canceling a waitlist spot (not a confirmed RSVP) — no attendeeCount change, nobody to promote.
    if (waitlistDoc.exists) {
      tx.delete(waitlistRef);
      return;
    }
    if (!attendeeDoc.exists) return;

    // Earliest waitlisted person, read BEFORE any writes below (Firestore transactions require
    // every read to precede every write) — only relevant for a plain event, same reasoning as
    // joinEvent's capacity check.
    const nextWaitlistSnap = !occurrenceDate ? await tx.get(eventRef.collection('waitlist').orderBy('joinedAt', 'asc').limit(1)) : null;
    const promoted = nextWaitlistSnap && !nextWaitlistSnap.empty ? nextWaitlistSnap.docs[0] : null;

    tx.delete(attendeeRef);
    if (!occurrenceDate) {
      if (promoted) {
        // Net attendeeCount is unchanged — one leaves, one is promoted in — so only the outright
        // decrement below needs an explicit counter write.
        tx.delete(promoted.ref);
        tx.set(eventRef.collection('attendees').doc(promoted.id), {
          uid: promoted.data().uid,
          occurrenceDate: null,
          joinedAt: promoted.data().joinedAt,
        });
      } else {
        tx.set(eventRef, { attendeeCount: FieldValue.increment(-1) }, { merge: true });
      }
    }
  });

  return { joined: false };
});

/** Admin-only hard delete of an event and its attendees/waitlist/photos/updates subcollections —
 * same reasoning and admin tier as deleteClubChallenge above (Admin-SDK-only, full-admin-only,
 * firestore.rules' clubs/{clubId}/events/{eventId} `allow write: if false` stays unchanged). */
exports.deleteClubEvent = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const eventId = String(request.data?.eventId || '');
  if (!clubId || !eventId) throw new HttpsError('invalid-argument', 'clubId and eventId are required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const eventRef = clubRef.collection('events').doc(eventId);

  const clubDoc = await clubRef.get();
  if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
  if (!isClubAdmin(clubDoc.data(), uid)) {
    throw new HttpsError('permission-denied', 'Only a club admin can delete an event.');
  }

  await deleteCollectionInBatches(eventRef.collection('attendees'));
  await deleteCollectionInBatches(eventRef.collection('waitlist'));
  await deleteCollectionInBatches(eventRef.collection('photos'));
  await deleteCollectionInBatches(eventRef.collection('updates'));
  await eventRef.delete();

  return { deleted: true };
});

/** Pages through every follower of `authorUid`, batching `handler` calls in groups of up to 300
 * (well under Firestore's 500-op batch cap) so a single popular account's fan-out doesn't need
 * special-casing. Cursor-paginated (not `deleteCollectionInBatches`'s re-query-from-start trick)
 * since this only writes/deletes OTHER documents (each follower's feed entry) — the `follows`
 * page being iterated never shrinks as a side effect the way a delete-in-place query does. */
async function forEachFollowerBatch(authorUid, handler) {
  const pageSize = 300;
  let cursor = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db.collection('follows').where('followedUid', '==', authorUid).orderBy('__name__').limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => handler(batch, doc.data().followerUid));
    await batch.commit();
    if (snapshot.size < pageSize) return;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

// Soft, advisory rate-limit counters on `users/{uid}` — usePostComposer.ts/useComments.ts read
// these fields back and refuse to submit client-side once a window's count reaches its cap (kept
// in sync with POST_RATE_LIMIT_MAX/COMMENT_RATE_LIMIT_MAX there). This is NOT an enforcement
// boundary: a modified client can always skip the check and write directly (Firestore rules can't
// cheaply express "how many did this uid create in the last N minutes" — that needs a query the
// rules engine can't run against `request.resource`), and moving posts/comments off direct client
// writes onto a callable wrapper is a much larger change to two working, frequently-used flows.
// This only stops accidental bursts (a double-tap, a retry loop, a client bug), not a deliberately
// malicious client — see firestore.rules' own `posts`/`comments` create rules for the actual
// (unchanged) trust boundary.
const POST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const COMMENT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

async function bumpRateLimitWindow(uid, field, windowMs) {
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data()?.[field];
    const windowStartMs = existing?.windowStart?.toMillis?.() ?? 0;
    const stillInWindow = Date.now() - windowStartMs < windowMs;
    tx.set(
      ref,
      { [field]: { windowStart: stillInWindow ? existing.windowStart : Timestamp.now(), count: stillInWindow ? (existing.count ?? 0) + 1 : 1 } },
      { merge: true }
    );
  });
}

exports.onPostCreated = onDocumentCreated({ document: 'posts/{postId}', region: 'us-central1' }, async (event) => {
  const post = event.data?.data();
  if (!post) return;
  const postId = event.params.postId;

  await bumpRateLimitWindow(post.authorUid, 'postRateLimit', POST_RATE_LIMIT_WINDOW_MS);

  await forEachFollowerBatch(post.authorUid, (batch, followerUid) => {
    const feedRef = db.collection('users').doc(followerUid).collection('feed').doc(postId);
    batch.set(feedRef, {
      postId,
      authorUid: post.authorUid,
      authorUsernameLower: post.authorUsernameLower ?? '',
      authorAvatarUrl: post.authorAvatarUrl ?? null,
      type: post.type,
      card: post.card ?? null,
      photoUrl: post.photoUrl ?? null,
      photoUrls: post.photoUrls ?? null,
      caption: post.caption ?? null,
      createdAt: post.createdAt,
    });
  });

  await db.collection('userPublicProfiles').doc(post.authorUid).set({ postCount: FieldValue.increment(1) }, { merge: true });
});

exports.onPostDeleted = onDocumentDeleted({ document: 'posts/{postId}', region: 'us-central1' }, async (event) => {
  const post = event.data?.data();
  if (!post) return;
  const postId = event.params.postId;
  const postRef = db.collection('posts').doc(postId);

  await forEachFollowerBatch(post.authorUid, (batch, followerUid) => {
    batch.delete(db.collection('users').doc(followerUid).collection('feed').doc(postId));
  });

  // Deleting a document never deletes its subcollections on its own — without
  // this, every deleted post would leave its likes/comments permanently orphaned in Firestore.
  await deleteCollectionInBatches(postRef.collection('likes'));
  await deleteCollectionInBatches(postRef.collection('comments'));

  await db.collection('userPublicProfiles').doc(post.authorUid).set({ postCount: FieldValue.increment(-1) }, { merge: true });
});

// Likes/comments maintain a denormalized count on the parent `posts/{postId}` doc — the same
// "counter lives on the doc it describes, updated only by a trigger" shape as postCount above.
// The client writes the like/comment doc directly (firestore.rules scopes that to the caller's
// own uid/authorUid), then these triggers do the count update the client isn't trusted to do
// itself (incrementing a field on a doc it doesn't own — the post belongs to a different user).
exports.onLikeCreated = onDocumentCreated(
  { document: 'posts/{postId}/likes/{likerUid}', region: 'us-central1' },
  async (event) => {
    // firestore.rules requires the post to exist() at the moment the like doc is created, but
    // the post can still be deleted between then and this trigger running (real eventual-
    // consistency ordering, not just a defensive nicety) — guard the same way onLikeDeleted does,
    // so a late-arriving trigger can't resurrect a "zombie" posts/{postId} doc via
    // set(...,{merge:true}) on one that no longer exists.
    const { postId, likerUid } = event.params;
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return;
    await postRef.set({ likeCount: FieldValue.increment(1) }, { merge: true });
    // Reverse-index under the liker's own tree so useLikedPosts can list "posts I've liked" with
    // a plain collection(users/{uid}/likedPosts) read instead of a collectionGroup('likes') scan
    // across every post — same fan-out-on-write shape as the users/{uid}/feed subcollection.
    await db.collection('users').doc(likerUid).collection('likedPosts').doc(postId).set({ createdAt: FieldValue.serverTimestamp() });
    await notify(postSnap.data().authorUid, likerUid, { type: 'like', postId });
  }
);

exports.onLikeDeleted = onDocumentDeleted(
  { document: 'posts/{postId}/likes/{likerUid}', region: 'us-central1' },
  async (event) => {
    // Guard against the post itself having just been deleted (onPostDeleted clears its
    // likes/comments subcollections, which fires this trigger for each one) — without this
    // check, `.set(..., {merge:true})` on an already-deleted doc would silently recreate it as a
    // zombie doc holding only a negative likeCount.
    const { postId, likerUid } = event.params;
    const postRef = db.collection('posts').doc(postId);
    await db.collection('users').doc(likerUid).collection('likedPosts').doc(postId).delete();
    if (!(await postRef.get()).exists) return;
    await postRef.set({ likeCount: FieldValue.increment(-1) }, { merge: true });
  }
);

exports.onCommentCreated = onDocumentCreated(
  { document: 'posts/{postId}/comments/{commentId}', region: 'us-central1' },
  async (event) => {
    // Same late-deletion guard as onLikeCreated above.
    const { postId, commentId } = event.params;
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return;
    await postRef.set({ commentCount: FieldValue.increment(1) }, { merge: true });
    const commentAuthorUid = event.data.data().authorUid;
    await bumpRateLimitWindow(commentAuthorUid, 'commentRateLimit', COMMENT_RATE_LIMIT_WINDOW_MS);
    await notify(postSnap.data().authorUid, commentAuthorUid, { type: 'comment', postId, commentId });
  }
);

exports.onCommentDeleted = onDocumentDeleted(
  { document: 'posts/{postId}/comments/{commentId}', region: 'us-central1' },
  async (event) => {
    // Same zombie-doc guard as onLikeDeleted above.
    const postRef = db.collection('posts').doc(event.params.postId);
    if (!(await postRef.get()).exists) return;
    await postRef.set({ commentCount: FieldValue.increment(-1) }, { merge: true });
  }
);

// ---------------------------------------------------------------------------------------------
// getAdminAnalytics — developer-only usage dashboard (app/admin-analytics.tsx). There's no
// existing admin/owner-uid concept anywhere in this codebase (club `admins` arrays are per-club,
// not app-wide) — this is the first one, and it's deliberately an email check rather than a uid
// check: a uid would need to be looked up out-of-band and hardcoded, where the developer's own
// login email is already known and just as unforgeable a signal (Firebase Auth's own token, not
// anything client-supplied). Keep this in sync BY HAND with modules/admin/adminUids.ts's
// ADMIN_EMAIL — that file gates the screen client-side (UX only), this is the actual boundary,
// and the two can't share code since functions/ has no build step wiring it to the app's modules.
// ---------------------------------------------------------------------------------------------

const ADMIN_EMAIL = 'prasanth.j@aica.cloud';

const ACTIVE_7D_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_30D_MS = 30 * 24 * 60 * 60 * 1000;

/** "Last active" proxy: there's no lastSeenAt/presence doc anywhere in this schema (checked —
 * userPublicProfiles only holds cumulative counters like cardioLogCount/postCount, no recency),
 * and count() can't express "distinct uid" anyway. The closest real signal is the sync engine's
 * own updatedAt bookkeeping on users/{uid}/records/{syncId} (see modules/sync/syncEngine.ts) —
 * every local write bumps it. This reads matching doc refs across ALL users via a collectionGroup
 * query and dedupes by the uid segment of each ref's path (ref.parent.parent is the users/{uid}
 * doc). Needs a COLLECTION_GROUP index on records.updatedAt — see firestore.indexes.json — since
 * collection-group range queries aren't auto-indexed the way single-collection ones are. Reads
 * scale with matching row count, not user count, so this is a real cost at large scale — fine for
 * a developer-only dashboard on this app's current size, worth revisiting if that changes. */
async function distinctActiveUserCount(sinceMs) {
  const cutoffIso = new Date(sinceMs).toISOString();
  const snap = await db.collectionGroup('records').where('updatedAt', '>=', cutoffIso).get();
  const uids = new Set();
  snap.docs.forEach((doc) => uids.add(doc.ref.parent.parent.id));
  return uids.size;
}

exports.getAdminAnalytics = onCall({ region: 'us-central1' }, async (request) => {
  if (request.auth?.token?.email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Developer-only.');
  }

  const [
    totalUsersSnap,
    premiumUsersSnap,
    trialGrantedSnap,
    active7d,
    active30d,
    totalClubsSnap,
    clubMembershipsSnap,
    totalChallengesSnap,
    challengeParticipantsSnap,
    totalEventsSnap,
    eventAttendeesSnap,
  ] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('users').where('premium', '==', true).count().get(),
    // trialEndsAt is only ever set as a millisecond epoch number (see startTrialIfEligible) — this
    // counts everyone who has EVER been granted a trial, active or expired; there's no way to also
    // filter "still active" here without a second range field, which would need a composite index
    // this app doesn't have (premium==false AND trialEndsAt>now is two different fields).
    db.collection('users').where('trialEndsAt', '>', 0).count().get(),
    distinctActiveUserCount(Date.now() - ACTIVE_7D_MS),
    distinctActiveUserCount(Date.now() - ACTIVE_30D_MS),
    db.collection('clubs').count().get(),
    db.collectionGroup('members').count().get(),
    db.collectionGroup('challenges').count().get(),
    db.collectionGroup('participants').count().get(),
    db.collectionGroup('events').count().get(),
    db.collectionGroup('attendees').count().get(),
  ]);

  return {
    users: {
      total: totalUsersSnap.data().count,
      active7d,
      active30d,
    },
    premium: {
      premiumCount: premiumUsersSnap.data().count,
      trialGrantedCount: trialGrantedSnap.data().count,
    },
    clubs: {
      totalClubs: totalClubsSnap.data().count,
      totalMemberships: clubMembershipsSnap.data().count,
      totalChallenges: totalChallengesSnap.data().count,
      totalChallengeParticipants: challengeParticipantsSnap.data().count,
      totalEvents: totalEventsSnap.data().count,
      totalEventAttendees: eventAttendeesSnap.data().count,
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Club Habits & Tasks (v1): a shared, club-scoped version of the personal habits/tasks modules
// (modules/habits, modules/tasks) — same daily/weekly recurrence + streak-style "who did what on
// which day" shape, but Firestore-backed instead of the personal SQLite tables since this is
// cross-user state. Any existing member may create a club habit/task (same permission level as
// createChallenge/createEvent above); only the creator or a club admin/sub-admin may delete one.
//
// A club habit's "done today" state is tracked per-member in a `checkins/{uid}_{dateKey}`
// subcollection — same uid_dateKey doc-id shape as clubs/{clubId}/events/{eventId}/attendees for a
// recurring event occurrence — rather than an embedded map on the habit doc, so N members
// checking in on the same day never contend on one document. A club task reuses the exact same
// `checkins` subcollection when it's recurring (recurrence != null); a one-off task (recurrence
// null) instead uses simple completed/completedBy/completedAt fields on the task doc itself, since
// there's only ever one completion to represent, not one per day.
// ---------------------------------------------------------------------------------------------

const CLUB_HABIT_RECURRENCES = ['daily', 'weekly'];
const CLUB_TASK_RECURRENCES = ['daily', 'weekly'];

function assertClubMember(club, memberDoc, clubId) {
  if (!club) throw new HttpsError('not-found', 'That club does not exist.');
  if (!memberDoc.exists) throw new HttpsError('permission-denied', 'Join the club before using its shared habits/tasks.');
}

function canModerate(club, uid) {
  return isClubAdmin(club, uid) || (club.subAdmins || []).includes(uid);
}

exports.createClubHabit = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');
  const title = String(request.data?.title || '').trim().slice(0, 80);
  if (!title) throw new HttpsError('invalid-argument', 'A habit title is required.');
  const recurrence = CLUB_HABIT_RECURRENCES.includes(request.data?.recurrence) ? request.data.recurrence : 'daily';
  // Only meaningful for recurrence 'weekly' — 0=Sun..6=Sat, same convention as
  // modules/habits/types.ts's target_days for a weekly personal habit.
  const targetDays = Array.isArray(request.data?.targetDays)
    ? request.data.targetDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7)
    : [];

  const clubRef = db.collection('clubs').doc(clubId);
  const habitRef = clubRef.collection('habits').doc();

  await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc] = await Promise.all([tx.get(clubRef), tx.get(clubRef.collection('members').doc(uid))]);
    const club = clubDoc.exists ? clubDoc.data() : null;
    assertClubMember(club, memberDoc, clubId);
    // Admin/sub-admin only — same canModerate() tier already used just below by deleteClubHabit
    // for managing a single club habit (not the narrower full-admin-only tier reserved for
    // deleteClubEvent/deleteClubChallenge's bigger, whole-container deletions). A sub-admin who
    // can already delete any member's habit should be able to create one too.
    if (!canModerate(club, uid)) {
      throw new HttpsError('permission-denied', 'Only a club admin can create a club habit.');
    }

    tx.set(habitRef, {
      title,
      recurrence,
      targetDays: recurrence === 'weekly' ? targetDays : [],
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { habitId: habitRef.id };
});

/** Toggles the signed-in member's own checkin for `dateKey` (defaults to today, but the client may
 * pass any past date to log a missed day — same "log past entry" allowance as the personal habit
 * module's LogPastEntryModal). A member can only ever toggle their OWN checkin, never anyone
 * else's — the doc id embeds `uid` from `request.auth`, not from client input. */
exports.toggleClubHabitCheckin = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const habitId = String(request.data?.habitId || '');
  if (!clubId || !habitId) throw new HttpsError('invalid-argument', 'clubId and habitId are required.');
  const dateKey = String(request.data?.dateKey || new Date().toISOString().slice(0, 10));

  const clubRef = db.collection('clubs').doc(clubId);
  const habitRef = clubRef.collection('habits').doc(habitId);
  const checkinRef = habitRef.collection('checkins').doc(`${uid}_${dateKey}`);

  const result = await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc, habitDoc, checkinDoc] = await Promise.all([
      tx.get(clubRef),
      tx.get(clubRef.collection('members').doc(uid)),
      tx.get(habitRef),
      tx.get(checkinRef),
    ]);
    assertClubMember(clubDoc.exists ? clubDoc.data() : null, memberDoc, clubId);
    if (!habitDoc.exists) throw new HttpsError('not-found', 'That club habit does not exist.');

    if (checkinDoc.exists) {
      tx.delete(checkinRef);
      return { checked: false };
    }
    tx.set(checkinRef, { uid, dateKey, checkedAt: FieldValue.serverTimestamp() });
    return { checked: true };
  });

  return result;
});

/** Only the creator or a club admin/sub-admin may delete a club habit — same moderation tier as
 * deleting a club update/message (see firestore.rules). The `checkins` subcollection is left
 * orphaned rather than recursively deleted (Admin SDK writes here are single-document, same as
 * every other club callable above; a stray orphaned subcollection under a deleted parent doc is
 * simply unreachable from any client query, not a correctness problem). */
exports.deleteClubHabit = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const habitId = String(request.data?.habitId || '');
  if (!clubId || !habitId) throw new HttpsError('invalid-argument', 'clubId and habitId are required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const habitRef = clubRef.collection('habits').doc(habitId);

  await db.runTransaction(async (tx) => {
    const [clubDoc, habitDoc] = await Promise.all([tx.get(clubRef), tx.get(habitRef)]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    if (!habitDoc.exists) return; // Already gone — idempotent no-op.
    const club = clubDoc.data();
    if (habitDoc.data().createdBy !== uid && !canModerate(club, uid)) {
      throw new HttpsError('permission-denied', 'Only the creator or a club admin can delete this habit.');
    }
    tx.delete(habitRef);
  });

  return { deleted: true };
});

exports.createClubTask = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');
  const title = String(request.data?.title || '').trim().slice(0, 80);
  if (!title) throw new HttpsError('invalid-argument', 'A task title is required.');
  const assignedTo = request.data?.assignedTo ? String(request.data.assignedTo) : null;
  const dueDate = request.data?.dueDate ? String(request.data.dueDate) : null;
  const recurrence = CLUB_TASK_RECURRENCES.includes(request.data?.recurrence) ? request.data.recurrence : null;
  const recurrenceDays = Array.isArray(request.data?.recurrenceDays)
    ? request.data.recurrenceDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7)
    : [];

  const clubRef = db.collection('clubs').doc(clubId);
  const taskRef = clubRef.collection('tasks').doc();

  await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc, assigneeMemberDoc] = await Promise.all([
      tx.get(clubRef),
      tx.get(clubRef.collection('members').doc(uid)),
      assignedTo ? tx.get(clubRef.collection('members').doc(assignedTo)) : Promise.resolve(null),
    ]);
    const club = clubDoc.exists ? clubDoc.data() : null;
    assertClubMember(club, memberDoc, clubId);
    // Admin/sub-admin only — same canModerate() tier deleteClubTask uses below (see
    // createClubHabit's identical comment for the reasoning).
    if (!canModerate(club, uid)) {
      throw new HttpsError('permission-denied', 'Only a club admin can create a club task.');
    }
    if (assignedTo && !assigneeMemberDoc.exists) {
      throw new HttpsError('invalid-argument', 'assignedTo must be an existing member of this club.');
    }

    tx.set(taskRef, {
      title,
      assignedTo,
      dueDate,
      recurrence,
      recurrenceDays: recurrence === 'weekly' ? recurrenceDays : [],
      // Only meaningful when recurrence is null — a recurring task's per-day state lives entirely
      // in the `checkins` subcollection instead (see toggleClubTaskComplete).
      completed: false,
      completedBy: null,
      completedAt: null,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { taskId: taskRef.id };
});

/** For a one-off task (recurrence null), flips the shared completed/completedBy/completedAt
 * fields — anyone may complete an unassigned task, but only the assignee (or an admin/sub-admin)
 * may complete an assigned one, and only whoever completed it (or an admin/sub-admin) may undo it.
 * For a recurring task, mirrors toggleClubHabitCheckin exactly: toggles the caller's own
 * `checkins/{uid}_{dateKey}` doc, no assignment gating (a recurring club task is a shared habit in
 * every sense except name — every member tracks their own completion). */
exports.toggleClubTaskComplete = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const taskId = String(request.data?.taskId || '');
  if (!clubId || !taskId) throw new HttpsError('invalid-argument', 'clubId and taskId are required.');
  const dateKey = String(request.data?.dateKey || new Date().toISOString().slice(0, 10));

  const clubRef = db.collection('clubs').doc(clubId);
  const taskRef = clubRef.collection('tasks').doc(taskId);

  const result = await db.runTransaction(async (tx) => {
    const [clubDoc, memberDoc, taskDoc] = await Promise.all([
      tx.get(clubRef),
      tx.get(clubRef.collection('members').doc(uid)),
      tx.get(taskRef),
    ]);
    const club = clubDoc.exists ? clubDoc.data() : null;
    assertClubMember(club, memberDoc, clubId);
    if (!taskDoc.exists) throw new HttpsError('not-found', 'That club task does not exist.');
    const task = taskDoc.data();

    if (task.recurrence) {
      const checkinRef = taskRef.collection('checkins').doc(`${uid}_${dateKey}`);
      const checkinDoc = await tx.get(checkinRef);
      if (checkinDoc.exists) {
        tx.delete(checkinRef);
        return { completed: false };
      }
      tx.set(checkinRef, { uid, dateKey, checkedAt: FieldValue.serverTimestamp() });
      return { completed: true };
    }

    if (task.completed) {
      if (task.completedBy !== uid && !canModerate(club, uid)) {
        throw new HttpsError('permission-denied', 'Only whoever completed this task (or a club admin) can undo it.');
      }
      tx.set(taskRef, { completed: false, completedBy: null, completedAt: null }, { merge: true });
      return { completed: false };
    }

    if (task.assignedTo && task.assignedTo !== uid && !canModerate(club, uid)) {
      throw new HttpsError('permission-denied', 'Only the assignee (or a club admin) can complete this task.');
    }
    tx.set(taskRef, { completed: true, completedBy: uid, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { completed: true };
  });

  return result;
});

/** Only the creator or a club admin/sub-admin may delete a club task — same moderation tier as
 * deleteClubHabit above. */
exports.deleteClubTask = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  const taskId = String(request.data?.taskId || '');
  if (!clubId || !taskId) throw new HttpsError('invalid-argument', 'clubId and taskId are required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const taskRef = clubRef.collection('tasks').doc(taskId);

  await db.runTransaction(async (tx) => {
    const [clubDoc, taskDoc] = await Promise.all([tx.get(clubRef), tx.get(taskRef)]);
    if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
    if (!taskDoc.exists) return; // Already gone — idempotent no-op.
    const club = clubDoc.data();
    if (taskDoc.data().createdBy !== uid && !canModerate(club, uid)) {
      throw new HttpsError('permission-denied', 'Only the creator or a club admin can delete this task.');
    }
    tx.delete(taskRef);
  });

  return { deleted: true };
});

/** Hard delete of an entire club and everything in it — the single most destructive club action
 * this app has, so it's gated STRICTER than deleteClubEvent/deleteClubChallenge: those already
 * require full-admin (not just canModerate's admin-or-sub-admin tier), and this reuses that exact
 * same `admins` array check (there's no tier above full-admin to escalate to here — matching, not
 * loosening, is the right call). Cascades through every subcollection this feature set has grown:
 * members, invites, chat messages, each challenge's participants/updates, each event's
 * attendees/waitlist/photos/updates, each habit's checkins, each task's checkins — then the
 * habit/task/challenge/event docs themselves, and finally the club doc. Sequential rather than
 * parallel across containers (unlike deleteAccount's fan-out) since a club's per-container counts
 * are expected to stay small; nothing
 * here needs to be transactional since a partial failure just leaves remaining subcollections to
 * clean up on a retry (the client surfaces the error and the admin can try again). */
exports.deleteClub = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const clubId = String(request.data?.clubId || '');
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId is required.');

  const clubRef = db.collection('clubs').doc(clubId);
  const clubDoc = await clubRef.get();
  if (!clubDoc.exists) throw new HttpsError('not-found', 'That club does not exist.');
  if (!isClubAdmin(clubDoc.data(), uid)) {
    throw new HttpsError('permission-denied', 'Only a club admin can delete the club.');
  }

  const [challengesSnap, eventsSnap, habitsSnap, tasksSnap] = await Promise.all([
    clubRef.collection('challenges').get(),
    clubRef.collection('events').get(),
    clubRef.collection('habits').get(),
    clubRef.collection('tasks').get(),
  ]);

  for (const challengeDoc of challengesSnap.docs) {
    await deleteCollectionInBatches(challengeDoc.ref.collection('participants'));
    await deleteCollectionInBatches(challengeDoc.ref.collection('updates'));
    await challengeDoc.ref.delete();
  }

  for (const eventDoc of eventsSnap.docs) {
    await deleteCollectionInBatches(eventDoc.ref.collection('attendees'));
    await deleteCollectionInBatches(eventDoc.ref.collection('waitlist'));
    await deleteCollectionInBatches(eventDoc.ref.collection('photos'));
    await deleteCollectionInBatches(eventDoc.ref.collection('updates'));
    await eventDoc.ref.delete();
  }

  for (const habitDoc of habitsSnap.docs) {
    await deleteCollectionInBatches(habitDoc.ref.collection('checkins'));
    await habitDoc.ref.delete();
  }

  for (const taskDoc of tasksSnap.docs) {
    await deleteCollectionInBatches(taskDoc.ref.collection('checkins'));
    await taskDoc.ref.delete();
  }

  await deleteCollectionInBatches(clubRef.collection('messages'));
  await deleteCollectionInBatches(clubRef.collection('invites'));
  await deleteCollectionInBatches(clubRef.collection('members'));
  await clubRef.delete();

  return { deleted: true };
});
