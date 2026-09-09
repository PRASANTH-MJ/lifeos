import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, GlowSurface, ScreenContainer, showAlert } from '@/components';
import { useMyFamilyMembership, useOwnedFamily } from '@/modules/family';
import {
  FAMILY_PLANS,
  FREE_LIMITS,
  PLANS,
  fetchCurrentOffering,
  packageForPlan,
  purchasePlanPackage,
  restorePurchases,
  trialUrgencyHeadline,
  trialUrgencyLevel,
  usePremium,
  type PlanKey,
  type PlanProduct,
} from '@/modules/premium';
import { useAppTheme } from '@/theme';

const FEATURES = [
  {
    icon: 'flash-outline' as const,
    label: 'Unlimited Habits, Tasks & Accounts',
    sub: `No more caps — free plan: ${FREE_LIMITS.habits} habits, ${FREE_LIMITS.tasks} tasks, ${FREE_LIMITS.recurringTasks} recurring tasks, ${FREE_LIMITS.financeAccounts} finance account, ${FREE_LIMITS.financeTransactions} transactions/month`,
  },
  {
    icon: 'barbell-outline' as const,
    label: 'Full Workout & Food Databases',
    sub: 'Search the exercise and food catalogs instead of typing every entry manually',
  },
  { icon: 'body-outline' as const, label: 'Muscle Recovery', sub: 'See which muscle groups are fatigued and which are ready to train' },
  { icon: 'bar-chart-outline' as const, label: 'Advanced Insights', sub: 'The full Analytics picture across every module' },
  { icon: 'cloud-upload-outline' as const, label: 'Cloud Backup', sub: 'Back up your data and restore it any time' },
  { icon: 'download-outline' as const, label: 'Export to PDF & Excel', sub: 'Take your data with you' },
  { icon: 'color-palette-outline' as const, label: 'All Themes', sub: 'Cyberpunk Neon, Minimal Clean, Aurora, Deep Ocean, and more' },
];

