import { Linking, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';

const EFFECTIVE_DATE = 'August 18, 2026';
const SUPPORT_EMAIL = 'data24zone@gmail.com';

type Section = { title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    title: 'Free trial of features',
    body: [
      'Flowsy\'s free plan lets you try every module before paying — there is no separate trial period for Pro. We recommend using the free plan first to decide if Pro is right for you.',
    ],
  },
  {
    title: 'Cancelling a subscription',
    body: [
      'Monthly and Yearly Pro plans can be cancelled anytime. If you subscribed on the Flowsy website (Razorpay), email us at ' +
        SUPPORT_EMAIL +
        ' to cancel. If you subscribed through the Android app (Google Play), cancel via Google Play\'s subscription settings on your device.',
      'After cancelling, you keep Pro access until the end of the period you already paid for; it then reverts to the free plan and its usage limits. We do not pro-rate or refund the unused portion of a cancelled period.',
    ],
  },
  {
    title: 'Refunds',
    body: [
      'Because Pro unlocks digital features immediately on purchase, payments are generally non-refundable once made — for Monthly, Yearly, and Lifetime plans alike.',
      'Exceptions: if you were charged due to a verified technical error (e.g. duplicate charge, or a charge that did not unlock Pro on your account), email ' +
        SUPPORT_EMAIL +
        ' with your payment reference within 7 days of the charge and we will investigate and refund if the error is confirmed.',
      'Approved refunds for website (Razorpay) payments are issued back to the original payment method and typically appear within 5–7 business days, depending on your bank. Approved refunds for Google Play payments are issued by Google and follow Google Play\'s own refund timelines.',
    ],
  },
  {
    title: 'How to request a refund',
    body: [`Email ${SUPPORT_EMAIL} with the email address on your Flowsy account, the plan purchased, and the date of the charge.`],
  },
  {
    title: 'Contact',
    body: [`Questions about billing, cancellations, or refunds? Email us at ${SUPPORT_EMAIL}.`],
  },
];

export default function RefundPolicyScreen() {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Effective {EFFECTIVE_DATE}</Text>

      <Card style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
          This page explains how cancellations and refunds work for Flowsy Pro, whether you subscribed on our website or through the Android app.
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
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
          Need to cancel or request a refund?
        </Text>
        <Text
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          Email {SUPPORT_EMAIL}
        </Text>
      </Card>
    </ScrollView>
  );
}
