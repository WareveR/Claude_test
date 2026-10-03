# Deploying and rolling back

Production is the `family-calendar` Worker on David's Cloudflare account, answering on
https://calendario.phinest.org (and family-calendar.david-a-pires.workers.dev). It uses the D1
database `family-calendar` (EU jurisdiction) and the R2 buckets `family-calendar-images` and
`family-calendar-backups`. Secrets: `SETUP_CODE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` and, for email, `RESEND_API_KEY` (see [email.md](email.md)).

For now deploys are run by hand from a computer with the repo checked out and
`npx wrangler login` done. Deploying on every merge to `main` is still to do (#53).

## Deploy

```sh
git pull
npm ci
npx wrangler d1 time-travel info family-calendar   # note the bookmark it prints
npx wrangler d1 migrations apply family-calendar --remote
npm run build
npx wrangler deploy
```

Note the bookmark before applying migrations: it is the point to go back to if a migration goes
wrong. Migrations are additive only (v1 spec), so the previous version of the app keeps working
against the migrated database.

Then open the app and check it loads. Installed apps update themselves on their next open.

## Roll back the app

When a new version misbehaves but the data is fine:

```sh
npx wrangler deployments list     # find the previous version id
npx wrangler rollback <version-id>
```

This only swaps the Worker code and assets; the database is untouched.

## Roll back the database too

When a migration or a bug damaged data, restore the database to the bookmark noted before the
deploy, then roll the app back as above:

```sh
npx wrangler d1 time-travel restore family-calendar --bookmark=<bookmark>
```

Everything written after the bookmark is lost; tell the Family first. For older copies, see
[restore.md](restore.md).
