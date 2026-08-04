import { useEffect, useRef } from 'react';
import { Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useAppTheme } from '@/theme';

export type RazorpayResult = { paymentId: string; orderId?: string; subscriptionId?: string; signature: string };

/** Exactly one of orderId (one-time) / subscriptionId (recurring) must be set — Razorpay Checkout
 * takes either `order_id` or `subscription_id`, never both. */
type Props = {
  visible: boolean;
  orderId?: string;
  subscriptionId?: string;
  keyId: string;
  amountPaise?: number;
  name: string;
  description: string;
  prefillEmail?: string;
  onSuccess: (result: RazorpayResult) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
};

type RazorpayCheckoutConfig = {
  key: string;
  amount?: number;
  currency?: 'INR';
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  prefill: { email: string };
  theme: { color: string };
};

function buildConfig(options: {
  keyId: string;
  amountPaise?: number;
  name: string;
  description: string;
  orderId?: string;
  subscriptionId?: string;
  prefillEmail?: string;
  themeColor: string;
}): RazorpayCheckoutConfig {
  return {
    key: options.keyId,
    ...(options.subscriptionId
      ? { subscription_id: options.subscriptionId }
      : { order_id: options.orderId, amount: options.amountPaise, currency: 'INR' as const }),
    name: options.name,
    description: options.description,
    prefill: { email: options.prefillEmail ?? '' },
    theme: { color: options.themeColor },
  };
}

/** Razorpay's native React Native SDK doesn't support Expo/EAS builds (no config plugin, breaks
 * on the new architecture) — Razorpay's own docs recommend this exact approach instead: load
 * Standard Checkout (checkout.js) in a WebView and relay its callbacks back to RN via
 * postMessage. On web there's no WebView to relay through — checkout.js runs directly in the
 * same page, so its callbacks call straight back into React state, no postMessage needed.
 * `orderId`/`subscriptionId`/`keyId` must come from a server call either way (never generate an
 * order/subscription or hold the key secret client-side) — see functions/index.js. */
export function RazorpayCheckout({
  visible,
  orderId,
  subscriptionId,
  keyId,
  amountPaise,
  name,
  description,
  prefillEmail,
  onSuccess,
  onDismiss,
  onError,
}: Props) {
  const theme = useAppTheme();

  if (Platform.OS === 'web') {
    return (
      <WebRazorpayCheckout
        visible={visible}
        orderId={orderId}
        subscriptionId={subscriptionId}
        keyId={keyId}
        amountPaise={amountPaise}
        name={name}
        description={description}
        prefillEmail={prefillEmail}
        themeColor={theme.colors.primary}
        onSuccess={onSuccess}
        onDismiss={onDismiss}
        onError={onError}
      />
    );
  }

  const html = buildCheckoutHtml(
    buildConfig({ keyId, amountPaise, name, description, orderId, subscriptionId, prefillEmail, themeColor: theme.colors.primary })
  );

  const onMessage = (event: WebViewMessageEvent) => {
    let data: { status?: string; paymentId?: string; orderId?: string; subscriptionId?: string; signature?: string; error?: string };
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      onError('Something went wrong with the payment.');
      return;
    }

    if (data.status === 'success' && data.paymentId && data.signature && (data.orderId || data.subscriptionId)) {
      onSuccess({ paymentId: data.paymentId, orderId: data.orderId, subscriptionId: data.subscriptionId, signature: data.signature });
    } else if (data.status === 'dismissed') {
      onDismiss();
    } else {
      onError(data.error ?? 'Payment failed.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
        <WebView originWhitelist={['*']} source={{ html }} onMessage={onMessage} style={{ flex: 1 }} />
      </SafeAreaView>
    </Modal>
  );
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('load-failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('load-failed'));
    document.head.appendChild(script);
  });
}

/** No RN UI of its own on web — checkout.js manages its own full-screen overlay directly in the
 * DOM once opened, so this just triggers that (and reports back) rather than wrapping it in
 * anything. */
function WebRazorpayCheckout({
  visible,
  orderId,
  subscriptionId,
  keyId,
  amountPaise,
  name,
  description,
  prefillEmail,
  themeColor,
  onSuccess,
  onDismiss,
  onError,
}: {
  visible: boolean;
  orderId?: string;
  subscriptionId?: string;
  keyId: string;
  amountPaise?: number;
  name: string;
  description: string;
  prefillEmail?: string;
  themeColor: string;
  onSuccess: (result: RazorpayResult) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}) {
  const openedForId = useRef<string | null>(null);
  const identity = orderId ?? subscriptionId ?? null;

  useEffect(() => {
    if (!visible || !identity || openedForId.current === identity) return;
    openedForId.current = identity;

    loadRazorpayScript()
      .then(() => {
        const config = buildConfig({ keyId, amountPaise, name, description, orderId, subscriptionId, prefillEmail, themeColor });
        type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: unknown) => void) => void };
        type RazorpayConstructor = new (options: RazorpayCheckoutConfig & Record<string, unknown>) => RazorpayInstance;
        const RazorpayCtor = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

        const rzp = new RazorpayCtor({
          ...config,
          handler: (response: unknown) => {
            const r = response as { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_subscription_id?: string; razorpay_signature: string };
            onSuccess({ paymentId: r.razorpay_payment_id, orderId: r.razorpay_order_id, subscriptionId: r.razorpay_subscription_id, signature: r.razorpay_signature });
          },
          modal: { ondismiss: onDismiss },
        });
        rzp.on('payment.failed', (response: unknown) => {
          const r = response as { error?: { description?: string } };
          onError(r?.error?.description ?? 'Payment failed.');
        });
        rzp.open();
      })
      .catch(() => onError('Could not load the payment form — check your connection and try again.'));
  }, [visible, identity, orderId, subscriptionId, keyId, amountPaise, name, description, prefillEmail, themeColor, onSuccess, onDismiss, onError]);

  return null;
}

function buildCheckoutHtml(config: RazorpayCheckoutConfig): string {
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;">
<script src="${RAZORPAY_SCRIPT_SRC}"></script>
<script>
  function post(payload) { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
  var rzp = new Razorpay(Object.assign(${JSON.stringify(config)}, {
    handler: function (response) {
      post({ status: 'success', paymentId: response.razorpay_payment_id, orderId: response.razorpay_order_id, subscriptionId: response.razorpay_subscription_id, signature: response.razorpay_signature });
    },
    modal: { ondismiss: function () { post({ status: 'dismissed' }); } }
  }));
  rzp.on('payment.failed', function (response) {
    post({ status: 'failed', error: (response && response.error && response.error.description) || 'Payment failed' });
  });
  rzp.open();
</script>
</body>
</html>`;
}
