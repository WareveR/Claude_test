import { describe, expect, it } from "vitest";
import { readbackSentences } from "./readback";

describe("readbackSentences", () => {
  it("ends each part as its own sentence", () => {
    expect(readbackSentences(["Entrada: Consulta, 20 de outubro, 19:00", "Guardar?"])).toEqual([
      "Entrada: Consulta, 20 de outubro, 19:00.",
      "Guardar?",
    ]);
  });

  it("keeps punctuation already there and drops empty parts", () => {
    expect(readbackSentences(["  Which one? ", "", "1. Swimming."])).toEqual([
      "Which one?",
      "1. Swimming.",
    ]);
  });

  it("takes a single text", () => {
    expect(readbackSentences("Saved")).toEqual(["Saved."]);
  });
});
