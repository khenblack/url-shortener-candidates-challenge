import { eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Err, Ok } from "../../../../shared/types/result";
import type { Result } from "../../../../shared/types/result";
import { ShortenedURL } from "../../domain/shortened-url";
import type {
  InsertShortenedURLError,
  ClickRecorder,
  RecentLinksRepository,
  ShortenerRepository,
  StorageUnavailable,
} from "../../application/ports/shortener-repository";
import * as schema from "./schema";

export class PostgresShortenerRepository
  implements ShortenerRepository, ClickRecorder, RecentLinksRepository
{
  constructor(private readonly database: NodePgDatabase<typeof schema>) {}

  async insert(
    link: ShortenedURL,
  ): Promise<Result<void, InsertShortenedURLError>> {
    try {
      const inserted = await this.database
        .insert(schema.shortenedUrls)
        .values({ code: link.code, destination: link.destination.value })
        .onConflictDoNothing({ target: schema.shortenedUrls.code })
        .returning({ code: schema.shortenedUrls.code });
      return inserted.length === 1
        ? Ok(undefined)
        : Err({ code: "code_conflict" });
    } catch {
      return Err({ code: "storage_unavailable" });
    }
  }

  async findByCode(
    code: string,
  ): Promise<Result<ShortenedURL | null, StorageUnavailable>> {
    try {
      const [row] = await this.database
        .select()
        .from(schema.shortenedUrls)
        .where(eq(schema.shortenedUrls.code, code))
        .limit(1);
      if (!row) return Ok(null);
      const destination = ShortenedURL.parseDestination(row.destination);
      if (!destination.ok) return Err({ code: "storage_unavailable" });
      const link = ShortenedURL.create(
        row.code,
        destination.value,
        row.clickCount,
      );
      return link.ok ? link : Err({ code: "storage_unavailable" });
    } catch {
      return Err({ code: "storage_unavailable" });
    }
  }

  async incrementClicks(
    code: string,
  ): Promise<Result<void, StorageUnavailable>> {
    try {
      await this.database
        .update(schema.shortenedUrls)
        .set({ clickCount: sql`${schema.shortenedUrls.clickCount} + 1` })
        .where(eq(schema.shortenedUrls.code, code));
      return Ok(undefined);
    } catch {
      return Err({ code: "storage_unavailable" });
    }
  }

  async findByCodes(
    codes: readonly string[],
  ): Promise<Result<ShortenedURL[], StorageUnavailable>> {
    if (codes.length === 0) return Ok([]);
    try {
      const rows = await this.database
        .select()
        .from(schema.shortenedUrls)
        .where(inArray(schema.shortenedUrls.code, [...codes]));
      const links: ShortenedURL[] = [];
      for (const row of rows) {
        const destination = ShortenedURL.parseDestination(row.destination);
        if (!destination.ok) return Err({ code: "storage_unavailable" });
        const link = ShortenedURL.create(
          row.code,
          destination.value,
          row.clickCount,
        );
        if (!link.ok) return Err({ code: "storage_unavailable" });
        links.push(link.value);
      }
      return Ok(links);
    } catch {
      return Err({ code: "storage_unavailable" });
    }
  }
}
