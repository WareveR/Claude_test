# The test copy

Besides production there is a test copy of the app: the `family-calendar-testes` Worker on
https://calendario-testes.phinest.org (and family-calendar-testes.david-a-pires.workers.dev). It
has its own D1 database `family-calendar-testes` (EU jurisdiction), its own R2 buckets
`family-calendar-testes-images` and `family-calendar-testes-backups`, and its own secrets, so
nothing done there reaches the Family's data. It is the `testes` environment in `wrangler.jsonc`.

The test copy shows a "Testes" tag in the top bar, installs as "Family Calendar (testes)", and has
the tools for testing and diagnosing the app (Settings › App version › Tests and diagnostics),
which production hides (`src/app/environment.ts`).

## Deploy

Every push to a pull request is deployed there by `.github/workflows/testes.yml`, before it is
merged; production still deploys only from `main` ([deploy.md](deploy.md)). Pull requests share
the one test copy, so it runs whichever was pushed last. To put `main` back on it, run the
"Testes" workflow by hand from Actions.

The first run creates the database and buckets. Each run applies the pull request's migrations
to the test database, so a pull request that is later dropped can leave its tables behind there;
that never affects production.

It uses the same `CLOUDFLARE_API_TOKEN` as production, which needs permission to create D1
databases and R2 buckets (D1 Edit and Workers R2 Storage Edit) and to add the custom domain on
`phinest.org`.

## Secrets

The workflow adds any that are missing and never prints them:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: a key pair of its own, made on the first run.
- `VAPID_SUBJECT`: `mailto:calendario@phinest.org`.
- `SETUP_CODE`: copied from the repository secret `TESTES_SETUP_CODE`, which only David sets
  (GitHub › Settings › Secrets and variables › Actions). Without it the test copy can't be set
  up. To change it later, run `npx wrangler secret put SETUP_CODE --name family-calendar-testes`.

There is no `RESEND_API_KEY`, so its emails go through Cloudflare Email Service.

## Start over

To empty the test copy, delete its database in the Cloudflare dashboard (D1 ›
`family-calendar-testes`) and run the "Testes" workflow: it makes a new, empty one.
