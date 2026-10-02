# Family Calendar

A private, installable web app for one Family's shared calendar. The v1 spec is [docs/spec/v1.md](docs/spec/v1.md); terms are defined in [CONTEXT.md](CONTEXT.md) and decisions in [docs/adr/](docs/adr/).

## Develop

```sh
npm ci
npm run db:migrate:local   # apply migrations to the local D1
npm run dev                # Vite + the Worker in workerd, at http://localhost:5173
```

## Check

```sh
npm run typecheck && npm run lint && npm run format:check
npm test                   # calendar core (Node) and API (Workers pool, local D1)
npm run test:e2e           # Playwright smoke tests
```

## Database changes

Edit `src/worker/db/schema.ts`, then `npm run db:generate` to write the next numbered migration into `migrations/`. Migrations are additive only.
