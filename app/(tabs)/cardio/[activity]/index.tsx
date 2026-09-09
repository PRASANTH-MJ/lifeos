import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconBadge,
  PostToFeedPrompt,
  ProgressBar,
  ScreenContainer,
  ShareCardModal,
  TextField,
  showAlert,
  type ShareCardData,
} from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import {
  CARDIO_ACTIVITY_LABELS,
  CARDIO_INTENSITIES,
  CARDIO_INTENSITY_LABELS,
  CARDIO_WEATHERS,
  CARDIO_WEATHER_ICON,
  CARDIO_WEATHER_LABELS,
  DISTANCE_LEVEL_TIERS,
  GPS_RECORDABLE,
  SESSION_LEVEL_TIERS,
  SPORT_OPTIONS,
  YOGA_POSE_OPTIONS,
  comboSummaryLabel,
  computeCardioPersonalBest,
  computeCardioStreak,
  computeLevel,
  computeSplits,
  findComboSiblings,
  formatElapsed,
  hasSplitTimestamps,
  isDistanceActivity,
  useCardioActivityPrefs,
  useCardioLogs,
  type CardioActivity,
  type CardioFrequency,
  type CardioIntensity,
  type CardioWeather,
  type RoutePoint,
} from '@/modules/cardio';
import { CardioRouteMap } from '@/components/CardioRouteMap';
import { useAppTheme } from '@/theme';

const WEEKDAYS = [
  { value: 1, label: 'S' },
  { value: 2, label: 'M' },
  { value: 3, label: 'T' },
  { value: 4, label: 'W' },
  { value: 5, label: 'T' },
  { value: 6, label: 'F' },
  { value: 7, label: 'S' },
];

// Running/Walking/Hiking share this Chip switcher (same one entry point as the cardio hub's
// "Run · Walk · Hike" card) — Cycling is also a distance activity but reads as genuinely
// different, not a variant of a run, so it gets its own card/screen with no switcher at all.
const RUN_WALK_HIKE: CardioActivity[] = ['running', 'walking', 'hiking'];

const PICKLIST_ACTIVITY: Record<string, string[] | undefined> = {
  sports: SPORT_OPTIONS,
  yoga: YOGA_POSE_OPTIONS,
};

/** Only rendered once the caller has already confirmed hasSplitTimestamps — an empty result here
 * just means fewer than one full km was covered (nothing to show, not an error). */
function CardioSplitsList({ points }: { points: RoutePoint[] }) {
  const theme = useAppTheme();
  const splits = useMemo(() => computeSplits(points), [points]);
  if (splits.length === 0) return null;

  return (
    <View style={{ gap: 4 }}>
      {splits.map((split) => (
        <View key={split.km} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>Km {split.km}</Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{split.paceLabel}</Text>
        </View>
      ))}
    </View>
  );
}

