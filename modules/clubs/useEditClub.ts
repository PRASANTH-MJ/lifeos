import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';

import { firestore } from '@/firebase/config';
import { uploadClubPhoto } from './clubPhotoSync';
import type { ClubCategory, ClubPrivacy } from './types';

/** Edits a club's name/categories/privacy (direct client write — firestore.rules restricts this
 * to the club's own FULL admins, not sub-admins, and to just these fields) and/or its photo. Same
 * "owner-checked simple doc, no callable needed" shape as userPublicProfiles' self-update. */
export function useEditClub() {
  const [submitting, setSubmitting] = useState(false);

  const updateClub = async (clubId: string, values: { name: string; categories: ClubCategory[]; privacy: ClubPrivacy }): Promise<void> => {
    setSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'clubs', clubId), { name: values.name, categories: values.categories, privacy: values.privacy });
    } finally {
      setSubmitting(false);
    }
  };

  const updatePhoto = async (clubId: string, localUri: string): Promise<string> => {
    setSubmitting(true);
    try {
      return await uploadClubPhoto(clubId, localUri);
    } finally {
      setSubmitting(false);
    }
  };

  return { updateClub, updatePhoto, submitting };
}
