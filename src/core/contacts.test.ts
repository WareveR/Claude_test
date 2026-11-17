import { describe, expect, it } from "vitest";
import { contactsFor, parseContact, telHref } from "./contacts";

describe("Contacts", () => {
  it("are cleaned and checked", () => {
    expect(
      parseContact({ name: " Dra. Lopes ", role: "Pediatra", phone: "+351 912 345 678" }),
    ).toEqual({
      contact: {
        name: "Dra. Lopes",
        role: "Pediatra",
        phone: "+351 912 345 678",
        email: "",
        personId: null,
        notes: "",
      },
    });
    expect(parseContact({ name: "" })).toEqual({ field: "name" });
    expect(parseContact({ name: "X", phone: "liga-me" })).toEqual({ field: "phone" });
    expect(parseContact({ name: "X", email: "nope" })).toEqual({ field: "email" });
    expect(parseContact({ name: "X", personId: 3 })).toEqual({ field: "personId" });
  });

  it("dial digits only", () => {
    expect(telHref("+351 912 345-678")).toBe("tel:+351912345678");
  });

  it("are found by name or role in an Entry's title or place", () => {
    const contacts = [
      { name: "Dra. Lopes", role: "Pediatra" },
      { name: "Sr. Rui", role: "Canalizador" },
      { name: "Clínica Sorriso", role: "Dentista" },
      { name: "Bo", role: "" },
    ];
    expect(contactsFor(contacts, ["Consulta pediatra Bia", ""])).toEqual([contacts[0]]);
    expect(contactsFor(contacts, ["Dentes", "Clinica Sorriso, Braga"])).toEqual([contacts[2]]);
    expect(contactsFor(contacts, ["Canalizadores", ""])).toEqual([]);
    // Too short a name is never matched alone.
    expect(contactsFor(contacts, ["Bo dia", ""])).toEqual([]);
    // Words don't run from the title into the place.
    expect(contactsFor(contacts, ["Clínica", "Sorriso"])).toEqual([]);
  });
});
