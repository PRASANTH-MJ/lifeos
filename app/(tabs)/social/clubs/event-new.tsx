import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Button, Card, Chip, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate, monthCursorOf, shiftMonth, todayKey, weekdayOf } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { EVENT_TYPES, EVENT_TYPE_LABELS, useCreateEvent, type EventType } from '@/modules/clubs';
import { useAppTheme } from '@/theme';

const TIME_OPTIONS = ['06:00', '07:00', '08:00', '17:00', '18:00', '19:00'];

export default function CreateEventScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { createEvent, submitting } = useCreateEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState('07:00');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateCursor, setDateCursor] = useState(() => monthCursorOf(todayKey()));
  const [recurring, setRecurring] = useState(false);
  const [eventType, setEventType] = useState<EventType>('other');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canCreate = title.trim().length > 0;

  const onCreate = async () => {
    if (!clubId || !canCreate) return;
    setError(null);
    try {
      const [hour, minute] = time.split(':').map(Number);
      const startsAt = new Date(date);
      startsAt.setHours(hour, minute, 0, 0);
      const numericCapacity = Number(capacity);
      const eventId = await createEvent(clubId, {
        title: title.trim(),
        description: description.trim(),
        startsAtMs: startsAt.getTime(),
        eventType,
        capacity: capacity.trim() && Number.isFinite(numericCapacity) && numericCapacity > 0 ? Math.floor(numericCapacity) : null,
        ...(recurring ? { recurring: true, recurrenceDayOfWeek: weekdayOf(date), anchorOccurrenceDate: date } : {}),
      });
      router.replace({ pathname: '/social/clubs/event', params: { clubId, eventId } });
    } catch {
      // createEvent's httpsCallable throws on failure — without this the rejection was
      // unhandled and the button just silently reset with no feedback at all.
      setError('Could not create the event. Please try again.');
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          New Event
        </Text>
        <TextField label="Title" placeholder="e.g. Saturday morning 5K" value={title} onChangeText={setTitle} autoFocus />
        <TextField label="Description (optional)" placeholder="Meeting point, pace, what to bring..." value={description} onChangeText={setDescription} multiline />

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Date</Text>
          </View>
          <Chip label={formatDisplayDate(date)} selected onPress={() => setDatePickerVisible(true)} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Time</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            {TIME_OPTIONS.map((option) => (
              <Chip key={option} label={option} selected={time === option} onPress={() => setTime(option)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Event type</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            {EVENT_TYPES.map((type) => (
              <Chip key={type} label={EVENT_TYPE_LABELS[type]} selected={eventType === type} onPress={() => setEventType(type)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <TextField label="Capacity (optional)" placeholder="Unlimited" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          {capacity.trim() ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Once {capacity.trim()} members are going, anyone else who RSVPs joins a waitlist automatically.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Repeats</Text>
          <Chip label="Repeats weekly" selected={recurring} onPress={() => setRecurring((current) => !current)} />
          {recurring ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              A new occurrence shows up every {formatDisplayDate(date).split(',')[0]} — members RSVP separately for each week.
            </Text>
          ) : null}
        </View>

        <Button label="Create Event" onPress={onCreate} disabled={!canCreate} loading={submitting} glow />
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{error}</Text>
        ) : !canCreate ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>Enter a title to continue</Text>
        ) : null}
      </View>

      <Modal visible={datePickerVisible} animationType="slide" transparent onRequestClose={() => setDatePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setDatePickerVisible(false)} />
          <Card style={{ borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, gap: theme.spacing.lg }}>
            <CalendarMonthGrid
              year={dateCursor.year}
              month={dateCursor.month}
              selectedDate={date}
              markedDates={new Set([date])}
              onSelectDate={(dateKey) => {
                setDate(dateKey);
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
