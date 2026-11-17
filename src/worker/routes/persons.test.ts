import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { TestBrowser, setUpFamily } from "../test/client";

type Person = {
  id: string;
  name: string;
  color: string;
  photoKey: string | null;
  dateOfBirth: string | null;
  nicknames: string[];
  archived: boolean;
};

const ANA = { name: "Ana", color: "#e07a5f", dateOfBirth: "2015-03-14", nicknames: ["Aninhas"] };

describe("Persons", () => {
  it("adds a Person with a colour, Nicknames and date of birth", async () => {
    const browser = await setUpFamily();
    const res = await browser.post("/persons", ANA);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ...ANA, photoKey: null, archived: false });
    const list = (await (await browser.get("/persons")).json()) as Person[];
    expect(list.map((p) => p.name)).toEqual(["Ana"]);
  });

  it("keeps a profile sheet, empty until filled in", async () => {
    const browser = await setUpFamily();
    const ana = (await (await browser.post("/persons", ANA)).json()) as Person & {
      profile: Record<string, unknown>;
    };
    expect(ana.profile).toEqual({
      clothes: "",
      shoes: "",
      allergies: [],
      doctor: "",
      school: "",
      notes: "",
      species: "",
      breed: "",
      chip: "",
      food: "",
    });
    expect(ana).toMatchObject({ kind: "person" });
    const res = await browser.request("PATCH", `/persons/${ana.id}`, {
      profile: { shoes: " 34 ", allergies: ["amendoim", " ", "ovo"], doctor: "Dra. Lopes" },
    });
    expect(res.status).toBe(200);
    const [stored] = (await (await browser.get("/persons")).json()) as (typeof ana)[];
    expect(stored.profile).toMatchObject({ shoes: "34", allergies: ["amendoim", "ovo"] });
    // The other details stay as they were.
    expect(stored).toMatchObject({ name: "Ana", nicknames: ["Aninhas"] });
    const bad = await browser.request("PATCH", `/persons/${ana.id}`, { profile: { shoes: 34 } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid", field: "profile.shoes" });
  });

  it("needs a name and a valid colour and date", async () => {
    const browser = await setUpFamily();
    expect((await browser.post("/persons", { ...ANA, name: " " })).status).toBe(400);
    expect((await browser.post("/persons", { ...ANA, color: "red" })).status).toBe(400);
    expect((await browser.post("/persons", { ...ANA, dateOfBirth: "2015-02-30" })).status).toBe(
      400,
    );
  });

  it("edits a Person and replaces their Nicknames", async () => {
    const browser = await setUpFamily();
    const ana = (await (await browser.post("/persons", ANA)).json()) as Person;
    const res = await browser.request("PATCH", `/persons/${ana.id}`, {
      name: "Ana Pires",
      nicknames: ["Di", "Mum", "Di"],
      dateOfBirth: null,
    });
    expect(await res.json()).toMatchObject({
      name: "Ana Pires",
      nicknames: ["Di", "Mum"],
      dateOfBirth: null,
      color: "#e07a5f",
    });
  });

  it("archives and unarchives a Person", async () => {
    const browser = await setUpFamily();
    const ana = (await (await browser.post("/persons", ANA)).json()) as Person;
    await browser.request("PATCH", `/persons/${ana.id}`, { archived: true });
    const [archived] = (await (await browser.get("/persons")).json()) as Person[];
    expect(archived.archived).toBe(true);
    await browser.request("PATCH", `/persons/${ana.id}`, { archived: false });
    const [back] = (await (await browser.get("/persons")).json()) as Person[];
    expect(back.archived).toBe(false);
  });

  it("deletes a Person nothing mentions", async () => {
    const browser = await setUpFamily();
    const ana = (await (await browser.post("/persons", ANA)).json()) as Person;
    expect((await browser.delete(`/persons/${ana.id}`)).status).toBe(204);
    expect(await (await browser.get("/persons")).json()).toEqual([]);
  });

  it("is only for Signed-in Devices", async () => {
    await setUpFamily();
    expect((await new TestBrowser().get("/persons")).status).toBe(401);
  });
});

describe("photos", () => {
  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

  it("stores a photo under a new random key, served only with a session", async () => {
    const browser = await setUpFamily();
    const upload = await browser.upload("/images", PNG, "image/png");
    expect(upload.status).toBe(201);
    const { key } = (await upload.json()) as { key: string };

    const ana = (await (
      await browser.post("/persons", { ...ANA, photoKey: key })
    ).json()) as Person;
    expect(ana.photoKey).toBe(key);

    const image = await browser.get(`/images/${key}`);
    expect(image.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(PNG);
    expect((await new TestBrowser().get(`/images/${key}`)).status).toBe(401);

    const second = (await (await browser.upload("/images", PNG, "image/png")).json()) as {
      key: string;
    };
    expect(second.key).not.toBe(key);
  });

  it("refuses other file types", async () => {
    const browser = await setUpFamily();
    expect((await browser.upload("/images", PNG, "text/html")).status).toBe(415);
  });

  it("does not serve attachments or unknown keys", async () => {
    const browser = await setUpFamily();
    const types = (await (await browser.get("/entry-types")).json()) as { id: string }[];
    const entry = (await (
      await browser.post("/entries", {
        title: "Consulta",
        entryTypeId: types[0]!.id,
        time: {
          allDay: false,
          startDate: "2026-10-30",
          startTime: "10:00",
          endDate: null,
          endTime: null,
        },
        personIds: [],
      })
    ).json()) as { id: string };
    const upload = await browser.request(
      "POST",
      `/attachments?entry=${entry.id}`,
      new TextEncoder().encode("<script>alert(1)</script>"),
      { "Content-Type": "text/html", "X-File-Name": "x.html" },
    );
    expect(upload.status).toBe(201);
    const { objects } = await env.IMAGES.list({ prefix: "attachments/" });
    expect(objects).toHaveLength(1);

    const key = encodeURIComponent(objects[0]!.key);
    expect((await browser.get(`/images/${key}`)).status).toBe(404);
    expect((await browser.get("/images/never-uploaded")).status).toBe(404);
  });
});
