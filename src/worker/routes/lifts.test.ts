import { describe, expect, it } from "vitest";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

async function newEntry(browser: TestBrowser, title: string, extra: object = {}) {
  const types = (await (await browser.get("/entry-types")).json()) as { id: string }[];
  const res = await browser.post("/entries", {
    title,
    entryTypeId: types[0].id,
    time: {
      allDay: false,
      startDate: "2026-11-20",
      startTime: "17:00",
      endDate: "2026-11-20",
      endTime: "18:00",
    },
    personIds: [],
    importance: "normal",
    location: "",
    notes: "",
    icon: null,
    private: false,
    reminders: [],
    repetition: null,
    ...extra,
  });
  return ((await res.json()) as { id: string }).id;
}

const lifts = async (browser: TestBrowser) =>
  (await (await browser.get("/lifts")).json()) as { entryId: string; dropOffId: string | null }[];

describe("Lifts", () => {
  it("are set, changed and taken away on an Entry", async () => {
    const browser = await setUpFamily();
    const rui = (
      (await (await browser.post("/persons", { name: "Rui", color: "#e07a5f" })).json()) as {
        id: string;
      }
    ).id;
    const ballet = await newEntry(browser, "Ballet");
    const res = await browser.request("PUT", `/lifts/${ballet}`, {});
    expect(await res.json()).toEqual({ entryId: ballet, dropOffId: null, pickUpId: null });
    await browser.request("PUT", `/lifts/${ballet}`, { dropOffId: rui });
    expect(await lifts(browser)).toEqual([{ entryId: ballet, dropOffId: rui, pickUpId: null }]);
    expect((await browser.request("PUT", `/lifts/${ballet}`, { pickUpId: "nobody" })).status).toBe(
      400,
    );
    expect((await browser.delete(`/lifts/${ballet}`)).status).toBe(204);
    expect(await lifts(browser)).toEqual([]);
    // Deleting the Entry takes its Lift with it.
    await browser.request("PUT", `/lifts/${ballet}`, {});
    await browser.delete(`/entries/${ballet}`);
    expect(await lifts(browser)).toEqual([]);
  });

  it("of a hidden Private Entry are kept from other Accounts", async () => {
    const browser = await setUpFamily();
    const secret = await newEntry(browser, "Consulta", { private: true });
    await browser.request("PUT", `/lifts/${secret}`, {});
    expect(await lifts(browser)).toHaveLength(1);
    const other = await addAccount("rita@example.com");
    expect(await lifts(other)).toEqual([]);
    expect((await other.request("PUT", `/lifts/${secret}`, {})).status).toBe(404);
    expect((await other.delete(`/lifts/${secret}`)).status).toBe(404);
  });
});
