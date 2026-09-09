import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer, showAlert } from '@/components';
import { formatCurrency, useSplitExpenses, type SplitExpense } from '@/modules/finance';
import { useProfilesByUids } from '@/modules/social';
import { useAppTheme } from '@/theme';

export default function SplitsScreen() {
  const theme = useAppTheme();
  const { iOwe, owedToMe, loading, setSettled } = useSplitExpenses();
  const otherUids = Array.from(new Set([...iOwe.map((s) => s.fromUid), ...owedToMe.map((s) => s.fromUid), ...owedToMe.map((s) => s.toUid), ...iOwe.map((s) => s.toUid)]));
  const { profiles } = useProfilesByUids(otherUids);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const unsettledIOwe = iOwe.filter((s) => !s.settled);
  const unsettledOwedToMe = owedToMe.filter((s) => !s.settled);
  const totalIOwe = unsettledIOwe.reduce((sum, s) => sum + s.amount, 0);
  const totalOwedToMe = unsettledOwedToMe.reduce((sum, s) => sum + s.amount, 0);

  const onToggleSettled = (split: SplitExpense) => {
    showAlert(split.settled ? 'Mark as unsettled?' : 'Mark as settled?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => setSettled(split.id, !split.settled) },
    ]);
  };

  const nameFor = (uid: string) => profiles[uid]?.displayName || profiles[uid]?.usernameLower || 'Someone';

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Card style={{ flex: 1, gap: theme.spacing.xs, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>You owe</Text>
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {formatCurrency(totalIOwe)}
            </Text>
          </Card>
          <Card style={{ flex: 1, gap: theme.spacing.xs, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>You&apos;re owed</Text>
            <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {formatCurrency(totalOwedToMe)}
            </Text>
          </Card>
        </View>

        {iOwe.length === 0 && owedToMe.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No shared expenses yet"
            subtitle="Split a transaction with a mutual follower to track who owes who."
          />
        ) : (
          <>
            <SplitSection title="You owe" splits={iOwe} nameFor={nameFor} isDebtor onToggleSettled={onToggleSettled} />
            <SplitSection title="You're owed" splits={owedToMe} nameFor={nameFor} isDebtor={false} onToggleSettled={onToggleSettled} />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function SplitSection({
  title,
  splits,
  nameFor,
  isDebtor,
  onToggleSettled,
}: {
  title: string;
  splits: SplitExpense[];
  nameFor: (uid: string) => string;
  isDebtor: boolean;
  onToggleSettled: (split: SplitExpense) => void;
}) {
  const theme = useAppTheme();
  if (splits.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
        {title}
      </Text>
      {splits.map((split) => {
        const otherUid = isDebtor ? split.toUid : split.fromUid;
        return (
          <Pressable key={split.id} onPress={() => onToggleSettled(split)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: split.settled ? 0.5 : 1 }}>
              <IconBadge
                name={split.settled ? 'checkmark-circle' : isDebtor ? 'arrow-up-circle' : 'arrow-down-circle'}
                color={split.settled ? theme.colors.textTertiary : isDebtor ? theme.colors.danger : theme.colors.success}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                  {isDebtor ? `Owed to ${nameFor(otherUid)}` : `Owed by ${nameFor(otherUid)}`}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{split.description}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    color: split.settled ? theme.colors.textTertiary : isDebtor ? theme.colors.danger : theme.colors.success,
                    fontSize: theme.typography.size.base,
                    fontWeight: theme.typography.weight.semibold,
                  }}>
                  {formatCurrency(split.amount)}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                  {split.settled ? 'Settled' : 'Tap to settle'}
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
