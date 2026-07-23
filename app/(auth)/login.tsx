import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { useAuth } from '@/modules/auth';
import { useAppTheme } from '@/theme';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { signIn, addingAccount, cancelAddAccount } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign in.');
    }
    setLoading(false);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl, marginTop: theme.spacing['4xl'] }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            {addingAccount ? 'Add an account' : 'Welcome back'}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {addingAccount ? 'Log in with another account to switch between them.' : 'Log in to LifeOS'}
          </Text>
        </View>

        <TextField
          label="Email or username"
          placeholder="you@example.com"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}

        <Button label="Log in" onPress={onSubmit} disabled={!identifier.trim() || !password} loading={loading} />

        <Link href="/signup" style={{ textAlign: 'center' }}>
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm }}>Don&apos;t have an account? Sign up</Text>
        </Link>

        {addingAccount ? (
          <Text onPress={cancelAddAccount} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            Cancel
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
