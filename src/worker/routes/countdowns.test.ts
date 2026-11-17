import { describe, expect, it } from "vitest";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

/** A day within the coming year, after Christmas would come only if it is near. */
const SOON = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

type Answer = {
  items: { kind: string; title: string; entryId: string | null }[];
  marked: string[];
};

async function newEntry(browser: TestBrowser, title: string, extra: object = {}) {
  const types = (await (await browser.get("/entry-types")).json()) as { id: string }[];
  const res = await browser.post("/entries", {
    title,
    entryTypeId: types[0].id,
    time: { allDay: true, startDate: SOON, endDate: SOON },
    personIds: [],
    importance: "normal",
    location: "",
    notes: "",
    icon: null,
    private: false,
    reminders: [],
    repetition: null,
    birthYearKnown: false,
    ...extra,
  });
  return ((await res.json()) as { id: string }).id;
}

const countdowns = async (browser: TestBrowser) =>
  (await (await browser.get("/countdowns")).json()) as Answer;

describe("Countdowns", () => {
  it("count to Christmas by themselves and to the Entries marked for it", async () => {
    const browser = await setUpFamily();
    expect((await countdowns(browser)).items.map((i) => i.kind)).toEqual(["christmas"]);
    const ferias = await newEntry(browser, "Férias");
    expect((await browser.request("PUT", `/countdowns/${ferias}`)).status).toBe(204);
    // Marking twice is no different.
    expect((await browser.request("PUT", `/countdowns/${ferias}`)).status).toBe(204);
    const marked = await countdowns(browser);
    expect(marked.marked).toEqual([ferias]);
    expect(marked.items.map((i) => i.title)).toContain("Férias");

    expect((await browser.delete(`/countdowns/${ferias}`)).status).toBe(204);
    expect((await countdowns(browser)).marked).toEqual([]);
    expect((await browser.request("PUT", "/countdowns/nothing")).status).toBe(404);
  });

  it("never show a Private Entry, and keep a hidden one from other Accounts", async () => {
    const browser = await setUpFamily();
    const secret = await newEntry(browser, "Surpresa", { private: true });
    await browser.request("PUT", `/countdowns/${secret}`);
    const mine = await countdowns(browser);
    expect(mine.marked).toEqual([secret]);
    expect(mine.items.map((i) => i.title)).not.toContain("Surpresa");

    const other = await addAccount("rita@example.com");
    expect((await countdowns(other)).marked).toEqual([]);
    expect((await other.delete(`/countdowns/${secret}`)).status).toBe(404);
  });
});