export default function PremiumScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { premium, plan: activePlan, trialActive, trialDaysLeft } = usePremium();
  const { family: ownedFamily } = useOwnedFamily();
  const { ownerUid: memberOfFamilyUid } = useMyFamilyMembership();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('yearly');
  // null = still checking; a fetch failure collapses to null too, which is what tells us to fall
  // back to the coming-soon card below rather than show a button that would just error on tap
  // (e.g. before the developer has set up the Play Console products documented in
  // modules/premium/billingService.ts).
  const [offering, setOffering] = useState<PlanProduct[] | null>(null);
  const [checkingOffering, setCheckingOffering] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentOffering().then((result) => {
      if (!cancelled) {
        setOffering(result);
        setCheckingOffering(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const purchasingAvailable = !checkingOffering && offering !== null;

  const handlePurchase = async () => {
    const pkg = packageForPlan(offering, selectedPlan);
    if (!pkg) {
      showAlert('Plan unavailable', 'This plan isn’t set up for purchase yet. Please try again later.');
      return;
    }

    setPurchasing(true);
    const result = await purchasePlanPackage(pkg);
    setPurchasing(false);

    if (result.ok) {
      showAlert('Purchase successful', 'Thanks for upgrading! It may take a few seconds for Pro features to unlock.');
    } else if (!result.cancelled) {
      showAlert('Purchase failed', result.message);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);

    if (!result) {
      showAlert('Restore failed', 'Something went wrong while restoring your purchase. Please try again.');
      return;
    }

    if (result.found) {
      showAlert('Purchase restored', 'We found an active Pro purchase — it may take a few seconds to unlock.');
    } else {
      showAlert('No purchase found', "We couldn't find an active purchase to restore on this account.");
    }
  };

  if (premium && !trialActive) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
          <Text style={{ fontSize: 48 }}>✓</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            You're on Flowsy Pro
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            {activePlan === 'lifetime'
              ? 'Lifetime access — thanks for supporting Flowsy, for good.'
              : memberOfFamilyUid
                ? 'Included on a Family plan — thanks for supporting Flowsy.'
                : activePlan
                  ? `${PLANS[activePlan].label} plan — thanks for supporting Flowsy.`
                  : 'Thanks for supporting Flowsy.'}
          </Text>
          {ownedFamily || memberOfFamilyUid ? (
            <Button label="Manage Family Plan" variant="ghost" onPress={() => router.push('/family-plan')} />
          ) : null}
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

        {trialActive ? (
          <Card
            style={{
              borderColor: trialUrgencyLevel(trialDaysLeft) === 'normal' ? theme.colors.warning : theme.colors.danger,
              borderWidth: 1,
              gap: 2,
            }}>
            <Text
              style={{
                color: trialUrgencyLevel(trialDaysLeft) === 'normal' ? theme.colors.warning : theme.colors.danger,
                fontSize: theme.typography.size.sm,
                fontWeight: theme.typography.weight.semibold,
              }}>
              {trialUrgencyHeadline(trialDaysLeft)}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              You already have every Pro feature unlocked — subscribe now so it doesn't lapse.
            </Text>
          </Card>
        ) : null}

        <View style={{ gap: theme.spacing.md }}>
          <PlanCard
            planKey="yearly"
            selected={selectedPlan === 'yearly'}
            onPress={() => setSelectedPlan('yearly')}
            badge="RECOMMENDED"
            available={!!packageForPlan(offering, 'yearly')}
          />
          <PlanCard
            planKey="halfYearly"
            selected={selectedPlan === 'halfYearly'}
            onPress={() => setSelectedPlan('halfYearly')}
            available={!!packageForPlan(offering, 'halfYearly')}
          />
          <PlanCard
            planKey="quarterly"
            selected={selectedPlan === 'quarterly'}
            onPress={() => setSelectedPlan('quarterly')}
            available={!!packageForPlan(offering, 'quarterly')}
          />
          <PlanCard
            planKey="monthly"
            selected={selectedPlan === 'monthly'}
            onPress={() => setSelectedPlan('monthly')}
            available={!!packageForPlan(offering, 'monthly')}
          />
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
            Family plan — share Pro with up to {PLANS.familyYearly.maxMembers} people
          </Text>
          {FAMILY_PLANS.map((key) => (
            <PlanCard
              key={key}
              planKey={key}
              selected={selectedPlan === key}
              onPress={() => setSelectedPlan(key)}
              available={!!packageForPlan(offering, key)}
            />
          ))}
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

        {purchasingAvailable ? (
          <Button
            label={plan.recurring ? `Subscribe — ₹${plan.priceInr} ${plan.billing}` : `Buy Lifetime — ₹${plan.priceInr}`}
            variant="gradient"
            loading={purchasing}
            onPress={handlePurchase}
          />
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

        <Button label="Restore Purchases" variant="ghost" loading={restoring} onPress={handleRestore} />
      </View>
    </ScreenContainer>
  );
}

function PlanCard({
  planKey,
  selected,
  onPress,
  badge,
  available,
}: {
  planKey: PlanKey;
  selected: boolean;
  onPress: () => void;
  badge?: string;
  /** Whether packageForPlan() actually resolved a live product for this plan — see
   * app/premium.tsx's usage. When false, this specific plan is rendered visibly disabled (greyed
   * out, unselectable) rather than looking identical to a working plan — same idea as the
   * whole-screen "Purchasing is coming soon" Card below, just scoped to one plan. */
  available: boolean;
}) {
  const theme = useAppTheme();
  const plan = PLANS[planKey];
  const isSelectable = selected && available;

  const card = (
    <Card
      style={{
        borderColor: isSelectable ? theme.colors.primary : theme.colors.border,
        borderWidth: isSelectable ? 2 : 1,
        opacity: available ? 1 : 0.5,
        gap: 4,
      }}>
      {badge && available ? (
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
          {available && plan.savingsLabel ? (
            <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
              {plan.savingsLabel}
            </Text>
          ) : null}
          {!available ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Not available right now</Text>
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
    <Pressable onPress={available ? onPress : undefined} disabled={!available}>
      {isSelectable ? <GlowSurface borderRadius={theme.radius.lg}>{card}</GlowSurface> : card}
    </Pressable>
  );
}
