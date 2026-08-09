import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, View } from 'react-native';

import { FAB_BOTTOM_OFFSET } from '@/components/tabBarMetrics';
import { useBudgetAlert } from '@/modules/finance';
import { useAppTheme } from '@/theme';

const BUTTON_SIZE = 52;
const POSITION_KEY = 'ai-assistant-fab-position';
const DRAG_THRESHOLD = 6;

/** A single, draggable floating "AI Assistant" entry point (sparkle icon), mounted once at the
 * (tabs) layout root so it's reachable from everywhere — Today, Habits, all of it. A tap (movement
 * under DRAG_THRESHOLD) opens the full /assistant page; anything past that is treated as a drag to
 * reposition, with the new spot remembered across app restarts. */
export function AiAssistantFab() {
  const theme = useAppTheme();
  const router = useRouter();
  const { alert: budgetAlert } = useBudgetAlert();

  const { width, height } = Dimensions.get('window');
  const defaultX = theme.spacing.lg;
  const defaultY = height - FAB_BOTTOM_OFFSET - BUTTON_SIZE;

  const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
  const dragged = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(POSITION_KEY).then((raw) => {
      if (raw) {
        try {
          const { x, y } = JSON.parse(raw);
          pan.setValue({ x, y });
        } catch {
          // Corrupt/old value — keep the default position.
        }
      }
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragged.current = false;
        pan.setOffset({ x: (pan.x as unknown as { _value: number })._value, y: (pan.y as unknown as { _value: number })._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_evt, gesture) => {
        if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) dragged.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_evt, gesture);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const current = pan as unknown as { x: { _value: number }; y: { _value: number } };
        const clampedX = Math.min(Math.max(current.x._value, 0), width - BUTTON_SIZE);
        const clampedY = Math.min(Math.max(current.y._value, 40), height - BUTTON_SIZE - 40);
        pan.setValue({ x: clampedX, y: clampedY });
        AsyncStorage.setItem(POSITION_KEY, JSON.stringify({ x: clampedX, y: clampedY }));
        if (!dragged.current) router.push('/assistant');
      },
    })
  ).current;

  if (!ready) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        transform: pan.getTranslateTransform(),
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadow.md,
      }}>
      <Ionicons name="sparkles" size={22} color="#fff" />
      {budgetAlert ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: theme.colors.danger,
            borderWidth: 2,
            borderColor: theme.colors.background,
          }}
        />
      ) : null}
    </Animated.View>
  );
}
