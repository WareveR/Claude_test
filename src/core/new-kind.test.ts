import { describe, expect, it } from "vitest";
import { guessKind } from "./new-kind";

describe("guessKind", () => {
  it("takes a title starting with something to do for a Task", () => {
    expect(guessKind("Comprar pão")).toBe("task");
    expect(guessKind("Pagar o IUC")).toBe("task");
    expect(guessKind("  Ligar à avó")).toBe("task");
    expect(guessKind("Pay the water bill")).toBe("task");
  });

  it("takes a clock time for an Entry, even with something to do", () => {
    expect(guessKind("Dentista às 15h")).toBe("entry");
    expect(guessKind("Jantar 20:30")).toBe("entry");
    expect(guessKind("Levar o carro à revisão às 9")).toBe("entry");
    expect(guessKind("Call Ana at 3pm")).toBe("entry");
  });

  it("says nothing when the words don't tell", () => {
    expect(guessKind("Jantar com os avós")).toBeNull();
    expect(guessKind("Aniversário da Rita")).toBeNull();
    expect(guessKind("")).toBeNull();
    // A word that only starts like one to do.
    expect(guessKind("Pagamento da escola")).toBeNull();
  });
});
