import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A pill selector with a sliding highlight — generalizes the hand-rolled 2-Chip-row pattern
 * (e.g. Settings' time format toggle) into something reusable for any small fixed option set. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useAppTheme();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const slide = useRef(new Animated.Value(selectedIndex)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: selectedIndex, duration: 200, useNativeDriver: false }).start();
  }, [selectedIndex, slide]);

  const left = slide.interpolate({
    inputRange: options.map((_, index) => index),
    outputRange: options.map((_, index) => `${(index / options.length) * 100}%`),
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 3,
      }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left,
          width: `${100 / options.length}%`,
          backgroundColor: theme.colors.primaryMuted,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        }}
      />
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={{ flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center' }}>
          <Text
            style={{
              color: value === option.value ? theme.colors.primary : theme.colors.textSecondary,
              fontSize: theme.typography.size.sm,
              fontWeight: theme.typography.weight.semibold,
            }}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
