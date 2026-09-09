import { SYNC_TABLES, syncConfigFor } from '@/modules/sync/syncSchema';

describe('syncConfigFor', () => {
  test('finds a table config by name', () => {
    expect(syncConfigFor('habits')?.table).toBe('habits');
  });

  test('returns undefined for a table not in the sync list (e.g. user_profile, deliberately excluded)', () => {
    expect(syncConfigFor('user_profile')).toBeUndefined();
    expect(syncConfigFor('not_a_real_table')).toBeUndefined();
  });
});

// mergeBatch/mergeRemoteRecord (syncEngine.ts) apply an initial pull in SYNC_TABLES order so a
// foreign-key lookup always has something to find — that invariant only holds if every
// referencesTable genuinely appears earlier in the array than the table that points to it. This
// is exactly the kind of thing a future edit (adding a table, reordering for readability) could
// silently break without this test catching it.
test('every foreign key points to a table listed earlier in SYNC_TABLES', () => {
  const indexOf = new Map(SYNC_TABLES.map((config, index) => [config.table, index]));

  for (const config of SYNC_TABLES) {
    for (const fk of config.foreignKeys ?? []) {
      const targetIndex = indexOf.get(fk.referencesTable);
      expect(targetIndex).toBeDefined();
      // A self-reference (e.g. tasks.parent_task_id -> tasks) is allowed — mergeBatch's deferred
      // retry pass exists specifically to cover that case — but any OTHER table's foreign key
      // must reference something strictly earlier.
      if (fk.referencesTable !== config.table) {
        expect(targetIndex!).toBeLessThan(indexOf.get(config.table)!);
      }
    }
  }
});

test('every table name is unique', () => {
  const names = SYNC_TABLES.map((c) => c.table);
  expect(new Set(names).size).toBe(names.length);
});
