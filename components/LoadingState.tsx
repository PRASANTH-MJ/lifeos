import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/theme';

export function LoadingState() {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing['4xl'] }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}
