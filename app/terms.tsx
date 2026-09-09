import { Linking, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';

const EFFECTIVE_DATE = 'August 18, 2026';
const SUPPORT_EMAIL = 'data24zone@gmail.com';

type Section = { title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    title: 'The service',
    body: [
      'Flowsy is a personal life-tracking app covering habits, tasks, journaling, mindfulness, fitness, food, and finance. A free plan is available with usage limits; a Pro plan removes those limits and unlocks additional features.',
    ],
  },
  {
    title: 'Accounts',
    body: [
      'You need an account (email and password) to sync your data across devices and to purchase Pro. You are responsible for keeping your login credentials secure and for all activity under your account.',
    ],
  },
  {
    title: 'Subscriptions and payment',
    body: [
      'Pro is available as Monthly (₹199/month), Yearly (₹899/year), or Lifetime (₹3499 one-time). Purchases made on the Flowsy website are processed by Razorpay; purchases made through the Android app are processed by Google Play Billing. Flowsy never receives or stores your card or bank details in either case.',
      'Monthly and Yearly plans renew automatically until cancelled. You can cancel anytime; see our Refund & Cancellation Policy for what happens to your access and billing after cancelling.',
    ],
  },
  {
    title: 'Your content',
    body: [
      'You own the data you enter into Flowsy. We store it to provide the service (sync, backup, and the features you use) as described in our Privacy Policy, and do not claim ownership over it.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'Do not use Flowsy to store or transmit unlawful content, attempt to disrupt or reverse-engineer the service, or access accounts other than your own.',
    ],
  },
  {
    title: 'Disclaimer',
    body: [
      'Flowsy is a personal tracking tool, not a medical, financial, or legal advisor. Nothing in the app constitutes professional advice. The service is provided "as is" without warranties of any kind.',
    ],
  },
  {
    title: 'Limitation of liability',
    body: [
      'To the maximum extent permitted by law, Flowsy and its operators are not liable for indirect, incidental, or consequential damages arising from your use of the app, including loss of data.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: ['If these terms change, we will update this page and its effective date.'],
  },
  {
    title: 'Contact',
    body: [`Questions about these terms? Email us at ${SUPPORT_EMAIL}.`],
  },
];

export default function TermsScreen() {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Effective {EFFECTIVE_DATE}</Text>

      <Card style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
          These Terms & Conditions govern your use of Flowsy. By creating an account or using the app, you agree to them.
        </Text>
      </Card>

      {SECTIONS.map((section) => (
        <View key={section.title} style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
            {section.title}
          </Text>
          <Card style={{ gap: theme.spacing.sm }}>
            {section.body.map((paragraph, index) => (
              <Text key={index} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
                {paragraph}
              </Text>
            ))}
          </Card>
        </View>
      ))}

      <Card style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>Questions?</Text>
        <Text
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          Email {SUPPORT_EMAIL}
        </Text>
      </Card>
    </ScrollView>
  );
}
