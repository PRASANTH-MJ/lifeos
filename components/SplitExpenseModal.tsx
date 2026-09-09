import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { formatCurrency, useSplitExpenses } from '@/modules/finance';
import { useMutualFollowers } from '@/modules/social';
import { useAppTheme } from '@/theme';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { TextField } from './TextField';

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: { id: string; amount: number; note: string | null; currency?: string };
};

type SplitMode = 'equal' | 'custom';

/** "Split this expense" — pick a mutual follower and their share, writes a splitExpenses doc
 * (see firestore.rules) where the viewer is the creditor (they paid) and the picked friend is the
 * debtor. Deliberately limited to mutuals, not any follower/followed uid: a one-directional follow
 * doesn't guarantee the other person actually knows the viewer well enough for this to make sense. */
export function SplitExpenseModal({ visible, onClose, transaction }: Props) {
  const theme = useAppTheme();
  const { mutuals, loading } = useMutualFollowers();
  const { createSplit } = useSplitExpenses();
  const [friendUid, setFriendUid] = useState<string | null>(null);
  const [mode, setMode] = useState<SplitMode>('equal');
  const [customAmount, setCustomAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const equalShare = transaction.amount / 2;
  const shareAmount = mode === 'equal' ? equalShare : Number(customAmount);
  const canSave = !!friendUid && shareAmount > 0 && shareAmount <= transaction.amount && !saving;

  const reset = () => {
    setFriendUid(null);
    setMode('equal');
    setCustomAmount('');
  };

  const onSave = async () => {
    if (!canSave || !friendUid) return;
    setSaving(true);
    try {
      await createSplit({
        friendUid,
        amount: shareAmount,
        description: transaction.note || 'Shared expense',
        transactionId: transaction.id,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{ flex: 1, backgroundColor: theme.colors.overlay }}
          onPress={() => {
            reset();
            onClose();
          }}
        />
        <View
          style={{
            maxHeight: '85%',
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            Split this expense
          </Text>

          {loading ? null : mutuals.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No mutual followers yet"
              subtitle="Follow each other with someone to split an expense with them."
            />
          ) : (
            <ScrollView style={{ maxHeight: 220 }}>
              <View style={{ gap: theme.spacing.sm }}>
                {mutuals.map((profile) => (
                  <Pressable
                    key={profile.uid}
                    onPress={() => setFriendUid(profile.uid)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor: friendUid === profile.uid ? theme.colors.primaryMuted : 'transparent',
                    }}>
                    <Avatar url={profile.avatarUrl} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>
                      {profile.displayName || profile.usernameLower}
                    </Text>
                    {friendUid === profile.uid ? <Text style={{ color: theme.colors.primary }}>✓</Text> : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {mutuals.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Their share
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Chip label={`Split equally (${formatCurrency(equalShare, transaction.currency)})`} selected={mode === 'equal'} onPress={() => setMode('equal')} />
                <Chip label="Custom amount" selected={mode === 'custom'} onPress={() => setMode('custom')} />
              </View>
              {mode === 'custom' ? (
                <TextField value={customAmount} onChangeText={setCustomAmount} placeholder="0.00" keyboardType="decimal-pad" />
              ) : null}
            </View>
          ) : null}

          <Button label="Save split" onPress={onSave} disabled={!canSave} loading={saving} />
        </View>
      </View>
    </Modal>
  );
}
