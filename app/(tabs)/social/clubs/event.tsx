import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconBadge,
  LoadingState,
  PostToFeedPrompt,
  ProgressBar,
  ScreenContainer,
  UpdatesFeed,
  showAlert,
  type ShareCardData,
} from '@/components';
import { formatDisplayDate, formatDisplayDateTime, todayKey } from '@/lib/date';
import { hasPromptedEventRecap, markEventRecapPrompted } from '@/modules/clubs/eventRecap';
import { EVENT_TYPE_ICONS, nextOccurrenceDates, useClub, useDeleteClubEvent, useEvent, useEventAttendees, useEventPhotos } from '@/modules/clubs';
import { usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

const UPCOMING_OCCURRENCE_COUNT = 4;

function AttendeeRow({ uid }: { uid: string }) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(uid);
  if (!profile) return null;

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Avatar url={profile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
        @{profile.usernameLower}
      </Text>
    </Card>
  );
}

/** One upcoming week's RSVP for a recurring event's template doc — its own join()/leave() and
 * attendee roster, scoped to `occurrenceDate` (see useEvent/useEventAttendees' occurrenceDate
 * param), since a recurring event's attendance can't be one shared doc the way a plain event's is. */
function OccurrenceCard({ clubId, eventId, occurrenceDate }: { clubId: string; eventId: string; occurrenceDate: string }) {
  const theme = useAppTheme();
  const { hasJoined, submitting, join, leave } = useEvent(clubId, eventId, occurrenceDate);
  const { uids } = useEventAttendees(clubId, eventId, occurrenceDate);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconBadge name="calendar" color={theme.colors.moduleTasks} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {formatDisplayDate(occurrenceDate)}
          </Text>
          <Text
            onPress={() => setExpanded((current) => !current)}
            style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {uids.length} going{uids.length > 0 ? ' · tap to view' : ''}
          </Text>
        </View>
        <Button
          label={hasJoined ? "Can't make it" : "I'm going"}
          variant={hasJoined ? 'danger' : 'secondary'}
          onPress={hasJoined ? leave : join}
          loading={submitting}
        />
      </View>
      {expanded ? <View style={{ gap: theme.spacing.sm }}>{uids.map((uid) => <AttendeeRow key={uid} uid={uid} />)}</View> : null}
    </Card>
  );
}

/** The post-event photo album — any attendee can add to it once the event has passed (see
 * `hasPassed` below), a plain photo grid otherwise hidden until at least one photo exists. */
