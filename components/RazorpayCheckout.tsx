import { Modal, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useAppTheme } from '@/theme';
import { Button } from './Button';

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

/** Razorpay's native React Native SDK doesn't support Expo/EAS builds (no config plugin, breaks
 * on the new architecture) — Razorpay's own docs recommend this exact approach instead: load
 * Standard Checkout (checkout.js) in a WebView and relay its callbacks back to RN via
 * postMessage. `orderId`/`keyId` must come from a server call (never generate an order or hold
 * the key secret client-side) — see functions/index.js's `createOrder`. */
export function RazorpayCheckout({ visible, orderId, keyId, amountPaise, name, description, prefillEmail, onSuccess, onDismiss, onError }: Props) {
  const theme = useAppTheme();

  const html = buildCheckoutHtml({
    keyId,
    amountPaise,
    name,
    description,
    orderId,
    prefillEmail,
    themeColor: theme.colors.primary,
  });

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

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, textAlign: 'center' }}>
            Premium purchases are only available in the Android app right now.
          </Text>
          <Button label="Close" variant="secondary" onPress={onDismiss} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
        <WebView originWhitelist={['*']} source={{ html }} onMessage={onMessage} style={{ flex: 1 }} />
      </SafeAreaView>
    </Modal>
  );
}

function buildCheckoutHtml(options: {
  keyId: string;
  amountPaise: number;
  name: string;
  description: string;
  orderId: string;
  prefillEmail?: string;
  themeColor: string;
}): string {
  const config = {
    key: options.keyId,
    amount: options.amountPaise,
    currency: 'INR',
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: { email: options.prefillEmail ?? '' },
    theme: { color: options.themeColor },
  };

  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
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
