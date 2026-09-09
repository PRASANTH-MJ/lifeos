import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RoutePoint } from '@/modules/cardio';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';
import { CardioRouteMap } from './CardioRouteMap';
import type { ShareCardData } from './ShareCard';

export type StoryStat = { label: string; value: string };

export type StoryTemplateId = 'minimal' | 'bold' | 'gradient' | 'map';

/** The 3 picks offered everywhere — order here is the order they're offered in the picker (see
 * PostToFeedPrompt.tsx's swatch row). A 4th 'map' pick is appended only where a real GPS route
 * exists (see StoryTemplatePicker's `hasRoute` prop) — every other domain never offers it. */
export const STORY_TEMPLATES: { id: StoryTemplateId; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'bold', label: 'Bold' },
  { id: 'gradient', label: 'Gradient' },
];

const TEMPLATE_WIDTH = 320;
// The photo's own aspect ratio drives the Minimal template's height (see aspectRatio state below)
// — this is just the height used before a photo's real size is known, when there's no photo at
// all, or for Bold/Gradient (whose canvas is a fixed size regardless of the photo's shape, since
// neither goes full-bleed with it — see each template's render below).
const DEFAULT_TEMPLATE_HEIGHT = 400;

// Clamped to a plain portrait/landscape photo's actual shape (3:4 through 16:9) rather than left
// unbounded — a panorama or a screenshot-thin strip would otherwise render as an absurdly
// short/tall card. Everything a phone camera normally produces (4:3, 3:4, 1:1, 16:9) falls inside
// this range untouched, so it's clamping only true outliers, not cropping ordinary photos.
const MIN_ASPECT_RATIO = 3 / 4;
const MAX_ASPECT_RATIO = 16 / 9;
const MAX_TEMPLATE_HEIGHT = 480;

function clampAspectRatio(ratio: number) {
  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio));
}

// Fixed brand palette for the Bold template only — deliberately NOT theme.colors.* tokens. A
// shareable "brand" card is meant to look the same/recognizable to whoever sees it in a feed or a
// story, regardless of the *sharer's* in-app theme — the same reason Instagram's or Strava's own
// share-card templates don't reskin per the posting user's app theme. See ShareCard.tsx for the
// same reasoning already applied to the streak card.
const BOLD_BG_TOP = '#0B0710';
const BOLD_BG_BOTTOM = '#1A0B2E';
const BOLD_ACCENT = '#FF6B35';
const BOLD_TEXT = '#F8F5FF';

/**
 * The photo-story overlay used by the "Add a Photo" share flow — stats baked directly onto a
 * real photo (or, for the stats-only carousel page, onto a plain background) via whichever of the
 * 3 `template` visual treatments the user picked. All 3 are layout/style variants of the SAME
 * capture mechanism (the caller screenshots whichever one is mounted via `react-native-view-shot`
 * — see PostToFeedPrompt.tsx/ActivityShareCarousel.tsx), not 3 separate pipelines.
 *
 * - 'minimal': on-theme, understated — matches whichever of the app's themes the user has picked.
 * - 'bold': a fixed-palette, high-contrast big-number callout (see BOLD_* comment above for why
 *   this one is exempt from the theme-token rule).
 * - 'gradient': a colorful diagonal duotone background built from the current theme's own accent
 *   tokens (still theme-reactive, just visually louder than 'minimal').
 * - 'map': the actual GPS route (via the same CardioRouteMap already used for the live/history
 *   map elsewhere) as the background instead of a picked photo — only ever offered when
 *   `routePoints` has a real multi-point route. Captured the exact same way as every other
 *   template (react-native-view-shot on this component's own live-rendered View, at post time) —
 *   deliberately NOT the separate pre-capture-then-store pipeline RouteRevealMap/`createStaticMapImage`
 *   used, which repeatedly failed silently under real-world timing (the map not finished loading
 *   before its scheduled capture attempt). A template captured on demand, exactly like Bold or
 *   Gradient, has no such race — whatever's on screen when you tap Post to Feed is what gets sent.
 *
 * `stats` renders as label/value rows (Distance/Pace/Time, etc.) — pass 2-3 for the full
 * Strava-style breakdown; omitted, it falls back to a single row built from
 * `card.value`/`card.valueLabel`.
 */
export const PhotoStoryTemplate = forwardRef<
  View,
  { photoUri: string | null; card: ShareCardData; stats?: StoryStat[]; template?: StoryTemplateId; routePoints?: RoutePoint[] | null }
