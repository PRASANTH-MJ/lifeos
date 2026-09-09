import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components';
import { formatDisplayDateTime } from '@/lib/date';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';
import { moodEmoji, type JournalEntry } from './types';

export function JournalListItem({ entry }: { entry: JournalEntry }) {
  const theme = useAppTheme();

  return (
    <Link href={{ pathname: '/journal/[id]', params: { id: String(entry.id) } }} asChild>
      <Pressable>
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
              {formatDisplayDateTime(entry.created_at)}
            </Text>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: withAlpha(theme.colors.moduleJournal, 0.14),
              }}>
              <Text style={{ fontSize: 15 }}>{moodEmoji(entry.mood)}</Text>
            </View>
          </View>
          <Text numberOfLines={3} style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {entry.body}
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}
