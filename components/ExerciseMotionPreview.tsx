import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Motion = 'circular' | 'swing' | 'bounce' | 'pulse' | 'hold';

/** No licensed photo/GIF library covers generic warm-up and stretch cues (unlike the wger-sourced
 * Exercise Library), so this classifies a move by keywords in its name and renders a small,
 * purpose-built looping animation instead — a real moving visual, not a static icon, without
 * depending on copyrighted third-party motion content. */
function classifyMotion(name: string): Motion {
  const n = name.toLowerCase();
  if (/circle|roll/.test(n)) return 'circular';
  if (/swing|twist|cat-cow|cat cow/.test(n)) return 'swing';
  if (/breathing|breath/.test(n)) return 'pulse';
  if (/jack|knee|squat|shrug|jump/.test(n)) return 'bounce';
  return 'hold';
}

const ICON_FOR: Record<Motion, keyof typeof Ionicons.glyphMap> = {
  circular: 'sync-outline',
  swing: 'body-outline',
  bounce: 'body-outline',
  pulse: 'pulse-outline',
  hold: 'body-outline',
};

export function ExerciseMotionPreview({ name, size = 100 }: { name: string; size?: number }) {
  const theme = useAppTheme();
  const motion = classifyMotion(name);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const loop =
      motion === 'circular'
        ? Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }))
        : Animated.loop(
            Animated.sequence([
              Animated.timing(anim, {
                toValue: 1,
                duration: motion === 'bounce' ? 420 : motion === 'swing' ? 800 : motion === 'pulse' ? 3200 : 2000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0,
                duration: motion === 'bounce' ? 420 : motion === 'swing' ? 800 : motion === 'pulse' ? 3200 : 2000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          );
    loop.start();
    return () => loop.stop();
  }, [anim, motion]);

  const transform =
    motion === 'circular'
      ? [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }]
      : motion === 'swing'
        ? [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['-22deg', '22deg'] }) }]
        : motion === 'bounce'
          ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }]
          : motion === 'pulse'
            ? [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }]
            : [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.moduleTasksMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Animated.View style={{ transform }}>
        <Ionicons name={ICON_FOR[motion]} size={size * 0.44} color={theme.colors.moduleTasks} />
      </Animated.View>
    </View>
  );
}
