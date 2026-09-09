import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { Card } from './Card';
import { useAppTheme } from '@/theme';

type Props = {
  remainingSeconds: number;
  /** 0–1. Animates smoothly toward each new value instead of jumping, unlike a plain
   * state-driven `width` percentage. */
  progress: number;
  color?: string;
};

/** The MM:SS + progress bar shared by the guided meditation player and the freeform timer —
 * previously each screen hand-rolled its own, which is how the freeform timer ended up missing
 * the progress bar the guided player had. */
export function CountdownDisplay({ remainingSeconds, progress, color }: Props) {
  const theme = useAppTheme();
  const accentColor = color ?? theme.colors.moduleJournal;
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, { toValue: progress, duration: 400, useNativeDriver: false }).start();
  }, [progress, widthAnim]);

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text
        style={{
          textAlign: 'center',
          color: theme.colors.textPrimary,
          fontSize: 56,
          fontWeight: theme.typography.weight.bold,
          fontVariant: ['tabular-nums'],
        }}>
        {minutes}:{seconds}
      </Text>

      <Card style={{ height: 8, padding: 0, overflow: 'hidden' }}>
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: accentColor,
            width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </Card>
    </View>
  );
}
