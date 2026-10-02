import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker from "../index";
import { encryptPayload, fromBase64Url, pusher, toBase64Url, vapidAuthorization } from "../push";
import type { PushMessage } from "../push";
import { PASSWORD, setUpFamily, TestBrowser } from "../test/client";

type Sent = { endpoint: string; message: PushMessage };
let sent: Sent[] = [];
let goneEndpoints = new Set<string>();
const realSend = pusher.send;

beforeEach(() => {
  sent = [];
  goneEndpoints = new Set();
  pusher.send = async (_env, subscription, message) => {
    sent.push({ endpoint: subscription.endpoint, message });
    const gone = goneEndpoints.has(subscription.endpoint);
    return { ok: !gone, gone };
  };
});
afterEach(() => {
  pusher.send = realSend;
});

function runScheduler(iso: string) {
  const controller = { scheduledTime: Date.parse(iso), cron: "*/5 * * * *" };
  return worker.scheduled(controller as ScheduledController, env);
}

async function browserKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, p256dh: toBase64Url(raw), auth: toBase64Url(auth) };
}

async function subscribe(browser: TestBrowser, name: string) {
  const { p256dh, auth } = await browserKeys();
  const endpoint = `https://fcm.googleapis.com/fcm/send/${name}`;
  const res = await browser.request("PUT", "/device/push", { endpoint, keys: { p256dh, auth } });
  expect(res.status).toBe(200);
  return endpoint;
}

async function family() {
  const phone = await setUpFamily();
  const person = async (name: string) =>
    ((await (await phone.post("/persons", { name, color: "#e07a5f" })).json()) as { id: string })
      .id;
  const ana = await person("Ana");
  const rui = await person("Rui");
  const types = (await (await phone.get("/entry-types")).json()) as {
    id: string;
    builtinKey: string;
  }[];
  const typeId = types.find((t) => t.builtinKey === "appointment")!.id;
  const add = async (title: string, extra: Record<string, unknown>) =>
    (
      (await (
        await phone.post("/entries", {
          title,
          entryTypeId: typeId,
          personIds: [],
          notes: "secret notes",
          ...extra,
        })
      ).json()) as { id: string; error?: string }
    ).id;
  return { phone, ana, rui, add };
}

