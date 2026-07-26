import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { useShoppingLists } from '@/modules/shopping';
import { useAppTheme } from '@/theme';

export default function NewShoppingListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addList } = useShoppingLists();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const listId = await addList(name.trim());
      router.replace({ pathname: '/shopping/[listId]', params: { listId } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="List name" placeholder="e.g. Groceries, Trip to Goa" value={name} onChangeText={setName} autoFocus onSubmitEditing={onSave} />
        <Button label="Create list" onPress={onSave} disabled={!name.trim()} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
