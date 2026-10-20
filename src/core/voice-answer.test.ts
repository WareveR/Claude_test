import { describe, expect, it } from "vitest";
import { readAnswer } from "./voice-answer";

describe("readAnswer", () => {
  it("takes a plain yes, with or without politeness", () => {
    for (const s of ["Sim", "sim, guarda", "Sim, pode guardar.", "Yes please", "ok", "Está bem"])
      expect(readAnswer(s)).toBe("yes");
  });

  it("asks what to change on a plain no", () => {
    expect(readAnswer("Não.")).toBe("no");
    expect(readAnswer("no")).toBe("no");
  });

  it("reads anything more as a correction, even after a yes or a no", () => {
    expect(readAnswer("Não, às 11")).toEqual({ correction: "Não, às 11" });
    expect(readAnswer("sim, mas para a Maria")).toEqual({ correction: "sim, mas para a Maria" });
    expect(readAnswer("muda para amanhã")).toEqual({ correction: "muda para amanhã" });
  });

  it("cancels, opens the form, or hears nothing", () => {
    expect(readAnswer("Cancela")).toBe("cancel");
    expect(readAnswer("esquece isso")).toBe("cancel");
    expect(readAnswer("editar")).toBe("form");
    expect(readAnswer(null)).toBe("silence");
    expect(readAnswer(" . ")).toBe("silence");
  });
});
