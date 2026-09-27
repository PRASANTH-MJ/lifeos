import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState, LoadingState, ScreenContainer, SegmentedControl } from '@/components';
import { auth } from '@/firebase/config';
import { ClubTaskRow, useClub, useClubTasks, useDeleteClubTask, useSetClubTaskArchived } from '@/modules/clubs';
import { useAppTheme } from '@/theme';

/** Club tasks list — one-off and recurring club tasks share this screen (a recurring club task IS
 * a shared habit, see modules/clubs/ClubTaskRow.tsx's doc comment), matching how the personal
 * Tasks tab keeps one-off and recurring tasks together rather than as two separate features. */
export default function ClubTasksScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid;
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { tasks: allTasks, loading } = useClubTasks(clubId);
  const { club } = useClub(clubId);
  const { deleteClubTask } = useDeleteClubTask();
  const { setClubTaskArchived } = useSetClubTaskArchived();
  const [view, setView] = useState<'active' | 'archived'>('active');
  // A legacy club doc's `admins` array can predate the creator ever being added to it — see
  // useClub.ts's isAdmin, which this mirrors.
  const canModerate = !!myUid && !!club && (club.admins.includes(myUid) || club.subAdmins.includes(myUid) || club.createdBy === myUid);
  const tasks = allTasks.filter((t) => (view === 'archived' ? t.archived : !t.archived));
  const archivedCount = allTasks.filter((t) => t.archived).length;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            Club Tasks
          </Text>
          {canModerate ? (
            <Pressable
              onPress={() => router.push({ pathname: '/social/clubs/task-new', params: { clubId } })}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.moduleTasks,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        {archivedCount > 0 ? (
          <SegmentedControl
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: `Archived (${archivedCount})` },
            ]}
            value={view}
            onChange={setView}
          />
        ) : null}

        {loading ? (
          <LoadingState />
        ) : tasks.length === 0 ? (
          view === 'archived' ? (
            <EmptyState icon="archive-outline" title="No archived tasks" subtitle="Completed tasks you archive will show up here." />
          ) : (
            <EmptyState icon="checkbox-outline" title="No shared tasks yet" subtitle="Add a one-off or recurring task for the club." />
          )
        ) : (
          tasks.map((task) => (
            <ClubTaskRow
              key={task.id}
              clubId={clubId}
              task={task}
              canDelete={task.createdBy === myUid || canModerate}
              onDelete={() => deleteClubTask(clubId, task.id)}
              onArchive={
                task.createdBy === myUid || canModerate ? () => setClubTaskArchived(clubId, task.id, !task.archived) : undefined
              }
              archiveLabel={task.archived ? 'Unarchive' : 'Archive'}
              showMemberStatus
            />
          ))
        )}
      </View>
    </ScreenContainer>
  );
}
