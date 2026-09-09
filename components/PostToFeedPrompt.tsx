import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { showAlert } from './showAlert';

import { usePostComposer, type PostType } from '@/modules/social';
import { useAppTheme } from '@/theme';
import { Button } from './Button';
import { PhotoStoryTemplate, StoryTemplatePicker, type StoryStat, type StoryTemplateId } from './PhotoStoryTemplate';
import { SegmentedControl } from './SegmentedControl';
import { ShareCard, type ShareCardData } from './ShareCard';
import { TextField } from './TextField';

type Props = {
  type: PostType;
  card: ShareCardData;
  /** A captured route/route-reveal image, or any other photo to attach — optional, since not
   * every completion (a habit streak, a meditation session) has one. Acts as the starting photo
   * behind the stat overlay; the user can still take a new one, swap it, or remove it below. */
  photoUri?: string | null;
  /** 2-3 label/value rows overlaid on the photo (Distance/Pace/Time, etc.) — omit to fall back
   * to a single row built from `card.value`/`card.valueLabel`. */
  stats?: StoryStat[];
  /** Called once the prompt is done with — either the post succeeded, or the user skipped.
   * The caller should dismiss/navigate away from here; this component doesn't do that itself. */
  onDone: () => void;
  /** A pre-encoded animated GIF alternative to the static `photoUri` (currently only ever
   * supplied by the cardio save/share flow — see app/(tabs)/cardio/[activity]/save.tsx and
   * modules/social/gifExport.ts). When provided (even while still `null`, meaning it's being
   * encoded), a "Static Image" / "Animated GIF" toggle is shown; omit entirely for every other
   * call site, which keeps today's plain single-photo behavior unchanged. */
  animatedGifUri?: string | null;
  /** True while the GIF named above is still being encoded — disables picking it and shows a
   * brief "preparing animation..." label in its place. Ignored if `animatedGifUri` is omitted. */
  gifPreparing?: boolean;
  /** Real, freshly-computed consecutive-day streak for this domain (e.g. computeWorkoutStreak,
   * useFoodStreak, useMindfulnessStreak — see each call site), including today's just-logged
   * activity. A streak card is only ever offered when this is > 1, mirroring cardio's
   * ActivityShareCarousel — never fabricate a number here. Omit entirely for a domain with no
   * real streak concept (e.g. mind-training). */
  streak?: number;
  /** Small-caps label for the streak card's eyebrow, e.g. "WORKOUT STREAK" or "MEDITATION
   * STREAK". Required whenever `streak` is passed. */
  streakLabel?: string;
};

type Mode = 'streak' | 'photo';

/** The "post this to Feed, or skip" prompt shown right after completing something worth
 * celebrating (a cardio activity, a finished workout, a habit streak milestone) — reuses the
 * existing ShareCardData + usePostComposer infra compose.tsx already has for manual sharing,
 * just surfaced proactively at the moment of completion instead of requiring a trip to the
 * Social tab's compose screen. Skipping is always one tap away and posts nothing.
 *
 * Offers two share types (see Mode): "Streak" — the existing ShareCard streak visual, using a
 * real streak number only, or "Photo" — pick/take a photo, then choose one of 3 PhotoStoryTemplate
 * visual treatments to overlay stats on it (captured with react-native-view-shot right before
 * posting — a Strava-style "story" image, rather than a stat card sitting next to a plain photo).
 * A segmented control switches between them when both are available; with no real streak for this
 * context it goes straight to the photo flow with no control shown at all — the same
 * honest-omission pattern as `streak` itself (never fabricated, never offered empty). */
