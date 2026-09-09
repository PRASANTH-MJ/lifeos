import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, IconBadge, ProgressBar, ScreenContainer, StreakBadge } from '@/components';
import { addDays, todayKey } from '@/lib/date';
import {
  CARDIO_ACTIVITY_ICON,
  CARDIO_ACTIVITY_LABELS,
  DISTANCE_LEVEL_TIERS,
  SESSION_LEVEL_TIERS,
  computeCardioStreak,
  computeLevel,
  formatElapsed,
  isDistanceActivity,
  useCardioLogs,
  type CardioActivity,
} from '@/modules/cardio';
import { useAppTheme } from '@/theme';

// Running/Walking/Hiking share one entry point (a Chip switcher on the detail screen picks which
// one you're logging) instead of three near-identical cards. Cycling is a distance activity too
// (same GPS-recordable, level-by-distance shape) but gets its own card rather than joining that
// switcher — Strava-style, cycling reads as a genuinely different activity from a run, not a
// variant of one. Swimming/Yoga/Sports stay separate since they're logged differently (a
// picklist or just duration, not distance) and level up independently.
const RUN_WALK_HIKE: CardioActivity[] = ['running', 'walking', 'hiking'];
const CARDS: { key: string; activities: CardioActivity[]; label: string; icon: keyof typeof Ionicons.glyphMap; linkTo: CardioActivity }[] = [
  { key: 'run-walk-hike', activities: RUN_WALK_HIKE, label: 'Run · Walk · Hike', icon: 'walk', linkTo: 'running' },
  { key: 'cycling', activities: ['cycling'], label: CARDIO_ACTIVITY_LABELS.cycling, icon: CARDIO_ACTIVITY_ICON.cycling, linkTo: 'cycling' },
  { key: 'swimming', activities: ['swimming'], label: CARDIO_ACTIVITY_LABELS.swimming, icon: CARDIO_ACTIVITY_ICON.swimming, linkTo: 'swimming' },
  { key: 'yoga', activities: ['yoga'], label: CARDIO_ACTIVITY_LABELS.yoga, icon: CARDIO_ACTIVITY_ICON.yoga, linkTo: 'yoga' },
  { key: 'sports', activities: ['sports'], label: CARDIO_ACTIVITY_LABELS.sports, icon: CARDIO_ACTIVITY_ICON.sports, linkTo: 'sports' },
];

export default function CardioScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { logs, loading } = useCardioLogs();
  const streak = computeCardioStreak(logs);

  const weekStart = addDays(todayKey(), -6);
  const weekLogs = logs.filter((log) => log.date >= weekStart);
  const weekDistanceKm = weekLogs.reduce((sum, log) => sum + (log.distanceKm ?? 0), 0);
  const weekMinutes = weekLogs.reduce((sum, log) => sum + log.durationMinutes, 0);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
              Activity Tracker
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, marginTop: 2 }}>
              Running, walking, hiking, yoga, and sports — log a session and level up.
            </Text>
          </View>
          <StreakBadge streak={streak} />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Log Activity" onPress={() => router.push('/cardio/log')} glow />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Milestones" variant="secondary" onPress={() => router.push('/cardio/milestones')} />
          </View>
        </View>

        {/* Challenges/events live under Clubs (a Social-tab concept — they need member rosters
            and cross-user leaderboards, which is Social's territory), but the ask was for this
            to feel like a Fitness feature, so it gets a real entry point here too instead of
            only being reachable via Social's header icon. */}
        <Link href="/social/clubs" asChild>
          <Pressable>
            <Card tier="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="trophy-outline" color={theme.colors.warning} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  Challenges & Events
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  Compete with your club, join a group run
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>
        </Link>

        {!loading && weekLogs.length > 0 ? (
          <Card tier="panel" style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                {weekDistanceKm > 0 ? weekDistanceKm.toFixed(1) : weekLogs.length}
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {weekDistanceKm > 0 ? 'KM THIS WEEK' : 'SESSIONS THIS WEEK'}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                {formatElapsed(weekMinutes * 60)}
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>TIME THIS WEEK</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                {weekLogs.length}
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                ACTIVIT{weekLogs.length === 1 ? 'Y' : 'IES'}
              </Text>
            </View>
          </Card>
        ) : null}

        {CARDS.map((card) => {
          const cardLogs = logs.filter((log) => card.activities.includes(log.activity));
          const distance = isDistanceActivity(card.linkTo);
          const value = distance ? cardLogs.reduce((sum, log) => sum + (log.distanceKm ?? 0), 0) : cardLogs.length;
          const level = computeLevel(value, distance ? DISTANCE_LEVEL_TIERS : SESSION_LEVEL_TIERS);

          return (
            <Link key={card.key} href={{ pathname: '/cardio/[activity]', params: { activity: card.linkTo } }} asChild>
              <Pressable>
                <Card tier="elevated" style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name={card.icon} color={theme.colors.moduleTasks} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                        {card.label}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {loading ? '—' : distance ? `${value.toFixed(1)} km total` : `${value} session${value === 1 ? '' : 's'} total`}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 4,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.moduleTasksMuted,
                      }}>
                      <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>
                        Lvl {level.level} · {level.label}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </View>
                  <ProgressBar progress={level.progress} color={theme.colors.moduleTasks} height={5} />
                </Card>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScreenContainer>
  );
}
