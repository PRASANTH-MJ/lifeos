import { Linking, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';

const EFFECTIVE_DATE = 'September 16, 2026';
const SUPPORT_EMAIL = 'data24zone@gmail.com';

type Section = { title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    title: 'Information you provide',
    body: [
      'When you create an account, we collect your email address via Firebase Authentication. We never see or store your password — Firebase handles that directly.',
      'Everything else — habits, tasks, journal entries and check-ins (including any mood you record), workouts, cardio/GPS routes, food and water logs, finance and budget records (accounts, transactions, budgets, debts, goals), meditation and mind-training logs, your nickname, avatar, personal details like height, weight, date of birth, timezone, and health or financial goals — is content you type or pick yourself while using the app. Some of this, particularly your journal entries, mood check-ins, GPS routes, and finance/budget records, is sensitive personal information, and we treat it with the same protections as the rest of your account data described below.',
      'If you use the Social feed, Clubs, or claim a username, that also creates a public or semi-public profile (username, display name, avatar, posts, comments, likes, follows, and club membership) visible to other signed-in users — see "Social features" below for how that differs from the rest of your data.',
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
    title: 'Social features',
    body: [
      'Claiming a username creates a public profile (username, display name, avatar) that any signed-in user can find via search and view. Posts, comments, and likes you make on the Social feed are visible to other users according to the privacy setting on each post; follows are visible to both sides of the follow.',
      'Clubs (including their habits, tasks, challenges, events, and chat messages) are visible to their members, or to any signed-in user if the club is public. You can block another user, delete your own posts/comments, leave a club, or report content at any time from within the app.',
    ],
  },
  {
    title: 'Family plan',
    body: [
      'A Family plan is a single Pro subscription shared by up to 5 accounts. The plan owner can see who has been invited to and is a member of their family group, and can remove a member; a member can see who else is in the family and can leave at any time. No member\'s habits, journal, finance, or other personal data is shared with other family members by this feature — only membership and plan status.',
    ],
  },
  {
    title: 'Purchases and subscriptions',
    body: [
      'Pro plan purchases made through the Android app are processed entirely by Google Play; purchases made on the Flowsy website are processed by Razorpay. Flowsy never sees or stores your card, bank, or other payment details in either case — Google Play or Razorpay handles all of that itself.',
      'After a purchase, the app (or website) asks a Flowsy server function (a Firebase Cloud Function) to verify it directly with Google\'s Play Developer API or with Razorpay. Once verified, that function stores only the resulting entitlement — whether you\'re Pro, which plan, and its subscription status — on your account record in Firestore. No payment information is included in that record.',
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
      'We use Firebase (a Google service) for account sign-in, for syncing your data across your signed-in devices, for storing your avatar and, if you opt into Cloud Backup, your backup snapshot, and for running the server-side functions that verify purchases and power social/club features. We use Google Play Billing and Razorpay to process purchases and subscriptions — see "Purchases and subscriptions" above for which one applies to your purchase. Cardio/GPS route maps are rendered using MapLibre with OpenFreeMap map tiles, a free service that does not require an API key or receive your account identity. Each of these providers\' handling of data is governed by their own privacy policy.',
    ],
  },
  {
    title: 'Data retention and deletion',
    body: [
      'Content on your device stays until you delete it in the app or uninstall the app. If you have an account, the synced copy of that content stays in our database until you delete it in the app (which removes it from sync too) or delete your account. A Cloud Backup snapshot stays in storage until you overwrite it with a new backup or delete your account.',
      `You can delete your account at any time from Settings → Delete Account, which permanently removes your synced data, backups, and public profile (username, posts, follows, club memberships). This cannot be undone. If you'd rather have us do it for you, or run into any trouble, email ${SUPPORT_EMAIL}.`,
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
