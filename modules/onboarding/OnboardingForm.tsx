import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Button, Card, Chip, GlowSurface, TextField, TimeField } from '@/components';
import type { Gender } from '@/modules/profile/types';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';
import { getOnboardingRecommendations } from './recommendations';
import { FINANCIAL_GOAL_LABELS, FOOD_STYLE_LABELS, HEALTH_GOAL_LABELS, INCOME_BRACKET_LABELS } from './types';
import type { FinancialGoal, FoodStyle, HealthGoal, IncomeBracket, UserDetails, UserDetailsInput } from './types';

const HEALTH_GOALS: HealthGoal[] = ['lose_weight', 'maintain', 'gain_weight', 'build_muscle'];
const INCOME_BRACKETS: IncomeBracket[] = ['under_25k', '25k_50k', '50k_1l', '1l_plus'];
const FINANCIAL_GOALS: FinancialGoal[] = ['save_more', 'pay_off_debt', 'invest', 'emergency_fund', 'other'];
const FOOD_STYLES: FoodStyle[] = ['vegetarian', 'non_vegetarian', 'vegan', 'eggetarian', 'other'];
const GENDERS: Gender[] = ['female', 'male', 'other'];
const GENDER_LABELS: Record<Gender, string> = { female: 'Female', male: 'Male', other: 'Other' };

const STEP_TITLES = ['Personal', 'Fitness', 'Finance', 'Goals'];

const STEP_HERO: { icon: keyof typeof Ionicons.glyphMap; colorKey: 'primary' | 'success' | 'warning' | 'moduleHabits'; headline: string; subtext: string }[] = [
  { icon: 'sparkles-outline', colorKey: 'primary', headline: "Let's get to know you", subtext: 'A few details help us personalize your whole experience.' },
  { icon: 'fitness-outline', colorKey: 'success', headline: 'Fuel your goals', subtext: 'Small daily habits compound into big results.' },
  { icon: 'wallet-outline', colorKey: 'warning', headline: 'Take control of your money', subtext: 'Awareness today builds freedom tomorrow.' },
  { icon: 'flag-outline', colorKey: 'moduleHabits', headline: 'Set your sights', subtext: 'Every big win starts with one clear goal.' },
];

/** A large icon-in-a-glow hero above each step's fields — gives the wizard a bit of personality
 * and momentum instead of reading as a flat data-entry form. Icon-based rather than a photo asset
 * so it stays crisp at any size, needs no bundled image, and matches the app's existing
 * icon-badge visual language (IconBadge, StatCard, etc.) in both light and dark theme. */
function StepHero({ step }: { step: number }) {
  const theme = useAppTheme();
  const hero = STEP_HERO[step];
  const color = theme.colors[hero.colorKey];
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs, paddingBottom: theme.spacing.xs }}>
      <GlowSurface color={color} intensity="lg" borderRadius={999}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: withAlpha(color, 0.16),
            borderWidth: 1,
            borderColor: withAlpha(color, 0.32),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={hero.icon} size={30} color={color} />
        </View>
      </GlowSurface>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
        {hero.headline}
      </Text>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>{hero.subtext}</Text>
    </View>
  );
}

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
  gender: Gender | null;
  avatarUri: string | null;
  onSave: (input: UserDetailsInput) => Promise<void>;
  onSaveName: (name: string) => void;
  onGenderChange: (gender: Gender | null) => void;
  onAvatarChange: (avatarUri: string | null) => void;
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

/** A dotted step tracker ("Step 2 of 4 — Fitness") — the same four-step order this form always
 * walks in (Personal → Fitness → Finance → Goals), so returning users always land where they
 * left off relative to a recognizable structure rather than one long scroll. */
function StepTracker({ step }: { step: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {STEP_TITLES.map((title, i) => (
          <View
            key={title}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= step ? theme.colors.primary : theme.colors.border,
            }}
          />
        ))}
      </View>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
        STEP {step + 1} OF {STEP_TITLES.length} · {STEP_TITLES[step].toUpperCase()}
      </Text>
    </View>
  );
}

