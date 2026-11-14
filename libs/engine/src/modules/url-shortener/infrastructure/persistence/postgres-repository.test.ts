// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Err, Ok } from "../../../../shared/types/result";
import { ShortenedURL } from "../../domain/shortened-url";
import * as schema from "./schema";
import { PostgresShortenerRepository } from "./postgres-repository";

function fixture(rows: { code: string; destination: string }[] = []) {
  const returning = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockResolvedValue(rows);
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const where = vi.fn(() => ({ limit }));
  const db = {
    insert: vi.fn(() => ({ values })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
  };
  const repository = new PostgresShortenerRepository(
    db as unknown as NodePgDatabase<typeof schema>,
  );
  const destination = ShortenedURL.parseDestination("https://example.com/path");
  if (!destination.ok) throw new Error("Invalid fixture");
  const link = ShortenedURL.create("Code000001", destination.value);
  if (!link.ok) throw new Error("Invalid fixture");
  return {
    repository,
    db,
    link: link.value,
    returning,
    limit,
    onConflictDoNothing,
    values,
  };
}

describe("PostgresShortenerRepository", () => {
  it("targets only the code constraint and translates an empty returning result", async () => {
    const f = fixture();
    expect(await f.repository.insert(f.link)).toEqual(
      Err({ code: "code_conflict" }),
    );
    expect(f.values).toHaveBeenCalledExactlyOnceWith({
      code: f.link.code,
      destination: f.link.destination.value,
    });
    expect(f.onConflictDoNothing).toHaveBeenCalledExactlyOnceWith({
      target: schema.shortenedUrls.code,
    });
    expect(f.returning).toHaveBeenCalledOnce();
  });

  it("returns success only after the insert completes", async () => {
    const f = fixture([
      { code: "Code000001", destination: "https://example.com/path" },
    ]);
    expect(await f.repository.insert(f.link)).toEqual(Ok(undefined));
    expect(f.returning).toHaveBeenCalledOnce();
  });

  it.each(["08006", "23505", "23514"])(
    "does not classify thrown database error %s as a code conflict",
    async (code) => {
      const f = fixture();
      f.returning.mockRejectedValueOnce({
        code,
        message: "private database detail",
      });
      expect(await f.repository.insert(f.link)).toEqual(
        Err({ code: "storage_unavailable" }),
      );
      expect(f.returning).toHaveBeenCalledOnce();
    },
  );

  it("distinguishes no rows from query failure", async () => {
    const f = fixture();
    expect(await f.repository.findByCode("missing")).toEqual(Ok(null));
    expect(f.limit).toHaveBeenCalledOnce();
    f.limit.mockRejectedValueOnce(new Error("private database detail"));
    expect(await f.repository.findByCode("missing")).toEqual(
      Err({ code: "storage_unavailable" }),
    );
    expect(f.limit).toHaveBeenCalledTimes(2);
  });

  it.each(["javascript:alert(1)", "https://", ""])(
    "never redirects corrupt stored destination %s",
    async (destination) => {
      const f = fixture([{ code: "legacy-!", destination }]);
      expect(await f.repository.findByCode("legacy-!")).toEqual(
        Err({ code: "storage_unavailable" }),
      );
      expect(f.limit).toHaveBeenCalledOnce();
    },
  );

  it("reconstitutes a legacy entity without canonicalizing its destination", async () => {
    const destination = "https://EXAMPLE.com:443/a/../path?ref=%61#section";
    const f = fixture([{ code: "legacy-!", destination }]);
    const result = await f.repository.findByCode("legacy-!");
    expect(result.ok && result.value).toBeInstanceOf(ShortenedURL);
    expect(result.ok && result.value?.destination.value).toBe(destination);
    expect(f.limit).toHaveBeenCalledOnce();
  });

  it("translates synchronous query construction errors at both operation boundaries", async () => {
    const f = fixture();
    f.db.insert.mockImplementationOnce(() => {
      throw new Error("private query detail");
    });
    f.db.select.mockImplementationOnce(() => {
      throw new Error("private query detail");
    });
    expect(await f.repository.insert(f.link)).toEqual(
      Err({ code: "storage_unavailable" }),
    );
    expect(await f.repository.findByCode("legacy")).toEqual(
      Err({ code: "storage_unavailable" }),
    );
    expect(f.db.insert).toHaveBeenCalledExactlyOnceWith(schema.shortenedUrls);
    expect(f.db.select).toHaveBeenCalledOnce();
  });
});

// Query compilation proves SQL shape only; it is not a live concurrency check.
describe("statistics persistence", () => {
  it("increments in a single parameterized UPDATE without reading the count", async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const database = drizzle({ query } as never, { schema });
    const repository = new PostgresShortenerRepository(database);
    expect(await repository.incrementClicks("legacy-!")).toEqual(Ok(undefined));
    expect(query).toHaveBeenCalledOnce();
    const [statement, parameters] = query.mock.calls[0];
    expect(statement.text).toBe(
      'update "shortened_urls" set "click_count" = "shortened_urls"."click_count" + 1 where "shortened_urls"."code" = $1',
    );
    expect(parameters).toEqual(["legacy-!"]);
  });

  it("selects only requested codes and restores persisted counts", async () => {
    const where = vi.fn().mockResolvedValue([
      {
        code: "legacy-!",
        destination: "https://example.com/path",
        clickCount: 12,
      },
    ]);
    const select = vi.fn(() => ({ from: () => ({ where }) }));
    const repository = new PostgresShortenerRepository({
      select,
    } as unknown as NodePgDatabase<typeof schema>);
    expect(await repository.findByCodes([])).toEqual(Ok([]));
    expect(select).not.toHaveBeenCalled();
    const result = await repository.findByCodes(["legacy-!"]);
    expect(result.ok && result.value[0].clickCount).toBe(12);
    const { PgDialect } = await import("drizzle-orm/pg-core");
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toBe('"shortened_urls"."code" in ($1)');
    expect(query.params).toEqual(["legacy-!"]);
  });

  it("maps increment and selected-query failures without leaking details", async () => {
    const database = {
      update: () => {
        throw Error("private update detail");
      },
      select: () => {
        throw Error("private query detail");
      },
    };
    const repository = new PostgresShortenerRepository(
      database as unknown as NodePgDatabase<typeof schema>,
    );
    expect(await repository.incrementClicks("aa")).toEqual(
      Err({ code: "storage_unavailable" }),
    );
    expect(await repository.findByCodes(["aa"])).toEqual(
      Err({ code: "storage_unavailable" }),
    );
  });
});
