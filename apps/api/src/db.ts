import knex, { Knex } from 'knex';
import { config } from './config';

export const db: Knex = knex({
  client: 'pg',
  connection: config.dbUrl,
  pool: {
    min: 1,
    max: 10
  }
});
