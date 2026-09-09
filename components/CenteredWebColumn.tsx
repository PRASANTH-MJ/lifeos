import type { ReactNode } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

/** Same breakpoint app/(tabs)/_layout.tsx uses to swap the floating tab bar for the permanent
 * DesktopSidebar — a screen is "on desktop web" exactly when that sidebar is showing. */
export const DESKTOP_BREAKPOINT = 768;

export function useIsDesktopWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

/** Centers narrow, feed-like content (a single column of fixed-width cards) in the remaining
 * space next to DesktopSidebar instead of leaving it pinned to the left edge with a huge empty
 * gutter on the right — the same "centered column" layout Twitter/Instagram's web feeds use.
 * Always fills its parent's height (so a ScreenContainer inside still stretches full-screen); on
 * phone widths and native it's just a transparent flex:1 wrapper, no visual change. Any
 * absolutely-positioned child (e.g. a FAB) anchors to this same constrained column, not the full
 * remaining desktop width, so it lines up with the centered content instead of floating off to
 * the far right of the screen. */
export function CenteredWebColumn({ children, maxWidth = 600 }: { children?: ReactNode; maxWidth?: number }) {
  const isDesktopWeb = useIsDesktopWeb();
  return (
    <View style={{ flex: 1, width: '100%', maxWidth: isDesktopWeb ? maxWidth : undefined, alignSelf: 'center' }}>
      {children}
    </View>
  );
}
