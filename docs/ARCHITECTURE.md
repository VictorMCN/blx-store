# System Architecture

## Overview

BLX Store separates the user interface, HTTP API, database, external integrations, and scheduled processing into distinct responsibilities.

```text
                         Customer / Admin
                                |
                                v
                       Next.js Storefront
                                |
                             /api/*
                                |
                                v
                         NestJS API
                         /    |    \
                        /     |     \
                       v      v      v
                   Neon     Stripe   AI Provider
                 PostgreSQL    |
                       ^       |
                       |       v
                       |   Stripe Webhook
                       |       |
                       +-------+
                       |
                Background Worker
                       |
                  Mock ERP Tables
```

## Frontend

The Next.js application is responsible for customer and administrative interfaces.

It communicates with the NestJS API through same-origin API paths.

## Backend

The NestJS application is organized into feature modules for authentication, catalog, accounts, cart, orders, payments, administration, ERP, monitoring, and AI assistance.

Prisma provides database access.

## Database

PostgreSQL is used for persistent application data.

Important domains include:

- Users and sessions
- Customer profiles and addresses
- Products, categories, and inventory
- Shopping carts
- Orders and order items
- Payments
- ERP synchronization records

Database migrations are managed using Prisma.

## Payment Lifecycle

1. The customer creates an order.
2. Inventory is reserved for the order.
3. The API creates or retrieves a Stripe PaymentIntent.
4. Stripe processes the payment in the configured environment.
5. Stripe sends a signed webhook to the API.
6. The backend validates the signature and processes the event.
7. The order and payment state are reconciled.

The implemented webhook handles successful, failed, and canceled payment intents.

The demonstration environment uses Stripe Sandbox.

## Reservation Expiration

The dedicated worker checks unpaid orders with expired reservations.

Before releasing inventory, it verifies relevant payment states with Stripe.

The expiration process uses database transactions and conditional updates to reduce the risk of inconsistent order or inventory state.

## ERP Integration

The ERP integration currently uses a mock provider.

Paid orders are exported to mock ERP storage.

Inventory snapshots are written to the mock ERP inventory table.

This integration demonstrates a synchronization workflow without depending on a commercial ERP service.

## Scheduled Jobs

The worker uses NestJS scheduling for three recurring operations:

| Job | Responsibility |
| --- | --- |
| `expire-payment-reservations` | Expire eligible unpaid reservations |
| `sync-orders-to-erp` | Export eligible paid orders |
| `sync-inventory-to-erp` | Synchronize stock snapshots |

The configured interval is one minute.

## Deployment

Vercel Services hosts the web and API services.

A separate Vercel Daemon runs the worker.

Neon hosts the PostgreSQL database.

See [Deployment](DEPLOYMENT.md) for configuration and operational notes.
