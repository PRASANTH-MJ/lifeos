import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, ScreenContainer } from '@/components';
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/tabBarMetrics';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  EXERCISE_MUSCLES,
  findLibraryExercise,
  resolveExercisePicker,
  searchExercises,
  useRecentExercises,
} from '@/modules/workout';
import { useAppTheme } from '@/theme';

type BrowseMode = 'category' | 'muscle' | 'equipment';

const MUSCLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Chest: 'body',
  Back: 'body',
  Lats: 'body',
  Trapezius: 'body',
  Shoulders: 'body',
  Biceps: 'fitness',
  Triceps: 'fitness',
  Brachialis: 'fitness',
  Abs: 'grid',
  'Obliquus externus abdominis': 'grid',
  Quads: 'walk',
  Hamstrings: 'walk',
  Glutes: 'walk',
  Calves: 'walk',
  Soleus: 'walk',
  'Serratus anterior': 'body',
};

const EQUIPMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Barbell: 'barbell',
  'SZ-Bar': 'barbell',
  Dumbbell: 'barbell-outline',
  Kettlebell: 'barbell-outline',
  'Cable machine': 'link',
  'Pull-up bar': 'remove-outline',
  Bench: 'bed-outline',
  'Incline bench': 'bed-outline',
  'Swiss Ball': 'ellipse-outline',
  'Gym mat': 'square-outline',
  'Resistance band': 'infinite-outline',
  'none (bodyweight exercise)': 'walk-outline',
};

