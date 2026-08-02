import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';
import { percentChange } from './AnalyticsService';

export type MetricRow = {
  label: string;
  value: string;
  current: number;
  previous: number | null;
  /** Lower is better for this metric (e.g. overdue tasks, spend) — flips arrow color meaning. */
  invert?: boolean;
};

export type MetricDomain = {
  key: string;
  label: string;
  color: string;
  metrics: MetricRow[];
};

/** A collapsible, domain-grouped grid (Productivity / Wellness / Finance) — each metric shows
 * its current value plus an up/down/flat trend arrow against the previous equal-length period. */
export function MetricGrid({ domains }: { domains: MetricDomain[] }) {
  const theme = useAppTheme();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <View style={{ gap: theme.spacing.md }}>
      {domains.map((domain) => {
        const isCollapsed = collapsed[domain.key] ?? false;
        return (
          <Card key={domain.key} style={{ gap: theme.spacing.sm }}>
            <Pressable
              onPress={() => setCollapsed((prev) => ({ ...prev, [domain.key]: !isCollapsed }))}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: domain.color }} />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  {domain.label}
                </Text>
              </View>
              <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={theme.colors.textTertiary} />
            </Pressable>

            {!isCollapsed ? (
              <View style={{ gap: theme.spacing.sm }}>
                {domain.metrics.map((metric) => {
                  const change = metric.previous != null ? percentChange(metric.current, metric.previous) : null;
                  const improved = change == null ? null : metric.invert ? change <= 0 : change >= 0;
                  return (
                    <View key={metric.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{metric.label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                          {metric.value}
                        </Text>
                        {change != null && change !== 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Ionicons
                              name={change > 0 ? 'arrow-up' : 'arrow-down'}
                              size={12}
                              color={improved ? theme.colors.success : theme.colors.danger}
                            />
                            <Text style={{ color: improved ? theme.colors.success : theme.colors.danger, fontSize: theme.typography.size.xs }}>
                              {Math.abs(Math.round(change))}%
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
