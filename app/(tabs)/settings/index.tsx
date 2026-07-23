import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, LoadingState, ScreenContainer } from '@/components';
import { useAuth } from '@/modules/auth';
import { useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { settings, setTimeFormat } = useSettings();
  const { user, accounts, switchAccount, removeAccount, beginAddAccount } = useAuth();

  if (!settings) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onAddAccount = () => {
    beginAddAccount();
    router.push('/login');
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Settings
        </Text>

        {user ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Accounts
            </Text>
            {accounts.map((account) => {
              const active = account.id === user.id;
              return (
                <Pressable
                  key={account.id}
                  onPress={() => !active && switchAccount(account.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? theme.colors.primary : theme.colors.textTertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                      {account.username}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{account.email}</Text>
                  </View>
                  {accounts.length > 1 ? (
                    <Pressable onPress={() => removeAccount(account.id)} hitSlop={8}>
                      <Ionicons name="close-circle-outline" size={20} color={theme.colors.textTertiary} />
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}
            <Button label="Add another account" variant="secondary" onPress={onAddAccount} />
            <Button label="Log out" variant="danger" onPress={() => removeAccount(user.id)} />
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
