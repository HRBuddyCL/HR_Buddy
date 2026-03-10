process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUNTIME_ENV = process.env.RUNTIME_ENV || process.env.NODE_ENV;

// Keep e2e config validation stable in CI where .env may not exist.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://hrbuddy:hrbuddy_pass@localhost:5433/hr_buddy?schema=public';
