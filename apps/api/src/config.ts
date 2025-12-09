import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'SESSION_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[config] Missing environment variable ${key}. Using fallback value where possible.`);
  }
});

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  dbUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/rapid_prototype',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret',
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'changeme'
};
