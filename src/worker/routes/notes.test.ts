import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addAccount, setUpFamily } from "../test/client";
import { MAX_NOTES } from "./notes";

type Note = { id: string; text: string; color: string; until: string | null; author: string };

const YELLOW = "#fff59d";
const notes = async (browser: Awaited<ReturnType<typeof setUpFamily>>) =>
  (await (await browser.get("/notes")).json()) as Note[];

describe("Notes", () => {
  it("are written, listed newest first with their author, and removed by anyone", async () => {
    const browser = await setUpFamily();
    const first = await browser.post("/notes", {
      text: "  Há sopa ",
      color: YELLOW,
      keep: "today",
    });
    expect(first.status).toBe(201);
    const sopa = (await first.json()) as Note;
    expect(sopa).toMatchObject({ text: "Há sopa", color: YELLOW });
    expect(sopa.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const other = await addAccount("rita@example.com");
    await other.post("/notes", {
      id: "n-cao",
      text: "O cão já comeu",
      color: "#bbdefb",
      keep: "removed",
    });
    const listed = await notes(browser);
    expect(listed.map((n) => n.text)).toEqual(["O cão já comeu", "Há sopa"]);
    expect(listed[0]).toMatchObject({ id: "n-cao", until: null });

    // Another Account removes the first one.
    expect((await other.delete(`/notes/${sopa.id}`)).status).toBe(204);
    expect((await other.delete(`/notes/${sopa.id}`)).status).toBe(404);
    expect((await notes(browser)).map((n) => n.text)).toEqual(["O cão já comeu"]);
  });

  it("refuse empty or long text, unknown colours and lengths of stay", async () => {
    const browser = await setUpFamily();
    const bad = [
      { text: " ", color: YELLOW, keep: "today" },
      { text: "x".repeat(201), color: YELLOW, keep: "today" },
      { text: "Olá", color: "red", keep: "today" },
      { text: "Olá", color: YELLOW, keep: "forever" },
      { id: "a b", text: "Olá", color: YELLOW, keep: "today" },
    ];
    for (const body of bad) expect((await browser.post("/notes", body)).status).toBe(400);
    expect(await notes(browser)).toEqual([]);
  });

  it("stop showing after their last day and are cleared when the next is written", async () => {
    const browser = await setUpFamily();
    await env.DB.prepare(
      "INSERT INTO note (id, text, color, until, created_at) VALUES ('old', 'Ontem', ?, '2020-01-01', '2020-01-01T08:00:00Z')",
    )
      .bind(YELLOW)
      .run();
    expect(await notes(browser)).toEqual([]);
    await browser.post("/notes", { text: "Hoje", color: YELLOW, keep: "tomorrow" });
    const left = await env.DB.prepare("SELECT id FROM note").all();
    expect(left.results.map((r) => r.id)).not.toContain("old");
  });

  it("are at most a Wall's worth", async () => {
    const browser = await setUpFamily();
    for (let i = 0; i < MAX_NOTES; i++) {
      await browser.post("/notes", { text: `N${i}`, color: YELLOW, keep: "removed" });
    }
    expect(
      (await browser.post("/notes", { text: "Mais", color: YELLOW, keep: "removed" })).status,
    ).toBe(409);
  });
});
