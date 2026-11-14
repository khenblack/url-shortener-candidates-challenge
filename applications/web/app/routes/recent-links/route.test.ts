// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStaticHandler } from "react-router";
import { loader } from "./route";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../bootstrap.server", () => ({ getRecentLinks: { execute } }));
const handler = createStaticHandler([
  { id: "recent", path: "/recent-links", loader },
]);
beforeEach(() =>
  execute.mockReset().mockResolvedValue({ ok: true, value: [] }),
);

describe("recent links resource", () => {
  it("uses only explicit codes, deduplicates and caps selection at fifty", async () => {
    const query = new URLSearchParams();
    [
      "legacy-!",
      "legacy-!",
      "",
      ...Array.from({ length: 55 }, (_, i) => `code${i}`),
    ].forEach((code) => query.append("code", code));
    const result = await handler.query(
      new Request(`http://localhost/recent-links?${query}`),
    );
    expect(!(result instanceof Response) && result.statusCode).toBe(200);
    expect(execute).toHaveBeenCalledExactlyOnceWith([
      "legacy-!",
      ...Array.from({ length: 49 }, (_, i) => `code${i}`),
    ]);
  });
  it("passes an empty selection without a global listing fallback", async () => {
    const result = await handler.query(
      new Request("http://localhost/recent-links"),
    );
    expect(execute).toHaveBeenCalledExactlyOnceWith([]);
    expect(!(result instanceof Response) && result.loaderData.recent).toEqual({
      links: [],
      error: undefined,
    });
  });
  it("returns safe unavailable feedback and prevents cached browser selections", async () => {
    execute.mockResolvedValueOnce({
      ok: false,
      error: { code: "storage_unavailable" },
    });
    const result = await handler.query(
      new Request("http://localhost/recent-links?code=aa"),
    );
    if (result instanceof Response) throw Error("Expected context");
    expect(result.statusCode).toBe(503);
    expect(result.loaderData.recent).toEqual({
      links: [],
      error: "Recent links are temporarily unavailable.",
    });
    expect(result.loaderHeaders.recent.get("Cache-Control")).toBe("no-store");
  });
});
