import { Text, View } from 'react-native';

import { Button, Card, Chip, LoadingState, ScreenContainer } from '@/components';
import { useAuth } from '@/modules/auth';
import { useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { settings, setTimeFormat } = useSettings();
  const { user, signOut } = useAuth();

  if (!settings) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Settings
        </Text>

        {user ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Account
            </Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              {user.email}
            </Text>
            <Button label="Log out" variant="danger" onPress={signOut} />
          </Card>
        ) : null}

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Time format
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            Applies everywhere a time is shown or entered, e.g. task due times.
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <Chip label="24-hour" selected={settings.timeFormat === '24h'} onPress={() => setTimeFormat('24h')} />
            <Chip label="12-hour (AM/PM)" selected={settings.timeFormat === '12h'} onPress={() => setTimeFormat('12h')} />
          </View>
        </Card>
      </View>
    </ScreenContainer>
  );
}
