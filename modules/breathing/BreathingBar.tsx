import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { BreathingStep } from './types';

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 200;
const WIDTH = 56;

type Props = {
  step: BreathingStep;
  secondsLeft: number;
  color: string;
};

/** A vertical bar that fills on inhale and drains on exhale, like a water level. */
export function BreathingBar({ step, secondsLeft, color }: Props) {
  const theme = useAppTheme();
  const height = useRef(new Animated.Value(MIN_HEIGHT)).current;

  useEffect(() => {
    if (step.label === 'Inhale') {
      Animated.timing(height, {
        toValue: MAX_HEIGHT,
        duration: step.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else if (step.label === 'Exhale') {
      Animated.timing(height, {
        toValue: MIN_HEIGHT,
        duration: step.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    }
  }, [step, height]);

  return (
    <View style={{ width: 200, height: MAX_HEIGHT + 60, alignItems: 'center', justifyContent: 'flex-end', gap: theme.spacing.md }}>
      <View
        style={{
          width: WIDTH,
          height: MAX_HEIGHT,
          borderRadius: WIDTH / 2,
          borderWidth: 2,
          borderColor: color,
          justifyContent: 'flex-end',
          overflow: 'hidden',
          backgroundColor: 'transparent',
        }}>
        <Animated.View style={{ width: '100%', height, backgroundColor: color, opacity: 0.4, borderRadius: WIDTH / 2 }} />
      </View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
        {step.label}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size['2xl'], fontVariant: ['tabular-nums'] }}>
        {secondsLeft}
      </Text>
    </View>
  );
}
