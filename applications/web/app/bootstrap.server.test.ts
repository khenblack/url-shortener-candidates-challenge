// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  readConfig: vi.fn(),
  createDatabase: vi.fn(),
  returning: vi.fn(),
  limit: vi.fn(),
  close: vi.fn(),
  update: vi.fn(),
  selected: vi.fn(),
}));
vi.mock("../database/config", () => ({
  readDatabaseConfig: state.readConfig,
}));
vi.mock("@url-shortener/database", () => ({
  PostgresDatabase: state.createDatabase,
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  state.close.mockResolvedValue(undefined);
  state.update.mockResolvedValue(undefined);
  state.selected.mockResolvedValue([
    { code: "legacy", destination: "https://example.com/path", clickCount: 2 },
  ]);
  state.readConfig.mockReturnValue({ host: "test" });
  state.returning.mockResolvedValue([{ code: "inserted" }]);
  state.limit.mockResolvedValue([
    { code: "legacy", destination: "https://example.com/path" },
  ]);
  state.createDatabase.mockImplementation(function () {
    return {
      close: vi.fn(() => state.close()),
      db: {
        insert: () => ({
          values: () => ({
            onConflictDoNothing: () => ({ returning: state.returning }),
          }),
        }),
        update: () => ({ set: () => ({ where: state.update }) }),
        select: () => ({
          from: () => ({
            where: () =>
              Object.assign(state.selected(), { limit: state.limit }),
          }),
        }),
      },
    };
  });
});

const unavailable = {
  ok: false,
  error: {
    code: "storage_unavailable",
    message: "Service temporarily unavailable. Please try again.",
  },
};

describe("application bootstrap", () => {
  it("reads configuration immediately and propagates startup configuration errors", async () => {
    const failure = new Error("invalid startup configuration");
    state.readConfig.mockImplementation(() => {
      throw failure;
    });

    await expect(import("./bootstrap.server")).rejects.toBe(failure);
    expect(state.readConfig).toHaveBeenCalledOnce();
    expect(state.createDatabase).not.toHaveBeenCalled();
    expect(state.returning).not.toHaveBeenCalled();
    expect(state.limit).not.toHaveBeenCalled();
  });

  it("constructs once on import and shares the database across all use cases", async () => {
    const application = await import("./bootstrap.server");
    expect(state.readConfig).toHaveBeenCalledOnce();
    expect(state.createDatabase).toHaveBeenCalledOnce();
    expect(state.createDatabase.mock.calls[0][0]).toEqual({ host: "test" });
    expect(state.returning).not.toHaveBeenCalled();
    expect(state.selected).not.toHaveBeenCalled();

    expect(
      (await application.shortenURL.execute("https://example.com")).ok,
    ).toBe(true);
    expect(
      (await application.shortenURL.execute("https://example.com")).ok,
    ).toBe(true);
    expect(await application.resolveShortenedURL.execute("legacy")).toEqual({
      ok: true,
      value: "https://example.com/path",
    });
    expect(state.update).not.toHaveBeenCalled();
    expect(await application.redirectShortenedURL.execute("legacy")).toEqual({
      ok: true,
      value: "https://example.com/path",
    });
    expect(await application.getRecentLinks.execute(["legacy"])).toEqual({
      ok: true,
      value: [
        {
          code: "legacy",
          destination: "https://example.com/path",
          clickCount: 2,
        },
      ],
    });
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.returning).toHaveBeenCalledTimes(2);
    expect(state.limit).toHaveBeenCalledTimes(2);
    expect(state.selected).toHaveBeenCalledTimes(3);
    expect((await import("./bootstrap.server")).shortenURL).toBe(
      application.shortenURL,
    );
    expect(state.readConfig).toHaveBeenCalledOnce();
    expect(state.createDatabase).toHaveBeenCalledOnce();
  });

  it("propagates database construction errors during startup without retrying", async () => {
    const failure = new Error("invalid pool configuration");
    state.createDatabase.mockImplementationOnce(function () {
      throw failure;
    });

    await expect(import("./bootstrap.server")).rejects.toBe(failure);
    expect(state.readConfig).toHaveBeenCalledOnce();
    expect(state.createDatabase).toHaveBeenCalledOnce();
    expect(state.returning).not.toHaveBeenCalled();
    expect(state.limit).not.toHaveBeenCalled();
  });

  it("rejects invalid input without querying the eagerly constructed database", async () => {
    const application = await import("./bootstrap.server");
    expect(await application.shortenURL.execute("")).toEqual({
      ok: false,
      error: { code: "required", message: "URL is required" },
    });
    expect(await application.resolveShortenedURL.execute(" ")).toEqual({
      ok: false,
      error: { code: "invalid_code", message: "Invalid short code" },
    });
    expect(state.createDatabase).toHaveBeenCalledOnce();
    expect(state.returning).not.toHaveBeenCalled();
    expect(state.selected).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });

  it("returns safe runtime storage failures without constructing another database", async () => {
    const application = await import("./bootstrap.server");
    state.returning.mockRejectedValueOnce(new Error("private write failure"));
    state.limit.mockRejectedValueOnce(new Error("private read failure"));
    expect(await application.shortenURL.execute("https://example.com")).toEqual(
      unavailable,
    );
    expect(await application.resolveShortenedURL.execute("legacy")).toEqual(
      unavailable,
    );
    expect(state.createDatabase).toHaveBeenCalledOnce();
  });

  it("scopes each explicit bootstrap and its cleanup to its own database", async () => {
    const { bootstrapApplication } = await import("./bootstrap.server");
    const first = bootstrapApplication();
    const second = bootstrapApplication();
    expect(state.readConfig).toHaveBeenCalledTimes(3);
    expect(state.createDatabase).toHaveBeenCalledTimes(3);
    const [sharedDatabase, firstDatabase, secondDatabase] =
      state.createDatabase.mock.results.map((result) => result.value);
    expect(firstDatabase.db).not.toBe(secondDatabase.db);
    expect((await first.shortenURL.execute("https://first.example")).ok).toBe(
      true,
    );
    expect((await second.resolveShortenedURL.execute("legacy")).ok).toBe(true);
    await first.close();
    expect(firstDatabase.close).toHaveBeenCalledOnce();
    expect(secondDatabase.close).not.toHaveBeenCalled();
    expect(sharedDatabase.close).not.toHaveBeenCalled();
    await second.close();
    expect(secondDatabase.close).toHaveBeenCalledOnce();
    expect(state.createDatabase).toHaveBeenCalledTimes(3);
  });

  it("closes an eagerly constructed application even when no use case ran", async () => {
    const { close } = await import("./bootstrap.server");
    expect(state.createDatabase).toHaveBeenCalledOnce();
    await close();
    expect(state.close).toHaveBeenCalledOnce();
    expect(state.returning).not.toHaveBeenCalled();
    expect(state.selected).not.toHaveBeenCalled();
  });

  it("waits for database cleanup to finish", async () => {
    const application = await import("./bootstrap.server");
    let finishClose!: () => void;
    state.close.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishClose = resolve;
      }),
    );
    let closed = false;
    const closing = application.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(state.close).toHaveBeenCalledOnce();
    expect(closed).toBe(false);
    finishClose();
    await closing;
    expect(closed).toBe(true);
    expect(state.createDatabase).toHaveBeenCalledOnce();
  });
});
