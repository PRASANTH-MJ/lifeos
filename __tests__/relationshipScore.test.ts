import { computeRelationshipScore, daysSince, perPersonScore } from '@/modules/relationships/relationshipScore';
import type { RelationshipCheckin, RelationshipPerson } from '@/modules/relationships/types';

const person = (id: number, overrides: Partial<RelationshipPerson> = {}): RelationshipPerson => ({
  id,
  name: `Person ${id}`,
  relation: 'friend',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

const checkin = (personId: number, createdAt: string, overrides: Partial<RelationshipCheckin> = {}): RelationshipCheckin => ({
  id: Math.random(),
  person_id: personId,
  note: null,
  mode: 'call',
  duration_minutes: null,
  created_at: createdAt,
  updated_at: createdAt,
  ...overrides,
});

describe('daysSince', () => {
  test('computes whole days elapsed', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    expect(daysSince('2026-09-05T12:00:00.000Z', now)).toBe(5);
  });

  test('never returns negative for a future timestamp', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    expect(daysSince('2026-09-15T00:00:00.000Z', now)).toBe(0);
  });
});

describe('perPersonScore', () => {
  test('scores 100 within the full-marks window', () => {
    expect(perPersonScore(0)).toBe(100);
    expect(perPersonScore(3)).toBe(100);
  });

  test('scores 0 at or beyond the zero-score threshold', () => {
    expect(perPersonScore(30)).toBe(0);
    expect(perPersonScore(90)).toBe(0);
  });

  test('decays linearly between the two thresholds', () => {
    // Halfway between day 3 and day 30 (27-day span) is day 16.5 -> ~50.
    expect(perPersonScore(16.5)).toBe(50);
  });
});

describe('computeRelationshipScore', () => {
  const now = new Date('2026-09-10T00:00:00.000Z');

  test('returns a neutral 50 when no people have been added at all', () => {
    expect(computeRelationshipScore([], [], now)).toBe(50);
  });

  test('treats a person with zero check-ins as maximally overdue, not skipped', () => {
    expect(computeRelationshipScore([person(1)], [], now)).toBe(0);
  });

  test('averages each person\'s own most-recent-check-in score', () => {
    const people = [person(1), person(2)];
    const checkins = [
      checkin(1, '2026-09-09T00:00:00.000Z'), // 1 day ago -> 100
      checkin(2, '2026-08-11T00:00:00.000Z'), // 30 days ago -> 0
    ];
    expect(computeRelationshipScore(people, checkins, now)).toBe(50);
  });

  test('only counts each person\'s most recent check-in, not every one', () => {
    const people = [person(1)];
    const checkins = [
      checkin(1, '2026-08-01T00:00:00.000Z'), // stale
      checkin(1, '2026-09-09T00:00:00.000Z'), // recent -> should win
    ];
    expect(computeRelationshipScore(people, checkins, now)).toBe(100);
  });

  test('ignores check-ins for people no longer in the list', () => {
    const people = [person(1)];
    const checkins = [checkin(99, '2026-09-09T00:00:00.000Z')];
    expect(computeRelationshipScore(people, checkins, now)).toBe(0);
  });
});
