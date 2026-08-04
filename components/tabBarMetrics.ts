export const FLOATING_TAB_BAR_HEIGHT = 64;
export const FLOATING_TAB_BAR_MARGIN = 16;
/** How much extra bottom clearance scrollable screen content needs so the last item never sits
 * behind the floating, absolutely-positioned tab bar — see app/(tabs)/_layout.tsx and
 * ScreenContainer.tsx, the two places this must stay in sync. */
export const FLOATING_TAB_BAR_CLEARANCE = FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_MARGIN * 2;
