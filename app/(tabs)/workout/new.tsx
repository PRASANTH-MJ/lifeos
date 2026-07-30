import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Chip, ScreenContainer, TextField } from '@/components';
import {
  EQUIPMENT_OPTIONS,
  GOALS,
  equipmentLabel,
  goalLabel,
  useCustomWorkouts,
  type Equipment,
  type WorkoutGoal,
} from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function NewWorkoutScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addWorkout } = useCustomWorkouts();

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<WorkoutGoal>('general');
  const [equipment, setEquipment] = useState<Equipment>('none');
  const [minutesText, setMinutesText] = useState('30');
  const [exercises, setExercises] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);

  const updateExercise = (index: number, text: string) => setExercises((items) => items.map((item, i) => (i === index ? text : item)));
  const addExercise = () => setExercises((items) => [...items, '']);
  const removeExercise = (index: number) => setExercises((items) => items.filter((_, i) => i !== index));

  const trimmedExercises = exercises.map((e) => e.trim()).filter(Boolean);
  const minutes = Number(minutesText);
  const canSave = title.trim().length > 0 && minutes > 0 && trimmedExercises.length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      await addWorkout({ title: title.trim(), goal, equipment, minutes, exercises: trimmedExercises });
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
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField placeholder="e.g. Push-ups — 3x12" value={exercise} onChangeText={(text) => updateExercise(index, text)} />
              </View>
              <Pressable onPress={() => removeExercise(index)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addExercise}>
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Add exercise
            </Text>
          </Pressable>
        </View>

        <Button label="Save workout" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
