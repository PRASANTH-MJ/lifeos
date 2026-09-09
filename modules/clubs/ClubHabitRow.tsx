import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, CompletionPulse, RowActionsMenu, StreakBadge } from '@/components';
import { WEEKDAY_LABELS } from '@/modules/habits';
import { useAppTheme } from '@/theme';
import { ClubItemMemberStatus } from './ClubItemMemberStatus';
import { useClubCheckins } from './useClubCheckins';
import type { ClubHabit } from './clubProductivityTypes';

/** One club habit's row — per-member "done today" toggle + streak (via useClubCheckins, which
 * reuses modules/habits' exact streak math). Shared between the in-club habits list
 * (app/(tabs)/social/clubs/habits.tsx) and the cross-club Productivity-tab rollup
 * (ClubHabitsSection), so both surfaces render/behave identically. `clubLabel`, when given,
 * renders the club's name under the title — only meaningful in the cross-club rollup, where a
 * habit's own club isn't otherwise obvious.
 *
 * `showMemberStatus`, when true, adds a "who's done this today" expand toggle (see
 * ClubItemMemberStatus) — opt-in and off by default so the compact cross-club rollup
 * (ClubHabitsSection) stays cheap; only the dedicated app/(tabs)/social/clubs/habits.tsx screen
 * passes it. */
export function ClubHabitRow({
  clubId,
  habit,
  clubLabel,
  canDelete,
  onDelete,
  onPress,
  showMemberStatus,
}: {
  clubId: string;
  habit: ClubHabit;
  clubLabel?: string;
  canDelete?: boolean;
  onDelete?: () => void;
  onPress?: () => void;
  showMemberStatus?: boolean;
}) {
  const theme = useAppTheme();
  const { doneToday, streak, submitting, toggleToday } = useClubCheckins('habits', clubId, habit.id, habit.recurrence, habit.targetDays);
  const [expanded, setExpanded] = useState(false);

  const content = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }} numberOfLines={1}>
          {habit.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2, flexWrap: 'wrap' }}>
          {clubLabel ? <Text style={{ color: theme.colors.moduleHabits, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>{clubLabel}</Text> : null}
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {habit.recurrence === 'daily' ? 'Every day' : habit.targetDays.map((d) => WEEKDAY_LABELS[d]).join(', ') || 'Weekly'}
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
      {canDelete && onDelete ? <RowActionsMenu itemLabel={habit.title} onDelete={onDelete} /> : null}
    </>
  );

  const row = onPress ? (
    <Pressable onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>{content}</View>
    </Pressable>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>{content}</View>
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
      {expanded ? <ClubItemMemberStatus clubId={clubId} parent="habits" itemId={habit.id} /> : null}
    </Card>
  );
}
