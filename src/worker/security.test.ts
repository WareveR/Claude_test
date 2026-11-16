/// <reference types="vite/client" />
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import headersFile from "../../public/_headers?raw";
import { CONTENT_SECURITY_POLICY } from "./security";

describe("Content-Security-Policy", () => {
  it("public/_headers sets the same policy as the Worker", () => {
    const line = headersFile
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("Content-Security-Policy:"));
    expect(line).toBe(`Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`);
  });

  it("the Worker sends the policy on its responses", async () => {
    const res = await exports.default.fetch("https://example.com/api/health");
    expect(res.headers.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
  });
});
