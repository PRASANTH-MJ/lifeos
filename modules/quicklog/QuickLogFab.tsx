import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { AI_FAB_SIZE, FAB_BOTTOM_OFFSET } from '@/components/tabBarMetrics';
import { todayKey } from '@/lib/date';
import { useWaterDay } from '@/modules/water';
import { useAppTheme } from '@/theme';

const BUTTON_SIZE = 44;
/** Default "log this much water" amount for the quick-log shortcut — matches the middle of
 * water/index.tsx's own QUICK_AMOUNTS (150/250/500ml), the most common single glass size. */
const QUICK_WATER_ML = 250;

/**
 * A second, small, FIXED floating entry point for the app's handful of most common "log
 * something" actions — mounted once at the (tabs) layout root alongside the draggable
 * AI-assistant FAB (see AiAssistantFab.tsx). Deliberately does NOT share that FAB's bottom-left
 * default spot or its drag gesture: stacked directly above the bottom-right corner instead, clear
 * of both the AI FAB and any screen's own bottom-right "+" FAB (Today/Habits/Meditation/etc., all
 * anchored at FAB_BOTTOM_OFFSET — see tabBarMetrics.ts's comment on that constant).
 */
export function QuickLogFab() {
  const theme = useAppTheme();
  const router = useRouter();
  const { addLog } = useWaterDay(todayKey());
  const [menuVisible, setMenuVisible] = useState(false);

  const actions: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }[] = [
    { key: 'water', label: 'Log water', icon: 'water-outline', color: theme.colors.primary, onPress: () => { addLog(QUICK_WATER_ML); } },
    { key: 'workout', label: 'Log workout', icon: 'barbell-outline', color: theme.colors.warning, onPress: () => router.push('/workout/new') },
    { key: 'task', label: 'Add task', icon: 'checkbox-outline', color: theme.colors.moduleTasks, onPress: () => router.push('/tasks-new') },
    { key: 'journal', label: 'Log mood/journal', icon: 'book-outline', color: theme.colors.moduleJournal, onPress: () => router.push('/journal-new') },
  ];

  const fabBottom = FAB_BOTTOM_OFFSET + AI_FAB_SIZE + theme.spacing.md;

  return (
    <>
      <Pressable
        onPress={() => setMenuVisible(true)}
        accessibilityLabel="Quick log"
        style={{
          position: 'absolute',
          right: theme.spacing.lg,
          bottom: fabBottom,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadow.md,
        }}>
        <Ionicons name="flash-outline" size={20} color={theme.colors.textPrimary} />
      </Pressable>

      <Modal visible={menuVisible} animationType="fade" transparent onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setMenuVisible(false)}>
          <View
            style={{
              position: 'absolute',
              right: theme.spacing.lg,
              bottom: fabBottom + BUTTON_SIZE + theme.spacing.sm,
              gap: theme.spacing.sm,
              alignItems: 'flex-end',
            }}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  setMenuVisible(false);
                  action.onPress();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  ...theme.shadow.sm,
                }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  {action.label}
                </Text>
                <Ionicons name={action.icon} size={18} color={action.color} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
