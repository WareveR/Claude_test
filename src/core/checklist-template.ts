import type { Language } from "./languages";

/** The built-in Checklist templates, in the order they are listed. */
export const BUILT_IN_TEMPLATES = [
  "summerCleaning",
  "decluttering",
  "shopping",
  "backToSchool",
  "holidayPacking",
] as const;
export type BuiltInTemplate = (typeof BUILT_IN_TEMPLATES)[number];

export function isBuiltInTemplate(value: unknown): value is BuiltInTemplate {
  return BUILT_IN_TEMPLATES.includes(value as BuiltInTemplate);
}

type TemplateText = { name: string; items: string[] };

/** What each built-in template says in each language, until the Family edits it. */
export const BUILT_IN_TEMPLATE_TEXT: Record<BuiltInTemplate, Record<Language, TemplateText>> = {
  summerCleaning: {
    en: {
      name: "Summer cleaning",
      items: [
        "Wash the windows",
        "Clean the curtains",
        "Turn the mattresses",
        "Clean behind the furniture",
        "Clean the fridge and freezer",
        "Descale the kettle and coffee machine",
        "Wash the outdoor furniture",
        "Clean the air conditioning filters",
        "Put away the winter clothes",
        "Wash the duvets and blankets",
      ],
    },
    "pt-PT": {
      name: "Limpeza de verão",
      items: [
        "Lavar as janelas",
        "Limpar os cortinados",
        "Virar os colchões",
        "Limpar atrás dos móveis",
        "Limpar o frigorífico e a arca",
        "Descalcificar a chaleira e a máquina de café",
        "Lavar os móveis de exterior",
        "Limpar os filtros do ar condicionado",
        "Arrumar a roupa de inverno",
        "Lavar os edredões e os cobertores",
      ],
    },
  },
  decluttering: {
    en: {
      name: "Decluttering",
      items: [
        "Wardrobes: clothes not worn in a year",
        "Shoes",
        "Toys and games",
        "Books and magazines",
        "Kitchen cupboards",
        "Medicine cabinet: expired medicines",
        "Papers and documents",
        "Cables and old electronics",
        "Garage or storage room",
        "Take donations to charity",
      ],
    },
    "pt-PT": {
      name: "Destralhar",
      items: [
        "Roupeiros: roupa que não se usa há um ano",
        "Sapatos",
        "Brinquedos e jogos",
        "Livros e revistas",
        "Armários da cozinha",
        "Armário dos medicamentos: medicamentos fora de prazo",
        "Papéis e documentos",
        "Cabos e eletrónica antiga",
        "Garagem ou arrecadação",
        "Levar doações a uma instituição",
      ],
    },
  },
  shopping: {
    en: {
      name: "Shopping",
      items: [
        "Bread",
        "Milk",
        "Eggs",
        "Fruit",
        "Vegetables",
        "Meat or fish",
        "Rice and pasta",
        "Yoghurts",
        "Toilet paper",
        "Washing-up liquid",
      ],
    },
    "pt-PT": {
      name: "Compras",
      items: [
        "Pão",
        "Leite",
        "Ovos",
        "Fruta",
        "Legumes",
        "Carne ou peixe",
        "Arroz e massa",
        "Iogurtes",
        "Papel higiénico",
        "Detergente da loiça",
      ],
    },
  },
  backToSchool: {
    en: {
      name: "Back to school",
      items: [
        "Buy the textbooks",
        "Buy notebooks and stationery",
        "New school bag",
        "Label books and clothes",
        "Try on last year's clothes and shoes",
        "Sports kit",
        "Check the timetable and activities",
        "Renew the school canteen and transport",
        "Medical and dental check-up",
      ],
    },
    "pt-PT": {
      name: "Regresso às aulas",
      items: [
        "Comprar os manuais escolares",
        "Comprar cadernos e material escolar",
        "Mochila nova",
        "Etiquetar os livros e a roupa",
        "Experimentar a roupa e os sapatos do ano passado",
        "Equipamento de educação física",
        "Ver o horário e as atividades",
        "Renovar a cantina e o transporte escolar",
        "Consulta no médico e no dentista",
      ],
    },
  },
  holidayPacking: {
    en: {
      name: "Holiday packing",
      items: [
        "Passports and ID cards",
        "Tickets and bookings",
        "Clothes and pyjamas",
        "Swimwear and towels",
        "Sun cream and hats",
        "Toiletries",
        "Medicines",
        "Phone chargers",
        "Books and games for the journey",
        "Snacks for the journey",
        "Close the windows and empty the fridge",
      ],
    },
    "pt-PT": {
      name: "Mala de férias",
      items: [
        "Passaportes e cartões de cidadão",
        "Bilhetes e reservas",
        "Roupa e pijamas",
        "Fatos de banho e toalhas",
        "Protetor solar e chapéus",
        "Artigos de higiene",
        "Medicamentos",
        "Carregadores dos telemóveis",
        "Livros e jogos para a viagem",
        "Lanches para a viagem",
        "Fechar as janelas e esvaziar o frigorífico",
      ],
    },
  },
};

/**
 * A Checklist template as stored: a built-in one has its builtinKey and, until the Family edits
 * it, no name or items of its own, so each device reads it in its own language.
 */
export type StoredTemplate = {
  builtinKey: string | null;
  name: string | null;
  items: string[] | null;
};

/** The name and items a template shows in the given language. */
export function templateText(template: StoredTemplate, language: Language): TemplateText {
  const builtIn = isBuiltInTemplate(template.builtinKey)
    ? BUILT_IN_TEMPLATE_TEXT[template.builtinKey][language]
    : null;
  return {
    name: template.name ?? builtIn?.name ?? "",
    items: template.items ?? builtIn?.items ?? [],
  };
}

/** The most items a template keeps, and the longest item or name. */
export const MAX_TEMPLATE_ITEMS = 200;
export const MAX_TEMPLATE_TEXT = 200;

/** Trims the item names and drops the empty ones; null when they are not a list of names. */
export function cleanItems(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) return null;
  const items = (value as string[]).map((v) => v.trim()).filter(Boolean);
  if (items.length > MAX_TEMPLATE_ITEMS || items.some((v) => v.length > MAX_TEMPLATE_TEXT)) {
    return null;
  }
  return items;
}
