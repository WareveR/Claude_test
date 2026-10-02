import { describe, expect, it } from "vitest";
import { isErrorCode, newErrorCode } from "./error-code";

describe("error codes", () => {
  it("are ERR- plus four unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(isErrorCode(newErrorCode())).toBe(true);
    expect(newErrorCode(() => 0)).toBe("ERR-2222");
    expect(newErrorCode(() => 0.999)).toBe("ERR-ZZZZ");
  });

  it("rejects anything else", () => {
    expect(isErrorCode("ERR-7F3K")).toBe(true);
    expect(isErrorCode("ERR-7F3O")).toBe(false);
    expect(isErrorCode("err-7f3k")).toBe(false);
    expect(isErrorCode("ERR-7F3K1")).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});
