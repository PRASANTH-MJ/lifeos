import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, ScreenContainer, TextField } from '@/components';
import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { useFinanceGoals } from '@/modules/finance';
import { CalendarMonthGrid } from '@/modules/calendar';
import { useAppTheme } from '@/theme';

const COLORS = ['#3D8BFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#00BCD4'];

export default function NewGoalScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addGoal } = useFinanceGoals();

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  const [saving, setSaving] = useState(false);

  // Static route — expo-router reuses the same screen instance across repeated visits rather
  // than mounting a fresh one each time, so a plain useState default only resets once, ever.
  useFocusEffect(
    useCallback(() => {
      setName('');
      setColor(COLORS[0]);
      setTargetAmount('');
      setTargetDate(null);
    }, [])
  );

  const numericTarget = Number(targetAmount);
  const canSave = name.trim().length > 0 && numericTarget > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      await addGoal({ name: name.trim(), color, targetAmount: numericTarget, targetDate });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Goal name" placeholder="e.g. Emergency fund" value={name} onChangeText={setName} autoFocus />
        <TextField label="Target amount" placeholder="0.00" value={targetAmount} onChangeText={setTargetAmount} keyboardType="decimal-pad" />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Color</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {COLORS.map((option) => (
              <Pressable key={option} onPress={() => setColor(option)}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: option,
                    borderWidth: color === option ? 3 : 0,
                    borderColor: theme.colors.textPrimary,
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Target date (optional)
          </Text>
          <Chip
            label={targetDate ? targetDate : 'No deadline'}
            selected={!!targetDate}
            onPress={() => setDatePickerVisible(true)}
          />
        </View>

        <Button label="Save goal" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <Card style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={targetDate ?? todayKey()}
              markedDates={new Set(targetDate ? [targetDate] : [])}
              onSelectDate={(dateKey) => {
                setTargetDate(dateKey);
                setDatePickerVisible(false);
              }}
              onChangeMonth={(delta) => setDateCursor((cursor) => shiftMonth(cursor, delta))}
            />
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
