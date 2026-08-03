import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, RazorpayCheckout, ScreenContainer } from '@/components';
import { useAuth } from '@/modules/auth';
import { createPremiumOrder, FREE_LIMITS, PREMIUM_PRICE_INR, usePremium, verifyPremiumPayment, type CreateOrderResult } from '@/modules/premium';
import { useAppTheme } from '@/theme';

const BENEFITS = [
  `Unlimited habits (free plan: ${FREE_LIMITS.habits})`,
  `Unlimited recurring tasks (free plan: ${FREE_LIMITS.recurringTasks})`,
  `Unlimited finance accounts (free plan: ${FREE_LIMITS.financeAccounts})`,
];

export default function PremiumScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { premium } = usePremium();
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onBuy = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await createPremiumOrder();
      setOrder(result);
    } catch {
      setError('Could not start checkout — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (premium || success) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
          <Text style={{ fontSize: 48 }}>✓</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            You're on Premium
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            Thanks for supporting LifeOS — every limit is lifted, for good.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
          LifeOS Premium
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base }}>
          One payment. No subscription. Yours for life.
        </Text>

        <View style={{ gap: theme.spacing.sm }}>
          {BENEFITS.map((benefit) => (
            <View key={benefit} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.primary }}>✓</Text>
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{benefit}</Text>
            </View>
          ))}
        </View>

        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          ₹{PREMIUM_PRICE_INR}
        </Text>

        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}

        {loading ? <ActivityIndicator /> : <Button label="Buy Premium" onPress={onBuy} />}
      </View>

      {order ? (
        <RazorpayCheckout
          visible
          orderId={order.orderId}
          keyId={order.keyId}
          amountPaise={order.amount}
          name="LifeOS Premium"
          description="Lifetime access"
          prefillEmail={user?.email ?? undefined}
          onSuccess={async ({ paymentId, orderId, signature }) => {
            setOrder(null);
            setLoading(true);
            try {
              const result = await verifyPremiumPayment({ orderId, paymentId, signature });
              if (result.ok) setSuccess(true);
              else setError('Payment could not be verified — if you were charged, contact support and we’ll sort it out.');
            } catch {
              setError('Payment received but verification failed — if you were charged, contact support and we’ll sort it out.');
            } finally {
              setLoading(false);
            }
          }}
          onDismiss={() => setOrder(null)}
          onError={(message) => {
            setOrder(null);
            setError(message);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}
