import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, GlowSurface, RazorpayCheckout, ScreenContainer } from '@/components';
import { useAuth } from '@/modules/auth';
import {
  createPremiumOrder,
  createPremiumSubscription,
  FREE_LIMITS,
  PLANS,
  usePremium,
  verifyPremiumPayment,
  verifyPremiumSubscription,
  type CreateOrderResult,
  type CreateSubscriptionResult,
  type PlanKey,
} from '@/modules/premium';
import { useAppTheme } from '@/theme';

const FEATURES = [
  { icon: 'flash-outline' as const, label: 'Unlimited Habits, Tasks & Finance Accounts', sub: `No more caps — free plan: ${FREE_LIMITS.habits} habits, ${FREE_LIMITS.recurringTasks} recurring tasks, ${FREE_LIMITS.financeAccounts} finance account` },
  { icon: 'bar-chart-outline' as const, label: 'Advanced Insights', sub: 'The full Analytics picture across every module' },
  { icon: 'heart-outline' as const, label: 'Support Future Development', sub: 'Keep new LifeOS features coming' },
];

type PendingCheckout =
  | { mode: 'order'; result: CreateOrderResult }
  | { mode: 'subscription'; result: CreateSubscriptionResult };

export default function PremiumScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { premium, plan: activePlan } = usePremium();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('yearly');
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      if (selectedPlan === 'lifetime') {
        const result = await createPremiumOrder();
        setPending({ mode: 'order', result });
      } else {
        const result = await createPremiumSubscription(selectedPlan);
        setPending({ mode: 'subscription', result });
      }
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
            You're on LifeOS Pro
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            {activePlan && activePlan !== 'lifetime'
              ? `${PLANS[activePlan].label} plan — thanks for supporting LifeOS.`
              : 'Lifetime access — thanks for supporting LifeOS, for good.'}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const plan = PLANS[selectedPlan];

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            Upgrade to Pro
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            Remove limits. Unlock every feature.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <PlanCard planKey="yearly" selected={selectedPlan === 'yearly'} onPress={() => setSelectedPlan('yearly')} badge="RECOMMENDED" />
          <PlanCard planKey="monthly" selected={selectedPlan === 'monthly'} onPress={() => setSelectedPlan('monthly')} />
          <PlanCard planKey="lifetime" selected={selectedPlan === 'lifetime'} onPress={() => setSelectedPlan('lifetime')} badge="BEST VALUE" />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Included in Pro
          </Text>
          {FEATURES.map((feature) => (
            <Card key={feature.label} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={feature.icon} size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                  {feature.label}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{feature.sub}</Text>
              </View>
            </Card>
          ))}
        </View>

        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button
            label={plan.recurring ? `Subscribe — ₹${plan.priceInr} ${plan.billing}` : `Buy Lifetime — ₹${plan.priceInr}`}
            variant="gradient"
            onPress={onContinue}
          />
        )}

        {plan.recurring ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, lineHeight: 18 }}>
            Subscription details: payment will be charged to your Razorpay-linked payment method upon confirmation.
            Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current billing
            period. You can cancel any time from Settings.
          </Text>
        ) : null}
      </View>

      {pending?.mode === 'order' ? (
        <RazorpayCheckout
          visible
          orderId={pending.result.orderId}
          keyId={pending.result.keyId}
          amountPaise={pending.result.amount}
          name="LifeOS Pro"
          description="Lifetime access"
          prefillEmail={user?.email ?? undefined}
          onSuccess={async ({ paymentId, orderId, signature }) => {
            setPending(null);
            setLoading(true);
            try {
              const result = await verifyPremiumPayment({ orderId: orderId!, paymentId, signature });
              if (result.ok) setSuccess(true);
              else setError('Payment could not be verified — if you were charged, contact support and we’ll sort it out.');
            } catch {
              setError('Payment received but verification failed — if you were charged, contact support and we’ll sort it out.');
            } finally {
              setLoading(false);
            }
          }}
          onDismiss={() => setPending(null)}
          onError={(message) => {
            setPending(null);
            setError(message);
          }}
        />
      ) : null}

      {pending?.mode === 'subscription' ? (
        <RazorpayCheckout
          visible
          subscriptionId={pending.result.subscriptionId}
          keyId={pending.result.keyId}
          name="LifeOS Pro"
          description={`${PLANS[pending.result.planKey].label} subscription`}
          prefillEmail={user?.email ?? undefined}
          onSuccess={async ({ paymentId, subscriptionId, signature }) => {
            setPending(null);
            setLoading(true);
            try {
              const result = await verifyPremiumSubscription({ subscriptionId: subscriptionId!, paymentId, signature });
              if (result.ok) setSuccess(true);
              else setError('Payment could not be verified — if you were charged, contact support and we’ll sort it out.');
            } catch {
              setError('Payment received but verification failed — if you were charged, contact support and we’ll sort it out.');
            } finally {
              setLoading(false);
            }
          }}
          onDismiss={() => setPending(null)}
          onError={(message) => {
            setPending(null);
            setError(message);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function PlanCard({ planKey, selected, onPress, badge }: { planKey: PlanKey; selected: boolean; onPress: () => void; badge?: string }) {
  const theme = useAppTheme();
  const plan = PLANS[planKey];

  const card = (
    <Card
      style={{
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        borderWidth: selected ? 2 : 1,
        gap: 4,
      }}>
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -10,
            left: theme.spacing.lg,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
            borderRadius: theme.radius.full,
          }}>
          <Text style={{ color: '#fff', fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>{badge}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {plan.label}
          </Text>
          {plan.savingsLabel ? (
            <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
              {plan.savingsLabel}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            ₹{plan.priceInr}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{plan.billing}</Text>
        </View>
      </View>
    </Card>
  );

  return (
    <Pressable onPress={onPress}>
      {selected ? <GlowSurface borderRadius={theme.radius.lg}>{card}</GlowSurface> : card}
    </Pressable>
  );
}
