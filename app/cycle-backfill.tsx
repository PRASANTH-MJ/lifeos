import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Card, Chip } from '@/components';
import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { useCycleLogs, type FlowLevel } from '@/modules/cycle';
import { useAppTheme } from '@/theme';

const EMPTY_MARKED_DATES = new Set<string>();

const FLOW_OPTIONS: { key: FlowLevel; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'Heavy' },
];

/** Bulk-log several past period days at once — e.g. last month's period — instead of stepping
 * through cycle-new.tsx one day at a time. Predictions (predictNextPeriod.ts) only stop relying
 * on the fallback average once at least two real period starts exist in cycle_logs, so this is
 * what actually unlocks accurate predictions for a new tracker instead of making them wait
 * through a couple of months of daily logging first. */
export default function CycleBackfillScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { upsertLog } = useCycleLogs();
  const [cursor, setCursor] = useState(() => monthCursorOf(todayKey()));
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [flow, setFlow] = useState<FlowLevel>('medium');
  const [saving, setSaving] = useState(false);

  const toggleDate = (date: string) => {
    if (date > todayKey()) return;
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    for (const date of selectedDates) {
      await upsertLog(date, { flow, symptoms: [], notes: null });
    }
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }} style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
        Log past periods
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
        Tap every day you had your period. You can page back to previous months to add more than one cycle.
      </Text>

      <Card tier="panel" style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Flow</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {FLOW_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={flow === option.key} onPress={() => setFlow(option.key)} />
          ))}
        </View>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Applied to every day you select below.</Text>
      </Card>

      <Card tier="panel">
        <CalendarMonthGrid
          year={cursor.year}
          month={cursor.month}
          selectedDate=""
          selectedDates={selectedDates}
          markedDates={EMPTY_MARKED_DATES}
          onSelectDate={toggleDate}
          onChangeMonth={(delta) => setCursor((c) => shiftMonth(c, delta))}
        />
      </Card>

      <Button
        label={`Save ${selectedDates.size} day${selectedDates.size === 1 ? '' : 's'}`}
        onPress={onSave}
        disabled={selectedDates.size === 0}
        loading={saving}
        glow
      />
    </ScrollView>
  );
}
