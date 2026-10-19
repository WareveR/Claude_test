import type { Account } from "./auth/account";

type Viewer = Pick<Account, "id" | "personId">;

/**
 * Whether this Account sees a Private Entry or Task in full: its creator does, and so does the
 * Account of any Person it is for. Everyone else sees only "Private", its time and its Persons.
 */
export function seesInFull(
  viewer: Viewer,
  item: { private: boolean; createdBy: string | null },
  personIds: string[],
) {
  return (
    !item.private ||
    item.createdBy === viewer.id ||
    (viewer.personId !== null && personIds.includes(viewer.personId))
  );
}
