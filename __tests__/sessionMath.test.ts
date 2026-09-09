import { computeSessionVolume, formatClock } from '@/modules/workout/sessionMath';

describe('formatClock', () => {
  test('formats as M:SS with no hour segment', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3661)).toBe('61:01');
  });
});

describe('computeSessionVolume', () => {
  test('sums weight x reps across only the done sets', () => {
    const exercises = [
      {
        sets: [
          { reps: '10', weightKg: '20', done: true },
          { reps: '8', weightKg: '25', done: false },
        ],
      },
      { sets: [{ reps: '5', weightKg: '100', done: true }] },
    ];
    // done sets only: 10*20 + 5*100 = 200 + 500 = 700
    expect(computeSessionVolume(exercises)).toBe(700);
  });

  test('blank reps/weight on a done set count as 0, not NaN', () => {
    const exercises = [{ sets: [{ reps: '', weightKg: '', done: true }] }];
    expect(computeSessionVolume(exercises)).toBe(0);
  });

  test('no exercises is zero volume', () => {
    expect(computeSessionVolume([])).toBe(0);
  });
});
