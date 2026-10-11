import { describe, expect, it } from "vitest";
import { excerpt, fold, highlight, parseQuery, scoreItem } from "./search";

describe("parseQuery", () => {
  it("splits loose words, quoted text and exclusions", () => {
    expect(parseQuery('Dentista  "consulta de rotina" -cancelado -"Dr. Silva"')).toEqual({
      words: ["dentista"],
      phrases: ["consulta de rotina"],
      excluded: ["cancelado", "dr. silva"],
    });
  });

  it("treats an open quote as running to the end and ignores a lone minus", () => {
    expect(parseQuery('ana - "festa de anos')).toEqual({
      words: ["ana"],
      phrases: ["festa de anos"],
      excluded: [],
    });
  });
});

describe("fold", () => {
  it("drops case and accents but keeps every position", () => {
    expect(fold("Reunião Ação")).toBe("reuniao acao");
    expect(fold("Reunião").length).toBe("Reunião".length);
  });
});

describe("scoreItem", () => {
  const item = { title: "Consulta no dentista", other: ["Levar o cartão", "Clínica Sorriso"] };

  it("matches any loose word, ranking more words and title words higher", () => {
    const one = scoreItem(item, parseQuery("cartao"));
    const two = scoreItem(item, parseQuery("cartao dentista"));
    expect(one).toBe(1);
    expect(two).toBe(3);
    expect(scoreItem(item, parseQuery("praia"))).toBeNull();
    expect(scoreItem(item, parseQuery("praia sorriso"))).toBe(1);
  });

  it("needs quoted text as written", () => {
    expect(scoreItem(item, parseQuery('"no dentista"'))).toBe(4);
    expect(scoreItem(item, parseQuery('"dentista no"'))).toBeNull();
  });

  it("leaves out anything with an excluded term, even with only exclusions", () => {
    expect(scoreItem(item, parseQuery("dentista -sorriso"))).toBeNull();
    expect(scoreItem(item, parseQuery("-praia"))).toBe(0);
  });
});

describe("highlight", () => {
  it("marks matches whatever their case or accents", () => {
    expect(highlight("Reunião de pais", ["reuniao", "pais"])).toEqual([
      { text: "Reunião", hit: true },
      { text: " de ", hit: false },
      { text: "pais", hit: true },
    ]);
  });
});

describe("excerpt", () => {
  it("cuts long text around the first match", () => {
    const text = `${"a ".repeat(60)}levar o cartão de cidadão ${"b ".repeat(60)}`;
    const piece = excerpt(text, ["cartao"], 40);
    expect(piece.startsWith("…")).toBe(true);
    expect(piece).toContain("cartão");
    expect(piece.endsWith("…")).toBe(true);
  });
});
