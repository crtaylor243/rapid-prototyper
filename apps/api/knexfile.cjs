const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/rapid_prototype';

module.exports = {
  development: {
    client: 'pg',
    connection: dbUrl,
    migrations: {
      directory: path.resolve(__dirname, './migrations'),
      extension: 'js'
    },
    seeds: {
      directory: path.resolve(__dirname, './seeds'),
      extension: 'js'
    }
  }
};
