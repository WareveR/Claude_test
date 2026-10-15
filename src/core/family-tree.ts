import { isPlainDate, type PlainDate } from "./plain-date";

/**
 * The Family Tree: relatives to show the children where they come from. Not Persons: a
 * Relative is never on the calendar, and may have lived long ago.
 */
export type Sex = "f" | "m" | "";

export type Relative = {
  id: string;
  name: string;
  nickname: string;
  sex: Sex;
  birthDate: PlainDate | null;
  deathDate: PlainDate | null;
  birthPlace: string;
  photoKey: string | null;
  notes: string;
  /** At most two. */
  parentIds: string[];
  partnerIds: string[];
};

export const SEXES: Sex[] = ["f", "m", ""];

/** A date of birth or death: a whole date, or null. */
export function parseTreeDate(value: unknown): PlainDate | null | undefined {
  if (value === null || value === "") return null;
  return typeof value === "string" && isPlainDate(value) ? value : undefined;
}

type Graph = Map<string, Relative>;

function graphOf(relatives: Relative[]): Graph {
  return new Map(relatives.map((r) => [r.id, r]));
}

export function childrenOf(relatives: Relative[], id: string): Relative[] {
  return relatives.filter((r) => r.parentIds.includes(id));
}

/** Those who share at least one parent with `id`. */
export function siblingsOf(relatives: Relative[], id: string): Relative[] {
  const me = relatives.find((r) => r.id === id);
  if (!me || me.parentIds.length === 0) return [];
  return relatives.filter((r) => r.id !== id && r.parentIds.some((p) => me.parentIds.includes(p)));
}

/** Every ancestor of `id` with the fewest generations up to them (a parent is 1). */
function ancestors(graph: Graph, id: string): Map<string, number> {
  const found = new Map<string, number>([[id, 0]]);
  let level = [id];
  for (let up = 1; level.length > 0; up++) {
    const next: string[] = [];
    for (const child of level) {
      for (const parent of graph.get(child)?.parentIds ?? []) {
        if (found.has(parent) || !graph.has(parent)) continue;
        found.set(parent, up);
        next.push(parent);
      }
    }
    level = next;
  }
  return found;
}

/** True when `maybe` is `id` or one of its descendants: such a Relative can't be its parent. */
export function isDescendant(relatives: Relative[], id: string, maybe: string): boolean {
  return ancestors(graphOf(relatives), maybe).has(id);
}

export type Blood = {
  /** Generations from the first Relative up to the nearest common ancestors. */
  up: number;
  /** Generations from there down to the second. */
  down: number;
  /** Siblings who share only one parent. */
  half: boolean;
  /** The nearest common ancestors (the second Relative themself in a direct line). */
  ancestorIds: string[];
};

/** How two Relatives are related by blood, through their nearest common ancestors, if at all. */
export function bloodLine(relatives: Relative[], a: string, b: string): Blood | null {
  const graph = graphOf(relatives);
  const fromA = ancestors(graph, a);
  const fromB = ancestors(graph, b);
  let best = Infinity;
  let common: string[] = [];
  for (const [id, up] of fromA) {
    const down = fromB.get(id);
    if (down === undefined) continue;
    if (up + down < best) {
      best = up + down;
      common = [id];
    } else if (up + down === best) common.push(id);
  }
  if (common.length === 0) return null;
  const up = fromA.get(common[0])!;
  const down = fromB.get(common[0])!;
  const parentsA = graph.get(a)?.parentIds ?? [];
  const parentsB = graph.get(b)?.parentIds ?? [];
  const half =
    up === 1 && down === 1 && parentsA.length === 2 && parentsB.length === 2 && common.length === 1;
  return { up, down, half, ancestorIds: common };
}

/**
 * What the second Relative is to the first, as a word key: "grandparent", "cousin"… Gendered
 * words are picked with the second Relative's sex.
 */
export type Kinship =
  | { kind: "self" }
  | {
      kind: "blood";
      word: string;
      /** For distant cousins and long lines: how many generations or which cousin. */
      count?: number;
      /** The civil degree: generations counted up to the common ancestor and down again. */
      degree: number;
      line: "direct" | "collateral";
      ancestorIds: string[];
    }
  | { kind: "affinity"; word: string }
  /** Related through `viaId`, the first Relative's partner, or the second's. */
  | { kind: "via"; viaId: string; viaSide: "a" | "b"; inner: Kinship }
  | { kind: "none" };

