import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button, Card, GlowSurface, LoadingState, ScreenContainer, SegmentedControl, TextField } from '@/components';
import {
  getNotificationPermissionSnapshot,
  type NotificationPermissionSnapshot,
  openAlarmSettings,
  openNotificationSettings,
  requestNotificationPermissions,
} from '@/notifications';
import { useAuth } from '@/modules/auth';
import { PLANS, usePremium } from '@/modules/premium';
import { useProfile } from '@/modules/profile';
import { useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';
import { THEME_COLORS, THEME_LABELS, type ThemeName } from '@/theme/tokens';

const THEME_NAMES = Object.keys(THEME_COLORS) as ThemeName[];

function SectionHeader({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        color: theme.colors.textTertiary,
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.weight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
      {label}
    </Text>
  );
}

function daysSinceSignup(creationTime: string | undefined): number | null {
  if (!creationTime) return null;
  const created = new Date(creationTime).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(1, Math.floor((Date.now() - created) / 86_400_000) + 1);
}

export default function SettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { premium, plan } = usePremium();
  const { settings, setTimeFormat } = useSettings();
  const { profile, setName, setAvatarUri, setPin, disablePin } = useProfile();
  const [nameDraft, setNameDraft] = useState(profile?.name ?? '');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [permissionSnapshot, setPermissionSnapshot] = useState<NotificationPermissionSnapshot | null>(null);

  const refreshPermissionSnapshot = useCallback(() => {
    getNotificationPermissionSnapshot().then(setPermissionSnapshot);
  }, []);

  // Re-check whenever this tab regains focus or the app returns from background — the only way to
  // find out the user granted a permission from the OS Settings screen we deep-linked them to.
  useFocusEffect(refreshPermissionSnapshot);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermissionSnapshot();
    });
    return () => sub.remove();
  }, [refreshPermissionSnapshot]);

  const daysActive = useMemo(() => daysSinceSignup(user?.metadata.creationTime), [user]);

  if (!settings || !profile) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onPickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      await setAvatarUri(result.assets[0].uri);
    }
  };

  const onSaveName = () => {
    if (nameDraft.trim() !== (profile.name ?? '')) setName(nameDraft);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Settings
        </Text>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Profile" />
          <Card glow style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Pressable onPress={onPickAvatar}>
                <GlowSurface intensity="md" borderRadius={32}>
                  {profile.avatarUri ? (
                    <Image source={{ uri: profile.avatarUri }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                  ) : (
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: theme.colors.primaryMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="person" size={28} color={theme.colors.primary} />
                    </View>
                  )}
                </GlowSurface>
                <View
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.colors.surfaceElevated,
                  }}>
                  <Ionicons name="camera" size={11} color="#fff" />
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <TextField placeholder="Your name" value={nameDraft} onChangeText={setNameDraft} onBlur={onSaveName} />
                {daysActive !== null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="flame" size={13} color={theme.colors.warning} />
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      Day {daysActive} with Flowsy
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />

            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{user?.email}</Text>
            <View>
              <Button label="Log out" variant="danger" onPress={signOut} />
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Appearance" />
          <Card style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Pick the look of the whole app.</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
              {THEME_NAMES.map((name) => (
                <ThemeSwatch key={name} name={name} selected={theme.themeName === name} onPress={() => theme.setThemeName(name)} />
              ))}
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="App Lock & Security" />
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              A PIN required to open the app on this device — not an account, just a local lock.
            </Text>
            {profile.pinEnabled ? (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                <Button label="Change PIN" variant="secondary" onPress={() => setPinModalVisible(true)} />
                <Button label="Turn off" variant="danger" onPress={disablePin} />
              </View>
            ) : (
              <View style={{ marginTop: theme.spacing.xs }}>
                <Button label="Set up PIN lock" variant="secondary" onPress={() => setPinModalVisible(true)} />
              </View>
            )}
          </Card>
        </View>

        {permissionSnapshot && permissionSnapshot.notifications !== 'unsupported' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <SectionHeader label="Notifications" />
            <Card style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                Required for reminders and alarms in every module to actually go off.
              </Text>

              <PermissionRow
                label="Notifications"
                state={permissionSnapshot.notifications}
                onFix={async () => {
                  if (permissionSnapshot.canAskAgain) {
                    await requestNotificationPermissions();
                    refreshPermissionSnapshot();
                  } else {
                    await openNotificationSettings();
                  }
                }}
                fixLabel={permissionSnapshot.canAskAgain ? 'Enable' : 'Open settings'}
              />

              {Platform.OS === 'android' && permissionSnapshot.alarms !== 'unsupported' ? (
                <PermissionRow
                  label="Alarms & reminders access"
                  state={permissionSnapshot.alarms}
                  onFix={openAlarmSettings}
                  fixLabel="Open settings"
                />
              ) : null}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Time Format" />
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              Applies everywhere a time is shown or entered, e.g. task due times.
            </Text>
            <View style={{ marginTop: theme.spacing.xs }}>
              <SegmentedControl
                options={[
                  { value: '24h', label: '24-hour' },
                  { value: '12h', label: '12-hour (AM/PM)' },
                ]}
                value={settings.timeFormat}
                onChange={setTimeFormat}
              />
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Pro" />
          <Card glow={!premium} style={{ gap: theme.spacing.sm }}>
            {premium ? (
              <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                ✓ You're on Pro{plan ? ` (${PLANS[plan].label})` : ''} — every limit is lifted.
              </Text>
            ) : (
              <>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  Free plan: up to 5 habits, 2 recurring tasks, 1 finance account.
                </Text>
                <View style={{ marginTop: theme.spacing.xs }}>
                  <Button label="Upgrade to Pro" variant="gradient" onPress={() => router.push('/premium')} />
                </View>
              </>
            )}
          </Card>
        </View>
      </View>

      <PinSetupModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSave={async (pin) => {
          await setPin(pin);
          setPinModalVisible(false);
        }}
      />
    </ScreenContainer>
  );
}

