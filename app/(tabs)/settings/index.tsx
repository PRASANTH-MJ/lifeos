import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button, Card, Chip, GlowSurface, IconBadge, LoadingState, ScreenContainer, SegmentedControl, TextField, UpsellModal, showAlert } from '@/components';
import { formatDisplayDateTime } from '@/lib/date';
import {
  cancelReminder,
  getNotificationPermissionSnapshot,
  type NotificationPermissionSnapshot,
  openAlarmSettings,
  openNotificationSettings,
  requestNotificationPermissions,
  scheduleWeeklyReminder,
  SCOREBOARD_WEEKLY_REMINDER_ID,
} from '@/notifications';
import { useCloudBackup } from '@/modules/backup';
import { useAccountDataExport, useBackupVerification, useDataExport } from '@/modules/export';
import { useAuth } from '@/modules/auth';
import { isAdminUser } from '@/modules/admin';
import { registerPushToken } from '@/modules/notifications';
import { FREE_LIMITS, PLANS, trialUrgencyHeadline, trialUrgencyLevel, usePremium } from '@/modules/premium';
import { useProfile } from '@/modules/profile';
import { useSettings } from '@/modules/settings';
import { useManualSync, useSyncStatus } from '@/modules/sync';
import { useAppTheme } from '@/theme';
import { THEME_COLORS, THEME_LABELS, type ThemeName } from '@/theme/tokens';

const THEME_NAMES = Object.keys(THEME_COLORS) as ThemeName[];
// Kept in sync with the same list in finance/accounts/new.tsx's CURRENCIES — that screen's
// picker seeds its own default from this setting, so both lists should offer the same options.
const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP'];

function SectionHeader({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.weight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginLeft: theme.spacing.xs,
      }}>
      {label}
    </Text>
  );
}

/** A single settings row inside a panel: leading IconBadge, title (+ optional subtitle), trailing
 * content (value text, chevron, switch-like control). Matches the mockups' list-row pattern —
 * used for rows that are primarily navigational/informational rather than a bespoke widget. */
