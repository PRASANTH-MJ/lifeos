export type Family = {
  ownerUid: string;
  plan: string;
  subscriptionStatus: string;
  maxMembers: number;
  memberUids: string[];
};

export type FamilyInviteStatus = 'pending' | 'accepted' | 'declined';

export type FamilyInvite = {
  id: string;
  ownerUid: string;
  invitedUid: string;
  status: FamilyInviteStatus;
};
