import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { EmptyState, LoadingState, ScreenContainer } from '@/components';
import { auth } from '@/firebase/config';
import { ClubHabitRow, useClub, useClubHabits, useDeleteClubHabit } from '@/modules/clubs';
import { useAppTheme } from '@/theme';

/** Club habits list — a shared, member-tracked-together version of the personal Habits tab (see
 * modules/habits), scoped to one club. Reachable from the club detail screen (see [clubId].tsx's
 * planned link — deliberately not wired in here, see the ownership note in this feature's task)
 * and, cross-club, from the Productivity tab's "Club Habits" rollup section (ClubHabitsSection). */
export default function ClubHabitsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid;
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { habits, loading } = useClubHabits(clubId);
  const { club } = useClub(clubId);
  const { deleteClubHabit } = useDeleteClubHabit();
  // A legacy club doc's `admins` array can predate the creator ever being added to it — see
  // useClub.ts's isAdmin, which this mirrors.
  const canModerate = !!myUid && !!club && (club.admins.includes(myUid) || club.subAdmins.includes(myUid) || club.createdBy === myUid);

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            Club Habits
          </Text>
          {canModerate ? (
            <Pressable
              onPress={() => router.push({ pathname: '/social/clubs/habit-new', params: { clubId } })}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.moduleHabits,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <LoadingState />
        ) : habits.length === 0 ? (
          <EmptyState icon="checkmark-circle-outline" title="No shared habits yet" subtitle="Start one for the club to track together." />
        ) : (
          habits.map((habit) => (
            <ClubHabitRow
              key={habit.id}
              clubId={clubId}
              habit={habit}
              canDelete={habit.createdBy === myUid || canModerate}
              onDelete={() => deleteClubHabit(clubId, habit.id)}
              showMemberStatus
            />
          ))
        )}
      </View>
    </ScreenContainer>
  );
}
