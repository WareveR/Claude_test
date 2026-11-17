import { describe, expect, it } from "vitest";
import { setUpFamily } from "../test/client";

type Contact = { id: string; name: string; role: string; phone: string; personId: string | null };

describe("Contacts", () => {
  it("are added, listed by name, changed and removed", async () => {
    const browser = await setUpFamily();
    const bia = (await (
      await browser.post("/persons", { name: "Bia", color: "#c8e6c9", nicknames: [] })
    ).json()) as { id: string };
    const res = await browser.post("/contacts", {
      name: "Dra. Lopes",
      role: "Pediatra",
      phone: "912 345 678",
      personId: bia.id,
    });
    expect(res.status).toBe(201);
    const lopes = (await res.json()) as Contact;
    await browser.post("/contacts", { name: "Canalizador Rui", phone: "+351 911 111 111" });
    const list = (await (await browser.get("/contacts")).json()) as Contact[];
    expect(list.map((c) => c.name)).toEqual(["Canalizador Rui", "Dra. Lopes"]);

    const changed = await browser.request("PUT", `/contacts/${lopes.id}`, {
      name: "Dra. Ana Lopes",
      role: "Pediatra",
      phone: "912 345 678",
      personId: bia.id,
    });
    expect(await changed.json()).toMatchObject({ name: "Dra. Ana Lopes", personId: bia.id });

    // Deleting the Person leaves the Contact for the Family.
    await browser.delete(`/persons/${bia.id}`);
    const after = (await (await browser.get("/contacts")).json()) as Contact[];
    expect(after.find((c) => c.id === lopes.id)?.personId).toBeNull();

    expect((await browser.delete(`/contacts/${lopes.id}`)).status).toBe(204);
    expect((await browser.delete(`/contacts/${lopes.id}`)).status).toBe(404);
  });

  it("refuse a bad phone, email or Person", async () => {
    const browser = await setUpFamily();
    expect((await browser.post("/contacts", { name: "X", phone: "abc" })).status).toBe(400);
    expect((await browser.post("/contacts", { name: "X", email: "x@" })).status).toBe(400);
    expect((await browser.post("/contacts", { name: "X", personId: "nobody" })).status).toBe(400);
    expect((await browser.request("PUT", "/contacts/nobody", { name: "X" })).status).toBe(404);
  });
});
