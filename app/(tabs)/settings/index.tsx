import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, LoadingState, ScreenContainer, TextField } from '@/components';
import { useProfile } from '@/modules/profile';
import { useSettings } from '@/modules/settings';
import { useAppTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { settings, setTimeFormat } = useSettings();
  const { profile, setName, setAvatarUri, setPin, disablePin } = useProfile();
  const [nameDraft, setNameDraft] = useState(profile?.name ?? '');
  const [pinModalVisible, setPinModalVisible] = useState(false);

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

        <Card style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Profile
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Pressable onPress={onPickAvatar}>
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
            <View style={{ flex: 1 }}>
              <TextField placeholder="Your name" value={nameDraft} onChangeText={setNameDraft} onBlur={onSaveName} />
            </View>
          </View>
        </Card>

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            App lock
          </Text>
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
