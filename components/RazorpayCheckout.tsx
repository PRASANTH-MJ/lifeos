import { useEffect, useRef } from 'react';
import { Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useAppTheme } from '@/theme';

export type RazorpayResult = { paymentId: string; orderId: string; signature: string };

type Props = {
  visible: boolean;
  orderId: string;
  keyId: string;
  amountPaise: number;
  name: string;
  description: string;
  prefillEmail?: string;
  onSuccess: (result: RazorpayResult) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
};

type RazorpayCheckoutConfig = {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  order_id: string;
  prefill: { email: string };
  theme: { color: string };
};

function buildConfig(options: {
  keyId: string;
  amountPaise: number;
  name: string;
  description: string;
  orderId: string;
  prefillEmail?: string;
  themeColor: string;
}): RazorpayCheckoutConfig {
  return {
    key: options.keyId,
    amount: options.amountPaise,
    currency: 'INR',
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: { email: options.prefillEmail ?? '' },
    theme: { color: options.themeColor },
  };
}

/** Razorpay's native React Native SDK doesn't support Expo/EAS builds (no config plugin, breaks
 * on the new architecture) — Razorpay's own docs recommend this exact approach instead: load
 * Standard Checkout (checkout.js) in a WebView and relay its callbacks back to RN via
 * postMessage. On web there's no WebView to relay through — checkout.js runs directly in the
 * same page, so its callbacks call straight back into React state, no postMessage needed.
 * `orderId`/`keyId` must come from a server call either way (never generate an order or hold the
 * key secret client-side) — see functions/index.js's `createOrder`. */
export function RazorpayCheckout({ visible, orderId, keyId, amountPaise, name, description, prefillEmail, onSuccess, onDismiss, onError }: Props) {
  const theme = useAppTheme();

  if (Platform.OS === 'web') {
    return (
      <WebRazorpayCheckout
        visible={visible}
        orderId={orderId}
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

  const html = buildCheckoutHtml(buildConfig({ keyId, amountPaise, name, description, orderId, prefillEmail, themeColor: theme.colors.primary }));

  const onMessage = (event: WebViewMessageEvent) => {
    let data: { status?: string; paymentId?: string; orderId?: string; signature?: string; error?: string };
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      onError('Something went wrong with the payment.');
      return;
    }

    if (data.status === 'success' && data.paymentId && data.orderId && data.signature) {
      onSuccess({ paymentId: data.paymentId, orderId: data.orderId, signature: data.signature });
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
  orderId: string;
  keyId: string;
  amountPaise: number;
  name: string;
  description: string;
  prefillEmail?: string;
  themeColor: string;
  onSuccess: (result: RazorpayResult) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}) {
  const openedForOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || openedForOrderId.current === orderId) return;
    openedForOrderId.current = orderId;

    loadRazorpayScript()
      .then(() => {
        const config = buildConfig({ keyId, amountPaise, name, description, orderId, prefillEmail, themeColor });
        type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: unknown) => void) => void };
        type RazorpayConstructor = new (options: RazorpayCheckoutConfig & Record<string, unknown>) => RazorpayInstance;
        const RazorpayCtor = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

        const rzp = new RazorpayCtor({
          ...config,
          handler: (response: unknown) => {
            const r = response as { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
            onSuccess({ paymentId: r.razorpay_payment_id, orderId: r.razorpay_order_id, signature: r.razorpay_signature });
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
  }, [visible, orderId, keyId, amountPaise, name, description, prefillEmail, themeColor, onSuccess, onDismiss, onError]);

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
      post({ status: 'success', paymentId: response.razorpay_payment_id, orderId: response.razorpay_order_id, signature: response.razorpay_signature });
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
