import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { JOURNAL_PROMPTS, MoodPicker, useJournal } from '@/modules/journal';
import { useAppTheme } from '@/theme';

export default function NewJournalEntryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { createEntry } = useJournal('');

  const [prompt] = useState(() => JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    await createEntry({ body: body.trim(), mood, prompt });
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, fontStyle: 'italic' }}>
          {prompt}
        </Text>

        <MoodPicker value={mood} onChange={setMood} />

        <TextField
          placeholder="Write freely..."
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={8}
          style={{ minHeight: 160, textAlignVertical: 'top' }}
          autoFocus
        />

        <Button label="Save entry" onPress={onSave} disabled={body.trim().length === 0} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
