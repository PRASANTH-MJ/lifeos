import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, LoadingState, PremiumGate, ScreenContainer } from '@/components';
import { FLOATING_TAB_BAR_CLEARANCE_HIDDEN } from '@/components/tabBarMetrics';
import { resolveExercisePicker, useExerciseCatalog, useExerciseCatalogSync, useRecentExercises, type CatalogExercise } from '@/modules/workout';
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
  const [categorySet, setCategorySet] = useState<Set<string>>(() => new Set(categoryParam ? [categoryParam] : []));
  const [muscleSet, setMuscleSet] = useState<Set<string>>(new Set());
  const [equipmentSet, setEquipmentSet] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const { recentKeys } = useRecentExercises();
  const { exercises: catalog } = useExerciseCatalog();
  const { syncing, error: syncError, syncNow } = useExerciseCatalogSync(); // keeps the catalog fresh in the background; reads above already work from whatever's local

  // Every catalog exercise, illustrated or not — rows without an image/gif fall back to the same
  // IconBadge placeholder used elsewhere (e.g. Avatar), which reads fine, rather than being
  // dropped outright. wger's own image licensing only covers ~30% of exercises, so filtering on
  // imageUrl/gifUrl was hiding most of the real catalog rather than just the rare broken row.
  const allExercises = catalog;

  const categories = useMemo(() => Array.from(new Set(allExercises.map((e) => e.category))).sort(), [allExercises]);
  const muscles = useMemo(
    () => Array.from(new Set(allExercises.flatMap((e) => [...e.muscles, ...e.musclesSecondary]))).sort(),
    [allExercises]
  );
  const equipmentOptions = useMemo(() => Array.from(new Set(allExercises.flatMap((e) => e.equipment))).sort(), [allExercises]);

  const toggleSelect = (exerciseKey: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(exerciseKey)) next.delete(exerciseKey);
      else next.add(exerciseKey);
      return next;
    });
  };

  const toggleInFilterSet = (setter: Dispatch<SetStateAction<Set<string>>>, value: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const onConfirmPick = () => {
    // router.back() must run BEFORE resolving — the callback may itself navigate (e.g. straight
    // into a new session), and calling back() after that would pop the screen it just pushed.
    const picked = allExercises.filter((e) => selectedKeys.has(e.key)).map((e) => ({ key: e.key, name: e.name }));
    router.back();
    resolveExercisePicker(picked);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExercises.filter((exercise) => {
      if (categorySet.size > 0 && !categorySet.has(exercise.category)) return false;
      if (muscleSet.size > 0 && !exercise.muscles.some((m) => muscleSet.has(m)) && !exercise.musclesSecondary.some((m) => muscleSet.has(m))) return false;
      if (equipmentSet.size > 0 && !exercise.equipment.some((eq) => equipmentSet.has(eq))) return false;
      if (q && !exercise.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allExercises, query, categorySet, muscleSet, equipmentSet]);

  const recentExercises = useMemo(
    () => recentKeys.map((key) => allExercises.find((e) => e.key === key)).filter((e): e is CatalogExercise => !!e),
    [recentKeys, allExercises]
  );
  const showRecent = !query && categorySet.size === 0 && muscleSet.size === 0 && equipmentSet.size === 0 && recentExercises.length > 0;

  const gridItems = browseMode === 'muscle' ? muscles : browseMode === 'equipment' ? equipmentOptions : [];
  const gridIcons = browseMode === 'muscle' ? MUSCLE_ICONS : EQUIPMENT_ICONS;
  const activeGridSet = browseMode === 'muscle' ? muscleSet : equipmentSet;

  const onSelectGridItem = (value: string) => {
    toggleInFilterSet(browseMode === 'muscle' ? setMuscleSet : setEquipmentSet, value);
  };

  return (
    <>
      <Stack.Screen options={{ title: pickMode ? 'Pick Exercises' : 'Exercise Library' }} />
      <ScreenContainer scroll={false} bottomClearance={false}>
      <PremiumGate
        feature="exerciseLibraryBrowse"
        bypass={pickMode}
        icon="barbell-outline"
        title="The Exercise Library is a Pro feature"
        message="Browse and search the full illustrated exercise database by body part, muscle, or equipment. Go Pro to unlock it — you can still pick exercises while building a workout for free.">
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
              { key: 'category', label: 'Body Part' },
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
              data={[null, ...categories]}
              keyExtractor={(item) => item ?? 'all'}
              contentContainerStyle={{ gap: theme.spacing.sm }}
              renderItem={({ item }) => {
                const selected = item === null ? categorySet.size === 0 : categorySet.has(item);
                return (
                  <Pressable
                    onPress={() => (item === null ? setCategorySet(new Set()) : toggleInFilterSet(setCategorySet, item))}
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
                const selected = activeGridSet.has(item);
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
                      {item.imageUrl || item.gifUrl ? (
                        <Image source={{ uri: item.imageUrl || item.gifUrl || undefined }} style={{ width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: theme.colors.background }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                          <IconBadge name="barbell" color={theme.colors.moduleTasks} size="lg" shape="square" />
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
          catalog.length === 0 && syncing ? (
            <LoadingState />
          ) : catalog.length === 0 && syncError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load the exercise library"
              subtitle={syncError}
              ctaLabel="Retry"
              onPressCta={syncNow}
            />
          ) : (
            <EmptyState icon="barbell-outline" title="No exercises found" subtitle="Try a different search or muscle group." />
          )
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl + FLOATING_TAB_BAR_CLEARANCE_HIDDEN }}
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
                  {item.imageUrl || item.gifUrl ? (
                    <Image
                      source={{ uri: item.imageUrl || item.gifUrl || undefined }}
                      style={{ width: 48, height: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.background }}
                      resizeMode="cover"
                    />
                  ) : (
                    <IconBadge name="barbell" color={theme.colors.moduleTasks} size="lg" shape="square" />
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      {item.muscles.length > 0 ? item.muscles.join(', ') : item.category}
                    </Text>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 2,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.moduleTasksMuted,
                      }}>
                      <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                        {item.category}
                      </Text>
                    </View>
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
          <Button label={`Add ${selectedKeys.size} exercise${selectedKeys.size === 1 ? '' : 's'}`} onPress={onConfirmPick} />
        ) : null}
      </View>
      </PremiumGate>
      </ScreenContainer>
    </>
  );
}
