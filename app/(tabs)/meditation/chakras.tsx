import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components';
import { CHAKRAS } from '@/modules/meditation';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

export default function ChakraMeditationScreen() {
  const theme = useAppTheme();

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
          Seven short guided sits, one per chakra — each pairs its traditional bija mantra and color to help you focus on and settle that center.
        </Text>

        {CHAKRAS.map((chakra) => (
          <Link key={chakra.key} href={{ pathname: '/meditation/chakra/[chakraKey]', params: { chakraKey: chakra.key } }} asChild>
            <Pressable>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    backgroundColor: withAlpha(chakra.color, 0.16),
                    borderWidth: 1,
                    borderColor: withAlpha(chakra.color, 0.4),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: chakra.color }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    {chakra.name} · {chakra.sanskritName}
                  </Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    {chakra.theme}
                  </Text>
                </View>
                <Text style={{ color: chakra.color, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
                  {chakra.mantra}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScreenContainer>
  );
}