export default function ExerciseLibraryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { category: categoryParam, mode } = useLocalSearchParams<{ category?: string; mode?: string }>();
  const pickMode = mode === 'pick';
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<BrowseMode>('category');
  const [category, setCategory] = useState<string | null>(categoryParam ?? null);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const { recentKeys } = useRecentExercises();

  const toggleSelect = (exerciseKey: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(exerciseKey)) next.delete(exerciseKey);
      else next.add(exerciseKey);
      return next;
    });
  };

  const onConfirmPick = () => {
    resolveExercisePicker(Array.from(selectedKeys));
    router.back();
  };

  const results = useMemo(() => searchExercises(query, { category, muscle, equipment }), [query, category, muscle, equipment]);
  const recentExercises = useMemo(
    () => recentKeys.map((key) => findLibraryExercise(key)).filter((e): e is NonNullable<typeof e> => !!e),
    [recentKeys]
  );
  const showRecent = !query && !category && !muscle && !equipment && recentExercises.length > 0;

  const gridItems = browseMode === 'muscle' ? EXERCISE_MUSCLES : browseMode === 'equipment' ? EXERCISE_EQUIPMENT : [];
  const gridIcons = browseMode === 'muscle' ? MUSCLE_ICONS : EQUIPMENT_ICONS;
  const activeGridValue = browseMode === 'muscle' ? muscle : equipment;

  const onSelectGridItem = (value: string) => {
    if (browseMode === 'muscle') setMuscle(muscle === value ? null : value);
    else setEquipment(equipment === value ? null : value);
  };

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: pickMode ? 'Pick Exercises' : 'Exercise Library' }} />
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: theme.spacing.md,
          }}>
          <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor={theme.colors.textTertiary}
            style={{ flex: 1, paddingVertical: theme.spacing.md, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(
            [
              { key: 'category', label: 'Category' },
              { key: 'muscle', label: 'Muscle' },
              { key: 'equipment', label: 'Equipment' },
            ] as const
          ).map((mode) => (
            <Pressable
              key={mode.key}
              onPress={() => setBrowseMode(mode.key)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: browseMode === mode.key ? theme.colors.moduleTasks : theme.colors.surface,
                borderWidth: 1,
                borderColor: browseMode === mode.key ? theme.colors.moduleTasks : theme.colors.border,
              }}>
              <Text
                style={{
                  color: browseMode === mode.key ? '#fff' : theme.colors.textSecondary,
                  fontSize: theme.typography.size.sm,
                  fontWeight: theme.typography.weight.medium,
                }}>
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {browseMode === 'category' ? (
          <View style={{ height: 44 }}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[null, ...EXERCISE_CATEGORIES]}
              keyExtractor={(item) => item ?? 'all'}
              contentContainerStyle={{ gap: theme.spacing.sm }}
              renderItem={({ item }) => {
                const selected = category === item;
                return (
                  <Pressable
                    onPress={() => setCategory(item)}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.full,
                      backgroundColor: selected ? theme.colors.moduleTasks : theme.colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.moduleTasks : theme.colors.border,
                    }}>
                    <Text style={{ color: selected ? '#fff' : theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      {item ?? 'All'}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        ) : (
          <ScrollView horizontal={false} style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {gridItems.map((item) => {
                const selected = activeGridValue === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => onSelectGridItem(item)}
                    style={{
                      width: '30%',
                      alignItems: 'center',
                      gap: 4,
                      padding: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor: selected ? theme.colors.moduleTasksMuted : theme.colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.moduleTasks : theme.colors.border,
                    }}>
                    <Ionicons name={gridIcons[item] ?? 'ellipse-outline'} size={22} color={selected ? theme.colors.moduleTasks : theme.colors.textSecondary} />
                    <Text
                      numberOfLines={2}
                      style={{
                        color: selected ? theme.colors.moduleTasks : theme.colors.textSecondary,
                        fontSize: theme.typography.size.xs,
                        fontWeight: theme.typography.weight.medium,
                        textAlign: 'center',
                      }}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {showRecent ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Recently viewed
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentExercises}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{ gap: theme.spacing.sm }}
              renderItem={({ item }) => {
                const selected = selectedKeys.has(item.key);
                const content = (
                  <View style={{ width: 84, alignItems: 'center', gap: 4 }}>
                    <View>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={{ width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: theme.colors.background }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: theme.colors.moduleTasksMuted, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="barbell" size={20} color={theme.colors.moduleTasks} />
                        </View>
                      )}
                      {pickMode && selected ? (
                        <View style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.moduleTasks, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.background }}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
                      {item.name}
                    </Text>
                  </View>
                );
                if (pickMode) {
                  return <Pressable onPress={() => toggleSelect(item.key)}>{content}</Pressable>;
                }
                return (
                  <Link href={{ pathname: '/workout/exercises/[key]', params: { key: item.key } }} asChild>
                    <Pressable>{content}</Pressable>
                  </Link>
                );
              }}
            />
          </View>
        ) : null}

        {results.length === 0 ? (
          <EmptyState icon="barbell-outline" title="No exercises found" subtitle="Try a different search or muscle group." />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}
            renderItem={({ item }) => {
              const selected = selectedKeys.has(item.key);
              const row = (
                <Card
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    borderWidth: pickMode && selected ? 2 : undefined,
                    borderColor: pickMode && selected ? theme.colors.moduleTasks : undefined,
                  }}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 48, height: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.background }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.moduleTasksMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="barbell" size={20} color={theme.colors.moduleTasks} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      {item.category}
                      {item.muscles.length > 0 ? ` · ${item.muscles.join(', ')}` : ''}
                    </Text>
                  </View>
                  {pickMode ? (
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? theme.colors.moduleTasks : theme.colors.textTertiary}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  )}
                </Card>
              );
              if (pickMode) {
                return <Pressable onPress={() => toggleSelect(item.key)}>{row}</Pressable>;
              }
              return (
                <Link href={{ pathname: '/workout/exercises/[key]', params: { key: item.key } }} asChild>
                  <Pressable>{row}</Pressable>
                </Link>
              );
            }}
          />
        )}

        {pickMode && selectedKeys.size > 0 ? (
          <View style={{ paddingBottom: FLOATING_TAB_BAR_CLEARANCE }}>
            <Button label={`Add ${selectedKeys.size} exercise${selectedKeys.size === 1 ? '' : 's'}`} onPress={onConfirmPick} />
          </View>
        ) : (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            Exercise data from wger.de, CC BY-SA 4.0
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}
