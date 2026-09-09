import { useRouter } from 'expo-router';
import { Image, ScrollView, Text, View } from 'react-native';

import { Button, Card } from '@/components';
import { useAppTheme } from '@/theme';

const SUPPORT_EMAIL = 'data24zone@gmail.com';

const FEATURES = [
  'Habits, tasks & recurring to-dos',
  'Journaling & mindfulness',
  'Workout & food tracking',
  'Finance: accounts, budgets & goals',
];

// Kept in sync by hand with modules/premium/purchase.ts's PLANS (the in-app source of truth) and
// functions/index.js's PLAN_PRICE_INR (the actual amount Razorpay charges on this site) — this
// page is the pre-signin marketing view, so it can't just import the app's own module.
const PLANS = [
  { label: 'Monthly', price: '₹149', billing: 'per month' },
  { label: '3 Months', price: '₹299', billing: 'per 3 months', badge: 'Save 33%' },
  { label: '6 Months', price: '₹599', billing: 'per 6 months', badge: 'Save 33%' },
  { label: 'Yearly', price: '₹999', billing: 'per year', badge: 'Save 44%' },
  // Lifetime deliberately not listed — Pro is subscription-only for new buyers now (see
  // purchase.ts's PURCHASABLE_PLANS); this pre-signin page shouldn't advertise a tier nobody can
  // actually buy anymore.
];

export function LandingScreen({ onSignIn }: { onSignIn: () => void }) {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: theme.spacing['4xl'], gap: theme.spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      style={{ backgroundColor: theme.colors.background }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadow.md,
          }}>
          <Image source={require('../../assets/icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>Flowsy</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
          Your habits, tasks, mindfulness, fitness, food, and finances — tracked in one place.
        </Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label="Sign in" onPress={onSignIn} />
        <Button label="Create an account" variant="secondary" onPress={onSignIn} />
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
          What's included
        </Text>
        {FEATURES.map((feature) => (
          <Text key={feature} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
            • {feature}
          </Text>
        ))}
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, marginTop: theme.spacing.xs }}>
          Free to use, with usage limits. Upgrade to Pro for unlimited habits, tasks & accounts, advanced insights, cloud backup, PDF/Excel export, and every theme.
        </Text>
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
          Pro pricing
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {PLANS.map((plan) => (
            <Card key={plan.label} style={{ flex: 1, gap: theme.spacing.xs, alignItems: 'center' }}>
              {plan.badge ? (
                <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>
                  {plan.badge}
                </Text>
              ) : null}
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>{plan.label}</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                {plan.price}
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{plan.billing}</Text>
            </Card>
          ))}
        </View>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          Payments on this website are processed securely by Razorpay. Cancel anytime — see our Refund & Cancellation Policy below.
        </Text>
      </View>

      <Card style={{ gap: theme.spacing.xs }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
          Contact & support
        </Text>
        <Text
          onPress={() => router.push('/help')}
          style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          For support, questions, or feedback, email us at {SUPPORT_EMAIL}.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, justifyContent: 'center', marginTop: theme.spacing.md }}>
        <Text onPress={() => router.push('/privacy-policy')} style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm }}>
          Privacy Policy
        </Text>
        <Text onPress={() => router.push('/terms')} style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm }}>
          Terms & Conditions
        </Text>
        <Text onPress={() => router.push('/refund-policy')} style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm }}>
          Refund & Cancellation Policy
        </Text>
      </View>
    </ScrollView>
  );
}

export default LandingScreen;
