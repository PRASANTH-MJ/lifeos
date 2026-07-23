import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components';
import { formatDisplayDateTime } from '@/lib/date';
import { useAppTheme } from '@/theme';
import { moodEmoji, type JournalEntry } from './types';

export function JournalListItem({ entry }: { entry: JournalEntry }) {
  const theme = useAppTheme();

  return (
    <Link href={{ pathname: '/journal/[id]', params: { id: String(entry.id) } }} asChild>
      <Pressable>
        <Card style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ fontSize: 18 }}>{moodEmoji(entry.mood)}</Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              {formatDisplayDateTime(entry.created_at)}
            </Text>
          </View>
          <Text numberOfLines={3} style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {entry.body}
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}
