# Development Guide

## Requirements

- Node.js 24
- npm
- PostgreSQL
- Git

GitHub Codespaces can be used as a development environment.

## Installation

From the repository root:

```bash
npm ci
```

## Environment Configuration

Review the provided template:

```bash
cat .env.example
```

Configure the variables required for the selected environment.

Important configuration names include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Database connection |
| `DATABASE_URL_UNPOOLED` | Direct database connection when required |
| `APP_URL` | Application origin |
| `API_ORIGIN` | Frontend API rewrite destination |
| `STRIPE_SECRET_KEY` | Stripe server-side access |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `EMAIL_DELIVERY_ENABLED` | Outbound email feature flag |
| `RESEND_API_KEY` | Resend API access |
| `EMAIL_FROM` | Authorized email sender |

Additional variables may be required by individual integrations. Check `.env.example` and the application source.

Never commit actual credentials, database URLs containing passwords, or provider tokens.

## Database

The repository contains Prisma schema and migrations under `prisma/`.

After configuring the correct database connection, existing migrations can be applied with:

```bash
npx prisma migrate deploy
```

The repository includes a development seed script:

```bash
node prisma/seed.mjs
```

Run seed operations only against a database intended for demonstration data.

## Running Applications

Start the API:

```bash
npm run start:dev --workspace=@blx-store/api
```

Start the web application in another terminal:

```bash
npm run dev --workspace=@blx-store/web
```

Default local development ports are 3001 for the API and 3000 for the web application.

## Frontend Checks

```bash
npm run lint --workspace=@blx-store/web
npm run build --workspace=@blx-store/web
```

## Backend Checks

```bash
npm run lint --workspace=@blx-store/api
npm run test --workspace=@blx-store/api
npm run build --workspace=@blx-store/api
```

## End-to-End Tests

```bash
npm run test:e2e --workspace=@blx-store/api
```

The test command prepares and uses database-dependent test infrastructure.

Use only an isolated, disposable test database. Do not point destructive test setup or cleanup at production Neon data.

## Git Workflow

Development changes are made on feature, fix, chore, or documentation branches.

Use Conventional Commits, for example:

```text
feat: add customer feature
fix: resolve payment issue
docs: update deployment guide
chore: improve project configuration
```

Changes should be reviewed and tested before merging into the main branch.