function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <IconBadge name={icon} color={iconColor} size="md" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} /> : null}
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
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
  const { premium, plan, trialActive, trialDaysLeft } = usePremium();
  const { settings, setTimeFormat, setScoreboardWeeklyReminder, setDefaultCurrency } = useSettings();
  const { profile, setName, setAvatarUri, setPin, disablePin, setBiometricEnabled } = useProfile();
  const [nameDraft, setNameDraft] = useState(profile?.name ?? '');
  useEffect(() => {
    setNameDraft(profile?.name ?? '');
  }, [profile?.name]);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.hasHardwareAsync().then(async (hasHardware) => {
      if (!hasHardware) return;
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return;
      // Android-only app — always "Fingerprint", never "Face ID" (an Apple trademark/UX term
      // that doesn't apply here even on the minority of Android phones with camera-based face
      // unlock, which isn't the same secure biometric class Face ID implies).
      setBiometricLabel('Fingerprint');
    });
  }, []);
  const [themeUpsellVisible, setThemeUpsellVisible] = useState(false);
  const [backupUpsellVisible, setBackupUpsellVisible] = useState(false);
  const [exportUpsellVisible, setExportUpsellVisible] = useState(false);
  const { backingUp, restoring, lastBackupAt, error: backupError, backupNow, restoreLatest, refreshLastBackupAt } = useCloudBackup();
  const { syncing, lastSyncedAt, error: syncError, syncNow } = useManualSync();
  const { pendingCount } = useSyncStatus();
  const { exporting, error: exportError, exportPdf, exportExcel } = useDataExport();
  const { exporting: exportingAccountData, error: accountDataExportError, downloadMyData } = useAccountDataExport();
  const { verifying: verifyingBackup, result: backupVerificationResult, verifyBackup } = useBackupVerification();
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

  useFocusEffect(
    useCallback(() => {
      refreshLastBackupAt();
    }, [refreshLastBackupAt])
  );

  const daysActive = useMemo(() => daysSinceSignup(user?.metadata.creationTime), [user]);

  if (!settings || !profile) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onPickAvatar = async () => {
    // No permission request needed — launchImageLibraryAsync opens Android's system Photo Picker
    // directly, which needs no READ_MEDIA_IMAGES/VIDEO grant at all; requesting one first (as this
    // used to) was exactly what forced the broad-permission flow Google Play's Photo and Video
    // Permissions policy flags apps for using unnecessarily.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      await setAvatarUri(result.assets[0].uri);
    }
  };

  const nicknameDirty = nameDraft.trim() !== (profile.name ?? '');

  const onSaveName = () => {
    if (nicknameDirty) setName(nameDraft.trim());
  };

  /** Toggled from the Notifications card below — schedules/cancels a single fixed-identifier
   * weekly reminder (Sunday 6pm) rather than anything per-module, since there's only ever one of
   * these. scheduleWeeklyReminder already cancels its own identifier before re-creating it, so
   * this stays idempotent even if the toggle is flipped on repeatedly. */
  const onToggleScoreboardReminder = async (enabled: boolean) => {
    await setScoreboardWeeklyReminder(enabled);
    if (!enabled) {
      await cancelReminder(SCOREBOARD_WEEKLY_REMINDER_ID);
      return;
    }
    const granted = await requestNotificationPermissions();
    if (!granted) {
      await setScoreboardWeeklyReminder(false);
      return;
    }
    await scheduleWeeklyReminder({
      identifier: SCOREBOARD_WEEKLY_REMINDER_ID,
      title: 'Life Scoreboard check-in',
      body: "See how physical, mental, spiritual, financial, and relationship balance look this week.",
      weekday: 1,
      hour: 18,
      minute: 0,
    });
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Settings
        </Text>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Profile" />
          <Card glow tier="panel" style={{ gap: theme.spacing.md }}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <TextField placeholder="Nickname" value={nameDraft} onChangeText={setNameDraft} />
                  </View>
                  {nicknameDirty ? <Button label="Save" variant="secondary" onPress={onSaveName} /> : null}
                </View>
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

            {/* Long-press is the only way in — deliberately no visible entry point for regular
                users. isAdminUser makes this a no-op for anyone but the developer's own account. */}
            <Pressable onLongPress={() => isAdminUser(user) && router.push('/admin-analytics')} delayLongPress={1500}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{user?.email}</Text>
            </Pressable>
            <View>
              <Button label="Log out" variant="danger" onPress={signOut} />
            </View>
            <Pressable onPress={() => router.push('/delete-account')} style={{ alignItems: 'center', paddingVertical: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Delete my account</Text>
            </Pressable>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Personal Details" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <SettingsRow
              icon="body-outline"
              title="Personal details"
              subtitle="Height, weight, date of birth, and your health/financial goals."
              onPress={() => router.push('/onboarding')}
            />
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Appearance" />
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="color-palette-outline" size="md" />
              <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {premium ? 'Pick the look of the whole app.' : "You're on the default theme for your device — Pro unlocks switching between all 4."}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
              {THEME_NAMES.map((name) => (
                <ThemeSwatch
                  key={name}
                  name={name}
                  selected={theme.themeName === name}
                  locked={!premium && theme.themeName !== name}
                  onPress={() => (premium ? theme.setThemeName(name) : setThemeUpsellVisible(true))}
                />
              ))}
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="App Lock & Security" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="lock-closed-outline" size="md" />
              <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                A PIN required to open the app on this device — not an account, just a local lock.
              </Text>
            </View>
            {profile.pinEnabled ? (
              <>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                  <Button label="Change PIN" variant="secondary" onPress={() => setPinModalVisible(true)} />
                  <Button label="Turn off" variant="danger" onPress={disablePin} />
                </View>
                {biometricLabel ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: theme.spacing.sm,
                      paddingTop: theme.spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Ionicons name="finger-print-outline" size={18} color={theme.colors.textSecondary} />
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        Unlock with {biometricLabel}
                      </Text>
                    </View>
                    <Switch value={profile.biometricEnabled} onValueChange={setBiometricEnabled} />
                  </View>
                ) : null}
              </>
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
            <Card tier="panel" style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <IconBadge name="notifications-outline" size="md" />
                <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  Required for reminders and alarms in every module to actually go off.
                </Text>
              </View>

              <PermissionRow
                label="Notifications"
                state={permissionSnapshot.notifications}
                onFix={async () => {
                  if (permissionSnapshot.canAskAgain) {
                    const granted = await requestNotificationPermissions();
                    if (granted && user) await registerPushToken(user.uid).catch(() => {});
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

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: theme.spacing.sm,
                  paddingTop: theme.spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    Weekly Scoreboard check-in
                  </Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    A Sunday evening nudge to see how your five areas are trending
                  </Text>
                </View>
                <Switch value={settings.scoreboardWeeklyReminder} onValueChange={onToggleScoreboardReminder} />
              </View>
            </Card>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Time Format" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="time-outline" size="md" />
              <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                Applies everywhere a time is shown or entered, e.g. task due times.
              </Text>
            </View>
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
          <SectionHeader label="Currency" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="cash-outline" size="md" />
              <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                Used as the default when adding a new Finance account. Flowsy doesn't convert between
                currencies — each account keeps its own.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
              {CURRENCY_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  selected={(settings.defaultCurrency ?? 'INR') === option}
                  onPress={() => setDefaultCurrency(option)}
                />
              ))}
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Pro" />
          <Card tier="panel" glow={!premium} style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge
                name="diamond-outline"
                color={trialActive && trialUrgencyLevel(trialDaysLeft) !== 'normal' ? theme.colors.danger : theme.colors.warning}
                size="md"
              />
              {trialActive ? (
                <Text
                  style={{
                    flex: 1,
                    color: trialUrgencyLevel(trialDaysLeft) === 'normal' ? theme.colors.warning : theme.colors.danger,
                    fontSize: theme.typography.size.sm,
                    fontWeight: theme.typography.weight.semibold,
                  }}>
                  {trialUrgencyHeadline(trialDaysLeft)} — every Pro feature is still unlocked.
                </Text>
              ) : premium ? (
                <Text style={{ flex: 1, color: theme.colors.success, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                  You're on Pro{plan ? ` (${PLANS[plan].label})` : ''} — every limit is lifted.
                </Text>
              ) : (
                <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  Free plan: up to {FREE_LIMITS.habits} habit, {FREE_LIMITS.tasks} active tasks, {FREE_LIMITS.journalEntries} journal
                  entries, {FREE_LIMITS.financeTransactions} transactions/month. No recurring tasks, finance accounts, or custom
                  workouts. Analytics, muscle recovery, the exercise library, themes, backup, and export are Pro-only.
                </Text>
              )}
            </View>
            {!premium || trialActive ? (
              <Button
                label={
                  trialActive
                    ? trialUrgencyLevel(trialDaysLeft) === 'final'
                      ? 'Subscribe now — trial ends today'
                      : 'Subscribe before your trial ends'
                    : 'Upgrade to Pro'
                }
                variant="gradient"
                onPress={() => router.push('/premium')}
              />
            ) : null}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.xs }} />
            <SettingsRow
              icon="people-outline"
              title="Family Plan"
              subtitle="Share Pro with up to 5 people"
              onPress={() => router.push('/family-plan')}
            />
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Cloud Sync" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="sync-outline" size="md" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {premium
                    ? 'Your data syncs across devices in real time.'
                    : 'Your data syncs across devices automatically at least once a day — tap "Sync now" any time for an immediate sync, or upgrade to Pro for real-time sync.'}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                  {lastSyncedAt ? `Last synced ${formatDisplayDateTime(new Date(lastSyncedAt).toISOString())}` : 'Not synced yet'}
                </Text>
              </View>
              {pendingCount > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: theme.colors.warningMuted,
                    borderRadius: theme.radius.full,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: 3,
                  }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.warning }} />
                  <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                    {pendingCount} pending
                  </Text>
                </View>
              ) : null}
            </View>
            {syncError ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs }}>{syncError}</Text> : null}
            <Button label="Sync now" variant="secondary" loading={syncing} onPress={syncNow} />
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Cloud Backup" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="cloud-upload-outline" size="md" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  Back up your habits, tasks, journal, and finance data — restore it any time, even on a new device.
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                  {lastBackupAt ? `Last backed up ${formatDisplayDateTime(lastBackupAt)}` : 'No backup yet'}
                </Text>
              </View>
            </View>
            {backupError ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs }}>{backupError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
              <Button
                label="Back up now"
                variant="secondary"
                loading={backingUp}
                onPress={() => (premium ? backupNow() : setBackupUpsellVisible(true))}
              />
              <Button
                label="Restore"
                variant="danger"
                loading={restoring}
                onPress={() => {
                  if (!premium) {
                    setBackupUpsellVisible(true);
                    return;
                  }
                  showAlert(
                    'Restore backup?',
                    'This replaces all habits, tasks, journal entries, and finance data on this device with your last backup. This can\'t be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Restore', style: 'destructive', onPress: () => restoreLatest() },
                    ]
                  );
                }}
              />
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Export Data" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="download-outline" size="md" />
              <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                Take your habits, tasks, journal, and finance data with you as a PDF or spreadsheet.
              </Text>
            </View>
            {exportError ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs }}>{exportError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
              <Button
                label="Export PDF"
                variant="secondary"
                loading={exporting === 'pdf'}
                disabled={exporting !== null}
                onPress={() => (premium ? exportPdf() : setExportUpsellVisible(true))}
              />
              <Button
                label="Export Excel"
                variant="secondary"
                loading={exporting === 'excel'}
                disabled={exporting !== null}
                onPress={() => (premium ? exportExcel() : setExportUpsellVisible(true))}
              />
            </View>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Your Data" />
          <Card tier="panel" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="cloud-download-outline" size="md" />
              <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                Download everything tied to your account — synced records, your profile, and your posts — as a single JSON file.
              </Text>
            </View>
            {accountDataExportError ? (
              <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs }}>{accountDataExportError}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Button label="Download my data" variant="secondary" loading={exportingAccountData} onPress={downloadMyData} />
              <Button label="Verify my backup" variant="secondary" loading={verifyingBackup} onPress={verifyBackup} />
            </View>
            {backupVerificationResult ? (
              <Text
                style={{
                  color: backupVerificationResult.ok ? theme.colors.success : theme.colors.warning,
                  fontSize: theme.typography.size.xs,
                }}>
                {backupVerificationResult.summary}
              </Text>
            ) : null}
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader label="Support" />
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <SettingsRow
              icon="calendar-outline"
              title="Weekly Review"
              subtitle="Overdue tasks, what's due this week, and upcoming events."
              onPress={() => router.push('/weekly-review')}
            />
            <SettingsRow icon="help-circle-outline" title="Help & Support" onPress={() => router.push('/help')} />
            <SettingsRow
              icon="chatbubble-ellipses-outline"
              title="Send feedback"
              subtitle="Bug reports, feature ideas, anything on your mind."
              onPress={() => router.push('/feedback')}
            />
            <SettingsRow icon="document-text-outline" title="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
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

      <UpsellModal
        visible={themeUpsellVisible}
        message="Switching between themes is a Pro feature — you're on the default theme for your device's light/dark setting."
        onClose={() => setThemeUpsellVisible(false)}
      />

      <UpsellModal
        visible={backupUpsellVisible}
        message="Cloud backup and restore is a Pro feature — never lose your habits, tasks, journal, and finance data."
        onClose={() => setBackupUpsellVisible(false)}
      />

      <UpsellModal
        visible={exportUpsellVisible}
        message="Exporting to PDF and Excel is a Pro feature — take your data with you any time."
        onClose={() => setExportUpsellVisible(false)}
      />

    </ScreenContainer>
  );
}

function ThemeSwatch({
  name,
  selected,
  locked,
  onPress,
}: {
  name: ThemeName;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const palette = THEME_COLORS[name];

  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 78 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.card,
          backgroundColor: palette.background,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? palette.primary : theme.colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: locked ? 0.55 : 1,
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
        {locked ? (
          <View style={{ position: 'absolute', top: 4, right: 4 }}>
            <Ionicons name="lock-closed" size={14} color={theme.colors.textPrimary} />
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
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
      </KeyboardAvoidingView>
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
      <IconBadge
        name={granted ? 'checkmark-circle' : 'alert-circle-outline'}
        color={granted ? theme.colors.success : theme.colors.danger}
        size="sm"
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
