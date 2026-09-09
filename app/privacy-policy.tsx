import { Linking, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';

const EFFECTIVE_DATE = 'August 14, 2026';
const SUPPORT_EMAIL = 'data24zone@gmail.com';

type Section = { title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    title: 'Information you provide',
    body: [
      'When you create an account, we collect your email address via Firebase Authentication. We never see or store your password — Firebase handles that directly.',
      'Everything else — habits, tasks, journal entries and check-ins (including any mood you record), workouts, food and water logs, finance and budget records (accounts, transactions, budgets, debts, goals), meditation and mind-training logs, your nickname, avatar, and personal details like height, weight, date of birth, and health or financial goals — is content you type or pick yourself while using the app. Some of this, particularly your journal entries, mood check-ins, and finance/budget records, is sensitive personal information, and we treat it with the same protections as the rest of your account data described below.',
    ],
  },
  {
    title: 'Where your data lives',
    body: [
      'If you use the app without creating an account, everything above stays in a local database on your device only and is never sent to us or anyone else.',
      'If you create an account, the content above (habits, tasks, journal entries and check-ins, food, water, workout, meditation, mind-training, and finance data) automatically and continuously syncs to our database (Firebase Firestore) under your account — this is what lets the same data appear if you sign in on another device. This sync happens for every signed-in account, not just Pro subscribers.',
      'If you choose a profile avatar image while signed in, it is uploaded to Firebase Cloud Storage under your account and a link to it is stored in Firestore, so your avatar follows your account to other signed-in devices.',
      'Separately, Cloud Backup (a Pro feature, and only when you tap "Back up now") uploads a full point-in-time snapshot of that same data to Firebase Cloud Storage, which you can restore from later or onto a new device. Cloud Backup is an additional copy on top of the sync described above, not the only way data can leave your device.',
    ],
  },
  {
    title: 'Purchases and subscriptions',
    body: [
      'Pro plan purchases are processed entirely by Google Play. Flowsy never sees or stores your card, bank, or other payment details — Google Play handles all of that itself.',
      'After a purchase, the app asks a Flowsy server function (a Firebase Cloud Function) to verify it directly with Google\'s Play Developer API. Once verified, that function stores only the resulting entitlement — whether you\'re Pro, which plan, and its subscription status — on your account record in Firestore. No payment information is included in that record.',
      'Tapping "Restore Purchases" in the app re-runs this same server-side verification for your Google account\'s existing purchases, in case your Pro status didn\'t sync automatically.',
    ],
  },
  {
    title: 'Camera and photo library',
    body: [
      'The app requests camera access for planned upcoming features (such as photo-based food logging); as of this version, the camera is not actively used to capture, store, or upload any images. We will update this section when a camera-based feature ships.',
      'The photo library is used only if you choose a profile avatar image. See "Where your data lives" above for what happens to it once you\'re signed in.',
    ],
  },
  {
    title: 'What we don’t do',
    body: [
      'Flowsy has no advertising SDK and no analytics or tracking SDK. We do not sell or share your data with third parties for advertising or marketing. Flowsy never receives or stores your payment/card details — those are handled entirely by Google Play, as described in "Purchases and subscriptions" above.',
    ],
  },
  {
    title: 'Third-party services',
    body: [
      'We use Firebase (a Google service) for account sign-in, for syncing your data across your signed-in devices, for storing your avatar and, if you opt into Cloud Backup, your backup snapshot, and for running the server-side function that verifies Play Store purchases. We use Google Play Billing to process purchases and subscriptions. Google\'s handling of that data is governed by Google\'s own privacy policy.',
    ],
  },
  {
    title: 'Data retention and deletion',
    body: [
      'Content on your device stays until you delete it in the app or uninstall the app. If you have an account, the synced copy of that content stays in our database until you delete it in the app (which removes it from sync too) or ask us to delete your account. A Cloud Backup snapshot stays in storage until you overwrite it with a new backup or ask us to delete it.',
      `There isn't yet a self-serve "delete my account" button in the app. To request deletion of your account and any backup data, email us at ${SUPPORT_EMAIL} and we’ll take care of it.`,
    ],
  },
  {
    title: 'Children’s privacy',
    body: ['Flowsy is not directed at children under 13, and we do not knowingly collect information from them.'],
  },
  {
    title: 'Changes to this policy',
    body: ['If how we handle data changes, we’ll update this page and change the effective date above.'],
  },
];

export default function PrivacyPolicyScreen() {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Effective {EFFECTIVE_DATE}</Text>

      <Card style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
          This page explains what information Flowsy collects, how it’s used, and how you can control it.
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
          Questions about your data?
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
