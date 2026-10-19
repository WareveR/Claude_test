import type { Language } from "./languages";

const TEXTS: Record<
  Language,
  Record<"entry" | "task", { named: (title: string) => string; private: string }>
> = {
  "pt-PT": {
    entry: { named: (title) => `Novo evento: ${title}`, private: "Novo evento privado" },
    task: { named: (title) => `Nova tarefa: ${title}`, private: "Nova tarefa privada" },
  },
  en: {
    entry: { named: (title) => `New event: ${title}`, private: "New private event" },
    task: { named: (title) => `New task: ${title}`, private: "New private task" },
  },
};

/** The notification other devices get when an Entry or Task is created; a Private one keeps its title hidden. */
export function newItemText(
  item: { kind: "entry" | "task"; title: string; private: boolean },
  language: Language,
): string {
  const texts = TEXTS[language][item.kind];
  return item.private ? texts.private : texts.named(item.title);
}
