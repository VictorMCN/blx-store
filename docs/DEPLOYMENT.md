# Deployment and Operations

## Hosting

BLX Store uses Vercel Services and Neon PostgreSQL.

The deployment configuration is defined in the root `vercel.json`.

## Services

| Service | Type | Responsibility |
| --- | --- | --- |
| `web` | Next.js | Storefront and admin interface |
| `api` | Container | NestJS HTTP API |
| `jobs` | Daemon | Scheduled background processing |

The worker runs as a dedicated daemon rather than inside the production HTTP application.

## Database

Neon PostgreSQL hosts application data.

Prisma manages the database schema and migrations.

Database migrations must be reviewed and applied separately from application deployment.

## Environment Variables

Environment variables are configured in the Vercel project settings.

Production secrets must use the appropriate secure configuration.

Never place credentials inside `vercel.json`, source code, README files, or Git history.

## Stripe

The current demonstration uses Stripe Sandbox credentials.

Stripe webhook requests are signed and validated by the NestJS API.

The protected Vercel deployment uses a controlled automation bypass for the webhook destination.

Both the bypass token and Stripe webhook signing secret must remain private.

## Worker

The worker configuration is located in `vercel.json`.

It currently specifies one instance in the `iad1` region.

The worker processes:

- Reservation expiration
- ERP order synchronization
- ERP inventory synchronization

The daemon may incur continuous resource usage.

Before changing worker instance counts, review database operations, Stripe reconciliation, and job concurrency.

## Operational Checks

Useful read-only commands:

```bash
npx vercel daemons inspect jobs
npx vercel daemons instances list jobs
npx vercel logs --since 30m
```

For application health checks:

```text
/api/health/live
/api/health/ready
```

## Deployment Process

Production deployments should be validated before promotion.

Example:

```bash
npx vercel deploy --prod --skip-domain --logs
```

After verifying the resulting deployment:

```bash
npx vercel promote <deployment-url>
```

Promotion should be performed deliberately.

A background daemon may affect the shared production database when its configuration becomes active.

## Current Demonstration Settings

- Stripe Sandbox is used for payment testing.
- Vercel Authentication protects the deployed demonstration.
- The ERP provider is a mock implementation.
- Outbound transactional email is disabled.
- The worker is configured for one production instance.

## Production Launch Limitations

This project is not documented as a fully launched commercial store.

Public operation would require additional review of:

- Payment and operational configurations
- Production credentials
- Domain and email authentication
- Security controls
- Monitoring and incident response
- Data protection and privacy requirements
- Performance and cost limits

See [Security](SECURITY.md).
