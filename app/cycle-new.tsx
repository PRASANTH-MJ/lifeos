import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Card, Chip, TextField } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { useCycleLogs, type FlowLevel } from '@/modules/cycle';
import { Scale5Picker } from '@/modules/journal';
import { useAppTheme } from '@/theme';

const FLOW_OPTIONS: { key: FlowLevel | null; label: string }[] = [
  { key: null, label: 'None' },
  { key: 'light', label: 'Light' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'Heavy' },
];

const SYMPTOM_OPTIONS = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Acne', 'Tender breasts', 'Backache', 'Nausea'];

export default function CycleNewEntryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { logs, upsertLog } = useCycleLogs();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const logDate = dateParam ?? todayKey();
  const existing = logs.find((l) => l.date === logDate);

  const [flow, setFlow] = useState<FlowLevel | null>(existing?.flow ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [saving, setSaving] = useState(false);

  const toggleSymptom = (symptom: string) => {
    setSymptoms((current) => (current.includes(symptom) ? current.filter((s) => s !== symptom) : [...current, symptom]));
  };

  const onSave = async () => {
    setSaving(true);
    await upsertLog(logDate, { flow, symptoms, notes: notes.trim() || null, mood, energy });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}>
      {logDate !== todayKey() ? (
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          Log for {formatDisplayDate(logDate)}
        </Text>
      ) : null}

      <Card tier="panel" style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Flow</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {FLOW_OPTIONS.map((option) => (
            <Chip key={option.label} label={option.label} selected={flow === option.key} onPress={() => setFlow(option.key)} />
          ))}
        </View>
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          Symptoms
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {SYMPTOM_OPTIONS.map((symptom) => (
            <Chip key={symptom} label={symptom} selected={symptoms.includes(symptom)} onPress={() => toggleSymptom(symptom)} />
          ))}
        </View>
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Mood</Text>
        <Scale5Picker value={mood} onChange={setMood} endLabels={['Low', 'Great']} />
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Energy</Text>
        <Scale5Picker value={energy} onChange={setEnergy} endLabels={['Drained', 'Energized']} />
      </Card>

      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything else worth remembering" multiline />

      <Button label="Save" onPress={onSave} loading={saving} glow />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