describe("Reminders", () => {
  it("sends each Occurrence's Reminders once, to the devices whose Persons match", async () => {
    const { phone, ana, rui, add } = await family();
    const dentist = await add("Dentist", {
      time: {
        allDay: false,
        startDate: "2026-10-03",
        startTime: "10:00",
        endDate: null,
        endTime: null,
      },
      personIds: [ana],
      reminders: [60],
    });
    await add("School trip", {
      time: { allDay: true, startDate: "2026-10-03", endDate: "2026-10-03" },
      reminders: [0],
    });
    await add("Therapy", {
      time: {
        allDay: false,
        startDate: "2026-10-03",
        startTime: "11:00",
        endDate: null,
        endTime: null,
      },
      personIds: [rui],
      private: true,
      reminders: [60],
    });
    await add("Swimming", {
      time: {
        allDay: false,
        startDate: "2026-09-26",
        startTime: "10:00",
        endDate: null,
        endTime: null,
      },
      personIds: [ana],
      repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
      reminders: [60],
    });

    const phoneEndpoint = await subscribe(phone, "phone");
    const tablet = new TestBrowser("192.0.2.30");
    await tablet.post("/session", { password: PASSWORD });
    await tablet.request("PATCH", "/device", { language: "en" });
    await tablet.request("PUT", "/device/reminders", {
      remindersOn: true,
      reminderPersonIds: [rui],
    });
    const tabletEndpoint = await subscribe(tablet, "tablet");
    const off = new TestBrowser("192.0.2.31");
    await off.post("/session", { password: PASSWORD });
    await off.request("PUT", "/device/reminders", { remindersOn: false, reminderPersonIds: null });
    await subscribe(off, "off");

    await runScheduler("2026-10-03T07:55:00Z"); // 08:55 in Lisbon
    expect(sent).toEqual([]);
    await runScheduler("2026-10-03T08:00:00Z"); // 09:00
    await runScheduler("2026-10-03T08:00:30Z");
    const to = (endpoint: string) =>
      sent.filter((s) => s.endpoint === endpoint).map((s) => s.message.title);
    expect(to(phoneEndpoint).sort()).toEqual(["Dentist, 10:00", "School trip", "Swimming, 10:00"]);
    expect(to(tabletEndpoint)).toEqual(["School trip"]);
    expect(sent.find((s) => s.message.title === "Dentist, 10:00")?.message.url).toBe(
      `/entries/${dentist}?occurrence=2026-10-03`,
    );
    expect(JSON.stringify(sent)).not.toContain("secret notes");

    sent = [];
    await runScheduler("2026-10-03T09:00:00Z"); // 10:00, but more than one run later
    expect(to(phoneEndpoint)).toEqual(["Lembrete às 11:00"]);
    expect(to(tabletEndpoint)).toEqual(["Reminder at 11:00"]);
  });

  it("reminds dated Tasks at their due time or 09:00, and Checklists on their first day", async () => {
    const { phone, rui } = await family();
    const task = async (body: Record<string, unknown>) =>
      ((await (await phone.post("/tasks", { personIds: [], ...body })).json()) as { id: string })
        .id;
    const pay = await task({ title: "Pay the school", dueDate: "2026-10-03" });
    await task({ title: "Call the bank", dueDate: "2026-10-03", dueTime: "09:00", private: true });
    await task({ title: "Undated", dueDate: null });
    const done = await task({ title: "Done already", dueDate: "2026-10-03" });
    await phone.post(`/tasks/${done}/done`);
    const school = (
      (await (
        await phone.post("/checklists", {
          name: "Back to school",
          startDate: "2026-10-03",
          endDate: "2026-10-10",
        })
      ).json()) as { id: string }
    ).id;
    await task({ title: "Pencils", checklistId: school, personIds: [rui] });
    await phone.post("/checklists", {
      name: "Quiet one",
      startDate: "2026-10-03",
      endDate: "2026-10-10",
      remindAtStart: false,
    });
    const endpoint = await subscribe(phone, "phone");

    await runScheduler("2026-10-03T07:55:00Z");
    await runScheduler("2026-10-03T08:00:00Z"); // 09:00 in Lisbon
    expect(sent.map((s) => s.message.title).sort()).toEqual([
      "Back to school",
      "Lembrete às 09:00",
      "Pay the school",
    ]);
    expect(sent.find((s) => s.message.title === "Pay the school")?.message.url).toBe(
      `/tasks/${pay}`,
    );
    expect(sent.find((s) => s.message.title === "Back to school")?.message.url).toBe(
      `/checklists/${school}`,
    );
    expect(sent.every((s) => s.endpoint === endpoint)).toBe(true);
  });

  it("removes a subscription the push service says is gone", async () => {
    const { phone, add } = await family();
    await add("Dentist", {
      time: {
        allDay: false,
        startDate: "2026-10-03",
        startTime: "10:00",
        endDate: null,
        endTime: null,
      },
      reminders: [0],
    });
    const endpoint = await subscribe(phone, "phone");
    goneEndpoints.add(endpoint);
    await runScheduler("2026-10-03T08:55:00Z");
    await runScheduler("2026-10-03T09:00:00Z");
    expect(sent).toHaveLength(1);
    expect(((await (await phone.get("/device")).json()) as { push: boolean }).push).toBe(false);
  });

  it("only accepts subscriptions from the browsers' push services", async () => {
    const browser = await setUpFamily();
    const { p256dh, auth } = await browserKeys();
    const put = (endpoint: string) =>
      browser.request("PUT", "/device/push", { endpoint, keys: { p256dh, auth } });
    expect((await put("https://evil.example/push")).status).toBe(400);
    expect((await put("http://fcm.googleapis.com/fcm/send/x")).status).toBe(400);
    expect((await put("https://web.push.apple.com/abc")).status).toBe(200);
    expect(
      (
        await browser.request("PUT", "/device/reminders", {
          remindersOn: true,
          reminderPersonIds: ["x"],
        })
      ).status,
    ).toBe(400);
    expect(
      ((await (await browser.get("/push/key")).json()) as { publicKey: string }).publicKey,
    ).toBe(env.VAPID_PUBLIC_KEY);
  });
});

describe("Web Push", () => {
  it("encrypts so the browser can read it (RFC 8291)", async () => {
    const { pair, p256dh, auth } = await browserKeys();
    const body = await encryptPayload(
      { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh, auth } },
      '{"title":"Dentist, 10:00"}',
    );
    // The browser's side.
    const salt = body.slice(0, 16);
    const idLength = body[20];
    const asPublic = body.slice(21, 21 + idLength);
    const ciphertext = body.slice(21 + idLength);
    const hmac = async (key: Uint8Array, data: Uint8Array) =>
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, [
            "sign",
          ]),
          data,
        ),
      );
    const asKey = await crypto.subtle.importKey(
      "raw",
      asPublic,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const ecdh = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "ECDH", public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
        pair.privateKey,
        256,
      ),
    );
    const text = new TextEncoder();
    const prkKey = await hmac(fromBase64Url(auth), ecdh);
    const info = new Uint8Array([
      ...text.encode("WebPush: info\0"),
      ...fromBase64Url(p256dh),
      ...asPublic,
      1,
    ]);
    const prk = await hmac(salt, await hmac(prkKey, info));
    const cek = (await hmac(prk, text.encode("Content-Encoding: aes128gcm\0\x01"))).slice(0, 16);
    const nonce = (await hmac(prk, text.encode("Content-Encoding: nonce\0\x01"))).slice(0, 12);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]),
        ciphertext,
      ),
    );
    expect(plain.at(-1)).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe('{"title":"Dentist, 10:00"}');
  });

  it("signs a VAPID token the push service can check (RFC 8292)", async () => {
    const header = await vapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc",
      {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: "mailto:calendar@example.com",
      },
      new Date("2026-10-03T08:00:00Z"),
    );
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(env.VAPID_PUBLIC_KEY);
    const [h, c, s] = token.split(".");
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(c)));
    expect(claims).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: Date.parse("2026-10-03T20:00:00Z") / 1000,
      sub: "mailto:calendar@example.com",
    });
    const key = await crypto.subtle.importKey(
      "raw",
      fromBase64Url(k),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      fromBase64Url(s),
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});
