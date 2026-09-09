import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { useAppTheme } from '@/theme';
import { Button } from './Button';
import { ShareCard, type ShareCardData } from './ShareCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  data: ShareCardData | null;
};

export function ShareCardModal({ visible, onClose, data }: Props) {
  const theme = useAppTheme();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your achievement' });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.centered} pointerEvents="box-none">
          {data ? <ShareCard ref={cardRef} data={data} /> : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.full }]}>
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </Pressable>
            <Button label="Share" variant="gradient" onPress={onShare} loading={sharing} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
