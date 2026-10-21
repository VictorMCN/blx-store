import { config } from 'dotenv';
import { Client } from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(
  new URL('../', import.meta.url),
);

config({
  path: join(root, '.env'),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. E2E tests were not started.',
  );
}

const source = new URL(databaseUrl);

const localHosts = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const sourceDatabase = decodeURIComponent(
  source.pathname.slice(1),
);

if (
  !['postgresql:', 'postgres:'].includes(source.protocol) ||
  !localHosts.has(source.hostname.toLowerCase()) ||
  !['blx_store', 'blx_store_test'].includes(sourceDatabase)
) {
  throw new Error(
    'Refusing E2E setup: only local BLX Store databases are allowed.',
  );
}

const testUrl = new URL(source);
testUrl.pathname = '/blx_store_test';

const adminUrl = new URL(source);
adminUrl.pathname = '/blx_store';

const client = new Client({
  connectionString: adminUrl.toString(),
});

try {
  await client.connect();

  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    ['blx_store_test'],
  );

  if (existing.rowCount === 0) {
    console.log('Creating isolated database: blx_store_test');

    await client.query(
      'CREATE DATABASE "blx_store_test"',
    );
  } else {
    console.log('Test database already exists.');
  }
} finally {
  await client.end();
}

console.log('Applying migrations to blx_store_test...');

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'deploy'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      NODE_ENV: 'test',
    },
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(
    'Test database migrations failed. E2E tests were not started.',
  );
}

console.log('E2E database ready: blx_store_test');
