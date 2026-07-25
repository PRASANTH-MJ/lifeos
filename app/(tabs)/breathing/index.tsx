import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, LogPastEntryModal, ScreenContainer } from '@/components';
import { todayKey } from '@/lib/date';
import { BREATHING_PATTERNS, findPattern, useBreathingLogs } from '@/modules/breathing';
import { useAppTheme } from '@/theme';

const DEFAULT_CYCLES = 8;

export default function BreathingScreen() {
  const theme = useAppTheme();
  const { sessionsThisWeek, refresh, logSession } = useBreathingLogs();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logPatternKey, setLogPatternKey] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(todayKey());

  const onSaveLog = async () => {
    if (!logPatternKey) return;
    const pattern = findPattern(logPatternKey) ?? BREATHING_PATTERNS[0];
    const cycleSeconds = pattern.steps.reduce((sum, step) => sum + step.seconds, 0);
    await logSession(logPatternKey, cycleSeconds * DEFAULT_CYCLES, DEFAULT_CYCLES, logDate);
    setLogModalVisible(false);
  };

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

        <Pressable
          onPress={() => {
            setLogPatternKey(BREATHING_PATTERNS[0].key);
            setLogDate(todayKey());
            setLogModalVisible(true);
          }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Log a past session
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Card>
        </Pressable>
      </View>

      <LogPastEntryModal
        visible={logModalVisible}
        title="Log a past session"
        items={BREATHING_PATTERNS.map((p) => ({ key: p.key, label: p.title }))}
        selectedItemKey={logPatternKey}
        onSelectItem={setLogPatternKey}
        date={logDate}
        onSelectDate={setLogDate}
        onClose={() => setLogModalVisible(false)}
        onSave={onSaveLog}
        moduleColor={theme.colors.moduleTasks}
        moduleMutedColor={theme.colors.moduleTasksMuted}
      />
    </ScreenContainer>
  );
}