function bloodWord({ up, down, half }: Blood): { word: string; count?: number } {
  if (up === 0) {
    const words = ["", "child", "grandchild", "greatGrandchild", "greatGreatGrandchild"];
    return down < words.length ? { word: words[down] } : { word: "descendant", count: down };
  }
  if (down === 0) {
    const words = ["", "parent", "grandparent", "greatGrandparent", "greatGreatGrandparent"];
    return up < words.length ? { word: words[up] } : { word: "ancestor", count: up };
  }
  if (up === 1 && down === 1) return { word: half ? "halfSibling" : "sibling" };
  if (up === 1) return down === 2 ? { word: "nephew" } : { word: "grandNephew" };
  if (down === 1) return up === 2 ? { word: "uncle" } : { word: "greatUncle" };
  if (up === down) return up === 2 ? { word: "cousin" } : { word: "nthCousin", count: up - 1 };
  return { word: "distantCousin" };
}

function partnersOf(graph: Graph, id: string): string[] {
  return (graph.get(id)?.partnerIds ?? []).filter((p) => graph.has(p));
}

/** What `b` is to `a`: by blood, by marriage, or through one of their partners. */
export function kinship(relatives: Relative[], a: string, b: string, deep = true): Kinship {
  if (a === b) return { kind: "self" };
  const graph = graphOf(relatives);
  const blood = bloodLine(relatives, a, b);
  if (blood) {
    return {
      kind: "blood",
      ...bloodWord(blood),
      degree: blood.up + blood.down,
      line: blood.up === 0 || blood.down === 0 ? "direct" : "collateral",
      ancestorIds: blood.ancestorIds,
    };
  }
  const relB = graph.get(b);
  const partnersA = partnersOf(graph, a);
  if (partnersA.includes(b)) return { kind: "affinity", word: "partner" };
  const parentsA = graph.get(a)?.parentIds ?? [];
  const childrenA = childrenOf(relatives, a).map((r) => r.id);
  const siblingsA = siblingsOf(relatives, a).map((r) => r.id);
  if (relB) {
    if (relB.parentIds.some((p) => partnersA.includes(p)))
      return { kind: "affinity", word: "stepChild" };
    if (relB.partnerIds.some((p) => parentsA.includes(p)))
      return { kind: "affinity", word: "stepParent" };
    if (partnersA.some((p) => graph.get(p)?.parentIds.includes(b))) {
      return { kind: "affinity", word: "parentInLaw" };
    }
    if (relB.partnerIds.some((p) => childrenA.includes(p)))
      return { kind: "affinity", word: "childInLaw" };
    const partnersSiblings = partnersA.flatMap((p) => siblingsOf(relatives, p).map((r) => r.id));
    if (partnersSiblings.includes(b) || relB.partnerIds.some((p) => siblingsA.includes(p))) {
      return { kind: "affinity", word: "siblingInLaw" };
    }
  }
  if (deep) {
    for (const p of partnersA) {
      const inner = kinship(relatives, p, b, false);
      if (inner.kind === "blood") return { kind: "via", viaId: p, viaSide: "a", inner };
    }
    for (const p of partnersOf(graph, b)) {
      const inner = kinship(relatives, a, p, false);
      if (inner.kind === "blood") return { kind: "via", viaId: p, viaSide: "b", inner };
    }
  }
  return { kind: "none" };
}

/** The shortest chain of Relatives from `a` to `b` through parents, children and partners. */
export function connection(relatives: Relative[], a: string, b: string): string[] {
  const neighbours = new Map<string, Set<string>>();
  const link = (x: string, y: string) => {
    if (!neighbours.has(x)) neighbours.set(x, new Set());
    if (!neighbours.has(y)) neighbours.set(y, new Set());
    neighbours.get(x)!.add(y);
    neighbours.get(y)!.add(x);
  };
  const ids = new Set(relatives.map((r) => r.id));
  for (const r of relatives) {
    for (const p of [...r.parentIds, ...r.partnerIds]) if (ids.has(p)) link(r.id, p);
  }
  const previous = new Map<string, string | null>([[a, null]]);
  const queue = [a];
  while (queue.length > 0) {
    const at = queue.shift()!;
    if (at === b) break;
    for (const next of neighbours.get(at) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, at);
      queue.push(next);
    }
  }
  if (!previous.has(b)) return [];
  const path: string[] = [];
  for (let at: string | null = b; at !== null; at = previous.get(at) ?? null) path.unshift(at);
  return path;
}

/** One place in a row of the tree: a Relative alone, or partners side by side. */
export type TreeUnit = string[];

export type TreeLayout = {
  /** Rows from the oldest generation down; each its units in order. */
  rows: { generation: number; units: TreeUnit[] }[];
};

/**
 * Puts the Relatives in rows by generation, counted from `rootId` (0; parents -1), partners side
 * by side, and each row ordered under the parents of the row above, so lines cross little.
 */
