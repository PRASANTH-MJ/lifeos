import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';

import { useAppTheme } from '@/theme';
import type { BreathingStep } from './types';

const MIN_SCALE = 0.55;
const MAX_SCALE = 1;
const SIZE = 200;
const PETAL_COUNT = 6;

type Props = {
  step: BreathingStep;
  secondsLeft: number;
  color: string;
};

/** Same bloom-on-inhale / close-on-exhale idea as BreathingCircle, just a flower shape instead of a plain disc. */
export function BreathingFlower({ step, secondsLeft, color }: Props) {
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
    // "Hold" intentionally does nothing — the flower stays wherever it is.
  }, [step, scale]);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ scale }] }}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
          {Array.from({ length: PETAL_COUNT }).map((_, index) => (
            <Ellipse
              key={index}
              cx={100}
              cy={52}
              rx={26}
              ry={52}
              fill={color}
              opacity={0.5}
              transform={`rotate(${(360 / PETAL_COUNT) * index} 100 100)`}
            />
          ))}
          <Circle cx={100} cy={100} r={20} fill={color} opacity={0.9} />
        </Svg>
      </Animated.View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
        {step.label}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size['2xl'], fontVariant: ['tabular-nums'] }}>
        {secondsLeft}
      </Text>
    </View>
  );
}
