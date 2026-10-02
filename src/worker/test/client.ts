import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";

export const ORIGIN = "https://calendar.example";
export const SETUP_CODE = env.SETUP_CODE;
export const PASSWORD = "correct horse battery";

/** A browser talking to the API: keeps its session cookie and sends the app's Origin. */
export class TestBrowser {
  cookie = "";

  constructor(
    readonly ip = "203.0.113.1",
    readonly userAgent = "Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile Safari/537.36",
  ) {}

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const res = await exports.default.fetch(`${ORIGIN}/api${path}`, {
      method,
      headers: {
        Origin: ORIGIN,
        "CF-Connecting-IP": this.ip,
        "User-Agent": this.userAgent,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("Set-Cookie");
    if (setCookie) {
      const [pair] = setCookie.split(";");
      this.cookie = pair.endsWith("=") ? "" : pair;
    }
    return res;
  }

  get(path: string) {
    return this.request("GET", path);
  }
  post(path: string, body?: unknown) {
    return this.request("POST", path, body ?? {});
  }
  delete(path: string) {
    return this.request("DELETE", path);
  }
}

export const VALID_SETUP = {
  setupCode: SETUP_CODE,
  name: "Pires",
  password: PASSWORD,
  recoveryEmail: "david@example.com",
  language: "pt-PT",
  timeZone: "Europe/Lisbon",
};

/** Creates the Family and returns the browser that did it, signed in. */
export async function setUpFamily(): Promise<TestBrowser> {
  const browser = new TestBrowser("198.51.100.9");
  const res = await browser.post("/setup", VALID_SETUP);
  if (res.status !== 201) throw new Error(`setup failed: ${res.status}`);
  return browser;
}
