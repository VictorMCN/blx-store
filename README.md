<p align="center">
  <img src="apps/web/public/blx-logo.png" alt="BLX Store Logo" width="220" />
</p>

# BLX Store

A full-stack e-commerce portfolio project focused on secure payments, AI-assisted shopping, administration, inventory management, and production-inspired engineering practices.

BLX Store demonstrates how a modern online storefront can connect customer-facing experiences with backend services, payment processing, persistent storage, operational monitoring, and background jobs.

> **Project status:** Portfolio and technical demonstration. The deployed environment is protected and is not intended for public commercial transactions.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React, TypeScript |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 |
| Payments | Stripe |
| Transactional email | Resend integration |
| Background processing | NestJS scheduled jobs |
| ERP integration | Mock ERP provider |
| Deployment | Vercel Services and Daemons |
| Runtime | Node.js 24 |
| Testing | Vitest and end-to-end tests |

## Features

### Storefront

- Product catalog and categories
- Product details and inventory availability
- Shopping cart
- Customer registration and authentication
- Customer profiles and delivery addresses
- Checkout and order tracking
- Stripe payment integration
- AI shopping assistant integration

### Administration

- Administrative access control
- Dashboard and operational information
- Order management
- Inventory visibility
- Payment monitoring
- ERP synchronization monitoring

### Background Processing

A dedicated worker handles scheduled operations, including:

- Expiration of unpaid order reservations
- Reconciliation checks against Stripe
- Release of expired inventory reservations
- Export of paid orders to the mock ERP
- Inventory synchronization with the mock ERP

## Architecture

The application is organized as a monorepo:

```text
blx-store/
├── apps/
│   ├── web/                 Next.js storefront
│   └── api/                 NestJS backend and worker
├── docs/                    Project documentation
├── packages/                Shared package workspace
├── prisma/                  Database schema and migrations
├── scripts/                 Development and test utilities
├── docker-compose.yml
├── Dockerfile.api.vercel
├── vercel.json
└── README.md
```

The deployed infrastructure uses separate web, API, and background worker services.

For more information, see [Architecture](docs/ARCHITECTURE.md).

## Getting Started

Requirements:

- Node.js 24
- npm
- PostgreSQL
- Environment variables configured for the selected environment

Install dependencies:

```bash
npm ci
```

Review the environment template:

```bash
cat .env.example
```

Database configuration, local development, and testing instructions are documented in [Development Guide](docs/DEVELOPMENT.md).

## Testing

The project includes unit and end-to-end testing.

```bash
npm run lint --workspace=@blx-store/web
npm run lint --workspace=@blx-store/api
npm run test --workspace=@blx-store/api
npm run build --workspace=@blx-store/web
npm run build --workspace=@blx-store/api
```

End-to-end tests require an appropriately configured, disposable test database.

## Deployment

BLX Store has been deployed using Vercel Services, with PostgreSQL hosted on Neon.

The deployment includes:

- Next.js web service
- Containerized NestJS API
- Dedicated background worker daemon
- Production environment configuration
- Stripe Sandbox payment integration

Deployment configuration and operational notes are available in [Deployment Guide](docs/DEPLOYMENT.md).

## Integration Status

| Integration | Status |
| --- | --- |
| Neon PostgreSQL | Integrated |
| Stripe Sandbox | Integrated and manually tested |
| Stripe webhooks | Success and failure deliveries tested |
| Background worker | Active and manually observed |
| Mock ERP | Integrated |
| Resend | Implemented; outbound email disabled |
| AI assistant | Implemented; runtime availability depends on provider configuration |

All payment testing described in this repository uses Stripe test credentials.

## Documentation

- [Frontend](apps/web/README.md)
- [Backend](apps/api/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and Testing](docs/DEVELOPMENT.md)
- [Deployment and Operations](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)

## Project Scope

BLX Store is an independent portfolio project built for software engineering practice and demonstration.

It is not presented as a fully launched commercial store. Some integrations use sandbox services, and certain production operations remain intentionally disabled pending additional configuration and validation.

## License

No license is granted unless a separate license file is added to this repository.

---

<p align="center">
  Developed by <strong>Victor Macene</strong>
</p>
