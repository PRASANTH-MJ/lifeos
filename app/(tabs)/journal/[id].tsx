import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, LoadingState, ScreenContainer, TextField } from '@/components';
import { formatDisplayDateTime } from '@/lib/date';
import { MoodPicker, useJournalDetail } from '@/modules/journal';
import { useAppTheme } from '@/theme';

export default function JournalDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  const { entry, loading, updateEntry, deleteEntry } = useJournalDetail(entryId);

  const [body, setBody] = useState('');

  useEffect(() => {
    if (entry) setBody(entry.body);
  }, [entry]);

  if (loading || !entry) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onDelete = () => {
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry();
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          {formatDisplayDateTime(entry.created_at)}
        </Text>

        {entry.prompt ? (
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, fontStyle: 'italic' }}>
            {entry.prompt}
          </Text>
        ) : null}

        <MoodPicker value={entry.mood} onChange={(mood) => updateEntry({ mood })} />

        <TextField
          value={body}
          onChangeText={setBody}
          onBlur={() => {
            if (body.trim() && body !== entry.body) {
              updateEntry({ body: body.trim() });
            }
          }}
          multiline
          numberOfLines={10}
          style={{ minHeight: 200, textAlignVertical: 'top' }}
        />

        <Button label="Delete entry" variant="danger" onPress={onDelete} />
      </View>
    </ScreenContainer>
  );
}