function ThemeSwatch({ name, selected, onPress }: { name: ThemeName; selected: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const palette = THEME_COLORS[name];

  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 78 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.lg,
          backgroundColor: palette.background,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? palette.primary : theme.colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.primary }} />
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.success }} />
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.moduleHabits }} />
        </View>
        {selected ? (
          <View style={{ position: 'absolute', top: 4, right: 4 }}>
            <Ionicons name="checkmark-circle" size={16} color={palette.primary} />
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={{
          color: selected ? theme.colors.textPrimary : theme.colors.textSecondary,
          fontSize: theme.typography.size.xs,
          lineHeight: theme.typography.size.xs + 2,
          fontWeight: selected ? theme.typography.weight.semibold : theme.typography.weight.regular,
          textAlign: 'center',
        }}>
        {THEME_LABELS[name]}
      </Text>
    </Pressable>
  );
}

function PinSetupModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (pin: string) => Promise<void> }) {
  const theme = useAppTheme();
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const canSave = pin.length >= 4 && pin === confirmPin;

  const reset = () => {
    setPinValue('');
    setConfirmPin('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            Set a PIN
          </Text>
          <TextInput
            value={pin}
            onChangeText={(text) => setPinValue(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="New PIN (4-6 digits)"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.background,
              color: theme.colors.textPrimary,
              padding: theme.spacing.md,
              fontSize: theme.typography.size.lg,
              letterSpacing: 6,
            }}
          />
          <TextInput
            value={confirmPin}
            onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="Confirm PIN"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.background,
              color: theme.colors.textPrimary,
              padding: theme.spacing.md,
              fontSize: theme.typography.size.lg,
              letterSpacing: 6,
            }}
          />
          {confirmPin.length > 0 && pin !== confirmPin ? (
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>PINs don't match.</Text>
          ) : null}
          <Button
            label="Save PIN"
            disabled={!canSave}
            onPress={async () => {
              await onSave(pin);
              reset();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function PermissionRow({
  label,
  state,
  onFix,
  fixLabel,
}: {
  label: string;
  state: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  onFix: () => void;
  fixLabel: string;
}) {
  const theme = useAppTheme();
  const granted = state === 'granted';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: granted ? theme.colors.success : theme.colors.danger,
        }}
      />
      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{label}</Text>
      {granted ? (
        <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
          Allowed
        </Text>
      ) : (
        <Button label={fixLabel} variant="secondary" onPress={onFix} />
      )}
    </View>
  );
}
