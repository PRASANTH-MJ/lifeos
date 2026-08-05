import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Button, ScreenContainer, TextField } from '@/components';
import { firestore } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { useAppTheme } from '@/theme';

export default function FeedbackScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!user || message.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(firestore, 'feedback'), {
        uid: user.uid,
        email: user.email,
        message: message.trim(),
        rating,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? null,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch {
      setError('Could not send feedback — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
          <Text style={{ fontSize: 48 }}>✓</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            Thanks for the feedback
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            We read every submission — it genuinely shapes what gets built next.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Bug reports, feature ideas, or anything that's bugging you about the app — this goes straight to the developer.
        </Text>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            How's Flowsy working for you? (optional)
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(rating === star ? null : star)} hitSlop={8}>
                <Ionicons
                  name={rating != null && star <= rating ? 'star' : 'star-outline'}
                  size={28}
                  color={rating != null && star <= rating ? theme.colors.warning : theme.colors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <TextField
          label="Your feedback"
          placeholder="What's on your mind?"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
          autoFocus
        />

        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}

        <Button label="Send feedback" onPress={onSubmit} disabled={message.trim().length === 0} loading={submitting} variant="gradient" />
      </View>
    </ScreenContainer>
  );
}
