import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { useAffirmations } from '@/modules/affirmations';
import { useAppTheme } from '@/theme';

export default function NewAffirmationScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { createCustom } = useAffirmations();

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    await createCustom(text.trim());
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField
          label="Your affirmation"
          placeholder="e.g. I show up for myself every day"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={3}
          autoFocus
        />
        <Button label="Save affirmation" onPress={onSave} disabled={text.trim().length === 0} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
