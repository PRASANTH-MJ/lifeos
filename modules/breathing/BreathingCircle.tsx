import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { BreathingStep } from './types';

const MIN_SCALE = 0.62;
const MAX_SCALE = 1;
const SIZE = 200;

type Props = {
  step: BreathingStep;
  secondsLeft: number;
  color: string;
};

export function BreathingCircle({ step, secondsLeft, color }: Props) {
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
    // "Hold" intentionally does nothing — the circle stays wherever it is.
  }, [step, scale]);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: color,
          opacity: 0.25,
          transform: [{ scale }],
        }}
      />
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
        {step.label}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size['2xl'], fontVariant: ['tabular-nums'] }}>
        {secondsLeft}
      </Text>
    </View>
  );
}
