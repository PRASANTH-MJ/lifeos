import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, SegmentedControl } from '@/components';
import { buildMonthGrid, formatDisplayDate, formatDisplayDateTime, monthCursorOf, shiftMonth, toDateKey, todayKey, weekdayOf } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { useAppTheme } from '@/theme';
import { nextOccurrenceDates } from './recurringEvents';
import { EVENT_TYPE_ICONS } from './types';
import type { FitnessEvent } from './types';

function EventRow({ event }: { event: FitnessEvent }) {
  const theme = useAppTheme();
  const nextOccurrence = event.recurring && event.recurrenceDayOfWeek != null ? nextOccurrenceDates(event.recurrenceDayOfWeek, 1)[0] : null;
  return (
    <Link href={{ pathname: '/social/clubs/event', params: { clubId: event.clubId, eventId: event.id } }} asChild>
      <Pressable>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconBadge name={EVENT_TYPE_ICONS[event.eventType]} color={theme.colors.moduleTasks} size="sm" />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              {event.title}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              {nextOccurrence
                ? `Weekly · next ${formatDisplayDate(nextOccurrence)}`
                : `${formatDisplayDateTime(new Date(event.startsAtMs).toISOString())} · ${event.attendeeCount}${event.capacity != null ? `/${event.capacity}` : ''} going`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
        </Card>
      </Pressable>
    </Link>
  );
}

/** Events, either as the plain soonest-first list or as a month-grid calendar (reusing the exact
 * CalendarMonthGrid used by the personal calendar tab, see app/(tabs)/calendar/index.tsx, rather
 * than a second grid implementation) with a dot on any day that has a club event. Selecting a day
 * in calendar view narrows the list below it to just that day's events, RSVP count included —
 * attendeeCount already lives on the event doc itself (see useEvents.ts), so no separate
 * useEventAttendees call is needed just to show a count here. `events` may span more than one club
 * (each FitnessEvent already carries its own clubId — see EventRow), so this also works as a
 * cross-club "your clubs' events" feed, not just a single club's. */
export function ClubEventsSection({ events, loading, title = 'Club Events' }: { events: FitnessEvent[]; loading: boolean; title?: string }) {
  const theme = useAppTheme();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [cursor, setCursor] = useState(() => monthCursorOf(todayKey()));
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const markedDates = useMemo(() => {
    const dates = new Set(events.filter((event) => !event.recurring).map((event) => toDateKey(new Date(event.startsAtMs))));
    const recurring = events.filter((event) => event.recurring && event.recurrenceDayOfWeek != null);
    if (recurring.length > 0) {
      for (const dateKey of buildMonthGrid(cursor.year, cursor.month)) {
        if (recurring.some((event) => event.recurrenceDayOfWeek === weekdayOf(dateKey))) dates.add(dateKey);
      }
    }
    return dates;
  }, [events, cursor]);
  const eventsOnSelectedDate = useMemo(
    () =>
      events.filter((event) =>
        event.recurring ? event.recurrenceDayOfWeek === weekdayOf(selectedDate) : toDateKey(new Date(event.startsAtMs)) === selectedDate
      ),
    [events, selectedDate]
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {/* flexWrap so a long title (e.g. index.tsx's "Club Events · <club name>") never pushes the
          segmented toggle past the right edge of the screen — it wraps onto its own line instead
          of getting silently clipped, which is guaranteed to fit at any phone width, unlike trying
          to precisely budget both elements' widths against every possible title length. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {title}
        </Text>
        <SegmentedControl
          options={[
            { value: 'list', label: 'List' },
            { value: 'calendar', label: 'Calendar' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : events.length === 0 ? (
        <EmptyState icon="calendar-outline" title="No events yet" subtitle="Schedule a group activity for club members to join." />
      ) : view === 'list' ? (
        events.map((event) => <EventRow key={event.id} event={event} />)
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Card>
            <CalendarMonthGrid
              year={cursor.year}
              month={cursor.month}
              selectedDate={selectedDate}
              markedDates={markedDates}
              onSelectDate={setSelectedDate}
              onChangeMonth={(delta) => setCursor((current) => shiftMonth(current, delta))}
            />
          </Card>
          {eventsOnSelectedDate.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No events this day" />
          ) : (
            eventsOnSelectedDate.map((event) => <EventRow key={event.id} event={event} />)
          )}
        </View>
      )}
    </View>
  );
}
