import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
  /** Shown under the 1 and 5 ends only, e.g. ['Low', 'High'] — optional. */
  endLabels?: [string, string];
};

/** A 1-5 numeric scale picker, same row-of-pressable-pills pattern as MoodPicker — used for
 * energy/stress/productivity in the Journal check-ins. */
export function Scale5Picker({ value, onChange, endLabels }: Props) {
  const theme = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        const label = n === 1 ? endLabels?.[0] : n === 5 ? endLabels?.[1] : undefined;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.md,
              backgroundColor: selected ? theme.colors.moduleJournalMuted : 'transparent',
              borderWidth: 1,
              borderColor: selected ? theme.colors.moduleJournal : theme.colors.border,
            }}>
            <Text
              style={{
                fontSize: theme.typography.size.lg,
                fontWeight: theme.typography.weight.semibold,
                color: selected ? theme.colors.moduleJournal : theme.colors.textPrimary,
              }}>
              {n}
            </Text>
            {label ? (
              <Text style={{ fontSize: theme.typography.size.xs, color: theme.colors.textTertiary }}>{label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
