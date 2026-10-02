/** The part of a nightly Backup or a full Export that a restore reads. */
export type Dump = { tables: Record<string, Record<string, unknown>[]> };

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

const identifier = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * SQL that replaces the rows of every table in the dump with the dump's rows, one statement per
 * line, for `wrangler d1 execute --file`. Tables the dump leaves out are not touched. Foreign
 * keys are checked once at the end, so the order of tables doesn't matter.
 */
export function restoreSql(dump: Dump): string {
  const lines = ["PRAGMA defer_foreign_keys = true;"];
  const tables = Object.keys(dump.tables).sort();
  for (const table of tables) lines.push(`DELETE FROM ${identifier(table)};`);
  for (const table of tables) {
    for (const row of dump.tables[table]) {
      const columns = Object.keys(row);
      lines.push(
        `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(", ")}) VALUES (${columns
          .map((c) => literal(row[c]))
          .join(", ")});`,
      );
    }
  }
  return lines.join("\n") + "\n";
}
