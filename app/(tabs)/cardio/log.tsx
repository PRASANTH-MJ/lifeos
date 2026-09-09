import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { Card, IconBadge, ScreenContainer } from '@/components';
import { CARDIO_ACTIVITIES, CARDIO_ACTIVITY_ICON, CARDIO_ACTIVITY_LABELS, GPS_RECORDABLE, type CardioActivity } from '@/modules/cardio';
import { useAppTheme } from '@/theme';

/** The single "which activity?" entry point — Strava's own "+" always starts here regardless of
 * which sport you end up picking. Replaces having to already be on the right activity's own card
 * before you can log it; the cardio hub's 5 cards remain the browsing/stats view, this is purely
 * a faster way in.
 *
 * `comboGroupId`, when present, means this pick is the next leg of a "brick" session (see
 * save.tsx's "Save & add another leg" and modules/cardio/pendingSession.ts) — it's forwarded into
 * whichever screen the pick leads to so that leg ends up stamped with the same id. */
export default function CardioLogScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { comboGroupId } = useLocalSearchParams<{ comboGroupId?: string }>();

  // GPS-recordable activities now land on the activity detail screen too (not straight into
  // recording) — it offers both "Record with GPS" and "Enter it manually instead", so this picker
  // no longer needs to choose between the two paths on the user's behalf.
  const onPick = (activity: CardioActivity) => {
    router.push({ pathname: '/cardio/[activity]', params: { activity, comboGroupId } });
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: comboGroupId ? 'Add Another Leg' : 'Log Activity', presentation: 'modal' }} />
      <View style={{ gap: theme.spacing.md }}>
        {CARDIO_ACTIVITIES.map((activity) => (
          <Pressable key={activity} onPress={() => onPick(activity)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name={CARDIO_ACTIVITY_ICON[activity]} color={theme.colors.moduleTasks} />
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                {CARDIO_ACTIVITY_LABELS[activity]}
              </Text>
              {Platform.OS !== 'web' && GPS_RECORDABLE.includes(activity) ? (
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>GPS</Text>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}
