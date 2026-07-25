import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, EmptyState, HeatmapCalendar, ScreenContainer, TextField, useTabSwipeNavigation } from '@/components';
import { toDateKey } from '@/lib/date';
import { JournalListItem, useJournal } from '@/modules/journal';
import { useAppTheme } from '@/theme';

export default function JournalScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/journal');
  const [search, setSearch] = useState('');
  const { entries, loading, refresh } = useJournal(search);

  const heatmapValues = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      const key = toDateKey(new Date(entry.created_at));
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/journal/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.moduleJournal} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.lg }}>
        {!search && entries.length > 0 ? (
          <Card>
            <HeatmapCalendar values={heatmapValues} accentColor={theme.colors.moduleJournal} maxIntensity={3} />
          </Card>
        ) : null}

        <TextField placeholder="Search entries" value={search} onChangeText={setSearch} />

        {!loading && entries.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title={search ? 'No matching entries' : 'No journal entries yet'}
            subtitle={search ? 'Try a different search term.' : 'Write your first entry to start your history.'}
            ctaLabel={search ? undefined : 'Write an entry'}
            onPressCta={search ? undefined : () => router.push('/journal/new')}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {entries.map((entry) => (
              <JournalListItem key={entry.id} entry={entry} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
    </View>
  );
}
