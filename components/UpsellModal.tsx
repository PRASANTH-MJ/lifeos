import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { Button } from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Count-based cap message, e.g. "up to 5 habits". Omit both and pass `message` instead for a
   * plain feature gate (e.g. theme switching) that isn't about a count. */
  resourceLabel?: string;
  limit?: number;
  message?: string;
};

/** Shown instead of letting a free-tier user create one more than their cap allows (or use a
 * Pro-only feature) — never shown for existing items, only at the point of hitting the gate. */
export function UpsellModal({ visible, resourceLabel, limit, message, onClose }: Props) {
  const theme = useAppTheme();
  const router = useRouter();

  const body =
    message ??
    (resourceLabel != null && limit != null
      ? `The free plan includes up to ${limit} ${resourceLabel}. Go Pro for unlimited ${resourceLabel}.`
      : 'Go Pro to unlock this.');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <Text style={{ fontSize: 40 }}>✨</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {resourceLabel != null && limit != null ? 'Free plan limit reached' : 'That\'s a Pro feature'}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base }}>{body}</Text>
          <Button
            label="Go Pro"
            onPress={() => {
              onClose();
              router.push('/premium');
            }}
          />
          <Button label="Not now" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
