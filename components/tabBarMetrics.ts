export const FLOATING_TAB_BAR_HEIGHT = 64;
export const FLOATING_TAB_BAR_MARGIN = 16;
/** How much extra bottom clearance scrollable screen content needs so the last item never sits
 * behind the floating, absolutely-positioned tab bar — see app/(tabs)/_layout.tsx and
 * ScreenContainer.tsx, the two places this must stay in sync. */
export const FLOATING_TAB_BAR_CLEARANCE = FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_MARGIN * 2;
/** Bottom offset for a screen's own floating "+" action button, so it clears the floating tab
 * bar instead of sitting behind it (the tab bar renders on top since it's part of the Tabs
 * navigator chrome, not the screen's own content). Used by every screen with its own FAB:
 * Today, Habits, Meditation, Breathing, Mind Training. */
export const FAB_BOTTOM_OFFSET = FLOATING_TAB_BAR_MARGIN + FLOATING_TAB_BAR_HEIGHT + 12;
