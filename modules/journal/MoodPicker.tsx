import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { MOODS } from './types';

type Props = {
  value: string | null;
  onChange: (mood: string) => void;
};

/** A row of equally-sized single-tap mood tiles — the "quick-pick" pattern used in journal
 * check-ins and the entry detail screen. Active tile gets the tinted/primary treatment. */
export function MoodPicker({ value, onChange }: Props) {
  const theme = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {MOODS.map((mood) => {
        const selected = value === mood.key;
        return (
          <Pressable
            key={mood.key}
            onPress={() => onChange(mood.key)}
            accessibilityRole="button"
            accessibilityLabel={mood.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: selected ? theme.colors.moduleJournal : theme.colors.border,
              backgroundColor: selected ? theme.colors.moduleJournalMuted : 'transparent',
            }}>
            <Text style={{ fontSize: 22 }}>{mood.emoji}</Text>
            <Text
              style={{
                fontSize: theme.typography.size.xs,
                fontWeight: selected ? theme.typography.weight.semibold : theme.typography.weight.medium,
                color: selected ? theme.colors.moduleJournal : theme.colors.textTertiary,
              }}>
              {mood.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
