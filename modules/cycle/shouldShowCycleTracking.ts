import type { Gender } from '@/modules/profile/types';

/** Gender is asked once during onboarding but starts out unanswered — anyone who hasn't set it
 * yet keeps seeing Cycle Tracking exactly as before this field existed; it only hides once
 * someone explicitly sets a gender other than female, so no existing user loses access to their
 * own tracked data just by this field being introduced. */
export function shouldShowCycleTracking(gender: Gender | null): boolean {
  return gender == null || gender === 'female';
}
