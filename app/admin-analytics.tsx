import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { LoadingState, ScreenContainer, StatCard } from '@/components';
import { functions } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { isAdminUser } from '@/modules/admin';
import { useAppTheme } from '@/theme';

type AdminAnalytics = {
  users: { total: number; active7d: number; active30d: number };
  premium: { premiumCount: number; trialGrantedCount: number };
  clubs: {
    totalClubs: number;
    totalMemberships: number;
    totalChallenges: number;
    totalChallengeParticipants: number;
    totalEvents: number;
    totalEventAttendees: number;
  };
};

function SectionHeader({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.weight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginLeft: theme.spacing.xs,
      }}>
      {label}
    </Text>
  );
}

function StatRow({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  return <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>{children}</View>;
}

/** Developer-only usage dashboard — not a real user-facing feature, so there's no prominent nav
 * entry to it anywhere (see the hidden long-press on the email row in app/(tabs)/settings/
 * index.tsx). This client-side isAdminUser check is UX only, redirecting away immediately for
 * anyone else; the actual boundary is getAdminAnalytics' own server-side email check (see
 * functions/index.js) — a modified client can't get real data out of this screen either way. */
export default function AdminAnalyticsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdminUser(user)) {
      router.replace('/');
      return;
    }
    const getAdminAnalytics = httpsCallable<Record<string, never>, AdminAnalytics>(functions, 'getAdminAnalytics');
    getAdminAnalytics({})
      .then((result) => setData(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics.'));
  }, [authLoading, user, router]);

  if (authLoading || !isAdminUser(user)) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text>
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const { users, premium, clubs } = data;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Analytics
        </Text>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Users" />
          <StatRow>
            <StatCard label="Total registered" value={String(users.total)} />
            <StatCard label="Active last 7d" value={String(users.active7d)} color={theme.colors.success} />
            <StatCard label="Active last 30d" value={String(users.active30d)} color={theme.colors.success} />
          </StatRow>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Premium" />
          <StatRow>
            <StatCard label="Premium/converted" value={String(premium.premiumCount)} color={theme.colors.warning} />
            <StatCard label="Ever started a trial" value={String(premium.trialGrantedCount)} />
          </StatRow>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Clubs" />
          <StatRow>
            <StatCard label="Total clubs" value={String(clubs.totalClubs)} />
            <StatCard label="Total memberships" value={String(clubs.totalMemberships)} />
          </StatRow>
          <StatRow>
            <StatCard label="Challenges" value={String(clubs.totalChallenges)} />
            <StatCard label="Challenge participants" value={String(clubs.totalChallengeParticipants)} />
          </StatRow>
          <StatRow>
            <StatCard label="Events" value={String(clubs.totalEvents)} />
            <StatCard label="Event RSVPs" value={String(clubs.totalEventAttendees)} />
          </StatRow>
        </View>
      </View>
    </ScreenContainer>
  );
}
