import { useRouter } from 'expo-router';

import { LoadingState, ScreenContainer } from '@/components';
import { OnboardingForm, useUserDetails } from '@/modules/onboarding';

export default function EditPersonalDetailsScreen() {
  const router = useRouter();
  const { details, loading, save } = useUserDetails();

  if (loading || !details) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <OnboardingForm
        initial={details}
        saveLabel="Save changes"
        onSave={async (input) => {
          await save(input);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}
