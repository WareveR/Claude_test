import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Kinship, Relative, Sex } from "../../core/family-tree";
import { api } from "../api";

export type { Relative };

export const RELATIVES = ["relatives"];

export function useRelatives() {
  return useQuery({ queryKey: RELATIVES, queryFn: () => api<Relative[]>("/relatives") });
}

const ROOT_KEY = "tree-root";

/** Whom this device draws the tree from: chosen once, else the youngest. */
export function treeRoot(relatives: Relative[]): string | null {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(ROOT_KEY);
  } catch {
    // Storage blocked: fall back to the youngest.
  }
  if (saved && relatives.some((r) => r.id === saved)) return saved;
  const youngest = [...relatives].sort((a, b) =>
    (b.birthDate ?? "").localeCompare(a.birthDate ?? ""),
  )[0];
  return youngest?.id ?? null;
}

export function setTreeRoot(id: string) {
  try {
    localStorage.setItem(ROOT_KEY, id);
  } catch {
    // Not remembered on this device.
  }
}

/** A long date in the device's language: "3 de maio de 1950". */
export function longDate(date: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

const sexKey = (sex: Sex) => sex || "x";

/** Words for kinship, in the device's language. */
export function useKinWords() {
  const { t } = useTranslation();
  const word = (key: string, sex: Sex, count?: number) =>
    t(`tree.kin.${key}.${sexKey(sex)}`, { count: count ?? 0 });
  /** "Rosa é avó de Leonor", and what kind of kinship it is. */
  const describe = (
    k: Kinship,
    a: Relative,
    b: Relative,
    byId: Map<string, Relative>,
  ): { sentence: string; detail: string | null } => {
    switch (k.kind) {
      case "self":
        return { sentence: b.name, detail: null };
      case "blood": {
        const line = k.line === "direct" ? "tree.directLine" : "tree.sideLine";
        return {
          sentence: t("tree.isOf", { b: b.name, word: word(k.word, b.sex, k.count), a: a.name }),
          detail: t(line, { degree: k.degree }),
        };
      }
      case "affinity":
        return {
          sentence: t("tree.isOf", { b: b.name, word: word(k.word, b.sex), a: a.name }),
          detail: t("tree.byMarriage"),
        };
      case "via": {
        const via = byId.get(k.viaId)!;
        const inner = k.inner.kind === "blood" ? word(k.inner.word, b.sex, k.inner.count) : "";
        if (k.viaSide === "a") {
          return {
            sentence: t("tree.isOfVia", {
              b: b.name,
              word: inner,
              via: via.name,
              viaWord: word("partner", via.sex),
              a: a.name,
            }),
            detail: t("tree.byMarriage"),
          };
        }
        const viaInner = k.inner.kind === "blood" ? word(k.inner.word, via.sex, k.inner.count) : "";
        return {
          sentence: t("tree.isPartnerOf", {
            b: b.name,
            word: word("partner", b.sex),
            via: via.name,
            viaWord: viaInner,
            a: a.name,
          }),
          detail: t("tree.byMarriage"),
        };
      }
      case "none":
        return { sentence: t("tree.notRelated", { a: a.name, b: b.name }), detail: null };
    }
  };
  return { word, describe };
}
