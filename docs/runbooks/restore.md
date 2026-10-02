# Restoring the database

This runbook replaces the **whole** database with an earlier copy. Use it when something was deleted or changed by mistake and can't be fixed in the app. There is no import in the app (v1 spec, "Backup, Export and restore"), so a restore is always done by hand, from a computer with the repo checked out and `npx wrangler login` done.

Pick the newest source that still has the lost data:

| What was lost                      | Use                                | Section |
| ---------------------------------- | ---------------------------------- | ------- |
| Within the last 7 days             | D1 Time Travel                     | A       |
| 8 days to 12 months ago            | A nightly or monthly Backup in R2  | B       |
| Cloudflare itself is gone or empty | The latest full Export (ZIP)       | C       |

Every restore loses whatever changed **after** the copy was taken. Tell the Family first and agree on the moment to go back to.

## 0. Before any restore: mark "now"

So the restore itself can be undone, note the current Time Travel bookmark:

```sh
npx wrangler d1 time-travel info family-calendar
```

Write down the bookmark it prints. To undo a restore, run section A with `--bookmark=<that bookmark>`.

## A. Time Travel (within 7 days)

1. Find the moment just before the mistake, in UTC (Lisbon is UTC+0 in winter and UTC+1 in summer). Check it:

   ```sh
   npx wrangler d1 time-travel info family-calendar --timestamp=2026-10-02T08:00:00Z
   ```

2. Restore:

   ```sh
   npx wrangler d1 time-travel restore family-calendar --timestamp=2026-10-02T08:00:00Z
   ```

3. Open the app on a phone and check the lost data is back. Devices stay signed in, as long as they were already signed in at that moment.

## B. A nightly or monthly Backup (up to 12 months)

The Scheduler writes the whole database to the `family-calendar-backups` bucket every night after 03:00 Family time. It keeps the last 30 nights as `nightly/YYYY-MM-DD.json` and the first night of each of the last 12 months as `monthly/YYYY-MM.json`.

1. List what is there and pick one:

   ```sh
   npx wrangler r2 object list family-calendar-backups --remote --prefix=nightly/
   npx wrangler r2 object list family-calendar-backups --remote --prefix=monthly/
   ```

2. Download it and turn it into SQL (Node 22.18 or newer):

   ```sh
   npx wrangler r2 object get family-calendar-backups/nightly/2026-09-20.json --remote --file=backup.json
   node scripts/restore-sql.ts backup.json > restore.sql
   ```

   The SQL empties each table in the Backup and inserts its rows. Tables the Backup doesn't hold (sign-in throttling, recovery links, Scheduler runs, the weather cache) are left as they are; they refill on their own.

3. Do section 0, then run it:

   ```sh
   npx wrangler d1 execute family-calendar --remote --file=restore.sql
   ```

4. Check the app. Signed-in Devices come back as they were that night, so a device signed in later must sign in again. Person photos and Entry Type thumbnails come back as long as the Backup is less than 30 days old: images unused for 30 days are deleted, and older Backups may name some of those. A missing image shows no picture; set it again in the app.

The database keeps its current schema: migrations only ever add columns, so an older Backup still fits, and newer columns get their defaults.

## C. A full Export (when Cloudflare data is gone)

A full Export is the ZIP downloaded from Settings › Export. It holds `data.json` and `images/`, but no password, no Signed-in Devices and no Error Log.

1. If the database itself is gone, set production up again first, as when it was first installed (#53): create the D1 database and both R2 buckets, apply the migrations, deploy.

2. Unzip the Export and turn its data into SQL:

   ```sh
   unzip family-calendar-2026-09-30.zip -d export
   node scripts/restore-sql.ts export/data.json > restore.sql
   npx wrangler d1 execute family-calendar --remote --file=restore.sql
   ```

3. Put the images back, keeping their names (the name before the extension is the image key):

   ```sh
   for f in export/images/*; do
     key=$(basename "$f"); key=${key%.*}
     type=$(file --brief --mime-type "$f")
     npx wrangler r2 object put "family-calendar-images/$key" --remote --file="$f" --content-type="$type"
   done
   ```

4. The Export has no Family Password. Set a new setup code (`npx wrangler secret put SETUP_CODE`), then open the app: it asks for the setup code and a new Family Password, and every device signs in again with it.

## Afterwards

- Check Settings › Error log for anything the restore surfaced.
- If the restore was a mistake, undo it with section A and the bookmark from section 0 (within 7 days).
