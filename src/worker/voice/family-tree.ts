// Voice commands about the Family Tree: adding a Relative or changing one's dates and nickname.
import type { Relative } from "../../core/family-tree";
import type { Language } from "../../core/languages";
import { formatPlainDate, isPlainDate } from "../../core/plain-date";
import { randomId } from "../auth/crypto";
import { LOCALES, type Plan, type VoiceState } from "./helpers";

const TREE_TEXTS: Record<
  Language,
  {
    add: string;
    change: string;
    born: string;
    died: string;
    relation: Record<
      "parent" | "child" | "partner" | "sibling",
      (name: string, sex: "f" | "m" | "") => string
    >;
  }
> = {
  "pt-PT": {
    add: "Nova pessoa na árvore",
    change: "Alterar na árvore",
    born: "nasceu a",
    died: "faleceu a",
    relation: {
      parent: (n, s) => `${s === "f" ? "mãe" : s === "m" ? "pai" : "pai ou mãe"} de ${n}`,
      child: (n, s) => `${s === "f" ? "filha" : s === "m" ? "filho" : "filho ou filha"} de ${n}`,
      partner: (n, s) =>
        `${s === "f" ? "companheira" : s === "m" ? "companheiro" : "companheiro ou companheira"} de ${n}`,
      sibling: (n, s) => `${s === "f" ? "irmã" : s === "m" ? "irmão" : "irmão ou irmã"} de ${n}`,
    },
  },
  en: {
    add: "New person in the tree",
    change: "Change in the tree",
    born: "born",
    died: "died",
    relation: {
      parent: (n, s) => `${s === "f" ? "mother" : s === "m" ? "father" : "parent"} of ${n}`,
      child: (n, s) => `${s === "f" ? "daughter" : s === "m" ? "son" : "child"} of ${n}`,
      partner: (n) => `partner of ${n}`,
      sibling: (n, s) => `${s === "f" ? "sister" : s === "m" ? "brother" : "sibling"} of ${n}`,
    },
  },
};

/**
 * Adding someone to the Family Tree, linked to a Relative already in it, or changing one's
 * dates or nickname; with Undo either way.
 */
export function relativePlan(
  answer: Record<string, unknown>,
  tree: Relative[],
  language: Language,
): (Omit<Plan, "kind"> & { kind: "relative" }) | null {
  const texts = TREE_TEXTS[language];
  const at = (v: unknown) => (Number.isInteger(v) ? tree[v as number] : undefined);
  const day = (v: unknown) => (typeof v === "string" && isPlainDate(v) ? v : null);
  const long = (d: string) =>
    formatPlainDate(d, LOCALES[language], { day: "numeric", month: "long", year: "numeric" });
  const nickname = Array.isArray(answer.nicknames)
    ? (answer.nicknames.find((n): n is string => typeof n === "string" && !!n.trim()) ?? "")
        .trim()
        .slice(0, 80)
    : "";
  const birthDate = day(answer.date);
  const deathDate = day(answer.endDate);
  const details = [
    nickname ? `“${nickname}”` : "",
    birthDate ? `${texts.born} ${long(birthDate)}` : "",
    deathDate ? `${texts.died} ${long(deathDate)}` : "",
  ];
  const changed = at(answer.relative);
  if (changed) {
    const patch = {
      ...(birthDate ? { birthDate } : {}),
      ...(deathDate ? { deathDate } : {}),
      ...(nickname ? { nickname } : {}),
    };
    if (Object.keys(patch).length === 0) return null;
    const old = Object.fromEntries(
      Object.keys(patch).map((k) => [k, changed[k as keyof typeof patch]]),
    );
    return {
      kind: "relative",
      id: changed.id,
      date: null,
      label: changed.name,
      summary: `${texts.change}: ${[changed.name, ...details].filter(Boolean).join(", ")}`,
      scope: "all",
      apply: { all: [{ method: "PATCH", path: `/relatives/${changed.id}`, body: patch }] },
      undo: [{ method: "PATCH", path: `/relatives/${changed.id}`, body: old }],
    };
  }
  const name = typeof answer.title === "string" ? answer.title.trim().slice(0, 80) : "";
  if (!name) return null;
  const of = at(answer.of);
  const relation =
    of && ["parent", "child", "partner", "sibling"].includes(answer.relation as string)
      ? (answer.relation as "parent" | "child" | "partner" | "sibling")
      : null;
  const sex = answer.sex === "f" || answer.sex === "m" ? answer.sex : "";
  const id = randomId();
  const body = {
    id,
    name,
    nickname,
    sex,
    birthDate,
    deathDate,
    parentIds: relation === "child" ? [of!.id] : relation === "sibling" ? of!.parentIds : [],
    childIds: relation === "parent" ? [of!.id] : [],
    partnerIds: relation === "partner" ? [of!.id] : [],
  };
  return {
    kind: "relative",
    id,
    date: null,
    label: name,
    summary: `${texts.add}: ${[
      name,
      relation ? texts.relation[relation](of!.name, sex) : "",
      ...details,
    ]
      .filter(Boolean)
      .join(", ")}`,
    scope: "all",
    apply: { all: [{ method: "POST", path: "/relatives", body }] },
    undo: [{ method: "DELETE", path: `/relatives/${id}` }],
  };
}

/** "Carla is the sister of Sara": the plan to add or change a Relative. */
export function relativeCommand({ answer, relatives, language, failed }: VoiceState) {
  const plan = relativePlan(answer, relatives, language);
  return plan ? { outcome: "change" as const, plan } : failed;
}
