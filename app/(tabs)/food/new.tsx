import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, ScreenContainer, TextField } from '@/components';
import { todayKey } from '@/lib/date';
import { MEALS, mealLabel, useFoodDay, type Meal } from '@/modules/food';
import { useAppTheme } from '@/theme';

export default function NewFoodLogScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateKey = date ?? todayKey();
  const { createLog } = useFoodDay(dateKey);

  const [description, setDescription] = useState('');
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  // "New Food Log" is a static route — expo-router reuses the same screen instance across
  // repeated visits rather than mounting a fresh one each time, so a plain useState default only
  // resets once, ever. Re-blanking on every focus is what actually makes each visit start fresh.
  useFocusEffect(
    useCallback(() => {
      setDescription('');
      setMeal('breakfast');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    }, [])
  );

  const parsedCalories = Number(calories);
  const canSave = description.trim().length > 0 && calories.trim().length > 0 && !Number.isNaN(parsedCalories);

  const onSave = async () => {
    setSaving(true);
    await createLog({
      description: description.trim(),
      meal,
      calories: Math.round(parsedCalories),
      proteinG: protein.trim() ? Math.round(Number(protein)) : null,
      carbsG: carbs.trim() ? Math.round(Number(carbs)) : null,
      fatG: fat.trim() ? Math.round(Number(fat)) : null,
    });
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <TextField label="What did you eat" placeholder="e.g. Grilled chicken salad" value={description} onChangeText={setDescription} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Meal
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {MEALS.map((option) => (
              <Chip key={option} label={mealLabel(option)} selected={meal === option} onPress={() => setMeal(option)} />
            ))}
          </View>
        </View>

        <TextField label="Calories" placeholder="e.g. 450" value={calories} onChangeText={setCalories} keyboardType="number-pad" />

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField label="Protein g" placeholder="0" value={protein} onChangeText={setProtein} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Carbs g" placeholder="0" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Fat g" placeholder="0" value={fat} onChangeText={setFat} keyboardType="number-pad" />
          </View>
        </View>

        <Button label="Save entry" onPress={onSave} disabled={!canSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
