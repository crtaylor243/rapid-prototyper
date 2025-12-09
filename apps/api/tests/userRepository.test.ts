import assert from 'node:assert/strict';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db } from '../src/db';
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin
} from '../src/repositories/userRepository';

async function resetDatabase() {
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const seedsDir = path.resolve(__dirname, '../seeds');
  await db.migrate.latest({ directory: migrationsDir });
  await db.seed.run({ directory: seedsDir });
}

async function shouldFindSeedUser() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  const admin = await findUserByEmail(adminEmail);
  assert(admin, 'Seeded admin user should exist');

  const passwordsMatch = await bcrypt.compare(adminPassword, admin.password_hash);
  assert(passwordsMatch, 'Seeded admin password hash should match provided ADMIN_PASSWORD');
}

async function shouldCreateUserAndStoreLastLogin() {
  const uniqueEmail = `integration+${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('TestPassword!234', 12);

  const created = await createUser({ email: uniqueEmail, passwordHash });
  assert.equal(created.email, uniqueEmail, 'Created user email should match input');
  assert.notEqual(created.password_hash, 'TestPassword!234', 'Password should be hashed');

  await updateLastLogin(created.id);

  const fetched = await findUserById(created.id);
  assert(fetched?.last_login_at, 'Last login timestamp should be present after update');
}

async function run() {
  await resetDatabase();
  await shouldFindSeedUser();
  await shouldCreateUserAndStoreLastLogin();
  console.log('Auth integration tests passed');
}

run()
  .catch((error) => {
    console.error('Auth integration tests failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
