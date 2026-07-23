import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, style, ...inputProps }: Props) {
  const theme = useAppTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.size.sm,
            fontWeight: theme.typography.weight.medium,
          }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.md,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.size.base,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs }}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
