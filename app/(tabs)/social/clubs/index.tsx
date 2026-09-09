import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, Chip, EmptyState, IconBadge, LoadingState, ScreenContainer, TextField } from '@/components';
import { auth } from '@/firebase/config';
import { todayKey } from '@/lib/date';
import {
  ActiveChallengeCard,
  CLUB_ACTION_BUTTON_MIN_HEIGHT,
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  ClubActivityLeaderboardSection,
  ClubEventsSection,
  useChallenges,
  useClub,
  useClubs,
  useEvents,
  useMyClubInvites,
  useMyClubs,
  useRespondToClubInvite,
  type Club,
  type ClubCategory,
  type ClubInvite,
} from '@/modules/clubs';
import { useNotifications, usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

const TRENDING_COUNT = 6;
type CategoryFilter = ClubCategory | 'all';

/** Bell icon + unread-count dot, same shape as the Feed tab's own header bell
 * (app/(tabs)/social/index.tsx) — kept as a small local duplicate rather than a shared export
 * since Feed's version isn't exported from anywhere yet and this screen shouldn't reach into
 * another route file to grab it. */
function NotificationBell() {
  const theme = useAppTheme();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  return (
    <Pressable onPress={() => router.push('/social/notifications')} accessibilityLabel="Notifications" hitSlop={8} style={{ position: 'relative' }}>
      <Ionicons name="notifications-outline" size={22} color={theme.colors.textSecondary} />
      {unreadCount > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            paddingHorizontal: 2,
            backgroundColor: theme.colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: theme.typography.weight.bold }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function HeaderRight() {
  const theme = useAppTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid;
  const { profile } = usePublicProfile(myUid);

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'center' }}>
      <NotificationBell />
      <Pressable
        onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: myUid ?? '' } })}
        accessibilityLabel="My profile"
        hitSlop={8}>
        <Avatar url={profile?.avatarUrl} size="sm" color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function InviteRow({ invite, onAccept, onDecline, submitting }: { invite: ClubInvite; onAccept: () => void; onDecline: () => void; submitting: boolean }) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(invite.invitedBy);

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <IconBadge name="mail" color={theme.colors.moduleTasks} size="sm" />
      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>
        {profile ? `@${profile.usernameLower}` : 'Someone'} invited you to a club
      </Text>
      <Button label="Decline" variant="secondary" onPress={onDecline} loading={submitting} />
      <Button label="Accept" onPress={onAccept} loading={submitting} />
    </Card>
  );
}

/** The signed-in member's biggest club (by useMyClubs' memberCount-desc ordering), if it has a
 * still-running challenge — a compact preview of both, with quick links into the real chat/invite/
 * challenge screens. There's no cross-club "your" events/leaderboard aggregator anywhere in this
 * data model, so this same club also anchors the Club Events and Most Active sections below rather
 * than those sections silently going empty on a page that otherwise centers around discovery. */