export default function CardioActivityScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { activity: activityParam, comboGroupId } = useLocalSearchParams<{ activity: CardioActivity; comboGroupId?: string }>();
  const activity = activityParam as CardioActivity;
  const distanceActivity = isDistanceActivity(activity);
  const label = CARDIO_ACTIVITY_LABELS[activity];
  const canRecordWithGps = Platform.OS !== 'web' && GPS_RECORDABLE.includes(activity);
  const picklistOptions = PICKLIST_ACTIVITY[activity];

  const { logs: allLogs, loading, addLog, removeLog } = useCardioLogs();
  const { getPrefs, savePrefs } = useCardioActivityPrefs();
  const prefs = getPrefs(activity);

  const logs = useMemo(() => allLogs.filter((log) => log.activity === activity), [allLogs, activity]);

  const [distanceInput, setDistanceInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [sportName, setSportName] = useState<string | null>(null);
  const [customSportName, setCustomSportName] = useState('');
  const [intensity, setIntensity] = useState<CardioIntensity | null>(null);
  const [weather, setWeather] = useState<CardioWeather | null>(null);
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);
  // Shown right after a manual (non-GPS) log — mirrors the GPS save flow's post-to-feed prompt
  // (app/(tabs)/cardio/[activity]/save.tsx), which manual entries never passed through.
  const [justLogged, setJustLogged] = useState<{ card: ShareCardData; streak: number } | null>(null);
  // GPS-recordable activities default to the "Record with GPS" flow (see canRecordWithGps below),
  // but someone who ran/walked/hiked/biked without tracking it live still needs a way to log it —
  // this reveals the same manual form non-GPS activities always show, saving with routePoints:
  // null (via addLog not being passed one at all) just like those always have.
  const [manualEntry, setManualEntry] = useState(false);
  const showManualForm = !canRecordWithGps || manualEntry;

  const totalValue = distanceActivity ? logs.reduce((sum, log) => sum + (log.distanceKm ?? 0), 0) : logs.length;
  const level = computeLevel(totalValue, distanceActivity ? DISTANCE_LEVEL_TIERS : SESSION_LEVEL_TIERS);
  const personalBest = useMemo(() => computeCardioPersonalBest(logs), [logs]);

  const distanceKm = Number(distanceInput);
  const durationMinutes = Number(durationInput);
  const resolvedSportName = sportName === 'Other' ? customSportName.trim() : sportName;
  const canLog =
    durationMinutes > 0 &&
    (!distanceActivity || distanceKm > 0) &&
    (!picklistOptions || Boolean(resolvedSportName));
  const speedKmh = distanceActivity && distanceKm > 0 && durationMinutes > 0 ? distanceKm / (durationMinutes / 60) : null;

  const onLog = async () => {
    await addLog({
      activity,
      date: todayKey(),
      distanceKm: distanceActivity ? distanceKm : null,
      durationMinutes,
      sportName: picklistOptions ? resolvedSportName : null,
      intensity,
      weather,
      comboGroupId: comboGroupId ?? null,
    });
    const loggedDistanceKm = distanceActivity ? distanceKm : null;
    const loggedSportName = picklistOptions ? resolvedSportName : null;
    setDistanceInput('');
    setDurationInput('');
    setSportName(null);
    setCustomSportName('');
    setIntensity(null);
    setWeather(null);
    setManualEntry(false);
    // Skip the prompt for combo-group entries (e.g. logging one leg of a multi-activity combo) —
    // this immediately navigates back to the combo screen, which isn't a natural share moment.
    if (comboGroupId) {
      router.back();
      return;
    }
    const streak = computeCardioStreak([...logs, { date: todayKey() }]);
    setJustLogged({
      card: {
        eyebrow: label.toUpperCase(),
        value: loggedDistanceKm != null ? loggedDistanceKm.toFixed(1) : String(durationMinutes),
        valueLabel: loggedDistanceKm != null ? 'KM' : 'MINUTES',
        detail: loggedSportName ? `${loggedSportName} · ${durationMinutes} min` : `${durationMinutes} min`,
        icon: 'trophy',
        accentColor: theme.colors.moduleTasks,
      },
      streak,
    });
  };

  const toggleDay = (day: number) => {
    const targetDays = prefs.targetDays.includes(day) ? prefs.targetDays.filter((d) => d !== day) : [...prefs.targetDays, day];
    savePrefs(activity, { ...prefs, targetDays });
  };

  const setFrequency = (frequency: CardioFrequency) => savePrefs(activity, { ...prefs, frequency });

  const onShare = () => {
    setShareCard({
      eyebrow: `${label.toUpperCase()} · LEVEL ${level.level}`,
      value: distanceActivity ? totalValue.toFixed(1) : String(totalValue),
      valueLabel: distanceActivity ? 'KM TOTAL' : `SESSION${totalValue === 1 ? '' : 'S'} TOTAL`,
      detail: level.label,
      icon: 'trophy',
      accentColor: theme.colors.moduleTasks,
    });
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: label }} />
      <View style={{ gap: theme.spacing.xl }}>
        {RUN_WALK_HIKE.includes(activity) ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {RUN_WALK_HIKE.map((option) => (
              <Chip
                key={option}
                label={CARDIO_ACTIVITY_LABELS[option]}
                selected={activity === option}
                color={theme.colors.moduleTasks}
                onPress={() => router.setParams({ activity: option })}
              />
            ))}
          </View>
        ) : null}

        <Card tier="elevated" glow style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="trophy" color={theme.colors.moduleTasks} size="lg" />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            Level {level.level} · {level.label}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {distanceActivity ? `${totalValue.toFixed(1)} km total` : `${totalValue} session${totalValue === 1 ? '' : 's'} total`}
            {level.nextThreshold != null
              ? distanceActivity
                ? ` · ${(level.nextThreshold - totalValue).toFixed(1)} km to next level`
                : ` · ${level.nextThreshold - totalValue} to next level`
              : ' · Max level reached'}
          </Text>
          <View style={{ width: '100%' }}>
            <ProgressBar progress={level.progress} color={theme.colors.moduleTasks} height={6} glow />
          </View>
          <Pressable onPress={onShare} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.xs }}>
            <Ionicons name="share-outline" size={14} color={theme.colors.moduleTasks} />
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              Share progress
            </Text>
          </Pressable>
        </Card>

        {distanceActivity && (personalBest.longestDistanceKm != null || personalBest.fastestPaceSecPerKm != null) ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="trophy" color={theme.colors.moduleTasks} size="sm" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                Personal Bests
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {personalBest.longestDistanceKm != null ? `${personalBest.longestDistanceKm.toFixed(2)} km` : '—'}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Longest distance</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {personalBest.fastestPaceSecPerKm != null ? `${formatElapsed(Math.round(personalBest.fastestPaceSecPerKm))}/km` : '—'}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Fastest pace</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {canRecordWithGps ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label="Record with GPS"
              glow
              onPress={() => router.push({ pathname: '/cardio/[activity]/record', params: { activity } })}
            />
            <Pressable onPress={() => setManualEntry((prev) => !prev)} hitSlop={8} style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                {manualEntry ? 'Hide manual entry' : 'Or enter it manually instead'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {justLogged ? (
          <PostToFeedPrompt
            type="text"
            card={justLogged.card}
            streak={justLogged.streak}
            streakLabel={`${label.toUpperCase()} STREAK`}
            onDone={() => setJustLogged(null)}
          />
        ) : null}

        {/* Non-GPS activities (swimming/yoga/sports) only ever have this manual form — there's no
            GPS-recording alternative for them. GPS-recordable activities (running/walking/hiking/
            cycling) default to "Record with GPS" above, but someone who did the activity without
            live tracking can reveal this same form via "Enter it manually instead" and log it with
            no route data (routePoints stays null, same as any pre-GPS or manual log). */}
        {showManualForm && !justLogged ? (
        <Card tier="panel" style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Log a session
          </Text>

          {picklistOptions ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                {activity === 'yoga' ? 'Pose / practice' : 'Sport'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {picklistOptions.map((option) => (
                  <Chip key={option} label={option} selected={sportName === option} onPress={() => setSportName(option)} />
                ))}
              </View>
              {sportName === 'Other' ? (
                <TextField placeholder="Name it..." value={customSportName} onChangeText={setCustomSportName} />
              ) : null}
            </View>
          ) : null}

          {distanceActivity ? <TextField placeholder="Distance (km)" value={distanceInput} onChangeText={setDistanceInput} keyboardType="decimal-pad" /> : null}
          <TextField placeholder="Duration (minutes)" value={durationInput} onChangeText={setDurationInput} keyboardType="number-pad" />
          {speedKmh != null ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Pace: {speedKmh.toFixed(1)} km/h</Text>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Intensity (optional)
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {CARDIO_INTENSITIES.map((option) => (
                <Chip
                  key={option}
                  label={CARDIO_INTENSITY_LABELS[option]}
                  selected={intensity === option}
                  onPress={() => setIntensity(intensity === option ? null : option)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Weather (optional)
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {CARDIO_WEATHERS.map((option) => (
                <Chip
                  key={option}
                  label={CARDIO_WEATHER_LABELS[option]}
                  selected={weather === option}
                  onPress={() => setWeather(weather === option ? null : option)}
                />
              ))}
            </View>
          </View>

          <Button label="Log session" onPress={onLog} disabled={!canLog} />
        </Card>
        ) : null}

        <Card tier="panel" style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconBadge name="repeat" color={theme.colors.moduleTasks} size="sm" />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Recurring
            </Text>
            <Button
              label={prefs.isRecurring ? 'On' : 'Off'}
              variant={prefs.isRecurring ? 'primary' : 'secondary'}
              onPress={() => savePrefs(activity, { ...prefs, isRecurring: !prefs.isRecurring })}
            />
          </View>
          {prefs.isRecurring ? (
            <>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Chip label="Daily" selected={prefs.frequency === 'daily'} color={theme.colors.moduleTasks} onPress={() => setFrequency('daily')} />
                <Chip label="Specific days" selected={prefs.frequency === 'weekly'} color={theme.colors.moduleTasks} onPress={() => setFrequency('weekly')} />
              </View>
              {prefs.frequency === 'weekly' ? (
                <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                  {WEEKDAYS.map((day) => {
                    const selected = prefs.targetDays.includes(day.value);
                    return (
                      <Chip key={day.value} label={day.label} selected={selected} color={theme.colors.moduleTasks} onPress={() => toggleDay(day.value)} />
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>History</Text>
          {!loading && logs.length === 0 ? (
            <EmptyState icon="time-outline" title="No sessions yet" subtitle="Log your first session above." />
          ) : (
            logs.map((log) => {
              const comboSiblings = log.comboGroupId ? findComboSiblings(allLogs, log.comboGroupId) : [];
              const isCombo = comboSiblings.length > 1;
              return (
              <Card key={log.id} style={{ gap: theme.spacing.sm, borderColor: isCombo ? theme.colors.moduleTasks : undefined, borderWidth: isCombo ? 1 : undefined }}>
                {isCombo ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="link" size={12} color={theme.colors.moduleTasks} />
                    <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                      {comboSummaryLabel(comboSiblings)}
                    </Text>
                  </View>
                ) : null}
                {log.photoUri ? (
                  <Image source={{ uri: log.photoUri }} style={{ width: '100%', height: 140, borderRadius: theme.radius.md }} resizeMode="cover" />
                ) : log.routePoints && log.routePoints.length > 1 ? (
                  <View style={{ height: 120, borderRadius: theme.radius.md, overflow: 'hidden' }}>
                    <CardioRouteMap points={log.routePoints} followUser={false} />
                  </View>
                ) : null}
                {log.routePoints && hasSplitTimestamps(log.routePoints) ? (
                  <CardioSplitsList points={log.routePoints} />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name="checkmark-circle" color={theme.colors.success} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      {log.note ? `${log.note} · ` : ''}
                      {log.sportName ? `${log.sportName} · ` : ''}
                      {log.distanceKm != null ? `${log.distanceKm} km · ` : ''}
                      {log.durationMinutes} min
                      {log.elevationGainM != null ? ` · ${log.elevationGainM} m gain` : ''}
                      {log.intensity ? ` · ${CARDIO_INTENSITY_LABELS[log.intensity]}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {formatDisplayDate(log.date)}
                        {log.mood ? ` · Felt ${log.mood}` : ''}
                      </Text>
                      {log.weather ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Ionicons name={CARDIO_WEATHER_ICON[log.weather]} size={11} color={theme.colors.textTertiary} />
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {CARDIO_WEATHER_LABELS[log.weather]}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      showAlert('Delete session?', 'This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => removeLog(log.id) },
                      ])
                    }>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                  </Pressable>
                </View>
              </Card>
              );
            })
          )}
        </View>
      </View>
      <ShareCardModal visible={!!shareCard} onClose={() => setShareCard(null)} data={shareCard} />
    </ScreenContainer>
  );
}
