import { SQLiteProvider } from 'expo-sqlite';
import type { ReactNode } from 'react';

import { DATABASE_NAME, migrateDbIfNeeded } from './schema';

export function StorageProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
      {children}
    </SQLiteProvider>
  );
}
