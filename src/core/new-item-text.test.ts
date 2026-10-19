import { describe, expect, it } from "vitest";
import { newItemText } from "./new-item-text";

describe("newItemText", () => {
  it("names the new Entry or Task in the device's language", () => {
    expect(newItemText({ kind: "entry", title: "Dentista", private: false }, "pt-PT")).toBe(
      "Novo evento: Dentista",
    );
    expect(newItemText({ kind: "task", title: "Bins", private: false }, "en")).toBe(
      "New task: Bins",
    );
  });
  it("hides a Private item's title", () => {
    expect(newItemText({ kind: "entry", title: "Therapy", private: true }, "pt-PT")).toBe(
      "Novo evento privado",
    );
  });
});
