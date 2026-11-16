import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };

/** D1 binds at most 100 parameters per query, so long id lists are read a part at a time. */
export async function inParts<T>(
  ids: string[],
  read: (part: string[]) => Promise<T[]>,
  size = 90,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await read(ids.slice(i, i + size))));
  return out;
}

/** The Person ids of link rows, by the row they link: one pass, instead of a scan per row. */
export function personsBy<L extends { personId: string }>(
  links: L[],
  owner: (link: L) => string,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const link of links) {
    const persons = out.get(owner(link));
    if (persons) persons.push(link.personId);
    else out.set(owner(link), [link.personId]);
  }
  return out;
}
