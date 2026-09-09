import { Text, View } from 'react-native';

import { EmptyState, LoadingState } from '@/components';
import { useAppTheme } from '@/theme';
import { ClubTaskRow } from './ClubTaskRow';
import { useClubs } from './useClubs';
import { useMyClubTasks } from './useMyClubTasks';
import { useMyClubs } from './useMyClubs';

/** Cross-club "Club Tasks" rollup for the Productivity tab (app/(tabs)/tasks/index.tsx) — every
 * shared task (one-off and recurring) across every club the signed-in user belongs to, alongside
 * (not replacing) their personal tasks list. Self-contained, same shape as ClubHabitsSection. */
export function ClubTasksSection() {
  const theme = useAppTheme();
  const { clubs } = useClubs();
  const { myClubs, loading: myClubsLoading } = useMyClubs(clubs);
  const { tasks, loading: tasksLoading } = useMyClubTasks(myClubs);

  if (!myClubsLoading && myClubs.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
        Club Tasks
      </Text>
      {myClubsLoading || tasksLoading ? (
        <LoadingState />
      ) : tasks.length === 0 ? (
        <EmptyState icon="people-outline" title="No shared club tasks yet" subtitle="Add one from any club you're in." />
      ) : (
        tasks.map(({ task, club }) => <ClubTaskRow key={`${club.id}_${task.id}`} clubId={club.id} task={task} clubLabel={club.name} />)
      )}
    </View>
  );
}
