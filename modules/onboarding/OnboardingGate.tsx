import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { Gender } from '@/modules/profile/types';
import { OnboardingForm } from './OnboardingForm';
import type { UserDetails, UserDetailsInput } from './types';

type Props = {
  details: UserDetails | null;
  name: string;
  email: string | null;
  gender: Gender | null;
  avatarUri: string | null;
  onSave: (input: UserDetailsInput) => Promise<void>;
  onSaveName: (name: string) => void;
  onGenderChange: (gender: Gender | null) => void;
  onAvatarChange: (avatarUri: string | null) => void;
  onSkip: () => Promise<void>;
};

/** Shown once, right after signup/PIN unlock, before the main tabs — optional and skippable
 * (both Save and Skip mark onboarding_done so this never blocks a returning user). Fields stay
 * editable later from Settings via app/onboarding.tsx. Takes `details`/`onSave`/`onSkip` as props
 * from RootNavigation's single useUserDetails() call rather than calling the hook itself here —
 * two independent hook instances would each hold their own stale state, so a save from this
 * screen would never be seen by the gate check in app/_layout.tsx that's deciding whether to
 * keep rendering this screen (same reason PinLockScreen takes verifyPin as a prop). */
export function OnboardingGate({ details, name, email, gender, avatarUri, onSave, onSaveName, onGenderChange, onAvatarChange, onSkip }: Props) {
  const theme = useAppTheme();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            Tell us about yourself
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            This helps personalize Flowsy. Skip anytime — you can fill this in later from Settings.
          </Text>
        </View>

        <OnboardingForm
          initial={details}
          name={name}
          email={email}
          gender={gender}
          avatarUri={avatarUri}
          saveLabel="Save & continue"
          onSave={onSave}
          onSaveName={onSaveName}
          onGenderChange={onGenderChange}
          onAvatarChange={onAvatarChange}
          onSkip={onSkip}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
