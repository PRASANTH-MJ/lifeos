import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, ScreenContainer, TextField } from '@/components';
import { useFinanceDebts } from '@/modules/finance';
import type { DebtDirection } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function NewDebtScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addDebt } = useFinanceDebts();

  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const numericAmount = Number(amount);
  const canSave = personName.trim().length > 0 && numericAmount > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      await addDebt({ personName: personName.trim(), direction, amount: numericAmount, note: note.trim() || null });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip
            label="I lent money"
            selected={direction === 'lent'}
            onPress={() => setDirection('lent')}
            color={theme.colors.success}
            mutedColor={theme.colors.successMuted}
          />
          <Chip
            label="I borrowed money"
            selected={direction === 'borrowed'}
            onPress={() => setDirection('borrowed')}
            color={theme.colors.danger}
            mutedColor={theme.colors.dangerMuted}
          />
        </View>

        <TextField label="Person" placeholder="e.g. Ravi" value={personName} onChangeText={setPersonName} autoFocus />
        <TextField label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <TextField label="Note (optional)" placeholder="What's this for?" value={note} onChangeText={setNote} />

        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          Debts are tracked separately from your accounts — logging one here doesn&apos;t move money between accounts.
        </Text>

        <Button label="Save" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