export function PostToFeedPrompt({ type, card, photoUri, stats, onDone, animatedGifUri, gifPreparing, streak, streakLabel }: Props) {
  const theme = useAppTheme();
  const { createPost, posting } = usePostComposer();
  const [caption, setCaption] = useState('');
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(photoUri ?? null);
  // Only offered while `animatedGifUri` was passed at all (see Props doc) AND the photo on
  // screen is still the original one it was captured alongside — swapping in a different photo
  // (camera/library) has nothing to do with the route-reveal GIF, so the toggle disappears the
  // moment that happens rather than posting a GIF that doesn't match the visible photo.
  const gifOffered = animatedGifUri !== undefined && selectedPhotoUri === (photoUri ?? null) && selectedPhotoUri != null;
  const [useGif, setUseGif] = useState(false);
  const templateRef = useRef<View>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplateId>('minimal');

  // Mirrors ActivityShareCarousel's `hasStreak = streak > 1` — a streak of 0 or 1 isn't worth
  // flexing, and this only ever fires off a real, caller-computed number (see Props doc above).
  const hasStreak = streak != null && streak > 1;
  const streakCardRef = useRef<View>(null);
  const streakCardData: ShareCardData | null = hasStreak
    ? {
        eyebrow: streakLabel ?? 'STREAK',
        value: String(streak),
        valueLabel: streak === 1 ? 'DAY' : 'DAYS',
        icon: 'flame',
        accentColor: theme.colors.warning,
      }
    : null;

  // Top-level choice between the two real share types (see Mode above) — defaults straight into
  // 'streak' when there's a real one to show, otherwise 'photo'; a segmented control below lets
  // switching between them take one tap instead of a separate "choose how to share" screen first.
  const [mode, setMode] = useState<Mode>(hasStreak ? 'streak' : 'photo');

  useEffect(() => {
    if (!gifOffered) setUseGif(false);
  }, [gifOffered]);

  const onTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    // A denied/blocked permission used to just silently do nothing here — tapping "Take photo"
    // looked identical to a broken button, with no way to tell it was a permission issue at all
    // (especially once Android permanently denies without re-prompting after "don't ask again").
    if (!permission.granted) {
      showAlert('Camera access needed', 'Allow camera access in your device Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setSelectedPhotoUri(result.assets[0].uri);
  };

  const onPickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo library access in your device Settings to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setSelectedPhotoUri(result.assets[0].uri);
  };

  // Captures whichever visual is currently the active choice — the streak card in 'streak' mode,
  // the photo+template overlay (or the raw GIF, which can't be captured — see onPost below) in
  // 'photo' mode. Shared by the post/save/share actions below so they never have to duplicate
  // this branch.
  const captureActive = async (): Promise<string | null> => {
    if (mode === 'streak') {
      if (!streakCardRef.current) return null;
      return captureRef(streakCardRef, { format: 'png', quality: 1 });
    }
    if (gifOffered && useGif && animatedGifUri) return animatedGifUri;
    if (!selectedPhotoUri || !templateRef.current) return null;
    return captureRef(templateRef, { format: 'png', quality: 1 });
  };

  const onPost = async () => {
    const finalUri = await captureActive();
    await createPost({ type, card, caption: caption.trim() || null, localPhotoUri: finalUri });
    onDone();
  };

  // The generic OS share sheet — covers Instagram, Facebook, WhatsApp, Telegram, Snapchat,
  // Messenger, SMS, email, and everything else already installed, via one button instead of a
  // row of app-specific ones.
  const onShareGeneric = async () => {
    const uri = await captureActive();
    if (!uri) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) return;
    try {
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  };

  const onSaveToPhotos = async () => {
    // expo-media-library has no web implementation at all (unlike expo-image-picker/expo-sharing)
    // — its index.ts does `class Query extends ExpoMediaLibraryNext.Query {}` unconditionally at
    // module scope, which throws immediately if statically imported into a bundle that ever runs
    // outside a native runtime (e.g. this app's web export). A dynamic import defers evaluation
    // to here, which is only ever reached from the Platform.OS !== 'web'-guarded button below.
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo library access in your device Settings to save this image.');
      return;
    }
    const uri = await captureActive();
    if (!uri) return;
    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      showAlert('Saved', 'The image was saved to your photos.');
    } catch {
      showAlert('Couldn’t save', 'Something went wrong saving the image — try again.');
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
        Share this with your followers?
      </Text>

      {hasStreak ? (
        <SegmentedControl
          options={[
            { value: 'streak', label: 'Streak' },
            { value: 'photo', label: 'Photo' },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}

      {mode === 'streak' && streakCardData ? (
            <View style={{ alignItems: 'center' }}>
              <ShareCard ref={streakCardRef} data={streakCardData} />
            </View>
          ) : null}

          {mode === 'photo' ? (
            <>
              <View style={{ alignItems: 'center' }}>
                <PhotoStoryTemplate ref={templateRef} photoUri={selectedPhotoUri} card={card} stats={stats} template={selectedTemplate} />
                {selectedPhotoUri ? (
                  <Pressable onPress={() => setSelectedPhotoUri(null)} hitSlop={8} style={{ marginTop: theme.spacing.sm }}>
                    <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      Remove photo
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <StoryTemplatePicker selected={selectedTemplate} onSelect={setSelectedTemplate} />

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                {Platform.OS !== 'web' ? (
                  <View style={{ flex: 1 }}>
                    <Button label="Take photo" variant="secondary" onPress={onTakePhoto} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Button label={selectedPhotoUri ? 'Change photo' : 'Add photo'} variant="secondary" onPress={onPickFromLibrary} />
                </View>
              </View>

              {gifOffered ? (
                <View style={{ width: '100%', gap: theme.spacing.xs }}>
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
            </>
          ) : null}

      {Platform.OS !== 'web' ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Save to Photos" variant="secondary" onPress={onSaveToPhotos} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Share" variant="secondary" onPress={onShareGeneric} />
          </View>
        </View>
      ) : null}

      <TextField
        label="Caption (optional)"
        placeholder="Say something about it..."
        value={caption}
        onChangeText={setCaption}
        multiline
      />
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
