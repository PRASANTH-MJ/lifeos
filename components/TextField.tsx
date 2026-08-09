import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  isPassword?: boolean;
};

export function TextField({ label, error, style, isPassword, secureTextEntry, ...inputProps }: Props) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);

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
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={theme.colors.textTertiary}
          secureTextEntry={isPassword ? !visible : secureTextEntry}
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
              paddingRight: isPassword ? theme.spacing.xl + theme.spacing.md : theme.spacing.md,
            },
            style,
          ]}
          {...inputProps}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={{ position: 'absolute', right: theme.spacing.md }}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
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
