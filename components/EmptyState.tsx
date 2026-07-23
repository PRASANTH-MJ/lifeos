import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { useAppTheme } from '@/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
};

export function EmptyState({ icon, title, subtitle, ctaLabel, onPressCta }: Props) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { paddingVertical: theme.spacing['4xl'], gap: theme.spacing.md }]}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.size.lg,
          fontWeight: theme.typography.weight.semibold,
          textAlign: 'center',
        }}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.size.sm,
            textAlign: 'center',
            maxWidth: 280,
          }}>
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onPressCta ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button label={ctaLabel} onPress={onPressCta} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
