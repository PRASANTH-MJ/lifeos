import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const PIN_MAX_LENGTH = 6;
const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

type Props = {
  verifyPin: (pin: string) => Promise<boolean>;
  onUnlock: () => void;
  biometricEnabled?: boolean;
};

/** A dot per entered digit, up to `pin.length || 4` expected — since PINs are 4-6 digits and we
 * don't know the real length until it's verified, we just show a dot per keystroke rather than a
 * fixed 4/6-slot layout, which would either overflow or look half-empty depending on the PIN. */
function PinDots({ length, shake }: { length: number; shake: Animated.Value }) {
  const theme = useAppTheme();
  const style = { transform: [{ translateX: shake }] };
  const slots = Math.max(length, 4);

  return (
    <Animated.View style={[{ flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'center' }, style]}>
      {Array.from({ length: slots }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: theme.radius.full,
            backgroundColor: i < length ? theme.colors.primary : 'transparent',
            borderWidth: i < length ? 0 : 1.5,
            borderColor: theme.colors.border,
          }}
        />
      ))}
    </Animated.View>
  );
}

function Key({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  if (!label) return <View style={{ width: 72, height: 72 }} />;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 72,
        height: 72,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.surfaceElevated : theme.colors.surface,
      })}>
      {label === 'del' ? (
        <Ionicons name="backspace-outline" size={24} color={theme.colors.textPrimary} />
      ) : (
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.semibold }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function PinLockScreen({ verifyPin, onUnlock, biometricEnabled }: Props) {
  const theme = useAppTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const attemptedBiometricOnMount = useRef(false);

  const submit = useCallback(
    async (candidate: string) => {
      setChecking(true);
      setError(null);
      const ok = await verifyPin(candidate);
      setChecking(false);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onUnlock();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError('Incorrect PIN. Try again.');
        setPin('');
        Animated.sequence([
          Animated.timing(shake, { toValue: -10, duration: 40, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 10, duration: 80, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -8, duration: 80, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }
    },
    [verifyPin, onUnlock, shake]
  );

  const onKeyPress = useCallback(
    (key: string) => {
      if (checking) return;
      Haptics.selectionAsync().catch(() => {});
      if (key === 'del') {
        setPin((p) => p.slice(0, -1));
        setError(null);
        return;
      }
      setPin((p) => {
        if (p.length >= PIN_MAX_LENGTH) return p;
        const next = p + key;
        if (next.length >= 4) {
          // Fire-and-check once at least 4 digits are in — verifyPin itself does the real
          // length-agnostic comparison, so a 4-digit PIN unlocks the moment the 4th digit lands
          // instead of waiting for a 5th/6th keystroke that will never come.
          submit(next);
        }
        return next;
      });
      setError(null);
    },
    [checking, submit]
  );

  const tryBiometric = useCallback(async () => {
    setBiometricBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Flowsy',
        cancelLabel: 'Use PIN instead',
        disableDeviceFallback: true,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onUnlock();
      }
    } finally {
      setBiometricBusy(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    if (!biometricEnabled || Platform.OS === 'web' || attemptedBiometricOnMount.current) return;
    attemptedBiometricOnMount.current = true;
    tryBiometric();
  }, [biometricEnabled, tryBiometric]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', gap: theme.spacing['2xl'], padding: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.sm,
          }}>
          <Ionicons name="lock-closed" size={26} color={theme.colors.primary} />
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          Enter your PIN
        </Text>
        <Text style={{ color: error ? theme.colors.danger : theme.colors.textTertiary, fontSize: theme.typography.size.sm, minHeight: 18 }}>
          {error ?? ' '}
        </Text>
      </View>

      <PinDots length={pin.length} shake={shake} />

      <View style={{ gap: theme.spacing.md, opacity: checking ? 0.5 : 1 }}>
        {KEYPAD_ROWS.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
            {row.map((key, j) => (
              <Key key={j} label={key} onPress={() => onKeyPress(key)} />
            ))}
          </View>
        ))}
      </View>

      {biometricEnabled && Platform.OS !== 'web' ? (
        <Pressable onPress={tryBiometric} disabled={biometricBusy} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Use fingerprint
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
