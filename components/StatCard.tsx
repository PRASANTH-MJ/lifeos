import { Text, View } from 'react-native';

import { Card } from './Card';
import { useAppTheme } from '@/theme';

type Props = {
  label: string;
  value: string;
  color?: string;
};

export function StatCard({ label, value, color }: Props) {
  const theme = useAppTheme();

  return (
    <Card
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        borderTopWidth: 3,
        borderTopColor: color ?? theme.colors.primary,
      }}>
      <Text
        style={{
          color: color ?? theme.colors.textPrimary,
          fontSize: theme.typography.size.xl,
          fontWeight: theme.typography.weight.bold,
        }}
        numberOfLines={1}>
        {value}
      </Text>
      <View>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{label}</Text>
      </View>
    </Card>
  );
}
