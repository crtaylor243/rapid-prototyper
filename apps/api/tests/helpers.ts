import path from 'node:path';
import { db } from '../src/db';

export async function resetDatabase() {
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const seedsDir = path.resolve(__dirname, '../seeds');
  await db.migrate.latest({ directory: migrationsDir });
  await db.seed.run({ directory: seedsDir });
}
