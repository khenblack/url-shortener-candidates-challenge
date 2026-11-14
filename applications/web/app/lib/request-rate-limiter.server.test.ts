import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "./request-rate-limiter.server";

describe("FixedWindowRateLimiter", () => {
  it("admits the limit, rejects without extending expiry, and resets at expiry", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter({
      limit: 20,
      windowMs: 60_000,
      now: () => now,
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(limiter.consume()).toEqual({ allowed: true });
    }
    now = 1_001;
    expect(limiter.consume()).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    now = 1_500;
    expect(limiter.consume()).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    now = 61_000;
    expect(limiter.consume()).toEqual({ allowed: true });
    for (let attempt = 0; attempt < 19; attempt += 1) {
      expect(limiter.consume()).toEqual({ allowed: true });
    }
    expect(limiter.consume()).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("rounds the remaining wait up to a positive whole second", () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => now,
    });

    limiter.consume();
    now = 59_001;
    expect(limiter.consume()).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("starts a fresh allowance for a fresh instance", () => {
    const first = new FixedWindowRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    first.consume();
    expect(first.consume().allowed).toBe(false);

    const restarted = new FixedWindowRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    expect(restarted.consume()).toEqual({ allowed: true });
  });
});
