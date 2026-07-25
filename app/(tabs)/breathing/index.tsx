import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { BREATHING_PATTERNS, useBreathingLogs } from '@/modules/breathing';
import { useAppTheme } from '@/theme';

export default function BreathingScreen() {
  const theme = useAppTheme();
  const { sessionsThisWeek, refresh } = useBreathingLogs();

  return (
    <ScreenContainer onRefresh={refresh}>
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Ionicons name="pulse" size={22} color={theme.colors.moduleTasks} />
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
            {sessionsThisWeek} sessions this week
          </Text>
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          {BREATHING_PATTERNS.map((pattern) => (
            <Link key={pattern.key} href={{ pathname: '/breathing/[patternKey]', params: { patternKey: pattern.key } }} asChild>
              <Pressable>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.moduleTasksMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="pulse" size={20} color={theme.colors.moduleTasks} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                      {pattern.title}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{pattern.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}
