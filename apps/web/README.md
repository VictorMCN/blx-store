# BLX Store — Frontend

The customer-facing and administrative frontend of BLX Store.

## Stack

- Next.js 16
- React
- TypeScript
- App Router

## Responsibilities

The frontend provides:

- Product browsing and product detail pages
- Shopping cart and checkout
- Customer registration and login
- Account, address, and order interfaces
- Administrative dashboards
- ERP and monitoring interfaces
- AI assistant interface

## Development

From the repository root:

```bash
npm ci
npm run dev --workspace=@blx-store/web
```

Local frontend development normally uses port 3000.

The frontend communicates with the NestJS API through the `/api` route prefix.

The `API_ORIGIN` environment variable is used by the Next.js configuration to control the API rewrite target.

## Quality Checks

```bash
npm run lint --workspace=@blx-store/web
npm run build --workspace=@blx-store/web
```

## Assets

Static assets are located in `public/`.

The application icon is defined in:

```text
src/app/icon.svg
```

## Security

The frontend includes request-origin protection for unsafe API requests.

Production API access should use the intended application origin. Changes to deployment domains or `APP_URL` must be reviewed alongside the origin protection configuration.

## Related Documentation

- [Main README](../../README.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Development](../../docs/DEVELOPMENT.md)
