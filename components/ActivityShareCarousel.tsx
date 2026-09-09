import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { RoutePoint } from '@/modules/cardio';
import { usePostComposer, type PostType } from '@/modules/social';
import { useAppTheme } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { PhotoStoryTemplate, StoryTemplatePicker, type StoryStat, type StoryTemplateId } from './PhotoStoryTemplate';
import { SegmentedControl } from './SegmentedControl';
import { ShareCard, type ShareCardData } from './ShareCard';
import { showAlert } from './showAlert';
import { TextField } from './TextField';

type Props = {
  type: PostType;
  /** The main activity card (distance/time headline) — same shape PostToFeedPrompt already used,
   * also stored as `post.card` so PostCard/PublicPostPreview keep rendering a sensible fallback
   * even for a viewer whose client predates this chooser. */
  card: ShareCardData;
  /** A captured route-reveal snapshot — null whenever the session had 1 or fewer GPS points (no
   * route to draw), in which case the route option is simply omitted rather than shown empty. */
  routePhotoUri: string | null;
  /** Pre-encoded animated-GIF alternative to the route photo above (see modules/social/gifExport.ts).
   * Only ever relevant when routePhotoUri is also present. */
  animatedGifUri?: string | null;
  gifPreparing?: boolean;
  /** The session's raw GPS points — passed through to the Photo tab's template picker so "Map" can
   * be offered as a 4th template alongside Minimal/Bold/Gradient (see PhotoStoryTemplate.tsx). This
   * is a second, simpler way to share the route: a plain static capture of the same live map
   * component already used everywhere else in Cardio, via the same generic captureRef every other
   * template already uses — independent of the Route tab's own reveal-animation/GIF pipeline above,
   * so it still works even on a session where that pipeline is slow or its native map snapshot
   * fails. */
  routePoints?: RoutePoint[];
  /** Full Distance/Pace/Time (etc) breakdown — overlaid on both the route image and the
   * photo+template image (see PhotoStoryTemplate's `stats` prop). */
  stats: StoryStat[];
  /** A photo the user already picked earlier in the save flow (edit phase's "Add a photo"), used
   * to prefill the photo option — still replaceable/removable here. Null if they didn't add one. */
  initialPhotoUri?: string | null;
  /** Real, freshly-computed streak (see modules/cardio/streak.ts's computeCardioStreak, called
   * with today's just-saved log included) — the streak option is only ever shown when this is > 1,
   * never fabricated. */
  streak: number;
  onDone: () => void;
};

type Mode = 'route' | 'streak' | 'photo';

/** Shown right after saving a cardio activity — cardio is the one domain with a real route to
 * share, so it offers up to 3 ways to share it: "Route" (the route map/GIF), "Streak" (real streak
 * only, never fabricated), and "Photo" (pick a photo, then choose one of PhotoStoryTemplate's 3
 * visual treatments to overlay stats on it) — a segmented control switches between whichever of
 * these actually have real data behind them for this session (a route needs 2+ GPS points, a
 * streak needs > 1 day), defaulting straight into the first one rather than requiring an extra tap
 * through a separate "choose how to share" screen first. Exactly one image is posted, from
 * whichever tab is active when "Post to Feed" is tapped. */
