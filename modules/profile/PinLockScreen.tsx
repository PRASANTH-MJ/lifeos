import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Button } from '@/components';
import { useAppTheme } from '@/theme';

type Props = {
  verifyPin: (pin: string) => Promise<boolean>;
  onUnlock: () => void;
};

export function PinLockScreen({ verifyPin, onUnlock }: Props) {
  const theme = useAppTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const onSubmit = async () => {
    setChecking(true);
    setError(null);
    const ok = await verifyPin(pin);
    setChecking(false);
    if (ok) {
      onUnlock();
    } else {
      setError('Incorrect PIN.');
      setPin('');
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, gap: theme.spacing.xl, padding: theme.spacing.xl }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
        Enter PIN
      </Text>
      <TextInput
        value={pin}
        onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
        secureTextEntry
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        onSubmitEditing={onSubmit}
        style={{
          width: 160,
          textAlign: 'center',
          fontSize: theme.typography.size['2xl'],
          letterSpacing: 8,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface,
          color: theme.colors.textPrimary,
          paddingVertical: theme.spacing.md,
        }}
      />
      {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}
      {checking ? <ActivityIndicator /> : <Button label="Unlock" onPress={onSubmit} disabled={pin.length < 4} />}
    </View>
  );
}
