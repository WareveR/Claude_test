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
