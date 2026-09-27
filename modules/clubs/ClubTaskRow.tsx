import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Card, CompletionPulse, RowActionsMenu, StreakBadge } from '@/components';
import { auth } from '@/firebase/config';
import { formatDisplayDate } from '@/lib/date';
import { WEEKDAY_LABELS } from '@/modules/habits';
import { usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';
import { ClubItemMemberStatus } from './ClubItemMemberStatus';
import { useClubCheckins } from './useClubCheckins';
import { useToggleClubTask } from './useClubTasks';
import type { ClubTask } from './clubProductivityTypes';

type RowProps = {
  clubId: string;
  task: ClubTask;
  clubLabel?: string;
  canDelete?: boolean;
  onDelete?: () => void;
  onArchive?: () => void;
  archiveLabel?: string;
  /** Adds a "who's done this today" (recurring) or "completed by" (one-off) breakdown — opt-in,
   * off by default, same reasoning as ClubHabitRow's own `showMemberStatus`: only the dedicated
   * app/(tabs)/social/clubs/tasks.tsx screen passes it, keeping the cross-club rollup cheap. */
  showMemberStatus?: boolean;
};

/** A recurring club task's row — behaves exactly like ClubHabitRow (per-member daily check-in +
 * streak), since a recurring club task IS a shared habit in every sense but name (see
 * clubProductivityTypes.ts). Shared between the in-club tasks list and the cross-club
 * Productivity-tab rollup, same as ClubHabitRow. */
export function RecurringClubTaskRow({ clubId, task, clubLabel, canDelete, onDelete, onArchive, archiveLabel, showMemberStatus }: RowProps) {
  const theme = useAppTheme();
  const { doneToday, streak, submitting, toggleToday } = useClubCheckins('tasks', clubId, task.id, task.recurrence, task.recurrenceDays);
  const [expanded, setExpanded] = useState(false);

  const row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2, flexWrap: 'wrap' }}>
          {clubLabel ? <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>{clubLabel}</Text> : null}
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {task.recurrence === 'daily' ? 'Every day' : task.recurrenceDays.map((d) => WEEKDAY_LABELS[d]).join(', ') || 'Weekly'}
          </Text>
          <StreakBadge streak={streak} />
        </View>
      </View>
      <CompletionPulse active={doneToday} size={30}>
        <Pressable
          onPress={() => toggleToday()}
          disabled={submitting}
          hitSlop={8}
          style={{
            width: 30,
            height: 30,
            borderWidth: 2,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: doneToday ? theme.colors.success : theme.colors.border,
            backgroundColor: doneToday ? theme.colors.success : 'transparent',
          }}>
          {doneToday ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
        </Pressable>
      </CompletionPulse>
      {canDelete && onDelete ? (
        <RowActionsMenu itemLabel={task.title} onDelete={onDelete} onArchive={onArchive} archiveLabel={archiveLabel} />
      ) : null}
    </View>
  );

  if (!showMemberStatus) {
    return <Card>{row}</Card>;
  }

  return (
    <Card>
      {row}
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textTertiary} />
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
          Who's done today
        </Text>
      </Pressable>
      {expanded ? <ClubItemMemberStatus clubId={clubId} parent="tasks" itemId={task.id} /> : null}
    </Card>
  );
}

/** A one-off club task's row — a shared completed/completedBy/completedAt toggle instead of a
 * per-day checkin (see clubProductivityTypes.ts's ClubTask doc comment). Gated the same way
 * functions/index.js's toggleClubTaskComplete is: an assigned task can only be completed by its
 * assignee (checked here just to disable the checkbox — the callable re-checks server-side). */
export function OneOffClubTaskRow({ clubId, task, clubLabel, canDelete, onDelete, onArchive, archiveLabel, showMemberStatus }: RowProps) {
  const theme = useAppTheme();
  const myUid = auth.currentUser?.uid;
  const { toggleClubTask, submitting } = useToggleClubTask();
  const blockedByAssignment = !!task.assignedTo && task.assignedTo !== myUid && !task.completed;
  // Already have completedBy on the task doc itself — no extra listener needed (unlike the
  // recurring row's per-day "who's done" breakdown, which has no single-doc equivalent). Gated
  // behind showMemberStatus anyway, for the same "keep the hub rollup cheap" reasoning.
  const { profile: completedByProfile } = usePublicProfile(showMemberStatus && task.completed ? task.completedBy : null);

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <CompletionPulse active={task.completed} size={26}>
        <Pressable
          onPress={() => toggleClubTask(clubId, task.id)}
          disabled={submitting || blockedByAssignment}
          hitSlop={8}
          style={{
            width: 26,
            height: 26,
            borderWidth: 2,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: blockedByAssignment ? 0.5 : 1,
            borderColor: task.completed ? theme.colors.success : theme.colors.border,
            backgroundColor: task.completed ? theme.colors.success : 'transparent',
          }}>
          {task.completed ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </Pressable>
      </CompletionPulse>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: task.completed ? theme.colors.textTertiary : theme.colors.textPrimary,
            fontSize: theme.typography.size.base,
            fontWeight: theme.typography.weight.semibold,
            textDecorationLine: task.completed ? 'line-through' : 'none',
          }}
          numberOfLines={1}>
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2, flexWrap: 'wrap' }}>
          {clubLabel ? <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>{clubLabel}</Text> : null}
          {task.dueDate ? <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(task.dueDate)}</Text> : null}
        </View>
        {completedByProfile ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
            <Avatar url={completedByProfile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Completed by @{completedByProfile.usernameLower}</Text>
          </View>
        ) : null}
      </View>
      {canDelete && onDelete ? (
        <RowActionsMenu itemLabel={task.title} onDelete={onDelete} onArchive={onArchive} archiveLabel={archiveLabel} />
      ) : null}
    </Card>
  );
}

/** Picks RecurringClubTaskRow or OneOffClubTaskRow based on the task's own `recurrence` field —
 * the single entry point both the in-club tasks list and the cross-club rollup render through. */
export function ClubTaskRow(props: RowProps) {
  return props.task.recurrence ? <RecurringClubTaskRow {...props} /> : <OneOffClubTaskRow {...props} />;
}
