import { describe, expect, it } from "vitest";
import { guessDeviceKind } from "./device-kind";

const desk = { touch: false, shortSide: 1080 };
const touch = { touch: true, shortSide: 800 };

describe("guessDeviceKind", () => {
  it("tells phones, tablets, computers, watches and TVs apart", () => {
    const android = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/130.0 ";
    expect(guessDeviceKind(`${android}Mobile Safari/537.36`, touch)).toBe("phone");
    expect(guessDeviceKind(`${android}Safari/537.36`, touch)).toBe("tablet");
    expect(guessDeviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", touch)).toBe(
      "phone",
    );
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15";
    expect(guessDeviceKind(mac, touch)).toBe("tablet");
    expect(guessDeviceKind(mac, desk)).toBe("computer");
    expect(guessDeviceKind("Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0", desk)).toBe("computer");
    expect(guessDeviceKind("Mozilla/5.0 (Linux; Android 13; Wear OS) Chrome/130.0", touch)).toBe(
      "watch",
    );
    expect(guessDeviceKind("Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) Chrome/94.0", desk)).toBe(
      "tv",
    );
  });
});
