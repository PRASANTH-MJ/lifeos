import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { Chip } from './Chip';

type Props = {
  label?: string;
  /** "HH:MM", 24-hour, or null for "no time set". */
  value: string | null;
  onChange: (value: string | null) => void;
};

function parseTime24(value: string | null): { hour24: number; minute: number } | null {
  if (!value) return null;
  const [hourStr, minuteStr] = value.split(':');
  const hour24 = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return null;
  return { hour24, minute };
}

// Time entry is always 12-hour + AM/PM here — the friendliest default for typing a
// time regardless of the app-wide Settings display format, which only governs how
// already-saved times are *read* elsewhere (list rows, detail headers).
export function TimeField({ label, value, onChange }: Props) {
  const theme = useAppTheme();

  const parsed = parseTime24(value);
  const [hourText, setHourText] = useState('');
  const [minuteText, setMinuteText] = useState('');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (!parsed) {
      setHourText('');
      setMinuteText('');
      return;
    }
    const hour12 = parsed.hour24 % 12 === 0 ? 12 : parsed.hour24 % 12;
    setHourText(String(hour12));
    setPeriod(parsed.hour24 < 12 ? 'AM' : 'PM');
    setMinuteText(String(parsed.minute).padStart(2, '0'));
    // Only re-sync from the external value — not on every local keystroke.
  }, [value]);

  const commit = (nextHourText: string, nextMinuteText: string, nextPeriod: 'AM' | 'PM') => {
    if (!nextHourText.trim() || !nextMinuteText.trim()) {
      onChange(null);
      return;
    }
    const hourInput = Number(nextHourText);
    const minuteInput = Number(nextMinuteText);
    if (Number.isNaN(hourInput) || Number.isNaN(minuteInput)) {
      onChange(null);
      return;
    }

    let hour24 = hourInput % 12;
    if (nextPeriod === 'PM') hour24 += 12;
    hour24 = Math.min(Math.max(hour24, 0), 23);
    const minute = Math.min(Math.max(minuteInput, 0), 59);
    onChange(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <TextInput
          value={hourText}
          onChangeText={setHourText}
          onBlur={() => commit(hourText, minuteText, period)}
          placeholder="hh"
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType="number-pad"
          maxLength={2}
          style={{
            width: 52,
            textAlign: 'center',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.size.base,
            paddingVertical: theme.spacing.md,
          }}
        />
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.lg }}>:</Text>
        <TextInput
          value={minuteText}
          onChangeText={setMinuteText}
          onBlur={() => commit(hourText, minuteText, period)}
          placeholder="MM"
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType="number-pad"
          maxLength={2}
          style={{
            width: 52,
            textAlign: 'center',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.size.base,
            paddingVertical: theme.spacing.md,
          }}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          {(['AM', 'PM'] as const).map((option) => (
            <Chip
              key={option}
              label={option}
              selected={period === option}
              onPress={() => {
                setPeriod(option);
                commit(hourText, minuteText, option);
              }}
            />
          ))}
        </View>
        {value ? (
          <Text onPress={() => onChange(null)} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            Clear
          </Text>
        ) : null}
      </View>
    </View>
  );
}

