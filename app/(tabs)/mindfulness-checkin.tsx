import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, IconBadge, ScreenContainer, SegmentedControl } from '@/components';
import {
  FIRST_REACHED_FOR_OPTIONS,
  MoodPicker,
  Scale5Picker,
  SLEEP_BUCKETS,
  useCheckins,
  type FirstReachedFor,
  type SleepBucket,
} from '@/modules/journal';
import { useAppTheme } from '@/theme';

type CheckinType = 'morning' | 'night';

/** A guided, one-question-at-a-time walk through the same fields CheckinSheet already saves in
 * one scroll (see modules/journal/CheckinSheet.tsx and useCheckins) — this screen is a second,
 * slower entry point into that exact same data, not a parallel table. */
export default function MindfulnessCheckinScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { type: initialType } = useLocalSearchParams<{ type?: string }>();
  const { morning, night, saveMorning, saveNight } = useCheckins();

  const [type, setType] = useState<CheckinType>(initialType === 'night' ? 'night' : 'morning');
  const [step, setStep] = useState(0);

  const existing = type === 'morning' ? morning : night;

  const [energy, setEnergy] = useState<number | null>(null);
  const [sleepBucket, setSleepBucket] = useState<SleepBucket | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [firstReachedFor, setFirstReachedFor] = useState<FirstReachedFor | null>(null);
  const [productivity, setProductivity] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);

  useEffect(() => {
    setStep(0);
    setEnergy(existing?.energy ?? null);
    setSleepBucket(existing?.sleep_bucket ?? null);
    setStress(existing?.stress ?? null);
    setFirstReachedFor(existing?.first_reached_for ?? null);
    setProductivity(existing?.productivity ?? null);
    setMood(existing?.mood ?? null);
    // Re-seed the wizard fresh whenever the toggle switches type — deliberately not reacting to
    // `existing` changing mid-edit, or a save-in-progress would blow away in-progress taps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const steps =
    type === 'morning'
      ? (['energy', 'sleep', 'stress', 'anchor', 'mood'] as const)
      : (['productivity', 'mood'] as const);

  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  const onNext = () => {
    if (isLast) {
      if (type === 'morning') {
        saveMorning({ energy, sleepBucket, stress, firstReachedFor, mood });
      } else {
        saveNight({ productivity, mood });
      }
      router.back();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            Check-in
          </Text>
        </View>

        <SegmentedControl
          options={[
            { value: 'morning', label: 'Morning' },
            { value: 'night', label: 'Night' },
          ]}
          value={type}
          onChange={(next) => setType(next as CheckinType)}
        />

        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Step {step + 1} of {total}
        </Text>

        <Card style={{ gap: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconBadge name={type === 'morning' ? 'sunny' : 'moon'} color={theme.colors.moduleJournal} size="sm" />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {stepLabel(type, current)}
            </Text>
          </View>

          {current === 'energy' ? <Scale5Picker value={energy} onChange={setEnergy} endLabels={['Drained', 'Energized']} /> : null}

          {current === 'sleep' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {SLEEP_BUCKETS.map((bucket) => (
                <Chip
                  key={bucket.key}
                  label={bucket.label}
                  selected={sleepBucket === bucket.key}
                  onPress={() => setSleepBucket(bucket.key)}
                />
              ))}
            </View>
          ) : null}

          {current === 'stress' ? <Scale5Picker value={stress} onChange={setStress} endLabels={['Calm', 'Stressed']} /> : null}

          {current === 'anchor' ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {FIRST_REACHED_FOR_OPTIONS.map((option) => {
                const selected = firstReachedFor === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFirstReachedFor(option.key)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.moduleJournal : theme.colors.border,
                      backgroundColor: selected ? theme.colors.moduleJournalMuted : 'transparent',
                    }}>
                    <IconBadge
                      name={option.icon as React.ComponentProps<typeof IconBadge>['name']}
                      color={theme.colors.moduleJournal}
                      tone={selected ? 'tinted' : 'neutral'}
                      size="sm"
                    />
                    <Text style={{ fontSize: theme.typography.size.xs, color: selected ? theme.colors.moduleJournal : theme.colors.textTertiary }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {current === 'productivity' ? <Scale5Picker value={productivity} onChange={setProductivity} endLabels={['Not much', 'Very']} /> : null}

          {current === 'mood' ? <MoodPicker value={mood} onChange={setMood} /> : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          {step > 0 ? <Button label="Back" variant="secondary" onPress={() => setStep((s) => s - 1)} /> : null}
          <View style={{ flex: 1 }}>
            <Button
              label={isLast ? `Save ${type === 'morning' ? 'Morning' : 'Night'} Check-in` : 'Next'}
              onPress={onNext}
              glow={isLast}
            />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

function stepLabel(type: CheckinType, step: string): string {
  if (type === 'morning') {
    switch (step) {
      case 'energy':
        return "How's your energy?";
      case 'sleep':
        return 'Sleep duration';
      case 'stress':
        return 'Stress level right now?';
      case 'anchor':
        return 'First anchor this morning?';
      case 'mood':
        return 'Emotional weather?';
    }
  }
  switch (step) {
    case 'productivity':
      return 'How was your day overall?';
    case 'mood':
      return 'Wind down — emotional weather?';
  }
  return '';
}
