import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { useAuth } from '@/modules/auth';
import { useAppTheme } from '@/theme';

export default function SignupScreen() {
  const theme = useAppTheme();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validationError =
    password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters.'
      : confirmPassword.length > 0 && password !== confirmPassword
        ? 'Passwords don’t match.'
        : null;

  const canSubmit = email.trim() && username.trim() && password.length >= 8 && password === confirmPassword;

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign up.');
    }
    setLoading(false);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl, marginTop: theme.spacing['4xl'] }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Create your account
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            Your habit/task/journal data stays on this device — this account is only for signing in.
          </Text>
        </View>

        <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <TextField label="Username" placeholder="yourname" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
        <TextField label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField label="Confirm password" placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        {validationError || error ? (
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error ?? validationError}</Text>
        ) : null}

        <Button label="Sign up" onPress={onSubmit} disabled={!canSubmit} loading={loading} />

        <Link href="/login" style={{ textAlign: 'center' }}>
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm }}>Already have an account? Log in</Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}
