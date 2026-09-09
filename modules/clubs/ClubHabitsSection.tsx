import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { EmptyState, LoadingState } from '@/components';
import { useAppTheme } from '@/theme';
import { ClubHabitRow } from './ClubHabitRow';
import { useClubs } from './useClubs';
import { useMyClubHabits } from './useMyClubHabits';
import { useMyClubs } from './useMyClubs';

/** Cross-club "Club Habits" rollup for the Productivity tab (app/(tabs)/habits/index.tsx) —
 * every shared habit across every club the signed-in user belongs to, alongside (not replacing)
 * their personal habits list above it. Self-contained (fetches its own clubs/myClubs/habits) so
 * the host screen only needs to render `<ClubHabitsSection />` with no props, same reasoning as
 * ClubEventsSection being handed pre-loaded `events` — except this one owns its own data since
 * there's no other screen already loading "my clubs' habits" for it to reuse. */
export function ClubHabitsSection() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubs } = useClubs();
  const { myClubs, loading: myClubsLoading } = useMyClubs(clubs);
  const { habits, loading: habitsLoading } = useMyClubHabits(myClubs);

  // Nothing to show for someone in no clubs — this section stays invisible rather than showing an
  // empty state that would only ever apply to a small slice of users, same convention as any other
  // "only if applicable" dashboard section in this app.
  if (!myClubsLoading && myClubs.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
        Club Habits
      </Text>
      {myClubsLoading || habitsLoading ? (
        <LoadingState />
      ) : habits.length === 0 ? (
        <EmptyState icon="people-outline" title="No shared club habits yet" subtitle="Start one from any club you're in." />
      ) : (
        habits.map(({ habit, club }) => (
          <ClubHabitRow
            key={`${club.id}_${habit.id}`}
            clubId={club.id}
            habit={habit}
            clubLabel={club.name}
            onPress={() => router.push({ pathname: '/social/clubs/habits', params: { clubId: club.id } })}
          />
        ))
      )}
    </View>
  );
}
