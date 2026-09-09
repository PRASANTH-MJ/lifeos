import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useFeatureGate, type PremiumFeature } from '@/modules/premium';
import { useAppTheme } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';

type Props = {
  feature: PremiumFeature;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  /** Skip the gate entirely regardless of premium status — for a screen that's mostly a Pro
   * teaser but has one specific mode that must stay free (e.g. the Exercise Library's pick mode,
   * which core workout logging depends on with no manual-entry fallback). Still calls the
   * underlying hook (rules of hooks), just never logs a hit or blocks render while true. */
  bypass?: boolean;
};

/** Whole-screen (or whole-section) Pro gate — renders `children` once the user is effectively
 * premium (real subscription or active trial, see useFeatureGate), otherwise a locked teaser card
 * with a "Go Pro" CTA. Logs exactly one paywall-hit event per mount of the locked state, not once
 * per render, so re-renders from unrelated state changes don't inflate the count. */
export function PremiumGate({ feature, title, message, icon = 'lock-closed', children, bypass = false }: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const { allowed, logHit } = useFeatureGate(feature);
  const logged = useRef(false);

  useEffect(() => {
    if (!bypass && !allowed && !logged.current) {
      logged.current = true;
      logHit();
    }
  }, [bypass, allowed, logHit]);

  if (bypass || allowed) return <>{children}</>;

  return (
    <Card tier="panel" style={{ alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={26} color={theme.colors.primary} />
      </View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>{message}</Text>
      <Button label="Go Pro" variant="gradient" onPress={() => router.push('/premium')} />
    </Card>
  );
}
