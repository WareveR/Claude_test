// Turns a nightly Backup or the data.json of a full Export into SQL for `wrangler d1 execute`.
// Usage: node scripts/restore-sql.ts backup.json > restore.sql   (see docs/runbooks/restore.md)
import { readFileSync } from "node:fs";
import { restoreSql, type Dump } from "../src/core/restore-sql.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/restore-sql.ts <backup.json | data.json>");
  process.exit(1);
}
const dump = JSON.parse(readFileSync(file, "utf8")) as Dump & { format?: string };
if (dump.format !== "family-calendar-backup" && dump.format !== "family-calendar-export") {
  console.error(`${file} is not a Family Calendar Backup or Export`);
  process.exit(1);
}
process.stdout.write(restoreSql(dump));
