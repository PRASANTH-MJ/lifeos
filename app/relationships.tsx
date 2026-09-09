import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, IconBadge, LoadingState, ReminderCard, ScreenContainer, TextField, showAlert } from '@/components';
import { useModuleReminders } from '@/modules/reminders';
import {
  CHECKIN_MODE_OPTIONS,
  RELATION_OPTIONS,
  checkinModeLabel,
  daysSince,
  relationLabel,
  useRelationshipCheckins,
  useRelationshipPeople,
  type CheckinMode,
  type RelationshipCheckin,
  type RelationshipPerson,
  type RelationType,
} from '@/modules/relationships';
import { useAppTheme } from '@/theme';

function lastContactLabel(personId: number, checkins: RelationshipCheckin[]): string {
  const forPerson = checkins.filter((c) => c.person_id === personId);
  if (forPerson.length === 0) return 'No check-ins yet';
  const mostRecent = forPerson.reduce((latest, c) => (c.created_at > latest.created_at ? c : latest), forPerson[0]);
  const days = daysSince(mostRecent.created_at, new Date());
  const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
  const modeLabel = mostRecent.mode ? checkinModeLabel(mostRecent.mode) : null;
  const duration = mostRecent.duration_minutes != null ? `${mostRecent.duration_minutes} min` : null;
  const detail = [modeLabel, duration].filter(Boolean).join(' · ');
  return detail ? `${when} · ${detail}` : `Checked in ${when}`;
}

/** A person's reminder settings — its own component (not inlined in PersonRow) because
 * useModuleReminders is a hook and can't be called once per row inside a .map(). Reuses the exact
 * same generic module-reminder system (module_reminders table, Notification/Alarm types, daily or
 * specific-days schedules) every other module in the app already uses — keyed by a per-person
 * module key so each person gets their own independent reminder(s). */
function PersonReminderSection({ person, accentColor }: { person: RelationshipPerson; accentColor: string }) {
  const { reminders, save, addReminder, removeReminder } = useModuleReminders(
    `relationship-${person.id}`,
    `Check in with ${person.name}`,
    `It's been a while since you connected with ${person.name} — reach out today.`
  );

  return (
    <View style={{ gap: 8 }}>
      {reminders.length > 0 ? (
        reminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            state={reminder}
            onSave={(next) => save(reminder.id, next)}
            onRemove={() => removeReminder(reminder.id)}
            color={accentColor}
          />
        ))
      ) : (
        <Pressable onPress={addReminder}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
            <Ionicons name="notifications-outline" size={16} color={accentColor} />
            <Text style={{ flex: 1, color: accentColor, fontSize: 13, fontWeight: '600' }}>Remind me to check in</Text>
          </Card>
        </Pressable>
      )}
    </View>
  );
}

function PersonRow({
  person,
  checkins,
  onLogCheckin,
  onRemove,
}: {
  person: RelationshipPerson;
  checkins: RelationshipCheckin[];
  onLogCheckin: (mode: CheckinMode, durationMinutes: number | null) => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [mode, setMode] = useState<CheckinMode>('call');
  const [duration, setDuration] = useState('');

  const onConfirm = () => {
    const parsed = duration.trim() ? Math.round(Number(duration)) : null;
    onLogCheckin(mode, parsed && parsed > 0 ? parsed : null);
    setShowCheckinForm(false);
    setMode('call');
    setDuration('');
  };

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <IconBadge name="heart" color={theme.colors.danger} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            {person.name}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {relationLabel(person.relation)} · {lastContactLabel(person.id, checkins)}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
        </Pressable>
      </View>

      {showCheckinForm ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            How did you connect?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CHECKIN_MODE_OPTIONS.map((option) => (
              <Chip key={option} label={checkinModeLabel(option)} selected={mode === option} onPress={() => setMode(option)} />
            ))}
          </View>
          <TextField label="How long (minutes, optional)" placeholder="e.g. 20" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="ghost" onPress={() => setShowCheckinForm(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Log check-in" onPress={onConfirm} />
            </View>
          </View>
        </View>
      ) : (
        <Button label="Check in" variant="secondary" onPress={() => setShowCheckinForm(true)} />
      )}

      <Pressable onPress={() => setShowReminder((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
          Reminder
        </Text>
        <Ionicons name={showReminder ? 'chevron-up' : 'chevron-down'} size={12} color={theme.colors.textTertiary} />
      </Pressable>
      {showReminder ? <PersonReminderSection person={person} accentColor={theme.colors.danger} /> : null}
    </Card>
  );
}

/** People you're tracking (family/partner/friend/other) plus a quick check-in log against each —
 * feeds the Life Scoreboard's Relationship score (see modules/scoreboard/useLifeScore.ts and
 * modules/relationships/relationshipScore.ts). A check-in captures how you connected (call, video,
 * in person, message, quality time) and roughly how long, both optional-feeling but quick to fill
 * via chips/a single number field — the point is lowering the bar to log real contact, not turning
 * this into another journal. */
export default function RelationshipsScreen() {
  const theme = useAppTheme();
  const { people, loading: peopleLoading, addPerson, removePerson } = useRelationshipPeople();
  const { checkins, loading: checkinsLoading, addCheckin } = useRelationshipCheckins();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<RelationType>('family');
  const [saving, setSaving] = useState(false);

  const loading = peopleLoading || checkinsLoading;

  const onAddPerson = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await addPerson({ name: name.trim(), relation });
    setSaving(false);
    setName('');
    setRelation('family');
    setShowAddForm(false);
  };

  const onRemove = (person: RelationshipPerson) => {
    showAlert('Remove this person?', `${person.name} will no longer be tracked.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePerson(person.id) },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Relationships', headerShown: true }} />
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Add the people who matter most, then check in whenever you connect — a call, a visit, a real conversation. Your Relationship score
          reflects how recently and how often you've checked in with each of them.
        </Text>

        {showAddForm ? (
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <TextField label="Name" placeholder="e.g. Mom, Alex..." value={name} onChangeText={setName} autoFocus />
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Relation
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {RELATION_OPTIONS.map((option) => (
                  <Chip key={option} label={relationLabel(option)} selected={relation === option} onPress={() => setRelation(option)} />
                ))}
              </View>
            </View>
            <Button label="Add person" onPress={onAddPerson} disabled={!name.trim()} loading={saving} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowAddForm(false)} />
          </Card>
        ) : (
          <Button label="+ Add person" variant="secondary" onPress={() => setShowAddForm(true)} />
        )}

        {loading ? (
          <LoadingState />
        ) : people.length === 0 ? (
          <EmptyState icon="heart-outline" title="No one added yet" subtitle="Add family, a partner, or friends to start tracking." />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {people.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                checkins={checkins}
                onLogCheckin={(mode, durationMinutes) => addCheckin(person.id, { mode, durationMinutes })}
                onRemove={() => onRemove(person)}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
