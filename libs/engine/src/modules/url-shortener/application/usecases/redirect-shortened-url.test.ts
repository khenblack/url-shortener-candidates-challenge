import { describe, expect, it, vi } from "vitest";
import { Err, Ok } from "../../../../shared/types/result";
import { ShortenedURL } from "../../domain/shortened-url";
import { ResolveShortenedURLUseCase } from "./resolve-shortened-url";
import { RedirectShortenedURLUseCase } from "./redirect-shortened-url";

function fixture() {
  const destination = ShortenedURL.parseDestination("https://example.com/path");
  if (!destination.ok) throw new Error("Invalid fixture");
  const link = ShortenedURL.create("legacy-!", destination.value);
  if (!link.ok) throw new Error("Invalid fixture");
  const findByCode = vi.fn(async (code: string) =>
    Ok(code === "legacy-!" ? link.value : null),
  );
  let count = 0;
  const incrementClicks = vi.fn(async () => {
    count++;
    return Ok(undefined);
  });
  const resolve = new ResolveShortenedURLUseCase({
    insert: vi.fn(),
    findByCode,
  });
  return {
    link: link.value,
    resolve,
    redirect: new RedirectShortenedURLUseCase(resolve, { incrementClicks }),
    incrementClicks,
    count: () => count,
  };
}

describe("redirect statistics", () => {
  it("starts at zero and records every successful repeated resolution", async () => {
    const f = fixture();
    expect(f.link.clickCount).toBe(0);
    expect(await f.redirect.execute("legacy-!")).toEqual(
      Ok("https://example.com/path"),
    );
    await f.redirect.execute("legacy-!");
    expect(f.count()).toBe(2);
    expect(f.incrementClicks).toHaveBeenCalledWith("legacy-!");
  });
  it("keeps ordinary reads, invalid codes and missing links uncounted", async () => {
    const f = fixture();
    await f.resolve.execute("legacy-!");
    expect((await f.redirect.execute(" ")).ok).toBe(false);
    expect((await f.redirect.execute("missing")).ok).toBe(false);
    expect(f.incrementClicks).not.toHaveBeenCalled();
  });
  it("preserves resolved destinations on returned and thrown recording failures", async () => {
    const f = fixture();
    f.incrementClicks.mockResolvedValueOnce(
      Err({ code: "storage_unavailable" }) as never,
    );
    expect(await f.redirect.execute("legacy-!")).toEqual(
      Ok("https://example.com/path"),
    );
    f.incrementClicks.mockRejectedValueOnce(new Error("private failure"));
    expect(await f.redirect.execute("legacy-!")).toEqual(
      Ok("https://example.com/path"),
    );
  });
});
