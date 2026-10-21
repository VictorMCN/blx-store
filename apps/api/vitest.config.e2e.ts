import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);

loadEnv({
  path: resolve(root, '.env'),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'E2E tests require DATABASE_URL.',
  );
}

const url = new URL(databaseUrl);

const localHosts = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const database = decodeURIComponent(
  url.pathname.slice(1),
);

if (
  !['postgresql:', 'postgres:'].includes(url.protocol) ||
  !localHosts.has(url.hostname.toLowerCase()) ||
  !['blx_store', 'blx_store_test'].includes(database)
) {
  throw new Error(
    'E2E tests must use the local BLX Store test database.',
  );
}

url.pathname = '/blx_store_test';

process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'test';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
