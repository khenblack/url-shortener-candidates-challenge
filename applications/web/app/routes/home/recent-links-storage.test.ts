import { describe, expect, it, vi } from "vitest";
import {
  readRecentCodes,
  rememberCode,
  writeRecentCodes,
} from "./recent-links-storage";

describe("browser recent codes", () => {
  it("moves duplicates first and retains only the latest fifty", () => {
    const codes = Array.from({ length: 50 }, (_, i) => `code${i}`);
    expect(rememberCode(codes, "code20")).toEqual([
      "code20",
      ...codes.filter((c) => c !== "code20"),
    ]);
    expect(rememberCode(codes, "new")).toEqual(["new", ...codes.slice(0, 49)]);
  });
  it("persists selection across reads without storing destination metadata", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    writeRecentCodes(storage, ["legacy-!", "aa"]);
    storage.getItem.mockReturnValue(storage.setItem.mock.calls[0][1]);
    expect(readRecentCodes(storage)).toEqual(["legacy-!", "aa"]);
  });
  it.each([null, "bad json", "{}", '[null,2,"","aa","aa"]'])(
    "handles malformed storage %s",
    (raw) => {
      expect(readRecentCodes({ getItem: () => raw })).toEqual(
        raw?.startsWith("[") ? ["aa"] : [],
      );
    },
  );
  it("tolerates denied reads and writes", () => {
    expect(
      readRecentCodes({
        getItem() {
          throw Error("denied");
        },
      }),
    ).toEqual([]);
    expect(() =>
      writeRecentCodes(
        {
          setItem() {
            throw Error("denied");
          },
        },
        ["aa"],
      ),
    ).not.toThrow();
  });
});
