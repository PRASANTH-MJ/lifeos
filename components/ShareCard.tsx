import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/theme/withAlpha';
import { GlowSurface } from './GlowSurface';

export type ShareCardData = {
  /** Small caps label above the headline, e.g. "WORKOUT STREAK" or a workout's title. */
  eyebrow: string;
  /** The big flex number, e.g. "7" or "900". */
  value: string;
  /** Small caps label under the headline, e.g. "DAY STREAK" or "KG LIFTED". */
  valueLabel: string;
  /** Optional smaller stat line under everything, e.g. "12 sets · 42:10". */
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
};

const CARD_WIDTH = 300;
const CARD_HEIGHT = 380;

/** Fixed dark brand background regardless of the user's in-app theme — matches the current
 * theme only via `accentColor`, so the card reads consistently in a Story/DM no matter which
 * of the app's four themes produced it, and always has enough contrast for white text. */
export const ShareCard = forwardRef<View, { data: ShareCardData }>(function ShareCard({ data }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient
        colors={['#171B26', '#0B0D12', withAlpha(data.accentColor, 0.28)]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <GlowSurface color={data.accentColor} intensity="lg" borderRadius={999}>
          <View style={[styles.iconCircle, { backgroundColor: withAlpha(data.accentColor, 0.18), borderColor: withAlpha(data.accentColor, 0.6) }]}>
            <Ionicons name={data.icon} size={34} color={data.accentColor} />
          </View>
        </GlowSurface>

        <Text style={[styles.eyebrow, { color: data.accentColor }]} numberOfLines={1}>
          {data.eyebrow.toUpperCase()}
        </Text>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {data.value}
        </Text>
        <Text style={styles.valueLabel}>{data.valueLabel.toUpperCase()}</Text>

        {data.detail ? <Text style={styles.detail}>{data.detail}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Ionicons name="flame" size={13} color="rgba(242,246,255,0.45)" />
        <Text style={styles.brand}>FLOWSY</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0B0D12',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  value: {
    color: '#F2F6FF',
    fontSize: 68,
    fontWeight: '800',
    marginTop: 6,
  },
  valueLabel: {
    color: 'rgba(242,246,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: -4,
  },
  detail: {
    color: 'rgba(242,246,255,0.72)',
    fontSize: 14,
    marginTop: 18,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    color: 'rgba(242,246,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
