import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, GlowSurface, ScreenContainer } from '@/components';
import { FREE_LIMITS, PLANS, purchasingAvailable, usePremium, type PlanKey } from '@/modules/premium';
import { useAppTheme } from '@/theme';

const FEATURES = [
  {
    icon: 'flash-outline' as const,
    label: 'Unlimited Habits, Tasks & Accounts',
    sub: `No more caps — free plan: ${FREE_LIMITS.habits} habits, ${FREE_LIMITS.tasks} tasks, ${FREE_LIMITS.recurringTasks} recurring tasks, ${FREE_LIMITS.journalEntries} journal entries, ${FREE_LIMITS.financeAccounts} finance account`,
  },
  { icon: 'bar-chart-outline' as const, label: 'Advanced Insights', sub: 'The full Analytics picture across every module' },
  { icon: 'cloud-upload-outline' as const, label: 'Cloud Backup', sub: 'Back up your data and restore it any time' },
  { icon: 'download-outline' as const, label: 'Export to PDF & Excel', sub: 'Take your data with you' },
  { icon: 'color-palette-outline' as const, label: 'All 4 Themes', sub: 'Cyberpunk Neon, Midnight Glass, Minimal Clean, Solar Flare' },
];

export default function PremiumScreen() {
  const theme = useAppTheme();
  const { premium, plan: activePlan } = usePremium();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('yearly');

  if (premium) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
          <Text style={{ fontSize: 48 }}>✓</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            You're on Flowsy Pro
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            {activePlan && activePlan !== 'lifetime'
              ? `${PLANS[activePlan].label} plan — thanks for supporting Flowsy.`
              : 'Lifetime access — thanks for supporting Flowsy, for good.'}
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
          <Text
            style={{
              color: theme.colors.textTertiary,
              fontSize: theme.typography.size.xs,
              fontWeight: theme.typography.weight.semibold,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
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

        {purchasingAvailable() ? (
          <Button label={plan.recurring ? `Subscribe — ₹${plan.priceInr} ${plan.billing}` : `Buy Lifetime — ₹${plan.priceInr}`} variant="gradient" onPress={() => {}} />
        ) : (
          <Card style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              Purchasing is coming soon
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Pro is launching via Google Play Billing — this screen will let you subscribe directly once it's live.
            </Text>
          </Card>
        )}
      </View>
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
