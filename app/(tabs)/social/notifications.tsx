import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, CenteredWebColumn, EmptyState, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { usePublicProfile, useNotifications, groupNotifications, type NotificationListEntry, type SocialNotification } from '@/modules/social';
import { useAppTheme } from '@/theme';

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const { notifications, loading, markRead } = useNotifications();
  const entries = useMemo(() => groupNotifications(notifications), [notifications]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  return (
    <CenteredWebColumn maxWidth={480}>
      <ScreenContainer>
        {loading ? (
          <LoadingState />
        ) : entries.length === 0 ? (
          <EmptyState icon="notifications-outline" title="No notifications yet" subtitle="Follows, likes, and comments show up here." />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {entries.map((entry) =>
              entry.kind === 'single' ? (
                <NotificationRow key={entry.notification.id} notification={entry.notification} onRead={() => markRead(entry.notification.id)} />
              ) : (
                <NotificationGroup
                  key={entry.key}
                  entry={entry}
                  expanded={expandedGroups.has(entry.key)}
                  onToggle={() =>
                    setExpandedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(entry.key)) next.delete(entry.key);
                      else next.add(entry.key);
                      return next;
                    })
                  }
                  onRead={markRead}
                />
              )
            )}
          </View>
        )}
      </ScreenContainer>
    </CenteredWebColumn>
  );
}

/** Collapsible header for a burst of 2+ same-type, same-hour notifications (see
 * groupNotifications.ts) — collapsed by default, expands into the same NotificationRow used for
 * an ungrouped notification so a grouped item still reads (and marks read) exactly like normal. */
function NotificationGroup({
  entry,
  expanded,
  onToggle,
  onRead,
}: {
  entry: Extract<NotificationListEntry, { kind: 'group' }>;
  expanded: boolean;
  onToggle: () => void;
  onRead: (id: string) => void;
}) {
  const theme = useAppTheme();
  const anyUnread = entry.notifications.some((n) => !n.read);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radius.lg,
          backgroundColor: anyUnread ? theme.colors.surfaceElevated : 'transparent',
        }}>
        <IconBadge name="albums-outline" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
          {entry.notifications.length} updates from the last hour
        </Text>
        {anyUnread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} /> : null}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textTertiary} />
      </Pressable>
      {expanded ? (
        <View style={{ gap: theme.spacing.sm, paddingLeft: theme.spacing.lg }}>
          {entry.notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onRead={() => onRead(n.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NotificationRow({ notification, onRead }: { notification: SocialNotification; onRead: () => void }) {
  return <SocialActivityRow notification={notification} onRead={onRead} />;
}

function verbFor(type: 'follow' | 'like' | 'comment'): string {
  if (type === 'follow') return 'started following you';
  if (type === 'like') return 'liked your post';
  return 'commented on your post';
}

function SocialActivityRow({ notification, onRead }: { notification: SocialNotification; onRead: () => void }) {
  const theme = useAppTheme();
  const router = useRouter();
  const { profile } = usePublicProfile(notification.fromUid);

  const onPress = () => {
    onRead();
    router.push({ pathname: '/social/profile/[uid]', params: { uid: notification.fromUid } });
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: notification.read ? 'transparent' : theme.colors.surfaceElevated,
      }}>
      <Avatar url={profile?.avatarUrl} color={theme.colors.primary} />
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, flex: 1 }}>
        <Text style={{ fontWeight: theme.typography.weight.semibold }}>{profile ? `@${profile.usernameLower}` : 'Someone'}</Text>
        {' ' + verbFor(notification.type as 'follow' | 'like' | 'comment')}
      </Text>
      {!notification.read ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} />
      ) : null}
    </Pressable>
  );
}
