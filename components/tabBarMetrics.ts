export const FLOATING_TAB_BAR_HEIGHT = 64;
export const FLOATING_TAB_BAR_MARGIN = 16;
/** Diameter of the global, draggable AI-assistant FAB (see AiAssistantFab.tsx) — it's mounted
 * once for every tab, at this size, so screen content clearance below must account for it too. */
export const AI_FAB_SIZE = 52;
/** Bottom offset for a screen's own floating "+" action button, so it clears the floating tab
 * bar instead of sitting behind it (the tab bar renders on top since it's part of the Tabs
 * navigator chrome, not the screen's own content). Used by every screen with its own FAB:
 * Today, Habits, Meditation, Breathing, Mind Training. */
export const FAB_BOTTOM_OFFSET = FLOATING_TAB_BAR_MARGIN + FLOATING_TAB_BAR_HEIGHT + 12;
/** How much extra bottom clearance scrollable screen content needs so the last item never sits
 * behind the floating, absolutely-positioned tab bar OR the globally-mounted AI-assistant FAB
 * (bottom-left on every tab) — see app/(tabs)/_layout.tsx and ScreenContainer.tsx, the places
 * this must stay in sync. The FAB's footprint (FAB_BOTTOM_OFFSET + its size) is taller than the
 * tab bar's own clearance need, so it's the one that determines this value. */
export const FLOATING_TAB_BAR_CLEARANCE = FAB_BOTTOM_OFFSET + AI_FAB_SIZE + 8;
/** Same idea as FLOATING_TAB_BAR_CLEARANCE, but for routes where the floating tab bar itself is
 * hidden (see HIDE_TAB_BAR_PREFIXES/PATHS below) — only the AI FAB still needs clearing, not the
 * bar's own height too. Using the full clearance on these routes left a large, purposeless empty
 * strip at the bottom of scrollable content once the bar was hidden but this padding wasn't. */
export const FLOATING_TAB_BAR_CLEARANCE_HIDDEN = FLOATING_TAB_BAR_MARGIN + AI_FAB_SIZE + 8;

/** The full-screen, task-focused workout module (hub, exercise library/picker, suggested
 * programs, sessions, etc.) hides the floating tab bar entirely — see app/(tabs)/_layout.tsx for
 * where this actually takes effect, and ScreenContainer.tsx for the matching bottom-clearance
 * adjustment. Single source of truth so the two stay in sync. */
export const HIDE_TAB_BAR_PREFIXES = ['/workout'];

export function isFloatingTabBarHidden(pathname: string): boolean {
  if (HIDE_TAB_BAR_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) return true;
  // The GPS recording screen (app/(tabs)/cardio/[activity]/record.tsx) and the save screen right
  // after it (app/(tabs)/cardio/[activity]/save.tsx) are both full-screen with their own
  // Start/Pause/Finish or Save/Discard buttons docked at the bottom — the floating tab bar renders
  // on top of them (it's Tabs navigator chrome, not screen content) and was covering those
  // buttons. Can't use a plain '/cardio' prefix like /workout's — that would also hide the bar on
  // the ordinary cardio list/detail screens, which still want it. Matched by suffix instead of
  // listing every '/cardio/{activity}/record' or '/save' path, since {activity} varies.
  if (pathname.startsWith('/cardio/') && (pathname.endsWith('/record') || pathname.endsWith('/save'))) return true;
  return false;
}
