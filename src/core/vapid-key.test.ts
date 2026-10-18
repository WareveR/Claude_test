import { describe, expect, it } from "vitest";
import { base64UrlBytes, cleanVapidKey } from "./vapid-key";

const key =
  "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";

describe("cleanVapidKey", () => {
  it("keeps a bare key", () => expect(cleanVapidKey(key)).toBe(key));
  it("drops the name the script prints", () =>
    expect(cleanVapidKey(`VAPID_PUBLIC_KEY=${key}`)).toBe(key));
  it("drops quotes, spaces and newlines", () => {
    expect(cleanVapidKey(` "${key}"\n`)).toBe(key);
    expect(cleanVapidKey(`${key.slice(0, 40)}\n${key.slice(40)}`)).toBe(key);
  });
  it("drops base64 padding", () => expect(cleanVapidKey("YWJj==")).toBe("YWJj"));
});

describe("base64UrlBytes", () => {
  it("decodes an unpadded base64url P-256 point", () => {
    const bytes = base64UrlBytes(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
  it("accepts padded input", () => expect([...base64UrlBytes("YQ==")]).toEqual([97]));
});