function EventPhotoAlbum({ clubId, eventId, canAdd }: { clubId: string; eventId: string; canAdd: boolean }) {
  const theme = useAppTheme();
  const { photos, uploading, addPhoto } = useEventPhotos(clubId, eventId);

  const onAddPhoto = async () => {
    // No permission request needed — see app/(tabs)/settings/index.tsx's onPickAvatar for why.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) await addPhoto(result.assets[0].uri);
  };

  if (photos.length === 0 && !canAdd) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
        Photos
      </Text>
      {canAdd ? <Button label="Add a photo" variant="secondary" onPress={onAddPhoto} loading={uploading} /> : null}
      {photos.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.photoUrl }}
              style={{ width: 96, height: 96, borderRadius: theme.radius.md }}
              resizeMode="cover"
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function EventDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubId, eventId } = useLocalSearchParams<{ clubId: string; eventId: string }>();
  const { event, loading, hasJoined, waitlistPosition, submitting, join, leave } = useEvent(clubId, eventId);
  const { uids, loading: attendeesLoading } = useEventAttendees(clubId, eventId);
  const { isAdmin } = useClub(clubId);
  const { deleteEvent, submitting: deleting } = useDeleteClubEvent();
  const [recapPromptVisible, setRecapPromptVisible] = useState(false);
  const [recapSharing, setRecapSharing] = useState(false);

  const confirmDelete = () => {
    showAlert('Delete this event?', 'This removes it and every RSVP for good — it cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEvent(clubId, eventId)
            .then(() => router.back())
            .catch(() => showAlert('Could not delete the event', 'Please try again.'));
        },
      },
    ]);
  };

  // Recurring events have no single "the event happened" moment to recap (each occurrence is its
  // own week) — the recap prompt only applies to plain, one-off events, kept simple per the v1
  // recurring-events scope.
  const hasPassed = !!event && !event.recurring && Date.now() > event.startsAtMs;

  useEffect(() => {
    if (!hasPassed || !hasJoined || !eventId) return;
    let cancelled = false;
    hasPromptedEventRecap(eventId).then((already) => {
      if (!already && !cancelled) setRecapPromptVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasPassed, hasJoined, eventId]);

  const dismissRecap = () => {
    setRecapPromptVisible(false);
    setRecapSharing(false);
    if (eventId) markEventRecapPrompted(eventId);
  };

  const occurrenceDates = useMemo(
    () => (event?.recurring && event.recurrenceDayOfWeek != null ? nextOccurrenceDates(event.recurrenceDayOfWeek, UPCOMING_OCCURRENCE_COUNT, todayKey()) : []),
    [event?.recurring, event?.recurrenceDayOfWeek]
  );

  if (loading || !event) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const recapCard: ShareCardData = {
    eyebrow: 'CLUB EVENT',
    value: String(event.attendeeCount || 1),
    valueLabel: 'ATTENDED',
    detail: event.title,
    icon: 'calendar',
    accentColor: theme.colors.moduleTasks,
  };

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Card tier="elevated" glow style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name={EVENT_TYPE_ICONS[event.eventType]} color={theme.colors.moduleTasks} size="lg" />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            {event.title}
          </Text>
          {event.description ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>{event.description}</Text>
          ) : null}
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {event.recurring ? 'Repeats weekly · ' : ''}
            {formatDisplayDateTime(new Date(event.startsAtMs).toISOString())}
          </Text>
        </Card>

        {recapPromptVisible ? (
          <Card tier="elevated" glow style={{ gap: theme.spacing.md }}>
            {recapSharing ? (
              <PostToFeedPrompt type="text" card={recapCard} onDone={dismissRecap} />
            ) : (
              <>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  How was {event.title}?
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Share how it went with your followers.</Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Not now" variant="ghost" onPress={dismissRecap} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Share" onPress={() => setRecapSharing(true)} glow />
                  </View>
                </View>
              </>
            )}
          </Card>
        ) : null}

        {event.recurring ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Upcoming occurrences
            </Text>
            {occurrenceDates.map((occurrenceDate) => (
              <OccurrenceCard key={occurrenceDate} clubId={clubId} eventId={eventId} occurrenceDate={occurrenceDate} />
            ))}
          </View>
        ) : (
          <>
            <Button
              label={hasJoined ? "Can't make it" : waitlistPosition != null ? 'Leave waitlist' : "I'm going"}
              variant={hasJoined || waitlistPosition != null ? 'danger' : 'gradient'}
              onPress={hasJoined || waitlistPosition != null ? leave : join}
              loading={submitting}
            />
            {waitlistPosition != null ? (
              <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.xs, textAlign: 'center', fontWeight: theme.typography.weight.medium }}>
                You're on the waitlist (position {waitlistPosition})
              </Text>
            ) : !hasJoined && event.capacity != null && event.attendeeCount >= event.capacity ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
                This event is full — you'll be added to the waitlist.
              </Text>
            ) : null}

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Going ({event.attendeeCount}{event.capacity != null ? `/${event.capacity}` : ''})
              </Text>
              {event.capacity != null ? (
                <ProgressBar progress={Math.min(event.attendeeCount / event.capacity, 1)} color={theme.colors.moduleTasks} height={4} />
              ) : null}
              {attendeesLoading ? (
                <LoadingState />
              ) : uids.length === 0 ? (
                <EmptyState icon="calendar-outline" title="Nobody's RSVP'd yet" />
              ) : (
                uids.map((uid) => <AttendeeRow key={uid} uid={uid} />)
              )}
            </View>

            {hasPassed ? <EventPhotoAlbum clubId={clubId} eventId={eventId} canAdd={hasJoined} /> : null}
          </>
        )}

        <UpdatesFeed parentPath={`clubs/${clubId}/events/${eventId}`} canPost={hasJoined || event.recurring} />

        {isAdmin ? <Button label="Delete Event" variant="danger" onPress={confirmDelete} loading={deleting} /> : null}
      </View>
    </ScreenContainer>
  );
}
