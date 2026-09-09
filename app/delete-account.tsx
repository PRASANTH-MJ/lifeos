import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Card, TextField } from '@/components';
import { functions } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { useAppTheme } from '@/theme';

const CONFIRM_WORD = 'DELETE';

export default function DeleteAccountScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmText.trim().toUpperCase() === CONFIRM_WORD && !submitting;

  const onDelete = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const deleteAccount = httpsCallable(functions, 'deleteAccount');
      await deleteAccount();
      await signOut();
      router.replace('/');
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          Delete your account
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
          This permanently deletes your Flowsy account ({user?.email}) and everything synced to it — habits, tasks, journal
          entries, finance records, workout logs, your avatar, and any cloud backups. This cannot be undone.
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, lineHeight: 18 }}>
          Content that only ever lived on this device (never signed in, or synced before an account existed) is not affected
          by this — it stays on the device until you delete it there or uninstall the app.
        </Text>
      </View>

      <Card style={{ gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Type <Text style={{ fontWeight: theme.typography.weight.bold, color: theme.colors.danger }}>{CONFIRM_WORD}</Text> to
          confirm.
        </Text>
        <TextField value={confirmText} onChangeText={setConfirmText} placeholder={CONFIRM_WORD} autoCapitalize="characters" autoCorrect={false} />
        {error ? (
          <View style={{ backgroundColor: theme.colors.dangerMuted, borderRadius: theme.radius.md, padding: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text>
          </View>
        ) : null}
        {submitting ? (
          <ActivityIndicator />
        ) : (
          <Button label="Permanently delete my account" variant="danger" disabled={!canSubmit} onPress={onDelete} />
        )}
      </Card>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
