import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { BreathingStep } from './types';

const MIN_SCALE = 0.5;
const MAX_SCALE = 1;
const SIZE = 200;
const RINGS = [1, 0.72, 0.46];

type Props = {
  step: BreathingStep;
  secondsLeft: number;
  color: string;
};

/** Three concentric rings scaling together — a "ripple" alternative to the plain circle. */
export function BreathingWave({ step, secondsLeft, color }: Props) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(MIN_SCALE)).current;

  useEffect(() => {
    if (step.label === 'Inhale') {
      Animated.timing(scale, {
        toValue: MAX_SCALE,
        duration: step.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else if (step.label === 'Exhale') {
      Animated.timing(scale, {
        toValue: MIN_SCALE,
        duration: step.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [step, scale]);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {RINGS.map((ringScale, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            borderWidth: 2,
            borderColor: color,
            opacity: 0.35 - index * 0.08,
            transform: [{ scale: Animated.multiply(scale, ringScale) }],
          }}
        />
      ))}
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
        {step.label}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size['2xl'], fontVariant: ['tabular-nums'] }}>
        {secondsLeft}
      </Text>
    </View>
  );
}
