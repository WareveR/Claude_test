import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mailer } from "./email";

const email = { to: "ana@example.com", subject: "Hello", text: "Body" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mailer.send", () => {
  it("sends through Resend when the Worker has an API key", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    await mailer.send({ ...env, RESEND_API_KEY: "re_test" }, email);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer re_test");
    expect(JSON.parse(init?.body as string)).toEqual({ from: env.EMAIL_FROM, ...email });
  });

  it("fails when Resend refuses, so the caller can report it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad domain", { status: 403 }));
    await expect(mailer.send({ ...env, RESEND_API_KEY: "re_test" }, email)).rejects.toThrow(
      "Resend answered 403: bad domain",
    );
  });

  it("uses Cloudflare Email Service without an API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const send = vi.fn().mockResolvedValue(undefined);
    await mailer.send({ ...env, RESEND_API_KEY: "", EMAIL: { send } as never }, email);
    expect(send).toHaveBeenCalledWith({ from: env.EMAIL_FROM, ...email });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
