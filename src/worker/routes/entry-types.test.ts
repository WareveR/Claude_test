import { describe, expect, it } from "vitest";
import { setUpFamily } from "../test/client";

type EntryType = {
  id: string;
  builtinKey: string | null;
  name: string | null;
  color: string;
  icon: string | null;
  thumbnailKey: string | null;
  defaults: Record<string, unknown>;
  deletable: boolean;
};

async function types(browser: Awaited<ReturnType<typeof setUpFamily>>) {
  return (await (await browser.get("/entry-types")).json()) as EntryType[];
}

describe("Entry Types", () => {
  it("starts with the seven built-in types, unnamed so each device translates them", async () => {
    const browser = await setUpFamily();
    const list = await types(browser);
    expect(list.map((t) => t.builtinKey)).toEqual([
      "birthday",
      "holiday",
      "appointment",
      "booking",
      "activity",
      "event",
      "general",
    ]);
    expect(list.every((t) => t.name === null)).toBe(true);
    expect(list.find((t) => t.builtinKey === "birthday")?.defaults).toMatchObject({
      allDay: true,
      repetition: { frequency: "yearly", interval: 1 },
      reminders: [4320, 0],
    });
    expect(list.find((t) => t.builtinKey === "appointment")?.defaults).toMatchObject({
      reminders: [1440, 60],
    });
  });

  it("renames, recolours and changes the icon of a built-in type", async () => {
    const browser = await setUpFamily();
    const holiday = (await types(browser)).find((t) => t.builtinKey === "holiday")!;
    const res = await browser.request("PATCH", `/entry-types/${holiday.id}`, {
      name: "Férias",
      color: "#00897B",
      icon: "sun",
    });
    expect(await res.json()).toMatchObject({ name: "Férias", color: "#00897b", icon: "sun" });
  });

  it("creates a custom type with defaults", async () => {
    const browser = await setUpFamily();
    const res = await browser.post("/entry-types", {
      name: "Swimming",
      color: "#1e88e5",
      icon: "trophy",
      defaults: {
        allDay: false,
        startTime: "18:30",
        durationMinutes: 45,
        importance: "high",
        location: "Piscina municipal",
        repetition: { frequency: "weekly", interval: 1, weekdays: [1, 3], end: { type: "never" } },
        reminders: [60, 1440, 60],
      },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      builtinKey: null,
      name: "Swimming",
      deletable: true,
      defaults: { startTime: "18:30", reminders: [1440, 60], importance: "high" },
    });
    expect((await types(browser)).at(-1)?.name).toBe("Swimming");
  });

  it("checks names, colours, icons and defaults", async () => {
    const browser = await setUpFamily();
    const base = { name: "X", color: "#000000" };
    expect((await browser.post("/entry-types", { ...base, name: "" })).status).toBe(400);
    expect((await browser.post("/entry-types", { ...base, icon: "rocket" })).status).toBe(400);
    expect(
      (await browser.post("/entry-types", { ...base, defaults: { startTime: "25:00" } })).status,
    ).toBe(400);
    expect(
      (await browser.post("/entry-types", { ...base, defaults: { importance: "urgent" } })).status,
    ).toBe(400);
  });

  it("deletes a type but never Birthday or General", async () => {
    const browser = await setUpFamily();
    const list = await types(browser);
    for (const key of ["birthday", "general"]) {
      const type = list.find((t) => t.builtinKey === key)!;
      expect(type.deletable).toBe(false);
      expect((await browser.delete(`/entry-types/${type.id}`)).status).toBe(409);
    }
    const booking = list.find((t) => t.builtinKey === "booking")!;
    expect((await browser.delete(`/entry-types/${booking.id}`)).status).toBe(204);
    expect((await types(browser)).map((t) => t.builtinKey)).not.toContain("booking");
  });
});
