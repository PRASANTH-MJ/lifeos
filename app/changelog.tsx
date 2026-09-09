import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Card, IconBadge } from '@/components';
import { CHANGELOG_ENTRIES, LATEST_CHANGELOG_VERSION } from '@/modules/changelog';
import { useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';

/** Marks the latest entry seen the moment this screen is opened, clearing the More tab's badge
 * dot — same "mark as read on open" shape as the notification bell, just via the settings row
 * instead of a per-item read flag. */
export default function ChangelogScreen() {
  const theme = useAppTheme();
  const { setLastSeenChangelogVersion } = useSettings();

  useEffect(() => {
    setLastSeenChangelogVersion(LATEST_CHANGELOG_VERSION);
  }, [setLastSeenChangelogVersion]);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.md }} style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
        Recent additions to Flowsy, newest first.
      </Text>

      {CHANGELOG_ENTRIES.map((entry) => (
        <Card key={entry.version} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <IconBadge name={entry.icon} color={theme.colors.primary} size="md" />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                {entry.title}
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{entry.date}</Text>
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
              {entry.description}
            </Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