>(function PhotoStoryTemplate({ photoUri, card, stats, template = 'minimal', routePoints }, ref) {
  const theme = useAppTheme();
  const rows = stats && stats.length > 0 ? stats : [{ label: card.valueLabel, value: card.value }];
  const isMapTemplate = template === 'map' && !!routePoints && routePoints.length > 1;
  // The map (like a photo) is a busy background needing the same tinted-chip eyebrow treatment a
  // plain gradient background doesn't — treated identically to `photoUri` below wherever that
  // distinction matters, without changing what actually gets rendered as the background itself.
  const hasBusyBackground = photoUri != null || isMapTemplate;

  // Starts at the old fixed 4:5 ratio so there's no layout jump while getSize resolves (or if it
  // never does — a data: URI or a load failure just keeps this default). Only actually drives
  // layout for 'minimal' (see templateHeight below) but kept unconditional so hook order never
  // depends on which template is selected.
  const [aspectRatio, setAspectRatio] = useState(TEMPLATE_WIDTH / DEFAULT_TEMPLATE_HEIGHT);

  useEffect(() => {
    if (!photoUri) return;
    let cancelled = false;
    Image.getSize(
      photoUri,
      (width, height) => {
        if (!cancelled) setAspectRatio(clampAspectRatio(width / height));
      },
      () => {
        // Keep the previous ratio — this only fires for an unreadable URI, and the fallback above
        // already covers "no photo at all".
      }
    );
    return () => {
      cancelled = true;
    };
  }, [photoUri]);

  const templateHeight =
    template === 'minimal' && photoUri ? Math.min(MAX_TEMPLATE_HEIGHT, TEMPLATE_WIDTH / aspectRatio) : DEFAULT_TEMPLATE_HEIGHT;

  if (template === 'bold') {
    const [primaryRow, ...restRows] = rows;
    return (
      <View ref={ref} collapsable={false} style={[styles.card, { height: templateHeight, backgroundColor: BOLD_BG_BOTTOM }]}>
        <LinearGradient
          colors={[BOLD_BG_TOP, BOLD_BG_BOTTOM]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRow}>
          <View style={[styles.iconBadge, { backgroundColor: withAlpha(BOLD_ACCENT, 0.9) }]}>
            <Ionicons name={card.icon} size={16} color="#fff" />
          </View>
          <Text style={[styles.eyebrow, { color: BOLD_TEXT }]} numberOfLines={1}>
            {card.eyebrow.toUpperCase()}
          </Text>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.boldThumb} resizeMode="cover" />
          ) : null}
        </View>

        {/* The one giant callout number is the whole point of "Bold" — everything else on the
            card is secondary to it, unlike Minimal/Gradient which treat the photo as the star. */}
        <View style={styles.boldCallout}>
          {/* A soft radial-style glow behind the number — just a blurred-looking, oversized
              tinted circle, not an actual RN blur — gives the callout depth instead of sitting
              flat against the gradient. */}
          <View style={[styles.boldGlow, { backgroundColor: withAlpha(BOLD_ACCENT, 0.18) }]} />
          <Text style={[styles.boldValue, { color: BOLD_ACCENT }]} numberOfLines={1} adjustsFontSizeToFit>
            {primaryRow.value}
          </Text>
          <Text style={[styles.boldLabel, { color: BOLD_TEXT }]}>{primaryRow.label.toUpperCase()}</Text>
        </View>

        {restRows.length > 0 ? (
          <View style={styles.boldChipRow}>
            {restRows.map((row) => (
              <View key={row.label} style={[styles.boldChip, { backgroundColor: withAlpha('#FFFFFF', 0.08), borderColor: withAlpha(BOLD_TEXT, 0.18) }]}>
                <Text style={[styles.boldChipValue, { color: BOLD_TEXT }]} numberOfLines={1}>
                  {row.value}
                </Text>
                <Text style={[styles.boldChipLabel, { color: withAlpha(BOLD_TEXT, 0.6) }]} numberOfLines={1}>
                  {row.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.brandRow}>
          <Ionicons name="flame" size={12} color={withAlpha(BOLD_ACCENT, 0.9)} />
          <Text style={[styles.brand, { color: withAlpha(BOLD_TEXT, 0.7) }]}>FLOWSY</Text>
        </View>
        <View style={styles.cardRing} pointerEvents="none" />
      </View>
    );
  }

  if (template === 'gradient') {
    // Diagonal duotone built from the current theme's own tokens (primary → the card's accent
    // color, e.g. cardio's orange or a streak's warning color) — colorful and on-brand for
    // "Gradient", but still theme-reactive, unlike Bold's deliberately fixed palette above.
    return (
      <View ref={ref} collapsable={false} style={[styles.card, { height: templateHeight, backgroundColor: theme.colors.background }]}>
        <LinearGradient
          colors={[theme.colors.primary, card.accentColor, theme.colors.background]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRow}>
          <View style={[styles.iconBadge, { backgroundColor: withAlpha('#FFFFFF', 0.22) }]}>
            <Ionicons name={card.icon} size={16} color="#fff" />
          </View>
          <Text style={styles.gradientEyebrow} numberOfLines={1}>
            {card.eyebrow.toUpperCase()}
          </Text>
        </View>

        {photoUri ? (
          <View style={styles.gradientPhotoFrame}>
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.statsBlock}>
          <View style={styles.gradientStatsRow}>
            {rows.map((row) => (
              <View key={row.label} style={styles.gradientStatPill}>
                <Text style={styles.gradientValue}>{row.value}</Text>
                <Text style={styles.gradientLabel}>{row.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <View style={styles.brandRow}>
            <Ionicons name="flame" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.brand}>FLOWSY</Text>
          </View>
        </View>
        <View style={styles.cardRing} pointerEvents="none" />
      </View>
    );
  }

  // 'minimal' (default) — the original Strava-style treatment, now on-theme: the bottom scrim
  // fades to the current theme's own `surfaceElevated` color (dark for a dark theme, light for a
  // light one) rather than a fixed black, so the stat text sitting on it can use plain
  // `theme.colors.textPrimary`/`textSecondary` and still stay legible either way — the scrim
  // color and the text color always come from the same theme, so contrast holds regardless of
  // which of the app's themes is active.
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { height: templateHeight, backgroundColor: theme.colors.background }]}>
      {isMapTemplate ? (
        <>
          {/* pointerEvents="none" — this is a static backdrop captured for sharing, not a map to
              interact with, and it sits deep inside a scrollable page where letting it capture
              pan gestures would fight the page's own scrolling. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <CardioRouteMap points={routePoints!} followUser={false} />
          </View>
          <LinearGradient
            colors={['transparent', withAlpha(theme.colors.surfaceElevated, 0.94)]}
            locations={[0, 1]}
            style={[StyleSheet.absoluteFill, { top: '42%' }]}
          />
        </>
      ) : photoUri ? (
        <>
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', withAlpha(theme.colors.surfaceElevated, 0.94)]}
            locations={[0, 1]}
            style={[StyleSheet.absoluteFill, { top: '42%' }]}
          />
        </>
      ) : (
        <LinearGradient
          colors={[theme.colors.surface, theme.colors.background, withAlpha(card.accentColor, 0.22)]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.topRow}>
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: withAlpha(hasBusyBackground ? theme.colors.surfaceElevated : card.accentColor, hasBusyBackground ? 0.75 : 0.85) },
          ]}>
          <Ionicons name={card.icon} size={16} color={hasBusyBackground ? theme.colors.primary : '#fff'} />
        </View>
        <Text
          style={[
            styles.minimalEyebrow,
            hasBusyBackground
              ? { color: theme.colors.textPrimary, backgroundColor: withAlpha(theme.colors.surfaceElevated, 0.6) }
              : { color: theme.colors.textPrimary },
          ]}
          numberOfLines={1}>
          {card.eyebrow.toUpperCase()}
        </Text>
      </View>

      <View style={styles.statsBlock}>
        {isMapTemplate ? (
          // A live map behind these numbers is a much busier, more detailed backdrop than the
          // photo/gradient cases' bottom scrim — the same big 34px stacked callouts the plain
          // 'minimal' template uses would sit on top of it like a bolted-on banner. Small frosted
          // pills (same glass-chip idea as the Gradient template's gradientStatPill, just tucked
          // down in size and weight) read as a refined route-summary caption instead, letting the
          // route line stay the visual focus.
          <View style={styles.mapStatsRow}>
            {rows.map((row) => (
              <View
                key={row.label}
                style={[
                  styles.mapStatPill,
                  {
                    backgroundColor: withAlpha(theme.colors.surfaceElevated, 0.72),
                    borderColor: withAlpha(theme.colors.textPrimary, 0.1),
                  },
                ]}>
                <Text style={[styles.mapStatValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {row.value}
                </Text>
                <Text style={[styles.mapStatLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {row.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          rows.map((row) => (
            <View key={row.label} style={{ marginBottom: 10 }}>
              <Text style={[styles.minimalValue, { color: theme.colors.textPrimary }]}>{row.value}</Text>
              <Text style={[styles.minimalLabel, { color: theme.colors.textSecondary }]}>{row.label.toUpperCase()}</Text>
            </View>
          ))
        )}
        <View style={[styles.brandRow, isMapTemplate ? { marginTop: 6 } : null]}>
          <Ionicons name="flame" size={12} color={theme.colors.textTertiary} />
          <Text style={[styles.brand, { color: theme.colors.textTertiary }]}>FLOWSY</Text>
        </View>
      </View>
      <View style={styles.cardRing} pointerEvents="none" />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: TEMPLATE_WIDTH,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 20,
    // A soft, deliberate shadow (plus the 1px ring below) is what reads as "premium" for a
    // shareable card sitting on a feed's plain background — without it, corners look flat and
    // cut-out rather than like a real card. Android needs `elevation` too; `shadow*` alone is
    // iOS/web-only in RN.
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statsBlock: {
    alignSelf: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  brand: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // Minimal
  minimalEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  minimalValue: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  minimalLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Map — small frosted stat pills, deliberately more restrained than Minimal's stacked big
  // numbers (see the isMapTemplate branch above): a live route behind the text needs the overlay
  // to read as a caption, not a competing headline.
  mapStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mapStatPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
    // A softer, tighter shadow than the outer card's own (styles.card below) — just enough to
    // lift each pill off a bright/patterned map tile without it reading as a heavy drop shadow.
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mapStatValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mapStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 1,
  },

  // Bold
  boldThumb: {
    width: 32,
    height: 32,
    borderRadius: 10,
    marginLeft: 'auto',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  boldCallout: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  boldGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  boldValue: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -1,
  },
  boldLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 2,
  },
  boldChipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  boldChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  boldChipValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  boldChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Gradient
  gradientEyebrow: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  gradientPhotoFrame: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 96,
    height: 96,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  gradientStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // A frosted-glass-style pill behind each stat, like Instagram Stories' stat chips — gives the
  // numbers a real surface to sit on instead of floating directly over the gradient, which is
  // what made the old version read as flatter/less finished.
  gradientStatPill: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  gradientValue: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  gradientLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
});

/** A row of small swatches — one per STORY_TEMPLATES entry, plus a 4th "Map" swatch appended only
 * when `hasRoute` is true (a real multi-point GPS route exists — every non-cardio call site omits
 * this prop and never shows it) — that a user taps to switch which template the live
 * PhotoStoryTemplate preview above/below it renders with. Each swatch is a tiny standalone
 * rendering of that template's own background treatment (not a screenshot of the real preview,
 * except Map, whose swatch is just an icon rather than rendering a live map for every swatch row
 * on screen) so they read as visually distinct at a glance without needing the real photo/stats. */
export function StoryTemplatePicker({
  selected,
  onSelect,
  hasRoute,
}: {
  selected: StoryTemplateId;
  onSelect: (id: StoryTemplateId) => void;
  hasRoute?: boolean;
}) {
  const theme = useAppTheme();
  const templates = hasRoute ? [...STORY_TEMPLATES, { id: 'map' as StoryTemplateId, label: 'Map' }] : STORY_TEMPLATES;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center' }}>
      {templates.map(({ id, label }) => {
        const isSelected = id === selected;
        return (
          <Pressable key={id} onPress={() => onSelect(id)} style={{ alignItems: 'center', gap: 4 }}>
            <View
              style={[
                swatchStyles.swatch,
                {
                  borderColor: isSelected ? theme.colors.primary : 'transparent',
                },
              ]}>
              {id === 'minimal' ? (
                <LinearGradient
                  colors={[theme.colors.surface, theme.colors.surfaceElevated]}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              {id === 'bold' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: BOLD_BG_BOTTOM }]} /> : null}
              {id === 'gradient' ? (
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.warning]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              {id === 'map' ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="map" size={22} color={theme.colors.primary} />
                </View>
              ) : null}
              {id === 'bold' ? <View style={swatchStyles.boldDot} /> : null}
            </View>
            <Text
              style={{
                color: isSelected ? theme.colors.primary : theme.colors.textTertiary,
                fontSize: theme.typography.size.xs,
                fontWeight: isSelected ? theme.typography.weight.semibold : theme.typography.weight.medium,
              }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const swatchStyles = StyleSheet.create({
  swatch: {
    width: 52,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
  },
  boldDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BOLD_ACCENT,
    alignSelf: 'center',
    top: '50%',
    marginTop: -7,
  },
});
