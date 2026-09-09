import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { useAuth } from '@/modules/auth/useAuth';
import { uploadAvatar } from './avatarSync';
import type { UserProfile } from './types';

type ProfileRow = {
  name: string | null;
  avatar_uri: string | null;
  pin_hash: string | null;
  pin_enabled: number;
  biometric_enabled: number;
  firebase_uid: string | null;
  premium: number;
  gender: string | null;
};

function toProfile(row: ProfileRow | undefined | null): UserProfile {
  return {
    name: row?.name ?? null,
    avatarUri: row?.avatar_uri ?? null,
    pinEnabled: Boolean(row?.pin_enabled),
    pinHash: row?.pin_hash ?? null,
    biometricEnabled: Boolean(row?.biometric_enabled),
    firebaseUid: row?.firebase_uid ?? null,
    premium: Boolean(row?.premium),
    gender: (row?.gender as UserProfile['gender']) ?? null,
  };
}

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

/**
 * Web build of useProfile.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect + a same-tab broadcast hack: a write from useAvatarSync.web.ts
 * (or any other tab) flows into every mounted useProfile() instance automatically, so the
 * avatarBroadcast.ts same-tab workaround the native version needs isn't necessary here.
 */
export function useProfile() {
  const { user } = useAuth();
  const row = useLiveQuery(() => webDb.user_profile.get(1) as Promise<ProfileRow | undefined>, []);
  const loading = row === undefined;
  const profile = toProfile(row);

  const update = useCallback(async (values: Record<string, unknown>) => {
    await webDb.user_profile.update(1, { ...values, updated_at: new Date().toISOString() });
  }, []);

  const setName = useCallback(async (name: string) => {
    await update({ name: name.trim() || null });
  }, [update]);

  const setAvatarUri = useCallback(
    async (avatarUri: string | null) => {
      await update({ avatar_uri: avatarUri });

      if (avatarUri && user) {
        uploadAvatar(user.uid, avatarUri)
          .then((url) => webDb.user_profile.update(1, { avatar_uri: url }))
          .catch(() => {});
      }
    },
    [update, user]
  );

  const setPin = useCallback(
    async (pin: string) => {
      const pinHash = await hashPin(pin);
      await update({ pin_hash: pinHash, pin_enabled: 1 });
    },
    [update]
  );

  const disablePin = useCallback(async () => {
    await update({ pin_enabled: 0, pin_hash: null, biometric_enabled: 0 });
  }, [update]);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      await update({ biometric_enabled: enabled ? 1 : 0 });
    },
    [update]
  );

  const verifyPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!profile.pinHash) return true;
      const candidate = await hashPin(pin);
      return candidate === profile.pinHash;
    },
    [profile.pinHash]
  );

  const syncAccount = useCallback(
    async (firebaseUid: string | null, premium: boolean) => {
      await update({ firebase_uid: firebaseUid, premium: premium ? 1 : 0, premium_synced_at: new Date().toISOString() });
    },
    [update]
  );

  const setGender = useCallback(async (gender: UserProfile['gender']) => {
    await update({ gender });
  }, [update]);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { profile, loading, setName, setAvatarUri, setGender, setPin, disablePin, setBiometricEnabled, verifyPin, syncAccount, refresh };
}
