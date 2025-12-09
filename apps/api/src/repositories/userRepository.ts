import { db } from '../db';
import { User } from '../types';

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const user = await db<User>('users').where({ email }).first();
  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const user = await db<User>('users').where({ id }).first();
  return user;
}

export async function createUser(params: { email: string; passwordHash: string }): Promise<User> {
  const [user] = await db<User>('users')
    .insert({
      email: params.email,
      password_hash: params.passwordHash
    })
    .returning('*');

  return user;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await db<User>('users')
    .where({ id: userId })
    .update({
      last_login_at: db.fn.now(),
      updated_at: db.fn.now()
    });
}
