import { Chip } from '@/components';
import { useAppTheme } from '@/theme';
import type { TaskPriority } from './types';

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  const theme = useAppTheme();
  const colors: Record<TaskPriority, string> = {
    high: theme.colors.danger,
    medium: theme.colors.warning,
    low: theme.colors.textTertiary,
  };
  const muted: Record<TaskPriority, string> = {
    high: theme.colors.dangerMuted,
    medium: theme.colors.warningMuted,
    low: theme.colors.border,
  };
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return <Chip label={label} color={colors[priority]} mutedColor={muted[priority]} />;
}
