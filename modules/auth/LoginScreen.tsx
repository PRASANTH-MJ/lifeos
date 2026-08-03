import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import { useAppTheme } from '@/theme';
import { useAuth } from './useAuth';

type Mode = 'signin' | 'signup';

export function LoginScreen() {
  const theme = useAppTheme();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !submitting;

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  };

  const onForgotPassword = async () => {
    if (email.trim().length < 4) {
      setError('Enter your email above first, then tap "Forgot password?" again.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await resetPassword(email);
    setSubmitting(false);
    if (result.ok) setInfo('Password reset email sent — check your inbox.');
    else setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled">
        <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {mode === 'signin' ? 'Sign in to continue to LifeOS.' : 'Takes a few seconds — just an email and password.'}
          </Text>
        </View>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signin' ? 'Your password' : 'At least 6 characters'}
          secureTextEntry
          autoCapitalize="none"
        />

        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}
        {info ? <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm }}>{info}</Text> : null}

        {submitting ? (
          <ActivityIndicator />
        ) : (
          <Button label={mode === 'signin' ? 'Sign in' : 'Sign up'} onPress={onSubmit} disabled={!canSubmit} />
        )}

        {mode === 'signin' ? (
          <Button label="Forgot password?" variant="ghost" onPress={onForgotPassword} />
        ) : null}

        <Button
          label={mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          variant="ghost"
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
