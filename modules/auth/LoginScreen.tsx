import { useState } from 'react';
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

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
    Keyboard.dismiss();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  };

  const onForgotPassword = async () => {
    Keyboard.dismiss();
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

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setInfo(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.xl, paddingTop: theme.spacing['4xl'], gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              ...theme.shadow.md,
            }}>
            <Image source={require('../../assets/icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            Flowsy
          </Text>
        </View>

        <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {mode === 'signin' ? 'Sign in to continue to Flowsy.' : 'Takes a few seconds — just an email and password.'}
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
          isPassword
          autoCapitalize="none"
        />

        {error ? (
          <View style={{ backgroundColor: theme.colors.dangerMuted, borderRadius: theme.radius.md, padding: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text>
          </View>
        ) : null}
        {info ? (
          <View style={{ backgroundColor: theme.colors.successMuted, borderRadius: theme.radius.md, padding: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm }}>{info}</Text>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          {submitting ? (
            <ActivityIndicator />
          ) : (
            <Button label={mode === 'signin' ? 'Sign in' : 'Sign up'} onPress={onSubmit} disabled={!canSubmit} />
          )}

          {mode === 'signin' ? (
            <Pressable onPress={onForgotPassword} style={{ alignItems: 'center', paddingVertical: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Forgot password?</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable onPress={switchMode} style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
