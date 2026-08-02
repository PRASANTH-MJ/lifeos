import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { Card } from './Card';
import { Chip } from './Chip';
import { TimeField } from './TimeField';

export type ReminderCardState = {
  reminderType: 'none' | 'notification' | 'alarm';
  time: string | null;
  scheduleType: 'daily' | 'specific_days';
  scheduleDays: number[];
};

type Props = {
  state: ReminderCardState;
  onSave: (next: ReminderCardState) => void;
  color?: string;
};

const WEEKDAYS = [
  { value: 1, label: 'S' },
  { value: 2, label: 'M' },
  { value: 3, label: 'T' },
  { value: 4, label: 'W' },
  { value: 5, label: 'T' },
  { value: 6, label: 'F' },
  { value: 7, label: 'S' },
];

/** A reminder's type (silent/Notification/Alarm-style sound) + schedule (every day or specific
 * weekdays) — the same shape wherever a module (Journal, Meditation, Breathing, Mind Training,
 * Workout, Food, Affirmations) offers one. */
export function ReminderCard({ state, onSave, color }: Props) {
  const theme = useAppTheme();
  const accentColor = color ?? theme.colors.textSecondary;
  const { reminderType, time, scheduleType, scheduleDays } = state;

  const toggleDay = (day: number) => {
    const next = scheduleDays.includes(day) ? scheduleDays.filter((d) => d !== day) : [...scheduleDays, day];
    onSave({ ...state, scheduleDays: next });
  };

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Ionicons name="alarm-outline" size={20} color={accentColor} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          Reminder
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label="Off" selected={reminderType === 'none'} onPress={() => onSave({ ...state, reminderType: 'none' })} />
        <Chip
          label="Notification"
          selected={reminderType === 'notification'}
          color={accentColor}
          onPress={() => onSave({ ...state, reminderType: 'notification', time: time ?? '09:00' })}
        />
        <Chip
          label="Alarm"
          selected={reminderType === 'alarm'}
          color={accentColor}
          onPress={() => onSave({ ...state, reminderType: 'alarm', time: time ?? '09:00' })}
        />
      </View>

      {reminderType !== 'none' ? (
        <>
          <TimeField value={time} onChange={(next) => onSave({ ...state, time: next })} />

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip label="Every day" selected={scheduleType === 'daily'} color={accentColor} onPress={() => onSave({ ...state, scheduleType: 'daily' })} />
            <Chip
              label="Specific days"
              selected={scheduleType === 'specific_days'}
              color={accentColor}
              onPress={() => onSave({ ...state, scheduleType: 'specific_days' })}
            />
          </View>

          {scheduleType === 'specific_days' ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              {WEEKDAYS.map((day) => (
                <Pressable
                  key={day.value}
                  onPress={() => toggleDay(day.value)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: scheduleDays.includes(day.value) ? accentColor : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: scheduleDays.includes(day.value) ? accentColor : theme.colors.border,
                  }}>
                  <Text style={{ color: scheduleDays.includes(day.value) ? '#fff' : theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                    {day.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
