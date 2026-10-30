import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../index";
import { addAccount, setUpFamily, type TestBrowser } from "../test/client";

type Attachment = { id: string; name: string; contentType: string; size: number };

const TIME = {
  allDay: false,
  startDate: "2026-10-30",
  startTime: "10:00",
  endDate: null,
  endTime: null,
};

async function newEntry(browser: TestBrowser, extra: Record<string, unknown> = {}) {
  const types = (await (await browser.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string | null;
  }[];
  const res = await browser.post("/entries", {
    title: "Consulta",
    entryTypeId: types.find((t) => t.builtinKey === "general")!.id,
    time: TIME,
    personIds: [],
    ...extra,
  });
  return ((await res.json()) as { id: string }).id;
}

function attach(browser: TestBrowser, owner: string, name: string, type = "image/jpeg") {
  return browser.request("POST", `/attachments?${owner}`, new Uint8Array([1, 2, 3, 4]), {
    "Content-Type": type,
    "X-File-Name": encodeURIComponent(name),
  });
}

const list = async (browser: TestBrowser, owner: string) =>
  (await (await browser.get(`/attachments?${owner}`)).json()) as Attachment[];

describe("attachments", () => {
  it("attaches a photo to an Entry, serves it and removes it", async () => {
    const david = await setUpFamily();
    const id = await newEntry(david);
    const res = await attach(david, `entry=${id}`, "Receita médica.jpg");
    expect(res.status).toBe(201);
    const added = (await res.json()) as Attachment;
    expect(added).toMatchObject({ name: "Receita médica.jpg", contentType: "image/jpeg", size: 4 });
    expect(await list(david, `entry=${id}`)).toEqual([expect.objectContaining({ id: added.id })]);

    const file = await david.get(`/attachments/${added.id}`);
    expect(file.status).toBe(200);
    expect(file.headers.get("Content-Type")).toBe("image/jpeg");
    expect(file.headers.get("Content-Disposition")).toMatch(/^inline;/);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));

    expect((await david.delete(`/attachments/${added.id}`)).status).toBe(204);
    expect(await list(david, `entry=${id}`)).toEqual([]);
  });

  it("only ever downloads files the browser could run, such as a web page", async () => {
    const david = await setUpFamily();
    const { id } = (await (await david.post("/tasks", { title: "IRS" })).json()) as { id: string };
    const added = (await (
      await attach(david, `task=${id}`, "../página.html", "text/html")
    ).json()) as Attachment;
    expect(added.name).toBe("..página.html");
    const file = await david.get(`/attachments/${added.id}`);
    expect(file.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(file.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  });

  it("keeps a Private Entry's attachments from the Accounts it is hidden from", async () => {
    const david = await setUpFamily();
    const carla = await addAccount("carla@example.com");
    const id = await newEntry(david, { private: true });
    const added = (await (
      await attach(david, `entry=${id}`, "análises.pdf", "application/pdf")
    ).json()) as Attachment;
    expect((await carla.get(`/attachments?entry=${id}`)).status).toBe(403);
    expect((await carla.get(`/attachments/${added.id}`)).status).toBe(403);
    expect((await carla.delete(`/attachments/${added.id}`)).status).toBe(403);
    expect((await attach(carla, `entry=${id}`, "x.jpg")).status).toBe(403);
    const exported = (await (await carla.get("/export")).json()) as {
      tables: { attachment: unknown[] };
    };
    expect(exported.tables.attachment).toEqual([]);
  });

  it("moves attachments along when an Entry becomes a Task and a Task gets items", async () => {
    const david = await setUpFamily();
    const entryId = await newEntry(david);
    await attach(david, `entry=${entryId}`, "bilhete.pdf", "application/pdf");
    const { id: taskId } = (await (await david.post(`/entries/${entryId}/to-task`)).json()) as {
      id: string;
    };
    expect((await list(david, `task=${taskId}`)).map((a) => a.name)).toEqual(["bilhete.pdf"]);
    const { id: checklistId } = (await (
      await david.post(`/tasks/${taskId}/with-items`)
    ).json()) as { id: string };
    expect((await list(david, `checklist=${checklistId}`)).map((a) => a.name)).toEqual([
      "bilhete.pdf",
    ]);
  });

  it("refuses an empty file or one without an owner", async () => {
    const david = await setUpFamily();
    const id = await newEntry(david);
    const empty = await david.request("POST", `/attachments?entry=${id}`, new Uint8Array(), {
      "Content-Type": "image/png",
    });
    expect(empty.status).toBe(413);
    expect((await attach(david, "", "x.jpg")).status).toBe(400);
    expect((await attach(david, "entry=nope", "x.jpg")).status).toBe(404);
  });

  it("sweeps the files of a deleted Entry at night", async () => {
    const david = await setUpFamily();
    const id = await newEntry(david);
    await attach(david, `entry=${id}`, "a.jpg");
    const [object] = (await env.IMAGES.list({ prefix: "attachments/" })).objects;
    expect((await david.delete(`/entries/${id}`)).status).toBe(204);
    const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    later.setUTCHours(4, 5, 0, 0);
    await worker.scheduled(
      { scheduledTime: later.getTime(), cron: "*/5 * * * *" } as ScheduledController,
      env,
    );
    expect(await env.IMAGES.get(object.key)).toBeNull();
  });
});
