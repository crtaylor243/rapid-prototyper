const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  await knex('users').del();

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await knex('users').insert({
    email: adminEmail,
    password_hash: passwordHash
  });

  console.log(JSON.stringify({ level: 'info', message: 'Seeded admin user', email: adminEmail }));
};
