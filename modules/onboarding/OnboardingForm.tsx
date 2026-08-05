import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, TextField } from '@/components';
import { useAppTheme } from '@/theme';
import { FINANCIAL_GOAL_LABELS, HEALTH_GOAL_LABELS, INCOME_BRACKET_LABELS } from './types';
import type { FinancialGoal, HealthGoal, IncomeBracket, UserDetails, UserDetailsInput } from './types';

const HEALTH_GOALS: HealthGoal[] = ['lose_weight', 'maintain', 'gain_weight', 'build_muscle'];
const INCOME_BRACKETS: IncomeBracket[] = ['under_25k', '25k_50k', '50k_1l', '1l_plus'];
const FINANCIAL_GOALS: FinancialGoal[] = ['save_more', 'pay_off_debt', 'invest', 'emergency_fund', 'other'];

/** A birthdate is typically decades in the past, so a calendar-grid picker (built for "next
 * Tuesday"-scale date entry elsewhere in this app) would mean clicking "previous month" dozens
 * of times — plain day/month/year fields are the standard, much less painful pattern here. */
function parseDob(dateOfBirth: string | null): { day: string; month: string; year: string } {
  if (!dateOfBirth) return { day: '', month: '', year: '' };
  const [year, month, day] = dateOfBirth.split('-');
  return { day: day ?? '', month: month ?? '', year: year ?? '' };
}

function composeDob(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(y) || y < 1900 || y > currentYear) return null;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Reject impossible calendar dates (e.g. day 31 in April) by round-tripping through Date.
  const check = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.getUTCDate() !== d || check.getUTCMonth() + 1 !== m) return null;
  return iso;
}

type Props = {
  initial: UserDetails | null;
  name: string;
  email: string | null;
  onSave: (input: UserDetailsInput) => Promise<void>;
  onSaveName: (name: string) => void;
  onSkip?: () => void;
  saveLabel?: string;
};

function SectionLabel({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        color: theme.colors.textTertiary,
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.weight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
      {label}
    </Text>
  );
}

/** Shared field content for both the first-run onboarding gate (app/_layout.tsx) and the
 * "edit personal details" screen reachable later from Settings — same form, different chrome
 * (the gate adds a Skip option and full-screen wrapper; Settings wraps it in ScreenContainer). */
export function OnboardingForm({ initial, name, email, onSave, onSaveName, onSkip, saveLabel = 'Save' }: Props) {
  const theme = useAppTheme();
  const [nameDraft, setNameDraft] = useState(name);
  const [phoneText, setPhoneText] = useState(initial?.phoneNumber ?? '');
  const initialDob = parseDob(initial?.dateOfBirth ?? null);
  const [dobDay, setDobDay] = useState(initialDob.day);
  const [dobMonth, setDobMonth] = useState(initialDob.month);
  const [dobYear, setDobYear] = useState(initialDob.year);
  const [dobError, setDobError] = useState(false);
  const [heightText, setHeightText] = useState(initial?.heightCm != null ? String(initial.heightCm) : '');
  const [weightText, setWeightText] = useState(initial?.weightKg != null ? String(initial.weightKg) : '');
  const [healthGoal, setHealthGoal] = useState<HealthGoal | null>(initial?.healthGoal ?? null);
  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket | null>(initial?.incomeBracket ?? null);
  const [financialGoal, setFinancialGoal] = useState<FinancialGoal | null>(initial?.financialGoal ?? null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    const anyDobEntered = dobDay.trim() || dobMonth.trim() || dobYear.trim();
    const dateOfBirth = anyDobEntered ? composeDob(dobDay, dobMonth, dobYear) : null;
    if (anyDobEntered && !dateOfBirth) {
      setDobError(true);
      return;
    }
    setDobError(false);

    setSaving(true);
    try {
      if (nameDraft.trim() !== name) onSaveName(nameDraft.trim());
      await onSave({
        phoneNumber: phoneText.trim() ? phoneText.trim() : undefined,
        dateOfBirth: dateOfBirth ?? undefined,
        heightCm: heightText.trim() ? Number(heightText) : undefined,
        weightKg: weightText.trim() ? Number(weightText) : undefined,
        healthGoal: healthGoal ?? undefined,
        incomeBracket: incomeBracket ?? undefined,
        financialGoal: financialGoal ?? undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card style={{ gap: theme.spacing.md }}>
        <SectionLabel label="Contact Details" />

        <TextField label="Name" placeholder="Your name" value={nameDraft} onChangeText={setNameDraft} />
        <TextField label="Mobile number" placeholder="e.g. 98765 43210" value={phoneText} onChangeText={setPhoneText} keyboardType="phone-pad" />

        {email ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Email
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{email}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: theme.spacing.md }}>
        <SectionLabel label="About you" />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Date of birth
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="DD" value={dobDay} onChangeText={setDobDay} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField placeholder="MM" value={dobMonth} onChangeText={setDobMonth} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 1.4 }}>
              <TextField placeholder="YYYY" value={dobYear} onChangeText={setDobYear} keyboardType="number-pad" maxLength={4} />
            </View>
          </View>
          {dobError ? (
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs }}>
              That date doesn't look right — check the day, month, and year.
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField label="Height (cm)" placeholder="e.g. 170" value={heightText} onChangeText={setHeightText} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Weight (kg)" placeholder="e.g. 65" value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Health goal
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {HEALTH_GOALS.map((goal) => (
              <Chip key={goal} label={HEALTH_GOAL_LABELS[goal]} selected={healthGoal === goal} onPress={() => setHealthGoal(goal)} />
            ))}
          </View>
        </View>
      </Card>

      <Card style={{ gap: theme.spacing.md }}>
        <SectionLabel label="Finance" />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Monthly income
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {INCOME_BRACKETS.map((bracket) => (
              <Chip
                key={bracket}
                label={INCOME_BRACKET_LABELS[bracket]}
                selected={incomeBracket === bracket}
                onPress={() => setIncomeBracket(bracket)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Financial goal
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {FINANCIAL_GOALS.map((goal) => (
              <Chip
                key={goal}
                label={FINANCIAL_GOAL_LABELS[goal]}
                selected={financialGoal === goal}
                onPress={() => setFinancialGoal(goal)}
              />
            ))}
          </View>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label={saveLabel} onPress={onSubmit} loading={saving} variant="gradient" />
        {onSkip ? <Button label="Skip for now" variant="ghost" onPress={onSkip} /> : null}
      </View>
    </View>
  );
}
