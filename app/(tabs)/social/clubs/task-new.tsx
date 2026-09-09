import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, EmptyState, ScreenContainer, TextField } from '@/components';
import { auth } from '@/firebase/config';
import { todayKey } from '@/lib/date';
import { useClub, useClubMembers, useCreateClubTask, type ClubRecurrence } from '@/modules/clubs';
import { WEEKDAY_LABELS } from '@/modules/habits';
import { usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

/** A member picker chip that resolves its own display name — same per-item-hook shape as
 * ActiveChallengeCard, since usePublicProfile needs its own uid and can't batch-fetch. */
function AssigneeChip({ uid, selected, onPress }: { uid: string; selected: boolean; onPress: () => void }) {
  const { profile } = usePublicProfile(uid);
  return <Chip label={profile ? `@${profile.usernameLower}` : uid.slice(0, 6)} selected={selected} onPress={onPress} />;
}

/** One-off (no recurrence) or recurring club task — recurrence distinguishes them rather than two
 * separate creation flows, matching modules/tasks' single Task model with an is_recurring split.
 * Recurring club tasks get no dueDate/assignee (see functions/index.js's createClubTask — every
 * member tracks their own daily/weekly completion via useClubCheckins instead, same as a club
 * habit), so those fields only show for a one-off task. */
export default function CreateClubTaskScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid;
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { createClubTask, submitting } = useCreateClubTask();
  const { uids: memberUids } = useClubMembers(clubId);
  const { canModerate, loading: clubLoading } = useClub(clubId);

  const [title, setTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<ClubRecurrence>('daily');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(todayKey());
  const [error, setError] = useState<string | null>(null);

  const canCreate = title.trim().length > 0 && (!isRecurring || recurrence !== 'weekly' || recurrenceDays.length > 0);

  const toggleDay = (day: number) => {
    setRecurrenceDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  };

  const onCreate = async () => {
    if (!clubId || !canCreate) return;
    setError(null);
    try {
      await createClubTask(clubId, {
        title: title.trim(),
        assignedTo: isRecurring ? null : assignedTo,
        dueDate: isRecurring ? null : dueDate,
        recurrence: isRecurring ? recurrence : null,
        recurrenceDays: isRecurring && recurrence === 'weekly' ? recurrenceDays : undefined,
      });
      router.replace({ pathname: '/social/clubs/tasks', params: { clubId } });
    } catch {
      setError('Could not create the task. Please try again.');
    }
  };

  // Only a club admin/sub-admin may create a club task (see functions/index.js's createClubTask
  // check) — this guards direct navigation here since the list screen already hides the entry
  // point for anyone else.
  if (!clubLoading && !canModerate) {
    return (
      <ScreenContainer>
        <EmptyState icon="lock-closed-outline" title="Admins only" subtitle="Only a club admin or sub-admin can create a club task." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          New Club Task
        </Text>

        <TextField label="Title" placeholder="e.g. Book the group hike permit" value={title} onChangeText={setTitle} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Type
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip label="One-off" selected={!isRecurring} onPress={() => setIsRecurring(false)} />
            <Chip label="Recurring" selected={isRecurring} onPress={() => setIsRecurring(true)} />
          </View>
        </View>

        {isRecurring ? (
          <>
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Recurrence
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Chip label="Every day" selected={recurrence === 'daily'} onPress={() => setRecurrence('daily')} />
                <Chip label="Specific days" selected={recurrence === 'weekly'} onPress={() => setRecurrence('weekly')} />
              </View>
            </View>
            {recurrence === 'weekly' ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  Which days
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  {WEEKDAY_LABELS.map((label, day) => (
                    <Chip key={day} label={label} selected={recurrenceDays.includes(day)} onPress={() => toggleDay(day)} />
                  ))}
                </View>
              </View>
            ) : null}
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Every member tracks their own completion, day by day — same as a club habit.
            </Text>
          </>
        ) : (
          <>
            <TextField label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Assign to (optional)
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                <Chip label="Anyone" selected={assignedTo === null} onPress={() => setAssignedTo(null)} />
                {memberUids
                  .filter((uid) => uid !== myUid)
                  .map((uid) => (
                    <AssigneeChip key={uid} uid={uid} selected={assignedTo === uid} onPress={() => setAssignedTo(uid)} />
                  ))}
              </View>
            </View>
          </>
        )}

        <Button label="Create Club Task" onPress={onCreate} disabled={!canCreate} loading={submitting} glow />
        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{error}</Text> : null}
      </View>
    </ScreenContainer>
  );
}