export function ActivityShareCarousel({
  type,
  card,
  routePhotoUri,
  animatedGifUri,
  gifPreparing,
  routePoints,
  stats,
  initialPhotoUri,
  streak,
  onDone,
}: Props) {
  const theme = useAppTheme();
  const { createPost, posting } = usePostComposer();
  const [caption, setCaption] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(initialPhotoUri ?? null);
  const [useGif, setUseGif] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplateId>('minimal');
  // Route tab gets its own template choice, independent of the Photo tab's — both start on
  // 'minimal' but a user picking "Bold" for their route card shouldn't also flip the (unrelated)
  // photo template underneath if they switch tabs.
  const [selectedRouteTemplate, setSelectedRouteTemplate] = useState<StoryTemplateId>('minimal');

  const routeCardRef = useRef<View>(null);
  const photoCardRef = useRef<View>(null);
  const streakCardRef = useRef<View>(null);

  const hasRoute = routePhotoUri != null;
  const hasStreak = streak > 1;
  const gifOffered = hasRoute && animatedGifUri !== undefined;

  // Real options available this session, in the same priority Strava's own share flow uses:
  // route map first, then the streak flex, then whatever photo the runner adds — each one only
  // offered when there's real data behind it. Defaults to the first one straight away (route if
  // there's a route, otherwise streak, otherwise photo) — a separate "choose" step used to sit in
  // front of this, requiring an extra tap before seeing any actual content; now every option is
  // one tap away via the segmented control below instead of hidden behind a picker screen.
  const options: Mode[] = [...(hasRoute ? (['route'] as Mode[]) : []), ...(hasStreak ? (['streak'] as Mode[]) : []), 'photo'];
  const [mode, setMode] = useState<Mode>(options[0]);

  const streakCardData: ShareCardData = {
    eyebrow: 'CARDIO STREAK',
    value: String(streak),
    valueLabel: streak === 1 ? 'DAY' : 'DAYS',
    icon: 'flame',
    accentColor: theme.colors.warning,
  };

  const onTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    // See PostToFeedPrompt.tsx's identical fix — a denied/blocked permission used to silently do
    // nothing, indistinguishable from a broken button.
    if (!permission.granted) {
      showAlert('Camera access needed', 'Allow camera access in your device Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const onPickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo library access in your device Settings to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  // Captures whichever option is the active choice — used both by "Post to Feed" and could be
  // reused for a future save/share button, mirroring PostToFeedPrompt's identical helper.
  const captureActive = async (): Promise<string | null> => {
    if (mode === 'route') {
      // The GIF path posts the raw encoded animation as-is — captureRef can only ever grab one
      // frame of an animated image, so there's no way to bake the overlay onto a GIF the same
      // way the static route image gets it (see PostToFeedPrompt's identical reasoning).
      // The GIF path posts the raw encoded animation as-is regardless of the static template
      // choice below — see this function's own doc comment for why an overlay can't be baked
      // onto a GIF the same way.
      if (useGif && animatedGifUri) return animatedGifUri;
      if (!routeCardRef.current) return null;
      return captureRef(routeCardRef, { format: 'png', quality: 1 });
    }
    if (mode === 'streak') {
      if (!streakCardRef.current) return null;
      return captureRef(streakCardRef, { format: 'png', quality: 1 });
    }
    // The 'map' template needs no picked photo — it renders the live route map as its own
    // background — so it's captured whenever selected regardless of `photoUri`, unlike
    // Minimal/Bold/Gradient which have nothing to show without one.
    if ((!photoUri && selectedTemplate !== 'map') || !photoCardRef.current) return null;
    return captureRef(photoCardRef, { format: 'png', quality: 1 });
  };

  const onPost = async () => {
    try {
      const uri = await captureActive();
      await createPost({ type, card, caption: caption.trim() || null, localPhotoUri: uri });
      onDone();
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        showAlert('Slow down', "You've posted a lot in a short time — please wait a bit and try again.");
        return;
      }
      throw err;
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
        Share this with your followers?
      </Text>

      {options.length > 1 ? (
        <SegmentedControl
          options={options.map((option) => ({
            value: option,
            label: option === 'route' ? 'Route' : option === 'streak' ? 'Streak' : 'Photo',
          }))}
          value={mode}
          onChange={setMode}
        />
      ) : null}

      {mode === 'route' ? (
            <View style={{ alignItems: 'center' }}>
              <PhotoStoryTemplate ref={routeCardRef} photoUri={routePhotoUri} card={card} stats={stats} template={selectedRouteTemplate} />

              {gifOffered ? (
                <View style={{ marginTop: theme.spacing.md, width: '100%', gap: theme.spacing.xs }}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button label="Static Image" variant={useGif ? 'secondary' : 'primary'} onPress={() => setUseGif(false)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={animatedGifUri ? 'Animated GIF' : 'Preparing animation…'}
                        variant={useGif ? 'primary' : 'secondary'}
                        onPress={() => setUseGif(true)}
                        disabled={!animatedGifUri}
                      />
                    </View>
                  </View>
                  {gifPreparing && !animatedGifUri ? (
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
                      Preparing the animated version — it'll be ready in a few seconds.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {!useGif ? (
                <View style={{ marginTop: theme.spacing.md, width: '100%' }}>
                  <StoryTemplatePicker selected={selectedRouteTemplate} onSelect={setSelectedRouteTemplate} hasRoute={false} />
                </View>
              ) : null}
            </View>
          ) : null}

          {mode === 'streak' ? (
            <View style={{ alignItems: 'center' }}>
              <ShareCard ref={streakCardRef} data={streakCardData} />
            </View>
          ) : null}

          {mode === 'photo' ? (
            <>
              <View style={{ alignItems: 'center' }}>
                <PhotoStoryTemplate
                  ref={photoCardRef}
                  photoUri={selectedTemplate === 'map' ? null : photoUri}
                  card={card}
                  stats={stats}
                  template={selectedTemplate}
                  routePoints={routePoints}
                />
                {photoUri && selectedTemplate !== 'map' ? (
                  <Pressable onPress={() => setPhotoUri(null)} hitSlop={8} style={{ marginTop: theme.spacing.sm }}>
                    <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      Remove photo
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <StoryTemplatePicker selected={selectedTemplate} onSelect={setSelectedTemplate} hasRoute={(routePoints?.length ?? 0) > 1} />

              {selectedTemplate !== 'map' ? (
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Take photo" variant="secondary" onPress={onTakePhoto} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label={photoUri ? 'Change photo' : 'Add photo'} variant="secondary" onPress={onPickFromLibrary} />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

      <TextField placeholder="Say something about it... (optional)" value={caption} onChangeText={setCaption} multiline />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Skip" variant="ghost" onPress={onDone} disabled={posting} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Post to Feed" onPress={onPost} loading={posting} glow />
        </View>
      </View>
    </View>
  );
}
