import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { LoadingState, ScreenContainer } from '@/components';
import { HabitForm, useHabitDetail, useHabits } from '@/modules/habits';

export default function HabitFormScreen() {
  const router = useRouter();
  const { habitId } = useLocalSearchParams<{ habitId?: string }>();
  const isEdit = Boolean(habitId);

  const { createHabit } = useHabits();
  const { habit: existingHabit, loading: loadingExisting, updateHabit } = useHabitDetail(Number(habitId ?? 0));

  if (isEdit && (loadingExisting || !existingHabit)) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: isEdit ? 'Edit Habit' : 'New Habit' }} />
      <HabitForm
        habit={isEdit ? existingHabit : null}
        autoFocusName={!isEdit}
        submitLabel={isEdit ? 'Save changes' : 'Save habit'}
        onSave={async (values) => {
          if (isEdit) {
            await updateHabit(values);
          } else {
            await createHabit(values);
          }
          router.back();
        }}
      />
    </ScreenContainer>
  );
}
