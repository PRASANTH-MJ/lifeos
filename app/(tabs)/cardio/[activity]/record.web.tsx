import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState, ScreenContainer } from '@/components';
import { CARDIO_ACTIVITY_LABELS, type CardioActivity } from '@/modules/cardio';

/** Web build of the GPS recording screen — background location tracking has no web
 * implementation (see modules/cardio/locationTracking.ts), and the map component
 * (@maplibre/maplibre-react-native) has no web target either, so this twin keeps both out of the
 * web bundle entirely rather than branching on Platform.OS inside a single shared file. */
export default function CardioRecordScreen() {
  const { activity: activityParam } = useLocalSearchParams<{ activity: CardioActivity }>();
  const label = CARDIO_ACTIVITY_LABELS[activityParam as CardioActivity];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: label }} />
      <EmptyState icon="phone-portrait-outline" title="Mobile only" subtitle="Live GPS recording is only available in the Flowsy mobile app." />
    </ScreenContainer>
  );
}
