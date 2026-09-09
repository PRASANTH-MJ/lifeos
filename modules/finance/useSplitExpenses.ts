import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

export type SplitExpense = {
  id: string;
  /** The person who owes the money. */
  fromUid: string;
  /** The person who paid and is owed the money. */
  toUid: string;
  amount: number;
  description: string;
  transactionId: string | null;
  settled: boolean;
  createdAt: number | null;
};

function toSplitExpense(id: string, data: Record<string, unknown>): SplitExpense {
  return {
    id,
    fromUid: data.fromUid as string,
    toUid: data.toUid as string,
    amount: (data.amount as number) ?? 0,
    description: (data.description as string) ?? '',
    transactionId: (data.transactionId as string | undefined) ?? null,
    settled: !!data.settled,
    createdAt: (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null,
  };
}

/** A lightweight shared-expense ledger against a mutual follower — not a payments feature, just a
 * "who owes who" reminder (see firestore.rules' splitExpenses match). Two listeners (I'm the
 * debtor / I'm the creditor) merged client-side, same "no OR-query, two where()s merged" shape as
 * useFollowList/useSuggestedUsers use elsewhere for the follow graph. The doc is only ever created
 * by the person who paid (toUid must be the creator, enforced in rules), so a split always starts
 * out as "I paid, they owe me their share" from the creator's side. */
export function useSplitExpenses() {
  const uid = auth.currentUser?.uid;
  const [iOwe, setIOwe] = useState<SplitExpense[]>([]);
  const [owedToMe, setOwedToMe] = useState<SplitExpense[]>([]);
  const [loadingOwe, setLoadingOwe] = useState(true);
  const [loadingOwed, setLoadingOwed] = useState(true);

  useEffect(() => {
    if (!uid) {
      setIOwe([]);
      setLoadingOwe(false);
      return;
    }
    setLoadingOwe(true);
    const q = query(collection(firestore, 'splitExpenses'), where('fromUid', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        setIOwe(snapshot.docs.map((d) => toSplitExpense(d.id, d.data())));
        setLoadingOwe(false);
      },
      () => setLoadingOwe(false)
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setOwedToMe([]);
      setLoadingOwed(false);
      return;
    }
    setLoadingOwed(true);
    const q = query(collection(firestore, 'splitExpenses'), where('toUid', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        setOwedToMe(snapshot.docs.map((d) => toSplitExpense(d.id, d.data())));
        setLoadingOwed(false);
      },
      () => setLoadingOwed(false)
    );
  }, [uid]);

  const createSplit = async (values: { friendUid: string; amount: number; description: string; transactionId?: string | null }) => {
    if (!uid) return;
    await addDoc(collection(firestore, 'splitExpenses'), {
      fromUid: values.friendUid,
      toUid: uid,
      amount: values.amount,
      description: values.description,
      transactionId: values.transactionId ?? null,
      settled: false,
      createdAt: serverTimestamp(),
    });
  };

  const setSettled = async (splitId: string, settled: boolean) => {
    await updateDoc(doc(firestore, 'splitExpenses', splitId), { settled });
  };

  return {
    iOwe,
    owedToMe,
    loading: loadingOwe || loadingOwed,
    createSplit,
    setSettled,
  };
}
