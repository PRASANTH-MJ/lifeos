import { clampScore } from '@/modules/scoreboard/scoring';
import type { RelationshipCheckin, RelationshipPerson } from './types';

const DAYS_FOR_FULL_SCORE = 3;
const DAYS_FOR_ZERO_SCORE = 30;
const NEVER_CHECKED_IN_DAYS = DAYS_FOR_ZERO_SCORE;

export function daysSince(dateIso: string, now: Date): number {
  const diffMs = now.getTime() - new Date(dateIso).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

/** A single person's score from how long it's been since their most recent check-in — full marks
 * within a few days of contact, decaying linearly to 0 by a month of silence. Deliberately not a
 * cliff-edge: falling behind by a day or two barely moves the number, matching how a real
 * relationship doesn't sour overnight. */
export function perPersonScore(daysSinceLastContact: number): number {
  if (daysSinceLastContact <= DAYS_FOR_FULL_SCORE) return 100;
  if (daysSinceLastContact >= DAYS_FOR_ZERO_SCORE) return 0;
  const span = DAYS_FOR_ZERO_SCORE - DAYS_FOR_FULL_SCORE;
  const elapsed = daysSinceLastContact - DAYS_FOR_FULL_SCORE;
  return clampScore(100 - (elapsed / span) * 100);
}

/**
 * Overall Relationship score: the average of each added person's own recency score (see
 * perPersonScore above) — a person with no check-in yet is treated as if it's been
 * NEVER_CHECKED_IN_DAYS (scores 0), not skipped, since "added someone and never followed up"
 * should visibly pull the score down rather than being silently ignored.
 *
 * Returns a fixed neutral 50 when no people have been added at all — same "nothing to measure
 * yet" convention every other Life Scoreboard area follows (see useLifeScore.ts) — rather than 0,
 * which would misleadingly read as "your relationships are in crisis" when really nobody's been
 * added to track in the first place.
 */
export function computeRelationshipScore(
  people: RelationshipPerson[],
  checkins: RelationshipCheckin[],
  now: Date = new Date()
): number {
  if (people.length === 0) return 50;

  const lastCheckinByPerson = new Map<number, string>();
  for (const checkin of checkins) {
    const existing = lastCheckinByPerson.get(checkin.person_id);
    if (!existing || checkin.created_at > existing) {
      lastCheckinByPerson.set(checkin.person_id, checkin.created_at);
    }
  }

  const scores = people.map((person) => {
    const lastCheckin = lastCheckinByPerson.get(person.id);
    const days = lastCheckin ? daysSince(lastCheckin, now) : NEVER_CHECKED_IN_DAYS;
    return perPersonScore(days);
  });

  return clampScore(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}
