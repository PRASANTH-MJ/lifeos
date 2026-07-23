import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { useCalendarDay } from '@/modules/calendar';
import { useAppTheme } from '@/theme';

export default function NewEventScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateKey = date ?? todayKey();
  const { createEvent } = useCalendarDay(dateKey);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    await createEvent({
      title: title.trim(),
      notes: notes.trim() || undefined,
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
    });
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          {formatDisplayDate(dateKey)}
        </Text>
        <TextField label="Title" placeholder="e.g. Dentist appointment" value={title} onChangeText={setTitle} autoFocus />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField label="Start (optional)" placeholder="14:00" value={startTime} onChangeText={setStartTime} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="End (optional)" placeholder="15:00" value={endTime} onChangeText={setEndTime} />
          </View>
        </View>
        <TextField label="Notes (optional)" placeholder="Add details" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        <Button label="Save event" onPress={onSave} disabled={title.trim().length === 0} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
