import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

const TIME = {
  allDay: false,
  startDate: "2026-10-23",
  startTime: "10:00",
  endDate: "2026-10-23",
  endTime: "11:00",
};

type Item = { id: string; title: string; notes: string; hidden: boolean; personIds: string[] };

async function generalType(browser: TestBrowser) {
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string | null;
  }[];
  return types.find((t) => t.builtinKey === "general")!.id;
}

/** David (Owner), his wife Carla and Rui, each with an Account for their own Person. */
async function family() {
  const david = await setUpFamily();
  const person = async (name: string) =>
    ((await (await david.post("/persons", { name, color: "#e07a5f" })).json()) as { id: string })
      .id;
  const ids = {
    david: await person("David"),
    carla: await person("Carla"),
    rui: await person("Rui"),
  };
  const carla = await addAccount("carla@example.com", "member", "198.51.100.30");
  const rui = await addAccount("rui@example.com", "admin", "198.51.100.31");
  for (const [email, personId] of [
    ["david@example.com", ids.david],
    ["carla@example.com", ids.carla],
    ["rui@example.com", ids.rui],
  ]) {
    await env.DB.prepare("UPDATE account SET person_id = ? WHERE email = ?")
      .bind(personId, email)
      .run();
  }
  return { david, carla, rui, ids, typeId: await generalType(david) };
}

const entries = async (browser: TestBrowser) =>
  (await (await browser.get("/entries?from=2026-10-01&to=2026-10-31")).json()) as Item[];

