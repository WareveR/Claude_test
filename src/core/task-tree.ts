/**
 * A Task's items can hold items of their own, to any depth. An item with items is done when all
 * of them are: ticking it ticks everything inside, and unticking anything inside unticks it.
 */
export type TreeItem = { id: string; parentId?: string | null; doneAt: string | null };

/** Each item's items, keyed by the id of the item they sit inside ("" for the top). */
export function childrenByParent<T extends TreeItem>(items: T[]): Map<string, T[]> {
  const ids = new Set(items.map((i) => i.id));
  const map = new Map<string, T[]>();
  for (const item of items) {
    // An item whose parent isn't in the list shows at the top rather than not at all.
    const key = item.parentId && ids.has(item.parentId) ? item.parentId : "";
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

/** The ids of everything inside an item, at any depth. */
export function descendantIds(items: TreeItem[], id: string): string[] {
  const children = childrenByParent(items);
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const child of children.get(parent) ?? []) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

/** "3 of 5 done", counting only the items that hold none: an item with items is their sum. */
export function leafProgress(items: TreeItem[], under?: string) {
  const children = childrenByParent(items);
  let done = 0;
  let total = 0;
  const walk = (list: TreeItem[]) => {
    for (const item of list) {
      const own = children.get(item.id);
      if (own) walk(own);
      else {
        total += 1;
        if (item.doneAt) done += 1;
      }
    }
  };
  walk(under === undefined ? (children.get("") ?? []) : (children.get(under) ?? []));
  return { done, total };
}

/** Whether putting an item inside another would put it inside itself. */
export function wouldNestInItself(items: TreeItem[], id: string, parentId: string | null) {
  return parentId !== null && (parentId === id || descendantIds(items, id).includes(parentId));
}

/**
 * The done state every item should have, after ticking (or unticking) one of them: everything
 * inside it follows, then each item with items is done exactly when all of them are. Returns
 * only the items whose state changes.
 */
export function settleDone(
  items: TreeItem[],
  now: string,
  tick?: { id: string; done: boolean },
): { id: string; doneAt: string | null }[] {
  const state = new Map(items.map((i) => [i.id, i.doneAt]));
  if (tick) {
    for (const id of [tick.id, ...descendantIds(items, tick.id)]) {
      if (tick.done) state.set(id, state.get(id) ?? now);
      else state.set(id, null);
    }
  }
  const children = childrenByParent(items);
  const settle = (id: string): string | null => {
    const own = children.get(id);
    if (!own) return state.get(id) ?? null;
    const done = own.map((child) => settle(child.id));
    const allDone = done.every(Boolean);
    const current = state.get(id) ?? null;
    const latest = done.reduce<string>((max, at) => (at && at > max ? at : max), "");
    state.set(id, allDone ? (current ?? latest) : null);
    return state.get(id) ?? null;
  };
  for (const top of children.get("") ?? []) settle(top.id);
  return items
    .filter((i) => (state.get(i.id) ?? null) !== i.doneAt)
    .map((i) => ({ id: i.id, doneAt: state.get(i.id) ?? null }));
}
