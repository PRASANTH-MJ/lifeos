import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { MOODS } from './types';

type Props = {
  value: string | null;
  onChange: (mood: string) => void;
};

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
            style={{
              alignItems: 'center',
              gap: 4,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.sm,
              borderRadius: theme.radius.md,
              backgroundColor: selected ? theme.colors.moduleJournalMuted : 'transparent',
            }}>
            <Text style={{ fontSize: 24 }}>{mood.emoji}</Text>
            <Text
              style={{
                fontSize: theme.typography.size.xs,
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
