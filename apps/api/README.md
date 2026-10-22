# BLX Store — Backend

The NestJS API and background processing application for BLX Store.

## Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma 7
- Stripe
- Resend integration
- Vitest

## API Responsibilities

The backend provides:

- Authentication and session management
- Customer profiles and addresses
- Product catalog and inventory queries
- Cart and order management
- Stripe PaymentIntent creation
- Stripe webhook processing
- Administrative operations
- ERP synchronization
- Operational monitoring
- AI assistant endpoints

## Main API Routes

| Route | Purpose |
| --- | --- |
| `/api/health/live` | Liveness |
| `/api/health/ready` | Readiness |
| `/api/catalog/products` | Product catalog |
| `/api/catalog/categories` | Categories |
| `/api/auth` | Authentication |
| `/api/account` | Customer account |
| `/api/cart` | Shopping cart |
| `/api/orders` | Orders and payment creation |
| `/api/payments/stripe/webhook` | Stripe webhook |
| `/api/admin` | Administrative APIs |
| `/api/admin/erp` | ERP administration |
| `/api/admin/monitoring` | Operational monitoring |
| `/api/assistant/chat` | AI assistant |

Individual endpoints may require authentication or administrative authorization.

## Development

From the repository root:

```bash
npm ci
npm run start:dev --workspace=@blx-store/api
```

Local API development normally uses port 3001.

## Tests

```bash
npm run lint --workspace=@blx-store/api
npm run test --workspace=@blx-store/api
npm run build --workspace=@blx-store/api
```

End-to-end tests:

```bash
npm run test:e2e --workspace=@blx-store/api
```

Only run end-to-end database tests against a dedicated test database.

## Background Worker

The worker entrypoint is:

```text
src/worker.ts
```

The worker schedules:

- Payment reservation expiration
- Paid order synchronization to the mock ERP
- Inventory synchronization to the mock ERP

The production HTTP application disables cron jobs to prevent duplicate scheduled execution.

## Email

Transactional email delivery is implemented using Resend.

Outbound delivery remains intentionally disabled in the demonstration environment with:

```text
EMAIL_DELIVERY_ENABLED=false
```

Sending requires valid Resend credentials and an authorized sender.

## Related Documentation

- [Main README](../../README.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Security](../../docs/SECURITY.md)
