import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';

import { auth, firestore } from '@/firebase/config';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';
export type ReportTargetType = 'post' | 'user';

/** Write-only report doc — same "submitted once, never read back by the app itself" shape as
 * `feedback/{feedbackId}` (see firestore.rules): an admin reviews these from the Firebase console
 * or a separate admin tool, never this client. */
export function useReportContent() {
  const [submitting, setSubmitting] = useState(false);

  const report = async (targetType: ReportTargetType, targetId: string, reason: ReportReason) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'reports'), {
        reporterUid: uid,
        targetType,
        targetId,
        reason,
        createdAt: serverTimestamp(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return { report, submitting };
}
