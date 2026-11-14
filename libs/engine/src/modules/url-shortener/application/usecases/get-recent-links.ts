import type {
  RecentLinksRepository,
  StorageUnavailable,
} from "../ports/shortener-repository";
import { Err, Ok, type Result } from "../../../../shared/types/result";

export type RecentLink = {
  code: string;
  destination: string;
  clickCount: number;
};

export class GetRecentLinksUseCase {
  constructor(private readonly repository: RecentLinksRepository) {}

  async execute(
    codes: readonly string[],
  ): Promise<Result<RecentLink[], StorageUnavailable>> {
    if (codes.length === 0) return Ok([]);
    try {
      const found = await this.repository.findByCodes(codes);
      if (!found.ok) return found;
      const links = new Map(found.value.map((link) => [link.code, link]));
      return Ok(
        [...new Set(codes)].flatMap((code) => {
          const link = links.get(code);
          return link
            ? [
                {
                  code,
                  destination: link.destination.value,
                  clickCount: link.clickCount,
                },
              ]
            : [];
        }),
      );
    } catch {
      return Err({ code: "storage_unavailable" });
    }
  }
}
