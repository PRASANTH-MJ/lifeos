import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { PanResponder } from 'react-native';

// Order of the 5 bottom tabs, left to right, as they appear in the tab bar.
const TAB_ORDER = ['/', '/habits', '/tasks', '/journal', '/more'] as const;
export type TabPath = (typeof TAB_ORDER)[number];

/**
 * Lets a top-level tab screen change tabs on a horizontal swipe, the same
 * order as the tab bar. Only claims the gesture once a swipe is clearly more
 * horizontal than vertical, so normal vertical scrolling is never intercepted.
 * onPanResponderMove/onPanResponderTerminationRequest must be present for the
 * gesture to actually resolve to onPanResponderRelease rather than being
 * silently abandoned partway through.
 */
export function useTabSwipeNavigation(currentPath: TabPath) {
  const router = useRouter();

  return useMemo(() => {
    const currentIndex = TAB_ORDER.indexOf(currentPath);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: () => {},
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx < 0 && currentIndex < TAB_ORDER.length - 1) {
          router.push(TAB_ORDER[currentIndex + 1]);
        } else if (gesture.dx > 0 && currentIndex > 0) {
          router.push(TAB_ORDER[currentIndex - 1]);
        }
      },
    }).panHandlers;
  }, [router, currentPath]);
}
