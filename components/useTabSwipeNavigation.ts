import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { PanResponder, Platform } from 'react-native';

// Order of the 5 bottom tabs, left to right, as they appear in the tab bar.
const TAB_ORDER = ['/', '/health-fitness', '/finance', '/mindfulness-wellness', '/more'] as const;
export type TabPath = (typeof TAB_ORDER)[number];

/**
 * Lets a top-level tab screen change tabs on a horizontal swipe, the same
 * order as the tab bar. Only claims the gesture once a swipe is clearly more
 * horizontal than vertical, so normal vertical scrolling is never intercepted.
 * onPanResponderMove/onPanResponderTerminationRequest must be present for the
 * gesture to actually resolve to onPanResponderRelease rather than being
 * silently abandoned partway through.
 *
 * Web-disabled entirely: a native <ScrollView> claims the touch responder for its own
 * horizontal scroll and blocks this PanResponder via the responder system, but
 * react-native-web's ScrollView scrolls through plain CSS overflow and never participates in
 * that system at all — so on web this was the only responder listening, and it hijacked every
 * horizontal drag over a nested horizontal ScrollView (e.g. the Finance screen's Records/Budgets/
 * Goals chip row) into a same-time tab change while the chip row visually scrolled underneath it.
 * Swiping to change tabs is a native mobile affordance anyway; web users click tabs instead, so
 * there's no loss in dropping it there — just returning empty handlers is enough, since an empty
 * PanResponder never claims anything.
 */
export function useTabSwipeNavigation(currentPath: TabPath) {
  const router = useRouter();

  return useMemo(() => {
    if (Platform.OS === 'web') {
      return PanResponder.create({}).panHandlers;
    }

    const currentIndex = TAB_ORDER.indexOf(currentPath);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: () => {},
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, gesture) => {
        // navigate (not push) — these are sibling tabs, not a new screen to stack. push was
        // adding a fresh history entry on every swipe, which both piled up the back-stack and
        // played a screen-push slide animation instead of the tab bar's instant cross-fade,
        // making repeated swipes feel like they were stacking up rather than just switching.
        if (gesture.dx < 0 && currentIndex < TAB_ORDER.length - 1) {
          router.navigate(TAB_ORDER[currentIndex + 1]);
        } else if (gesture.dx > 0 && currentIndex > 0) {
          router.navigate(TAB_ORDER[currentIndex - 1]);
        }
      },
    }).panHandlers;
  }, [router, currentPath]);
}
