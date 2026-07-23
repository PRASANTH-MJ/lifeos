import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { useEventDetail } from '@/modules/calendar';
import { useAppTheme } from '@/theme';

export default function EventDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const { event, loading, updateEvent, deleteEvent } = useEventDetail(eventId);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setNotes(event.notes ?? '');
    }
  }, [event]);

  if (loading || !event) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onDelete = () => {
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent();
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          {formatDisplayDate(event.date)}
          {event.start_time ? ` · ${event.start_time}${event.end_time ? ` – ${event.end_time}` : ''}` : ''}
        </Text>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          onBlur={() => title.trim() && title !== event.title && updateEvent({ title: title.trim() })}
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          onBlur={() => notes !== (event.notes ?? '') && updateEvent({ notes: notes.trim() || null })}
          multiline
          numberOfLines={4}
        />
        <Button label="Delete event" variant="danger" onPress={onDelete} />
      </View>
    </ScreenContainer>
  );
}
