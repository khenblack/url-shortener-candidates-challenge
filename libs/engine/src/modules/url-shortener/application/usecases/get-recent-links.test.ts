import { describe, expect, it, vi } from "vitest";
import { Err, Ok } from "../../../../shared/types/result";
import { ShortenedURL } from "../../domain/shortened-url";
import { GetRecentLinksUseCase } from "./get-recent-links";

function link(code: string, clickCount: number) {
  const destination = ShortenedURL.parseDestination(
    `https://example.com/${code}`,
  );
  if (!destination.ok) throw Error("Invalid fixture");
  const value = ShortenedURL.create(code, destination.value, clickCount);
  if (!value.ok) throw Error("Invalid fixture");
  return value.value;
}

describe("GetRecentLinksUseCase", () => {
  it("never queries all links for an empty selection", async () => {
    const findByCodes = vi.fn();
    expect(
      await new GetRecentLinksUseCase({ findByCodes }).execute([]),
    ).toEqual(Ok([]));
    expect(findByCodes).not.toHaveBeenCalled();
  });
  it("returns only selected links in browser order, preserving legacy codes and counts", async () => {
    const findByCodes = vi
      .fn()
      .mockResolvedValue(
        Ok([link("aa", 2), link("legacy-!", 0), link("other", 9)]),
      );
    const result = await new GetRecentLinksUseCase({ findByCodes }).execute([
      "legacy-!",
      "missing",
      "aa",
      "aa",
    ]);
    expect(result).toEqual(
      Ok([
        {
          code: "legacy-!",
          destination: "https://example.com/legacy-!",
          clickCount: 0,
        },
        { code: "aa", destination: "https://example.com/aa", clickCount: 2 },
      ]),
    );
    expect(findByCodes).toHaveBeenCalledExactlyOnceWith([
      "legacy-!",
      "missing",
      "aa",
      "aa",
    ]);
  });
  it("maps returned and thrown storage failures safely", async () => {
    const findByCodes = vi
      .fn()
      .mockResolvedValueOnce(Err({ code: "storage_unavailable" }))
      .mockRejectedValueOnce(Error("private"));
    const useCase = new GetRecentLinksUseCase({ findByCodes });
    expect(await useCase.execute(["aa"])).toEqual(
      Err({ code: "storage_unavailable" }),
    );
    expect(await useCase.execute(["aa"])).toEqual(
      Err({ code: "storage_unavailable" }),
    );
  });
});
