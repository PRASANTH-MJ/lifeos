import { useRouter } from 'expo-router';

import { LoadingState, ScreenContainer } from '@/components';
import { useAuth } from '@/modules/auth';
import { OnboardingForm, useUserDetails } from '@/modules/onboarding';
import { useProfile } from '@/modules/profile';

export default function EditPersonalDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, setName } = useProfile();
  const { details, loading, save } = useUserDetails();

  if (loading || !details || !profile) {
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
        name={profile.name ?? ''}
        email={user?.email ?? null}
        saveLabel="Save changes"
        onSaveName={setName}
        onSave={async (input) => {
          await save(input);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}
