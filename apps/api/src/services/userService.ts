import { db } from '../db';
import { User } from '../types';

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const user = await db<User>('users').where({ email }).first();
  return user;
}