describe("Private per person", () => {
  it("shows a Private Entry in full to its creator and its Persons, and only its time to others", async () => {
    const { david, carla, rui, ids, typeId } = await family();
    const res = await david.post("/entries", {
      title: "Massagem",
      notes: "Sala 2",
      entryTypeId: typeId,
      time: TIME,
      personIds: [ids.carla],
      private: true,
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as Item;

    for (const who of [david, carla]) {
      const [entry] = await entries(who);
      expect(entry).toMatchObject({ title: "Massagem", notes: "Sala 2", hidden: false });
    }
    const [seen] = await entries(rui);
    expect(seen).toMatchObject({ id, title: "", notes: "", hidden: true, personIds: [ids.carla] });
    expect(((await (await rui.get(`/entries/${id}`)).json()) as Item).title).toBe("");

    // Rui can't change, delete or turn it into a Task.
    const body = { title: "x", entryTypeId: typeId, time: TIME, personIds: [], private: false };
    expect((await rui.request("PUT", `/entries/${id}`, body)).status).toBe(403);
    expect((await rui.delete(`/entries/${id}`)).status).toBe(403);
    expect((await rui.post(`/entries/${id}/to-task`)).status).toBe(403);
    expect((await carla.request("PUT", `/entries/${id}`, { ...body, private: true })).status).toBe(
      200,
    );
  });

  it("hides a Private Task the same way, and keeps it hidden when it repeats", async () => {
    const { david, carla } = await family();
    const { id } = (await (
      await carla.post("/tasks", {
        title: "Marcar dentista",
        dueDate: "2026-10-23",
        repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
        private: true,
      })
    ).json()) as Item;
    const own = (await (await carla.get("/tasks")).json()) as Item[];
    expect(own[0]).toMatchObject({ title: "Marcar dentista", hidden: false });
    const other = (await (await david.get("/tasks")).json()) as Item[];
    expect(other[0]).toMatchObject({ id, title: "", hidden: true });
    expect((await david.post(`/tasks/${id}/done`)).status).toBe(403);

    expect((await carla.post(`/tasks/${id}/done`)).status).toBe(200);
    const next = ((await (await david.get("/tasks")).json()) as Item[]).find((t) => t.id !== id);
    expect(next).toMatchObject({ title: "", hidden: true });
  });

  it("does not let someone else give items to a Private Task", async () => {
    const { david, carla } = await family();
    const { id } = (await (
      await carla.post("/tasks", { title: "Marcar dentista", dueDate: "2026-10-23", private: true })
    ).json()) as Item;
    const res = await david.post(`/tasks/${id}/with-items`);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "private" });
    expect(text).not.toContain("Marcar dentista");
    const own = (await (await carla.get("/tasks")).json()) as Item[];
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ id, title: "Marcar dentista", hidden: false });
  });

  it("leaves hidden Private items out of a voice change and blanks them in the Export", async () => {
    const { david, rui, ids, typeId } = await family();
    await david.post("/entries", {
      title: "Consulta",
      notes: "análises",
      entryTypeId: typeId,
      time: TIME,
      personIds: [ids.david],
      private: true,
    });
    const exported = (await (await rui.get("/export")).json()) as {
      tables: { entry: { title: string; notes: string }[] };
    };
    expect(exported.tables.entry[0]).toMatchObject({ title: "", notes: "" });
    const ics = await (await rui.get("/export/entries.ics")).text();
    expect(ics).not.toContain("Consulta");
    expect(ics).toContain("SUMMARY:Ocupado");
    expect(await (await david.get("/export/entries.ics")).text()).toContain("SUMMARY:Consulta");
  });

  it("hides the type, importance, icon and reminders of a hidden Private Entry and its exceptions", async () => {
    const { david, rui, ids, typeId } = await family();
    const types = (await (await david.get("/entry-types")).json()) as {
      id: string;
      builtinKey: string | null;
    }[];
    const medical = types.find((t) => t.builtinKey !== "general")!.id;
    const weekly = { frequency: "weekly", interval: 1, end: { type: "never" } };
    const base = {
      title: "Consulta",
      entryTypeId: medical,
      time: TIME,
      personIds: [ids.david],
      importance: "high",
      icon: "heart",
      reminders: [3600],
      private: true,
    };
    const { id } = (await (
      await david.post("/entries", { ...base, repetition: weekly })
    ).json()) as Item;
    const res = await david.request("PUT", `/entries/${id}/occurrences/2026-10-30`, {
      ...base,
      repetition: weekly,
    });
    expect(res.status).toBe(200);

    type Seen = {
      entryTypeId: string;
      importance: string;
      icon: string | null;
      reminders: number[];
      exceptions: { override: Record<string, unknown> }[];
    };
    const [own] = (await entries(david)) as unknown as Seen[];
    expect(own).toMatchObject({ entryTypeId: medical, importance: "high", icon: "heart" });
    expect(own.exceptions[0].override).toMatchObject({ entryTypeId: medical, icon: "heart" });

    const [seen] = (await entries(rui)) as unknown as Seen[];
    expect(seen).toMatchObject({
      entryTypeId: typeId,
      importance: "normal",
      icon: null,
      reminders: [],
    });
    expect(seen.exceptions[0].override).toMatchObject({
      entryTypeId: typeId,
      importance: "normal",
      icon: null,
      reminders: [],
      hidden: true,
    });

    const exported = (await (await rui.get("/export")).json()) as {
      tables: {
        entry: { entry_type_id: string; importance: string; icon: string | null }[];
        occurrence_exception: { override: string }[];
      };
    };
    expect(exported.tables.entry[0]).toMatchObject({
      entry_type_id: typeId,
      importance: "normal",
      icon: null,
    });
    expect(JSON.parse(exported.tables.occurrence_exception[0].override)).toMatchObject({
      entryTypeId: typeId,
      importance: "normal",
      icon: null,
      reminders: [],
    });
  });

  it("shows a hidden Private Task with normal importance", async () => {
    const { david, carla } = await family();
    await carla.post("/tasks", {
      title: "Marcar dentista",
      dueDate: "2026-10-23",
      importance: "high",
      private: true,
    });
    const own = (await (await carla.get("/tasks")).json()) as { importance: string }[];
    expect(own[0].importance).toBe("high");
    const other = (await (await david.get("/tasks")).json()) as { importance: string }[];
    expect(other[0].importance).toBe("normal");
  });
});
