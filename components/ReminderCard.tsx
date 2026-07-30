import { Ionicons } from '@expo/vector-icons';
import { Switch, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { Card } from './Card';
import { TimeField } from './TimeField';

type Props = {
  enabled: boolean;
  time: string | null;
  onSave: (enabled: boolean, time: string | null) => void;
  color?: string;
};

/** A daily reminder toggle + time picker — the same shape wherever a module (Journal,
 * Meditation, Breathing, Mind Training, Workout, Food, Affirmations) offers one. */
export function ReminderCard({ enabled, time, onSave, color }: Props) {
  const theme = useAppTheme();
  const accentColor = color ?? theme.colors.textSecondary;

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name="alarm-outline" size={20} color={accentColor} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Daily reminder
          </Text>
        </View>
        <Switch value={enabled} onValueChange={(next) => onSave(next, next ? (time ?? '09:00') : time)} />
      </View>
      {enabled ? <TimeField value={time} onChange={(next) => onSave(enabled, next)} /> : null}
    </Card>
  );
}