function YourClubCard({ club }: { club: Club }) {
  const theme = useAppTheme();
  const router = useRouter();
  const { challenges } = useChallenges(club.id);
  const activeChallenge = challenges.find((c) => c.endDate >= todayKey()) ?? null;
  const primaryCategory = club.categories[0];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Your Club</Text>
      <Card tier="elevated" glow style={{ gap: theme.spacing.md }}>
        <Pressable
          onPress={() => router.push({ pathname: '/social/clubs/[clubId]', params: { clubId: club.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          {club.photoUrl ? (
            <Avatar url={club.photoUrl} color={theme.colors.moduleTasks} />
          ) : (
            <IconBadge name="people" color={theme.colors.moduleTasks} />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              {club.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {primaryCategory ? <Chip label={CLUB_CATEGORY_LABELS[primaryCategory]} /> : null}
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
              </Text>
            </View>
            {club.description ? (
              <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                {club.description}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {activeChallenge ? <ActiveChallengeCard clubId={club.id} challenge={activeChallenge} variant="compact" /> : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
            <Link href={{ pathname: '/social/clubs/chat', params: { clubId: club.id } }} asChild>
              <Button label="Open Chat" variant="secondary" onPress={() => {}} shrinkToFit />
            </Link>
          </View>
          <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
            <Link href={{ pathname: '/social/clubs/add-members', params: { clubId: club.id } }} asChild>
              <Button label="Invite" variant="secondary" onPress={() => {}} shrinkToFit />
            </Link>
          </View>
          <View style={{ flex: 1, minHeight: CLUB_ACTION_BUTTON_MIN_HEIGHT, justifyContent: 'center' }}>
            <Link
              href={
                activeChallenge
                  ? { pathname: '/social/clubs/challenge', params: { clubId: club.id, challengeId: activeChallenge.id } }
                  : { pathname: '/social/clubs/challenge-new', params: { clubId: club.id } }
              }
              asChild>
              <Button label="Challenge" variant="secondary" onPress={() => {}} shrinkToFit />
            </Link>
          </View>
        </View>
      </Card>
    </View>
  );
}

function TrendingCard({ club }: { club: Club }) {
  const theme = useAppTheme();
  const router = useRouter();
  const { isMember, submitting, join } = useClub(club.id);

  return (
    <Card style={{ width: '48%', gap: theme.spacing.xs }}>
      <Pressable
        onPress={() => router.push({ pathname: '/social/clubs/[clubId]', params: { clubId: club.id } })}
        style={{ gap: theme.spacing.xs, alignItems: 'flex-start' }}>
        {club.photoUrl ? (
          <Avatar url={club.photoUrl} color={theme.colors.moduleTasks} />
        ) : (
          <IconBadge name="people" color={theme.colors.moduleTasks} />
        )}
        <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          {club.name}
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
        </Text>
      </Pressable>
      <Button label={isMember ? 'Joined' : 'Join'} variant="secondary" disabled={isMember} onPress={join} loading={submitting} />
    </Card>
  );
}

/** Discover/join clubs — browse by member count, filter by category tag, join, see a roster. A
 * 'private' club never appears here at all (see firestore.rules' clubs/{clubId} read rule — the
 * useClubs() query itself just never gets that doc back for a non-member/non-invitee), so there's
 * no client-side privacy filtering to do beyond the category chips. Pending club invites get
 * their own small section up top since the general notifications screen only knows about
 * follow/like/comment/partner-activity types. Search is a plain client-side filter over the
 * already-loaded `clubs` list (name match only — there's no separate challenge/member search
 * index anywhere to query against), not a new backend search feature. */
export default function ClubsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid;
  const { clubs, loading } = useClubs();
  const { myClubs } = useMyClubs(clubs);
  const { invites, loading: invitesLoading } = useMyClubInvites();
  const { accept, decline, submitting: respondingSubmitting } = useRespondToClubInvite();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const primaryClub = myClubs[0] ?? null;
  const { events: primaryClubEvents, loading: primaryClubEventsLoading } = useEvents(primaryClub?.id);
  // Gates the leaderboard-vs-plain-roster mode below — see ClubActivityLeaderboardSection's
  // hasChallenge doc comment for why the ranked view only makes sense once a challenge exists.
  const { challenges: primaryClubChallenges } = useChallenges(primaryClub?.id);

  // useClubs already orders by memberCount desc, so the top slice is the "most members" proxy for
  // trending — no separate analytics/count-tracking needed.
  const trending = useMemo(() => clubs.slice(0, TRENDING_COUNT), [clubs]);
  const searchLower = search.trim().toLowerCase();
  // OR semantics — a club matches the category filter if ANY of its (up to CLUB_MAX_CATEGORIES)
  // tags does; search then narrows that further by name.
  const filteredClubs = useMemo(
    () =>
      clubs
        .filter((club) => category === 'all' || club.categories.includes(category))
        .filter((club) => !searchLower || club.name.toLowerCase().includes(searchLower)),
    [clubs, category, searchLower]
  );

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerRight: () => <HeaderRight /> }} />
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
          Clubs
        </Text>

        <TextField
          placeholder="Discover clubs, challenges, members..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          <Chip label="All" selected={category === 'all'} onPress={() => setCategory('all')} />
          {CLUB_CATEGORIES.map((cat) => (
            <Chip key={cat} label={CLUB_CATEGORY_LABELS[cat]} selected={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </ScrollView>

        {primaryClub ? <YourClubCard club={primaryClub} /> : null}

        <Button label="Create a New Club" onPress={() => router.push('/social/clubs/create')} glow />

        {!invitesLoading && invites.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Club invites
            </Text>
            {invites.map((invite) => (
              <InviteRow
                key={invite.clubId}
                invite={invite}
                onAccept={() => accept(invite.clubId)}
                onDecline={() => decline(invite.clubId)}
                submitting={respondingSubmitting}
              />
            ))}
          </View>
        ) : null}

        {primaryClub ? (
          <ClubEventsSection
            events={primaryClubEvents}
            loading={primaryClubEventsLoading}
            title={`Club Events · ${primaryClub.name}`}
          />
        ) : null}

        {primaryClub && primaryClubChallenges.length > 0 ? (
          <ClubActivityLeaderboardSection
            clubId={primaryClub.id}
            myUid={myUid}
            club={primaryClub}
            hasChallenge
            title={`Most Active This Month · ${primaryClub.name}`}
          />
        ) : null}

        {trending.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Trending Communities
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {trending.map((club) => (
                <TrendingCard key={club.id} club={club} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Browse clubs
          </Text>

          {filteredClubs.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No clubs found"
              subtitle={
                searchLower
                  ? 'No club names match your search.'
                  : category === 'all'
                    ? 'Be the first to create one and invite others to join.'
                    : 'No clubs in this category yet.'
              }
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {filteredClubs.map((club) => (
                <Link key={club.id} href={{ pathname: '/social/clubs/[clubId]', params: { clubId: club.id } }} asChild>
                  <Pressable>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      {club.photoUrl ? (
                        <Avatar url={club.photoUrl} color={theme.colors.moduleTasks} />
                      ) : (
                        <IconBadge name="people" color={theme.colors.moduleTasks} />
                      )}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                          {club.name}
                        </Text>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                          {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
                          {club.privacy === 'inviteOnly' ? ' · Invite only' : ''}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                          {club.categories.map((cat) => (
                            <Chip key={cat} label={CLUB_CATEGORY_LABELS[cat]} />
                          ))}
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
