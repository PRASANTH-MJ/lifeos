import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  /** True while the wrapped checkbox is in its "completed" state — a false→true transition
   * (not the initial mount value) triggers the haptic pulse. */
  active: boolean;
  size: number;
  color?: string;
  children: ReactNode;
};

/** Wraps a completion checkbox (habit/task) with a one-shot haptic + expanding glow-ring burst
 * the moment it flips to completed — shared by HabitListItem, TaskListItem and
 * RecurringTaskListItem so the same feedback fires everywhere a "done" checkbox exists. */
export function CompletionPulse({ active, size, color, children }: Props) {
  const theme = useAppTheme();
  const ringColor = color ?? theme.colors.success;
  const pulse = useRef(new Animated.Value(0)).current;
  const previousActiveRef = useRef(active);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      previousActiveRef.current = active;
      return;
    }
    if (active && !previousActiveRef.current) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      pulse.setValue(0);
      Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }).start();
    }
    previousActiveRef.current = active;
  }, [active, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ringColor,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      {children}
    </View>
  );
}
