import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Chip } from '@/components';
import { useAppTheme } from '@/theme';
import { MoodPicker } from './MoodPicker';
import { Scale5Picker } from './Scale5Picker';
import { FIRST_REACHED_FOR_OPTIONS, SLEEP_BUCKETS, type JournalCheckin, type MorningCheckinInput, type NightCheckinInput } from './types';

type Props = {
  visible: boolean;
  type: 'morning' | 'night';
  existing: JournalCheckin | null;
  onClose: () => void;
  onSaveMorning: (values: MorningCheckinInput) => void;
  onSaveNight: (values: NightCheckinInput) => void;
};

/** One bottom sheet for both check-in types — which fields render depends on `type`. Modeled on
 * LogPastEntryModal's sheet structure. */
export function CheckinSheet({ visible, type, existing, onClose, onSaveMorning, onSaveNight }: Props) {
  const theme = useAppTheme();
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [sleepBucket, setSleepBucket] = useState(existing?.sleep_bucket ?? null);
  const [stress, setStress] = useState<number | null>(existing?.stress ?? null);
  const [firstReachedFor, setFirstReachedFor] = useState(existing?.first_reached_for ?? null);
  const [productivity, setProductivity] = useState<number | null>(existing?.productivity ?? null);
  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);

  const onSave = () => {
    if (type === 'morning') {
      onSaveMorning({ energy, sleepBucket, stress, firstReachedFor, mood });
    } else {
      onSaveNight({ productivity, mood });
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <ScrollView
          style={{ maxHeight: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl }}
          contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {type === 'morning' ? 'Morning check-in' : 'Night check-in'}
          </Text>

          {type === 'morning' ? (
            <>
              <Field label="How's your energy this morning?">
                <Scale5Picker value={energy} onChange={setEnergy} endLabels={['Drained', 'Energized']} />
              </Field>

              <Field label="How many hours did you sleep?">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {SLEEP_BUCKETS.map((bucket) => (
                    <Chip
                      key={bucket.key}
                      label={bucket.label}
                      selected={sleepBucket === bucket.key}
                      color={theme.colors.moduleJournal}
                      mutedColor={theme.colors.moduleJournalMuted}
                      onPress={() => setSleepBucket(bucket.key)}
                    />
                  ))}
                </View>
              </Field>

              <Field label="Stress level right now?">
                <Scale5Picker value={stress} onChange={setStress} endLabels={['Calm', 'Stressed']} />
              </Field>

              <Field label="First thing you reached for?">
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  {FIRST_REACHED_FOR_OPTIONS.map((option) => {
                    const selected = firstReachedFor === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setFirstReachedFor(option.key)}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          gap: 4,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.radius.md,
                          borderWidth: 1,
                          borderColor: selected ? theme.colors.moduleJournal : theme.colors.border,
                          backgroundColor: selected ? theme.colors.moduleJournalMuted : 'transparent',
                        }}>
                        <Ionicons
                          name={option.icon as keyof typeof Ionicons.glyphMap}
                          size={18}
                          color={selected ? theme.colors.moduleJournal : theme.colors.textSecondary}
                        />
                        <Text style={{ fontSize: theme.typography.size.xs, color: selected ? theme.colors.moduleJournal : theme.colors.textTertiary }}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Feeling grateful this morning?">
                <MoodPicker value={mood} onChange={setMood} />
              </Field>
            </>
          ) : (
            <>
              <Field label="How productive did you feel today?">
                <Scale5Picker value={productivity} onChange={setProductivity} endLabels={['Not much', 'Very']} />
              </Field>

              <Field label="How was today overall?">
                <MoodPicker value={mood} onChange={setMood} />
              </Field>
            </>
          )}

          <Button label="Save" onPress={onSave} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>{label}</Text>
      {children}
    </View>
  );
}
