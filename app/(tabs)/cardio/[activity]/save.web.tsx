import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState, ScreenContainer } from '@/components';
import { CARDIO_ACTIVITY_LABELS, type CardioActivity } from '@/modules/cardio';

/** Web build of the post-recording save screen — same reasoning as record.web.tsx: this route
 * only ever exists as the next step after a native GPS recording session (see
 * modules/cardio/pendingSession.ts), which never happens on web, and it renders
 * CardioRouteMap (@maplibre/maplibre-react-native, native-only) which would otherwise break the
 * web bundle. Nothing legitimately lands on this route on web, so this is just a safety-net
 * EmptyState rather than a real flow. */
export default function CardioSaveScreen() {
  const { activity: activityParam } = useLocalSearchParams<{ activity: CardioActivity }>();
  const label = CARDIO_ACTIVITY_LABELS[activityParam as CardioActivity];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: label }} />
      <EmptyState icon="phone-portrait-outline" title="Mobile only" subtitle="Live GPS recording is only available in the Flowsy mobile app." />
    </ScreenContainer>
  );
}