/** Shared field content for both the first-run onboarding gate (app/_layout.tsx) and the
 * "edit personal details" screen reachable later from Settings (app/onboarding.tsx) — same form,
 * different chrome. A 4-step wizard (Personal → Fitness → Finance → Goals) instead of one long
 * scroll, ending on a short "recommended for you" screen built from whatever Goals were picked
 * (see recommendations.ts) — nothing is saved until that final screen's "Get started", so
 * stepping back and forth costs nothing. */
export function OnboardingForm({
  initial,
  name,
  email,
  gender,
  avatarUri,
  onSave,
  onSaveName,
  onGenderChange,
  onAvatarChange,
  onSkip,
  saveLabel = 'Save',
}: Props) {
  const theme = useAppTheme();
  const [step, setStep] = useState(0);
  const [showRecommendations, setShowRecommendations] = useState(false);

  const [nameDraft, setNameDraft] = useState(name);
  const [genderDraft, setGenderDraft] = useState<Gender | null>(gender);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(avatarUri);
  const [phoneText, setPhoneText] = useState(initial?.phoneNumber ?? '');
  const [countryText, setCountryText] = useState(initial?.country ?? '');
  const [stateText, setStateText] = useState(initial?.state ?? '');
  const initialDob = parseDob(initial?.dateOfBirth ?? null);
  const [dobDay, setDobDay] = useState(initialDob.day);
  const [dobMonth, setDobMonth] = useState(initialDob.month);
  const [dobYear, setDobYear] = useState(initialDob.year);
  const [dobError, setDobError] = useState(false);

  const [heightText, setHeightText] = useState(initial?.heightCm != null ? String(initial.heightCm) : '');
  const [weightText, setWeightText] = useState(initial?.weightKg != null ? String(initial.weightKg) : '');
  const [avgSleepTime, setAvgSleepTime] = useState<string | null>(initial?.avgSleepTime ?? null);
  const [avgWakeTime, setAvgWakeTime] = useState<string | null>(initial?.avgWakeTime ?? null);
  const [waterText, setWaterText] = useState(initial?.avgWaterIntakeMl != null ? String(initial.avgWaterIntakeMl) : '');
  const [foodStyle, setFoodStyle] = useState<FoodStyle | null>(initial?.foodStyle ?? null);

  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket | null>(initial?.incomeBracket ?? null);

  const [healthGoal, setHealthGoal] = useState<HealthGoal | null>(initial?.healthGoal ?? null);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(initial?.financialGoals ?? []);

  const [saving, setSaving] = useState(false);

  const toggleFinancialGoal = (goal: FinancialGoal) => {
    setFinancialGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
  };

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setAvatarDraft(result.assets[0].uri);
  };

  const validateDob = (): boolean => {
    const anyDobEntered = dobDay.trim() || dobMonth.trim() || dobYear.trim();
    if (!anyDobEntered) {
      setDobError(false);
      return true;
    }
    const ok = composeDob(dobDay, dobMonth, dobYear) != null;
    setDobError(!ok);
    return ok;
  };

  const goNext = () => {
    if (step === 0 && !validateDob()) return;
    if (step < STEP_TITLES.length - 1) {
      setStep(step + 1);
      return;
    }
    setShowRecommendations(true);
  };

  const goBack = () => {
    if (showRecommendations) {
      setShowRecommendations(false);
      return;
    }
    if (step > 0) setStep(step - 1);
  };

  const onFinish = async () => {
    setSaving(true);
    try {
      if (nameDraft.trim() !== name) onSaveName(nameDraft.trim());
      if (genderDraft !== gender) onGenderChange(genderDraft);
      if (avatarDraft !== avatarUri) onAvatarChange(avatarDraft);
      const anyDobEntered = dobDay.trim() || dobMonth.trim() || dobYear.trim();
      const dateOfBirth = anyDobEntered ? composeDob(dobDay, dobMonth, dobYear) : null;
      await onSave({
        phoneNumber: phoneText.trim() ? phoneText.trim() : undefined,
        country: countryText.trim() ? countryText.trim() : undefined,
        state: stateText.trim() ? stateText.trim() : undefined,
        dateOfBirth: dateOfBirth ?? undefined,
        heightCm: heightText.trim() ? Number(heightText) : undefined,
        weightKg: weightText.trim() ? Number(weightText) : undefined,
        avgSleepTime: avgSleepTime ?? undefined,
        avgWakeTime: avgWakeTime ?? undefined,
        avgWaterIntakeMl: waterText.trim() ? Number(waterText) : undefined,
        foodStyle: foodStyle ?? undefined,
        healthGoal: healthGoal ?? undefined,
        incomeBracket: incomeBracket ?? undefined,
        financialGoals,
      });
    } finally {
      setSaving(false);
    }
  };

  if (showRecommendations) {
    const recommendations = getOnboardingRecommendations(healthGoal, financialGoals);
    return (
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <GlowSurface color={theme.colors.success} intensity="lg" borderRadius={999}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: withAlpha(theme.colors.success, 0.16),
                borderWidth: 1,
                borderColor: withAlpha(theme.colors.success, 0.32),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="rocket-outline" size={30} color={theme.colors.success} />
            </View>
          </GlowSurface>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            Recommended for you
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
            Based on what you picked — a quick tour of where to start.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {recommendations.map((rec) => (
            <Card key={rec.key} tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                  {rec.title.slice(0, 1)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  {rec.title}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{rec.subtitle}</Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={saveLabel === 'Save' ? 'Save changes' : 'Get started'} onPress={onFinish} loading={saving} variant="gradient" />
          <Button label="Back" variant="ghost" onPress={goBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepTracker step={step} />
      <StepHero step={step} />

      {step === 0 ? (
        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel label="Personal" />

          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Pressable onPress={onPickPhoto} accessibilityLabel="Add a profile photo">
              <Avatar url={avatarDraft} size="lg" color={theme.colors.primary} />
            </Pressable>
            <Pressable onPress={onPickPhoto}>
              <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                {avatarDraft ? 'Change photo' : 'Add a photo'}
              </Text>
            </Pressable>
          </View>

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

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Gender
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {GENDERS.map((option) => (
                <Chip
                  key={option}
                  label={GENDER_LABELS[option]}
                  selected={genderDraft === option}
                  onPress={() => setGenderDraft(genderDraft === option ? null : option)}
                />
              ))}
            </View>
          </View>

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
              <TextField label="Country" placeholder="e.g. India" value={countryText} onChangeText={setCountryText} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="State" placeholder="e.g. Karnataka" value={stateText} onChangeText={setStateText} />
            </View>
          </View>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel label="Fitness" />

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField label="Height (cm)" placeholder="e.g. 170" value={heightText} onChangeText={setHeightText} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Weight (kg)" placeholder="e.g. 65" value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" />
            </View>
          </View>

          {/* Stacked, not side-by-side — each TimeField is its own hh:MM + AM/PM + Clear row,
              which doesn't fit two-across in a half-width column without squeezing/misaligning
              on a phone-width screen. */}
          <TimeField label="Avg. sleep time" value={avgSleepTime} onChange={setAvgSleepTime} />
          <TimeField label="Avg. wake time" value={avgWakeTime} onChange={setAvgWakeTime} />

          <TextField
            label="Avg. water intake (ml/day)"
            placeholder="e.g. 2000"
            value={waterText}
            onChangeText={setWaterText}
            keyboardType="number-pad"
          />

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Food style
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {FOOD_STYLES.map((option) => (
                <Chip key={option} label={FOOD_STYLE_LABELS[option]} selected={foodStyle === option} onPress={() => setFoodStyle(option)} />
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      {step === 2 ? (
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
        </Card>
      ) : null}

      {step === 3 ? (
        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel label="Goals" />

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

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Financial goal
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {FINANCIAL_GOALS.map((goal) => (
                <Chip
                  key={goal}
                  label={FINANCIAL_GOAL_LABELS[goal]}
                  selected={financialGoals.includes(goal)}
                  onPress={() => toggleFinancialGoal(goal)}
                />
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {step > 0 ? (
          <View style={{ flex: 1 }}>
            <Button label="Back" variant="secondary" onPress={goBack} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button label={step < STEP_TITLES.length - 1 ? 'Next' : 'See recommendations'} onPress={goNext} variant="gradient" />
        </View>
      </View>
      {step === 0 && onSkip ? <Button label="Skip for now" variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}
