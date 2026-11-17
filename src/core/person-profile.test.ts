import { describe, expect, it } from "vitest";
import { allergyWarnings, EMPTY_PROFILE, parseProfile, readProfile } from "./person-profile";

describe("Person profile", () => {
  it("is cleaned: trimmed, allergies without blanks or repeats", () => {
    expect(
      parseProfile({ clothes: " 10 anos ", allergies: [" amendoim", "", "amendoim", "Ovo"] }),
    ).toEqual({
      profile: { ...EMPTY_PROFILE, clothes: "10 anos", allergies: ["amendoim", "Ovo"] },
    });
  });

  it("names the bad field", () => {
    expect(parseProfile("x")).toEqual({ field: "profile" });
    expect(parseProfile({ shoes: 34 })).toEqual({ field: "profile.shoes" });
    expect(parseProfile({ chip: "x".repeat(201) })).toEqual({ field: "profile.chip" });
    expect(parseProfile({ allergies: "ovo" })).toEqual({ field: "profile.allergies" });
    expect(parseProfile({ allergies: Array.from({ length: 21 }, (_, i) => `a${i}`) })).toEqual({
      field: "profile.allergies",
    });
    expect(parseProfile({ notes: "x".repeat(2001) })).toEqual({ field: "profile.notes" });
  });

  it("reads an old or broken stored value as empty", () => {
    expect(readProfile(null)).toEqual(EMPTY_PROFILE);
    expect(readProfile({ shoes: "34" })).toEqual({ ...EMPTY_PROFILE, shoes: "34" });
  });
});

describe("Allergy warnings", () => {
  const persons = [
    { name: "Bia", profile: { allergies: ["amendoim", "ovo"] } },
    { name: "Avô", archived: true, profile: { allergies: ["leite"] } },
    { name: "Rui", profile: { allergies: ["frutos secos"] } },
  ];

  it("match whole words, without case, accents or a plural", () => {
    expect(
      allergyWarnings(["Manteiga de Amendoim", "2 Ovos", "Leite", "Frutos secos picados"], persons),
    ).toEqual([
      { person: "Bia", allergy: "amendoim", ingredient: "Manteiga de Amendoim" },
      { person: "Bia", allergy: "ovo", ingredient: "2 Ovos" },
      { person: "Rui", allergy: "frutos secos", ingredient: "Frutos secos picados" },
    ]);
  });

  it("don't match part of a word", () => {
    expect(allergyWarnings(["Novos sabores", "Secos"], persons)).toEqual([]);
  });
});
