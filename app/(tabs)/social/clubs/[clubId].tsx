import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, Share, Text, View } from 'react-native';

import { Avatar, Button, Card, Chip, EmptyState, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { auth } from '@/firebase/config';
import { todayKey } from '@/lib/date';
import {
  ActiveChallengeCard,
  buildClubDeepLink,
  CLUB_ACTION_BUTTON_MIN_HEIGHT,
  CLUB_CATEGORY_LABELS,
  ClubActivityLeaderboardSection,
  ClubEventsSection,
  goalUnitLabel,
  useChallenges,
  useClub,
  useEvents,
} from '@/modules/clubs';
import { useAppTheme } from '@/theme';

/** The "..." overflow next to the club title — today this only ever holds the one real
 * admin-only action this screen already had (edit club name/photo/categories/privacy), kept as an
 * overflow rather than a bare pencil icon so the header reads as the same
 * icon-photo/name/overflow shape used elsewhere, and so it has somewhere to grow into if more
 * admin actions land later without redoing the header again. */
function ClubOverflowMenu({ clubId }: { clubId: string }) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable accessibilityLabel="Club settings" onPress={() => setVisible(true)} hitSlop={8}>
        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }} onPress={() => setVisible(false)}>
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
            }}>
            <Link href={{ pathname: '/social/clubs/edit', params: { clubId } }} asChild>
              <Pressable
                onPress={() => setVisible(false)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
                <Ionicons name="pencil-outline" size={20} color={theme.colors.textPrimary} />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                  Edit club
                </Text>
              </Pressable>
            </Link>
            {/* The irreversible, everyone-loses-the-club action — its own typed-confirmation
                screen (delete-club.tsx) rather than a plain alert here, same reasoning as
                app/delete-account.tsx. This menu only ever renders for a full admin (see the
                isAdmin gate around <ClubOverflowMenu /> below), so no further tier check is
                needed at this call site. */}
            <Link href={{ pathname: '/social/clubs/delete-club', params: { clubId } }} asChild>
              <Pressable
                onPress={() => setVisible(false)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                  Delete club
                </Text>
              </Pressable>
            </Link>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Club roster + join/leave, plus club-scoped Challenges, Events, and a club-wide activity
 * leaderboard. Member list reuses usePublicProfile the same way a follower list already does. */
export default function ClubDetailScreen() {
  const theme = useAppTheme();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const myUid = auth.currentUser?.uid;
  const { club, loading, isMember, isAdmin, isSubAdmin, submitting, join, leave } = useClub(clubId);
  const { challenges, loading: challengesLoading } = useChallenges(clubId);
  const { events, loading: eventsLoading } = useEvents(clubId);

  const activeChallenge = useMemo(() => challenges.find((c) => c.endDate >= todayKey()) ?? null, [challenges]);
  const otherChallenges = useMemo(() => challenges.filter((c) => c.id !== activeChallenge?.id), [challenges, activeChallenge]);

  if (loading || !club) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
          {club.photoUrl ? (
            <Avatar url={club.photoUrl} size="lg" color={theme.colors.moduleTasks} />
          ) : (
            <IconBadge name="people" color={theme.colors.moduleTasks} size="lg" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {club.name}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, marginTop: 4 }}>
              {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
              {club.privacy !== 'public' ? ` · ${club.privacy === 'private' ? 'Private' : 'Invite only'}` : ''}
            </Text>
            {club.description ? (
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, marginTop: 4 }}>{club.description}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {club.categories.map((cat) => (
                <Chip key={cat} label={CLUB_CATEGORY_LABELS[cat]} />
              ))}
            </View>
          </View>
          {isAdmin ? <ClubOverflowMenu clubId={clubId} /> : null}
        </View>

        {isMember ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
              <Link href={{ pathname: '/social/clubs/chat', params: { clubId } }} asChild>
                <Button label="Open Chat" variant="secondary" onPress={() => {}} shrinkToFit />
              </Link>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
                <Link href={{ pathname: '/social/clubs/add-members', params: { clubId } }} asChild>
                  <Button label="Invite" variant="secondary" onPress={() => {}} shrinkToFit />
                </Link>
              </View>
              <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
                {/* "Challenge"/"Event", not "New Challenge"/"New Event" — matches the labels
                    index.tsx's YourClubCard already uses for the same actions. Short labels alone
                    weren't enough to guarantee a single line at large OS/accessibility text
                    sizes, so `shrinkToFit` (numberOfLines=1 + adjustsFontSizeToFit on Button
                    itself) now handles that robustly, with CLUB_ACTION_BUTTON_MIN_HEIGHT as a
                    defense-in-depth floor so this row can't grow taller than YourClubCard's
                    3-button row even if a label still wraps somehow. */}
                <Link href={{ pathname: '/social/clubs/challenge-new', params: { clubId } }} asChild>
                  <Button label="Challenge" variant="secondary" onPress={() => {}} shrinkToFit />
                </Link>
              </View>
              <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
                <Link href={{ pathname: '/social/clubs/event-new', params: { clubId } }} asChild>
                  <Button label="Event" variant="secondary" onPress={() => {}} shrinkToFit />
                </Link>
              </View>
              <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
                <Button label="Leave" variant="danger" onPress={leave} loading={submitting} shrinkToFit />
              </View>
            </View>
          </View>
        ) : (
          <Button label="Join Club" variant="gradient" onPress={join} loading={submitting} glow />
        )}

        {club.privacy !== 'public' ? (
          <Button label="Share invite link" variant="secondary" onPress={() => Share.share({ message: buildClubDeepLink(club.id) })} />
        ) : null}

        {activeChallenge ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Active Challenge
            </Text>
            <ActiveChallengeCard clubId={clubId} challenge={activeChallenge} />
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {activeChallenge ? 'Other Challenges' : 'Challenges'}
          </Text>
          {challengesLoading ? (
            <LoadingState />
          ) : otherChallenges.length === 0 ? (
            activeChallenge ? null : (
              <EmptyState icon="trophy-outline" title="No challenges yet" subtitle="Start one to get the club moving together." />
            )
          ) : (
            otherChallenges.map((challenge) => (
              <Link key={challenge.id} href={{ pathname: '/social/clubs/challenge', params: { clubId, challengeId: challenge.id } }} asChild>
                <Pressable>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name="trophy" color={theme.colors.warning} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        {challenge.title}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {challenge.goalSessions} {goalUnitLabel(challenge.metricType)} · {challenge.participantCount} joined
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </Card>
                </Pressable>
              </Link>
            ))
          )}
        </View>

        {isMember ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Club Productivity
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Link href={{ pathname: '/social/clubs/habits', params: { clubId } }} asChild>
                  <Button label="Club Habits" variant="secondary" onPress={() => {}} />
                </Link>
              </View>
              <View style={{ flex: 1 }}>
                <Link href={{ pathname: '/social/clubs/tasks', params: { clubId } }} asChild>
                  <Button label="Club Tasks" variant="secondary" onPress={() => {}} />
                </Link>
              </View>
            </View>
          </View>
        ) : null}

        <ClubEventsSection events={events} loading={eventsLoading} title="Club Events" />

        {/* One merged member-list section, not a separate leaderboard + "Club Members" list (see
            the duplicate-roster bug report) — ranked "most active" once the club has a challenge,
            a plain roster otherwise; see ClubActivityLeaderboardSection's hasChallenge doc
            comment. Always visible (not gated on isMember) like the old Club Members list was. */}
        <ClubActivityLeaderboardSection
          clubId={clubId}
          myUid={myUid}
          club={club}
          hasChallenge={challenges.length > 0}
          viewerIsAdmin={isAdmin}
          viewerIsSubAdmin={isSubAdmin}
          title="Most active this month"
        />
      </View>
    </ScreenContainer>
  );
}
