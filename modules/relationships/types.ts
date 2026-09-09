export type RelationType = 'family' | 'partner' | 'friend' | 'other';

export const RELATION_OPTIONS: RelationType[] = ['family', 'partner', 'friend', 'other'];

export function relationLabel(relation: RelationType): string {
  switch (relation) {
    case 'family':
      return 'Family';
    case 'partner':
      return 'Partner';
    case 'friend':
      return 'Friend';
    default:
      return 'Other';
  }
}

export type RelationshipPerson = {
  id: number;
  name: string;
  relation: RelationType;
  created_at: string;
  updated_at: string;
};

export type CheckinMode = 'call' | 'video_call' | 'in_person' | 'message' | 'quality_time' | 'other';

export const CHECKIN_MODE_OPTIONS: CheckinMode[] = ['call', 'video_call', 'in_person', 'message', 'quality_time', 'other'];

export function checkinModeLabel(mode: CheckinMode): string {
  switch (mode) {
    case 'call':
      return 'Call';
    case 'video_call':
      return 'Video call';
    case 'in_person':
      return 'In person';
    case 'message':
      return 'Message';
    case 'quality_time':
      return 'Quality time';
    default:
      return 'Other';
  }
}

export type RelationshipCheckin = {
  id: number;
  person_id: number;
  note: string | null;
  /** Null for check-ins logged before this was tracked (see db/schema.ts's v65 migration) — never
   * backfilled, just treated as "mode unknown" wherever it's displayed. */
  mode: CheckinMode | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
};