export function layoutTree(relatives: Relative[], rootId: string | null): TreeLayout {
  const graph = graphOf(relatives);
  const generation = new Map<string, number>();
  const byAge = [...relatives].sort(
    (x, y) =>
      (x.birthDate ?? "9999").localeCompare(y.birthDate ?? "9999") || x.name.localeCompare(y.name),
  );
  const starts =
    rootId && graph.has(rootId) ? [rootId, ...byAge.map((r) => r.id)] : byAge.map((r) => r.id);
  for (const start of starts) {
    if (generation.has(start)) continue;
    generation.set(start, 0);
    const queue = [start];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const g = generation.get(id)!;
      const me = graph.get(id)!;
      const steps: [string, number][] = [
        ...me.parentIds.map((p): [string, number] => [p, g - 1]),
        ...me.partnerIds.map((p): [string, number] => [p, g]),
        ...childrenOf(relatives, id).map((c): [string, number] => [c.id, g + 1]),
      ];
      for (const [next, ng] of steps) {
        if (!graph.has(next) || generation.has(next)) continue;
        generation.set(next, ng);
        queue.push(next);
      }
    }
  }

  // Partners of the same generation share a unit, in a chain: a second marriage sits on the
  // far side.
  const unitOf = new Map<string, TreeUnit>();
  const units: TreeUnit[] = [];
  for (const r of byAge) {
    if (unitOf.has(r.id)) continue;
    const g = generation.get(r.id);
    const group = new Set<string>([r.id]);
    const stack = [r.id];
    while (stack.length > 0) {
      for (const p of partnersOf(graph, stack.pop()!)) {
        if (group.has(p) || generation.get(p) !== g) continue;
        group.add(p);
        stack.push(p);
      }
    }
    const inGroup = (id: string) => partnersOf(graph, id).filter((p) => group.has(p));
    const end = [...group].find((id) => inGroup(id).length <= 1) ?? r.id;
    const chain: string[] = [end];
    while (chain.length < group.size) {
      const next = inGroup(chain[chain.length - 1]).find((p) => !chain.includes(p));
      if (!next) break;
      chain.push(next);
    }
    for (const id of group) if (!chain.includes(id)) chain.push(id);
    // Women on the left of a couple, as family trees are usually drawn.
    if (
      chain.length === 2 &&
      graph.get(chain[1])!.sex === "f" &&
      graph.get(chain[0])!.sex !== "f"
    ) {
      chain.reverse();
    }
    units.push(chain);
    for (const id of chain) unitOf.set(id, chain);
  }

  const gens = [...new Set(units.map((u) => generation.get(u[0])!))].sort((x, y) => x - y);
  const rows = gens.map((g) => ({
    generation: g,
    units: units.filter((u) => generation.get(u[0]) === g),
  }));

  const positions = (row: TreeUnit[]) => {
    const at = new Map<string, number>();
    row.flat().forEach((id, i) => at.set(id, i));
    return at;
  };
  const order = (row: TreeUnit[], key: (id: string) => number[]) => {
    const keyed = row.map((unit, i) => {
      const values = unit.flatMap(key);
      return {
        unit,
        k: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
        i,
      };
    });
    // Units with nothing to follow keep their place among the others.
    let last = -1;
    for (const u of keyed) {
      if (u.k === null) u.k = last + 0.001;
      last = u.k;
    }
    keyed.sort((x, y) => x.k! - y.k! || x.i - y.i);
    return keyed.map((u) => u.unit);
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 1; r < rows.length; r++) {
      const above = positions(rows[r - 1].units);
      rows[r].units = order(rows[r].units, (id) =>
        (graph.get(id)?.parentIds ?? []).filter((p) => above.has(p)).map((p) => above.get(p)!),
      );
    }
    for (let r = rows.length - 2; r >= 0; r--) {
      const below = positions(rows[r + 1].units);
      rows[r].units = order(rows[r].units, (id) =>
        childrenOf(relatives, id)
          .filter((c) => below.has(c.id))
          .map((c) => below.get(c.id)!),
      );
    }
  }
  // The last pass goes down, so children sit under their parents.
  for (let r = 1; r < rows.length; r++) {
    const above = positions(rows[r - 1].units);
    rows[r].units = order(rows[r].units, (id) =>
      (graph.get(id)?.parentIds ?? []).filter((p) => above.has(p)).map((p) => above.get(p)!),
    );
  }
  return { rows };
}

/** Age in whole years on `on`, or at death. */
export function ageOf(
  r: Pick<Relative, "birthDate" | "deathDate">,
  today: PlainDate,
): number | null {
  if (!r.birthDate) return null;
  const end = r.deathDate ?? today;
  let age = Number(end.slice(0, 4)) - Number(r.birthDate.slice(0, 4));
  if (end.slice(5) < r.birthDate.slice(5)) age--;
  return age;
}
