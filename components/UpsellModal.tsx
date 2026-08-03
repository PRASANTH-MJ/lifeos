import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { Button } from './Button';

type Props = {
  visible: boolean;
  resourceLabel: string;
  limit: number;
  onClose: () => void;
};

/** Shown instead of letting a free-tier user create one more than their cap allows — never
 * shown for existing items, only at the point of creating something new. */
export function UpsellModal({ visible, resourceLabel, limit, onClose }: Props) {
  const theme = useAppTheme();
  const router = useRouter();

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
            Free plan limit reached
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base }}>
            The free plan includes up to {limit} {resourceLabel}. Go Premium for unlimited {resourceLabel} — ₹500, once, forever.
          </Text>
          <Button
            label="Go Premium"
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
