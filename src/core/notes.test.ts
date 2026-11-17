import { describe, expect, it } from "vitest";
import { noteShows, noteUntil, readNotePhrase } from "./notes";

describe("Notes", () => {
  it("stay up today, until tomorrow or until removed", () => {
    expect(noteUntil("today", "2026-11-17")).toBe("2026-11-17");
    expect(noteUntil("tomorrow", "2026-11-30")).toBe("2026-12-01");
    expect(noteUntil("removed", "2026-11-17")).toBeNull();
  });

  it("show up to and including their last day", () => {
    expect(noteShows({ until: "2026-11-17" }, "2026-11-17")).toBe(true);
    expect(noteShows({ until: "2026-11-16" }, "2026-11-17")).toBe(false);
    expect(noteShows({ until: null }, "2030-01-01")).toBe(true);
  });

  it("are read from a sentence without the model", () => {
    expect(readNotePhrase("deixa um recado: há sopa")).toBe("Há sopa");
    expect(readNotePhrase("Deixa recado a dizer que o cão já comeu.")).toBe("O cão já comeu");
    expect(readNotePhrase("recado para todos: chego às 8")).toBe("Chego às 8");
    expect(readNotePhrase("leave a note: soup in the fridge")).toBe("Soup in the fridge");
    expect(readNotePhrase("Note for everyone, back at 8")).toBe("Back at 8");
  });

  it("leave other sentences alone", () => {
    expect(readNotePhrase("jantar com a avó sexta às 8")).toBeNull();
    expect(readNotePhrase("deixa um recado:")).toBeNull();
    expect(readNotePhrase("notes from the meeting tomorrow")).toBeNull();
    expect(readNotePhrase("recados da escola amanhã")).toBeNull();
  });
});
