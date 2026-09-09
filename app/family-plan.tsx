import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, LoadingState, ScreenContainer, TextField, showAlert } from '@/components';
import { auth } from '@/firebase/config';
import { useFamilyActions, useMyFamilyMembership, useOwnedFamily, usePendingFamilyInvites } from '@/modules/family';
import { PLANS, type PlanKey } from '@/modules/premium';
import { usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

export default function FamilyPlanScreen() {
  const theme = useAppTheme();
  const { family, loading: familyLoading } = useOwnedFamily();
  const { ownerUid: memberOfFamilyUid, loading: membershipLoading } = useMyFamilyMembership();
  const { invites } = usePendingFamilyInvites();
  const { submitting, inviteMember, respondToInvite, removeMember, leaveFamily } = useFamilyActions();
  const [username, setUsername] = useState('');
  const myUid = auth.currentUser?.uid;

  if (familyLoading || membershipLoading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onInvite = async () => {
    if (!username.trim()) return;
    const result = await inviteMember(username.trim());
    if (result.ok) {
      setUsername('');
      showAlert('Invite sent', `We let @${username.trim()} know they've been invited.`);
    } else {
      showAlert('Could not invite', result.message);
    }
  };

  const onRespond = async (inviteId: string, accept: boolean) => {
    const result = await respondToInvite(inviteId, accept);
    if (!result.ok) showAlert('Something went wrong', result.message);
  };

  const onRemove = (memberUid: string) => {
    showAlert('Remove member?', 'They will lose Pro access from this Family plan immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await removeMember(memberUid);
          if (!result.ok) showAlert('Could not remove member', result.message);
        },
      },
    ]);
  };

  const onLeave = () => {
    showAlert('Leave Family plan?', "You'll lose Pro access unless you have your own subscription.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const result = await leaveFamily();
          if (!result.ok) showAlert('Could not leave', result.message);
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          Family Plan
        </Text>

        {invites.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              Pending invites
            </Text>
            {invites.map((invite) => (
              <Card key={invite.id} style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>
                  You've been invited to join a Family plan.
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <Button label="Accept" onPress={() => onRespond(invite.id, true)} loading={submitting} />
                  <Button label="Decline" variant="ghost" onPress={() => onRespond(invite.id, false)} loading={submitting} />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {family ? (
          <View style={{ gap: theme.spacing.md }}>
            <Card style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                Your Family plan
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {family.memberUids.length} of {family.maxMembers} spots used
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {`₹${Math.round(PLANS[family.plan as PlanKey]?.priceInr / family.maxMembers) || '—'}/person, ${PLANS[family.plan as PlanKey]?.billing ?? ''}`}
              </Text>
            </Card>

            <View style={{ gap: theme.spacing.sm }}>
              <TextField label="Invite by username" placeholder="username" value={username} onChangeText={setUsername} autoCapitalize="none" />
              <Button
                label="Send invite"
                onPress={onInvite}
                loading={submitting}
                disabled={!username.trim() || family.memberUids.length >= family.maxMembers}
              />
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                Members
              </Text>
              {family.memberUids.map((uid) => (
                <FamilyMemberRow key={uid} uid={uid} isMe={uid === myUid} onRemove={() => onRemove(uid)} />
              ))}
            </View>
          </View>
        ) : memberOfFamilyUid ? (
          <View style={{ gap: theme.spacing.md }}>
            <Card style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>
                You're on someone else's Family plan.
              </Text>
            </Card>
            <Button label="Leave Family Plan" variant="danger" onPress={onLeave} loading={submitting} />
          </View>
        ) : (
          <Card>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
              Subscribe to a Family plan from the Premium screen to invite people here.
            </Text>
          </Card>
        )}
      </View>
    </ScreenContainer>
  );
}

/** Resolves a member's real display name via their public profile instead of showing the raw
 * uid — usePublicProfile is a live per-uid listener, fine at Family Plan's max of 5 rows. */
function FamilyMemberRow({ uid, isMe, onRemove }: { uid: string; isMe: boolean; onRemove: () => void }) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(uid);
  const label = isMe ? 'You (owner)' : profile?.displayName || (profile?.usernameLower ? `@${profile.usernameLower}` : uid);

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Ionicons name="person-circle-outline" size={22} color={theme.colors.textTertiary} />
      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{label}</Text>
      {!isMe ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={20} color={theme.colors.danger} />
        </Pressable>
      ) : null}
    </Card>
  );
}
