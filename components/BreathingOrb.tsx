import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

type Props = {
  /** Breathes continuously while true; eases back to resting size otherwise. */
  active: boolean;
  color?: string;
  /** Size of the content passed as children — the breathing halo renders larger than this and
   * pulses around it. */
  size: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const HALO_SCALE = 1.35;
const BREATH_MS = 2600;

/** A soft, continuously expanding/contracting halo behind its children (the play/pause button,
 * a session icon, etc.) — the classic "breathe with the animation" cue meditation apps use to
 * give the screen some life while a session is actually running. */
export function BreathingOrb({ active, color, size, children, style }: Props) {
  const theme = useAppTheme();
  const accentColor = color ?? theme.colors.moduleJournal;
  const scale = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();
    if (active) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: HALO_SCALE, duration: BREATH_MS, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: BREATH_MS, useNativeDriver: true }),
        ])
      );
      loopRef.current.start();
    } else {
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
    return () => loopRef.current?.stop();
  }, [active, scale]);

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(accentColor, 0.16),
          transform: [{ scale }],
        }}
      />
      {children}
    </View>
  );
}
