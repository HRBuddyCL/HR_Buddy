#!/usr/bin/env node

const { spawn } = require('node:child_process');

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();
const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
const selectedDatabaseUrl = directDatabaseUrl || runtimeDatabaseUrl;

if (!selectedDatabaseUrl) {
  console.error('[prisma:migrate:deploy] Missing DATABASE_URL and DIRECT_DATABASE_URL.');
  process.exit(1);
}

if (!selectedDatabaseUrl.startsWith('postgresql://') && !selectedDatabaseUrl.startsWith('postgres://')) {
  console.error('[prisma:migrate:deploy] Invalid database URL scheme. Expected postgresql:// or postgres://');
  process.exit(1);
}

if (directDatabaseUrl) {
  console.log('[prisma:migrate:deploy] Using DIRECT_DATABASE_URL for migrations.');
} else {
  console.log('[prisma:migrate:deploy] DIRECT_DATABASE_URL is not set. Falling back to DATABASE_URL.');
}

const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DATABASE_URL: selectedDatabaseUrl,
  },
});

child.on('exit', (code, signal) => {
  if (typeof code === 'number') {
    process.exit(code);
  }

  if (signal) {
    console.error(`[prisma:migrate:deploy] Process terminated by signal: ${signal}`);
  }

  process.exit(1);
});

child.on('error', (error) => {
  console.error('[prisma:migrate:deploy] Failed to start prisma migrate deploy:', error.message);
  process.exit(1);
});
