import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Chip, ScreenContainer, TextField } from '@/components';
import {
  EQUIPMENT_OPTIONS,
  GOALS,
  equipmentLabel,
  goalLabel,
  openExercisePicker,
  useCustomWorkouts,
  type CustomWorkoutExercise,
  type Equipment,
  type WorkoutGoal,
} from '@/modules/workout';
import { useAppTheme } from '@/theme';

/** One builder row — `groupedWithNext` is the raw "Group with next" toggle state; resolved into
 * the actual shared `supersetGroup` numbers at save time (see toSupersetExercises below), since a
 * chain of 3+ toggled rows should all end up in the SAME group, not three separate pairs. */
type BuilderExercise = { text: string; groupedWithNext: boolean };

/** Walks the builder rows once, assigning every run of 2+ consecutive `groupedWithNext`-linked
 * rows the same group number — a lone toggle on the last row (nothing to group it with) simply
 * never starts a group. */
function toSupersetExercises(items: BuilderExercise[]): CustomWorkoutExercise[] {
  let currentGroup: number | null = null;
  let nextGroupNumber = 1;
  return items.map((item, index) => {
    const groupedWithPrev = index > 0 && items[index - 1].groupedWithNext;
    if (item.groupedWithNext || groupedWithPrev) {
      if (currentGroup == null) currentGroup = nextGroupNumber++;
    } else {
      currentGroup = null;
    }
    return { text: item.text.trim(), supersetGroup: currentGroup };
  });
}

export default function NewWorkoutScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { addWorkout } = useCustomWorkouts();

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<WorkoutGoal>('general');
  const [equipment, setEquipment] = useState<Equipment>('none');
  const [minutesText, setMinutesText] = useState('30');
  const [exercises, setExercises] = useState<BuilderExercise[]>([
    { text: '', groupedWithNext: false },
    { text: '', groupedWithNext: false },
  ]);
  const [saving, setSaving] = useState(false);

  // Static route — expo-router reuses the same screen instance across repeated visits rather
  // than mounting a fresh one each time, so a plain useState default only resets once, ever.
  useFocusEffect(
    useCallback(() => {
      setTitle('');
      setGoal('general');
      setEquipment('none');
      setMinutesText('30');
      setExercises(
        prefill ? [{ text: prefill, groupedWithNext: false }, { text: '', groupedWithNext: false }] : [{ text: '', groupedWithNext: false }, { text: '', groupedWithNext: false }]
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefill])
  );

  const updateExercise = (index: number, text: string) => setExercises((items) => items.map((item, i) => (i === index ? { ...item, text } : item)));
  const addExercise = () => setExercises((items) => [...items, { text: '', groupedWithNext: false }]);
  const removeExercise = (index: number) => setExercises((items) => items.filter((_, i) => i !== index));
  const toggleGroupedWithNext = (index: number) =>
    setExercises((items) => items.map((item, i) => (i === index ? { ...item, groupedWithNext: !item.groupedWithNext } : item)));

  const onPickFromLibrary = () => {
    openExercisePicker(router, (picked) => {
      if (picked.length === 0) return;
      setExercises((items) => [
        ...items.filter((e) => e.text.trim().length > 0),
        ...picked.map((p) => ({ text: p.name, groupedWithNext: false })),
      ]);
    });
  };

  const trimmedExercises = exercises.filter((e) => e.text.trim().length > 0);
  const minutes = Number(minutesText);
  const canSave = title.trim().length > 0 && minutes > 0 && trimmedExercises.length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      await addWorkout({ title: title.trim(), goal, equipment, minutes, exercises: toSupersetExercises(trimmedExercises) });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="Workout name" placeholder="e.g. Leg Day" value={title} onChangeText={setTitle} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {GOALS.map((option) => (
              <Chip key={option} label={goalLabel(option)} selected={goal === option} onPress={() => setGoal(option)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Equipment needed
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {EQUIPMENT_OPTIONS.map((option) => (
              <Chip key={option} label={equipmentLabel(option)} selected={equipment === option} onPress={() => setEquipment(option)} />
            ))}
          </View>
        </View>

        <TextField label="Duration (minutes)" placeholder="30" value={minutesText} onChangeText={setMinutesText} keyboardType="number-pad" />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Exercises
          </Text>
          {exercises.map((exercise, index) => (
            <View key={index} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <TextField placeholder="e.g. Push-ups — 3x12" value={exercise.text} onChangeText={(text) => updateExercise(index, text)} />
                </View>
                <Pressable onPress={() => removeExercise(index)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                </Pressable>
              </View>
              {index < exercises.length - 1 ? (
                <Chip
                  label="Group with next (superset)"
                  selected={exercise.groupedWithNext}
                  onPress={() => toggleGroupedWithNext(index)}
                />
              ) : null}
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
            <Pressable onPress={addExercise}>
              <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Add exercise
              </Text>
            </Pressable>
            <Pressable onPress={onPickFromLibrary} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="library-outline" size={14} color={theme.colors.moduleTasks} />
              <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Pick from library
              </Text>
            </Pressable>
          </View>
        </View>

        <Button label="Save workout" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
