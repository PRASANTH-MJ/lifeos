import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useAuth } from '@/modules/auth/useAuth';
import { uploadAvatar } from './avatarSync';
import { subscribeToAvatarBroadcast } from './avatarBroadcast';
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

function toProfile(row: ProfileRow | null): UserProfile {
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

export function useProfile() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<ProfileRow>(
      'SELECT name, avatar_uri, pin_hash, pin_enabled, biometric_enabled, firebase_uid, premium, gender FROM user_profile WHERE id = 1'
    );
    setProfile(toProfile(row));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // A remote avatar change lands in local SQLite the moment useAvatarSync's listener fires, even
  // while this screen is already focused — useFocusEffect alone would miss that until the next
  // focus. Updating state directly here (skipping a DB round trip) keeps it live either way.
  useEffect(() => {
    return subscribeToAvatarBroadcast((url) => {
      setProfile((current) => (current ? { ...current, avatarUri: url } : current));
    });
  }, []);

  const setName = useCallback(
    async (name: string) => {
      await db.runAsync('UPDATE user_profile SET name = ?, updated_at = ? WHERE id = 1', [name.trim() || null, new Date().toISOString()]);
      await refresh();
    },
    [db, refresh]
  );

  const setAvatarUri = useCallback(
    async (avatarUri: string | null) => {
      await db.runAsync('UPDATE user_profile SET avatar_uri = ?, updated_at = ? WHERE id = 1', [avatarUri, new Date().toISOString()]);
      await refresh();

      // Upload in the background so picking a photo feels instant — once it's up, the local row
      // is updated to point at the same URL other devices will see, and this doc's listener
      // (see useAvatarSync, mounted at root) is how a *different* device picks up the change.
      if (avatarUri && user) {
        uploadAvatar(user.uid, avatarUri)
          .then((url) => db.runAsync('UPDATE user_profile SET avatar_uri = ? WHERE id = 1', [url]).then(refresh))
          .catch(() => {});
      }
    },
    [db, refresh, user]
  );

  const setPin = useCallback(
    async (pin: string) => {
      const pinHash = await hashPin(pin);
      await db.runAsync('UPDATE user_profile SET pin_hash = ?, pin_enabled = 1, updated_at = ? WHERE id = 1', [
        pinHash,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const disablePin = useCallback(async () => {
    await db.runAsync('UPDATE user_profile SET pin_enabled = 0, pin_hash = NULL, biometric_enabled = 0, updated_at = ? WHERE id = 1', [
      new Date().toISOString(),
    ]);
    await refresh();
  }, [db, refresh]);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      await db.runAsync('UPDATE user_profile SET biometric_enabled = ?, updated_at = ? WHERE id = 1', [enabled ? 1 : 0, new Date().toISOString()]);
      await refresh();
    },
    [db, refresh]
  );

  const verifyPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!profile?.pinHash) return true;
      const candidate = await hashPin(pin);
      return candidate === profile.pinHash;
    },
    [profile]
  );

  /** Caches the signed-in Firebase account + its entitlement locally, so the rest of the app
   * (free-tier limit checks in particular) never has to wait on a network round trip. Firestore
   * remains the source of truth — see modules/premium/usePremium.ts, which calls this. */
  const syncAccount = useCallback(
    async (firebaseUid: string | null, premium: boolean) => {
      await db.runAsync('UPDATE user_profile SET firebase_uid = ?, premium = ?, premium_synced_at = ? WHERE id = 1', [
        firebaseUid,
        premium ? 1 : 0,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const setGender = useCallback(
    async (gender: UserProfile['gender']) => {
      await db.runAsync('UPDATE user_profile SET gender = ?, updated_at = ? WHERE id = 1', [gender, new Date().toISOString()]);
      await refresh();
    },
    [db, refresh]
  );

  return { profile, loading, setName, setAvatarUri, setGender, setPin, disablePin, setBiometricEnabled, verifyPin, syncAccount, refresh };
}
