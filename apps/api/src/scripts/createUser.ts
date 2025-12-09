import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail } from '../repositories/userRepository';
import { db } from '../db';
import { logInfo, logError } from '../logger';

interface CliArgs {
  email?: string;
  password?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i += 1) {
    const [key, value] = args[i].split('=');
    if (key === '--email') {
      result.email = value ?? args[i + 1];
      if (!args[i].includes('=') && args[i + 1]) {
        i += 1;
      }
    }
    if (key === '--password') {
      result.password = value ?? args[i + 1];
      if (!args[i].includes('=') && args[i + 1]) {
        i += 1;
      }
    }
  }

  return result;
}

async function main() {
  const { email, password } = parseArgs();
  try {
    assert(email, 'An --email argument is required');
    assert(password, 'A --password argument is required');

    const existing = await findUserByEmail(email);
    if (existing) {
      throw new Error(`User with email ${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({ email, passwordHash });
    logInfo('Created user via CLI', { email: user.email, id: user.id });
  } catch (error) {
    logError('Failed to create user', { error });
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
