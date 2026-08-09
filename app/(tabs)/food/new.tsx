import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, ScreenContainer, TextField } from '@/components';
import { todayKey } from '@/lib/date';
import { FOOD_DATA_LICENSE_NOTICE, MEALS, mealLabel, searchFoodProducts, useFoodDay, type FoodSearchResult, type Meal } from '@/modules/food';
import { useAppTheme } from '@/theme';

type EntryTab = 'search' | 'manual';

export default function NewFoodLogScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { date, id, prefillName, prefillCalories, prefillProtein, prefillCarbs, prefillFat } = useLocalSearchParams<{
    date?: string;
    id?: string;
    prefillName?: string;
    prefillCalories?: string;
    prefillProtein?: string;
    prefillCarbs?: string;
    prefillFat?: string;
  }>();
  const dateKey = date ?? todayKey();
  const { logs, createLog, updateLog, deleteLog } = useFoodDay(dateKey);

  const editingLog = id ? logs.find((l) => l.id === Number(id)) : undefined;
  const isEditing = Boolean(id);
  const hasPrefill = Boolean(prefillName);

  const [entryTab, setEntryTab] = useState<EntryTab>('search');
  const [description, setDescription] = useState('');
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [portionNote, setPortionNote] = useState<string | null>(null);
  const [pickedResult, setPickedResult] = useState<FoodSearchResult | null>(null);
  const [quantity, setQuantity] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // "New Food Log" is a static route — expo-router reuses the same screen instance across
  // repeated visits rather than mounting a fresh one each time, so a plain useState default only
  // resets once, ever. Re-blanking on every focus is what actually makes each visit start fresh —
  // except when editing or arriving with a barcode-scan prefill, where we populate from that instead.
  useFocusEffect(
    useCallback(() => {
      if (editingLog) {
        setDescription(editingLog.description);
        setMeal(editingLog.meal);
        setCalories(String(editingLog.calories));
        setProtein(editingLog.protein_g != null ? String(editingLog.protein_g) : '');
        setCarbs(editingLog.carbs_g != null ? String(editingLog.carbs_g) : '');
        setFat(editingLog.fat_g != null ? String(editingLog.fat_g) : '');
        setEntryTab('manual');
      } else if (hasPrefill) {
        setDescription(prefillName ?? '');
        setCalories(prefillCalories ?? '');
        setProtein(prefillProtein ?? '');
        setCarbs(prefillCarbs ?? '');
        setFat(prefillFat ?? '');
        setPortionNote('Values are per 100g — adjust to match your actual portion.');
        setEntryTab('manual');
      } else if (!isEditing) {
        setDescription('');
        setMeal('breakfast');
        setCalories('');
        setProtein('');
        setCarbs('');
        setFat('');
        setPortionNote(null);
        setPickedResult(null);
        setQuantity('');
        setSearchQuery('');
        setSearchResults([]);
        setEntryTab('search');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingLog?.id, hasPrefill])
  );

  const onSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchFoodProducts(text);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onPickResult = (result: FoodSearchResult) => {
    setPickedResult(result);
    setDescription(result.name);
    const defaultQuantity = result.source === 'indian' ? '1' : '100';
    setQuantity(defaultQuantity);
    applyQuantity(result, defaultQuantity);
    setPortionNote(null);
    setEntryTab('manual');
  };

  // Indian-dish results are per-serving (factor = number of servings); Open Food Facts results
  // are per-100g (factor = grams / 100) — same recompute, different denominator by source.
  const applyQuantity = (result: FoodSearchResult, nextQuantity: string) => {
    const qty = Number(nextQuantity);
    if (!(qty > 0)) return;
    const factor = result.source === 'indian' ? qty : qty / 100;
    if (result.caloriesPer100g != null) setCalories(String(Math.round(result.caloriesPer100g * factor)));
    if (result.proteinPer100g != null) setProtein(String(Math.round(result.proteinPer100g * factor)));
    if (result.carbsPer100g != null) setCarbs(String(Math.round(result.carbsPer100g * factor)));
    if (result.fatPer100g != null) setFat(String(Math.round(result.fatPer100g * factor)));
  };

  const onChangeQuantity = (text: string) => {
    setQuantity(text);
    if (pickedResult) applyQuantity(pickedResult, text);
  };

  const parsedCalories = Number(calories);
  const canSave = description.trim().length > 0 && calories.trim().length > 0 && !Number.isNaN(parsedCalories);

  const onSave = async () => {
    setSaving(true);
    const values = {
      description: description.trim(),
      meal,
      calories: Math.round(parsedCalories),
      proteinG: protein.trim() ? Math.round(Number(protein)) : null,
      carbsG: carbs.trim() ? Math.round(Number(carbs)) : null,
      fatG: fat.trim() ? Math.round(Number(fat)) : null,
    };
    if (isEditing && editingLog) {
      await updateLog(editingLog.id, values);
    } else {
      await createLog(values);
    }
    setSaving(false);
    router.back();
  };

  const onDelete = () => {
    if (!editingLog) return;
    Alert.alert('Remove entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteLog(editingLog.id);
          router.back();
        },
      },
    ]);
  };

  const showTabs = !isEditing && !hasPrefill;

  return (
    <ScreenContainer scroll={entryTab === 'manual' || !showTabs}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Food Log' : 'Log Food' }} />
      <View style={{ gap: theme.spacing.xl, flex: showTabs && entryTab === 'search' ? 1 : undefined }}>
        {showTabs ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip label="Search" selected={entryTab === 'search'} onPress={() => setEntryTab('search')} />
            <Chip label="Manual Entry" selected={entryTab === 'manual'} onPress={() => setEntryTab('manual')} />
          </View>
        ) : null}

        {showTabs && entryTab === 'search' ? (
          <View style={{ gap: theme.spacing.sm, flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField placeholder="Search a food..." value={searchQuery} onChangeText={onSearch} autoCapitalize="none" autoFocus />
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/food/scan', params: { date: dateKey } })}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.moduleTasksMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="barcode-outline" size={22} color={theme.colors.moduleTasks} />
              </Pressable>
            </View>

            {searching ? <ActivityIndicator /> : null}

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.code}
              style={{ flex: 1 }}
              ListEmptyComponent={
                !searching && searchQuery.trim().length >= 2 ? (
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center', marginTop: theme.spacing.xl }}>
                    No results — try Manual Entry instead.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => onPickResult(item)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={{ width: 40, height: 40, borderRadius: theme.radius.sm }} />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: theme.radius.sm,
                          backgroundColor: theme.colors.moduleTasksMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Ionicons name="restaurant-outline" size={18} color={theme.colors.moduleTasks} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {item.source === 'indian'
                          ? `${item.serving} · ${Math.round(item.caloriesPer100g ?? 0)} cal`
                          : `${item.brand ? `${item.brand} · ` : ''}${item.caloriesPer100g != null ? `${Math.round(item.caloriesPer100g)} cal/100g` : 'No calorie data'}`}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              )}
            />

            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{FOOD_DATA_LICENSE_NOTICE}</Text>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.xl }}>
            <TextField label="What did you eat" placeholder="e.g. Grilled chicken salad" value={description} onChangeText={setDescription} />

            {pickedResult ? (
              <TextField
                label={pickedResult.source === 'indian' ? `Servings (1 = ${pickedResult.serving})` : 'Weight (grams)'}
                value={quantity}
                onChangeText={onChangeQuantity}
                keyboardType="decimal-pad"
              />
            ) : null}

            {portionNote ? <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{portionNote}</Text> : null}

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

            <Button label={isEditing ? 'Save changes' : 'Save entry'} onPress={onSave} disabled={!canSave} loading={saving} />
            {isEditing ? <Button label="Delete entry" variant="danger" onPress={onDelete} /> : null}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
