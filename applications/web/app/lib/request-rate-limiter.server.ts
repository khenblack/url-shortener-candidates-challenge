type FixedWindowRateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export class FixedWindowRateLimiter {
  private attempts = 0;
  private expiresAt = 0;
  private readonly now: () => number;

  constructor(private readonly options: FixedWindowRateLimiterOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  consume(): RateLimitResult {
    const now = this.now();
    if (now >= this.expiresAt) {
      this.attempts = 0;
      this.expiresAt = now + this.options.windowMs;
    }

    if (this.attempts >= this.options.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((this.expiresAt - now) / 1_000),
        ),
      };
    }

    this.attempts += 1;
    return { allowed: true };
  }
}

export const urlCreationRateLimiter = new FixedWindowRateLimiter({
  limit: 20,
  windowMs: 60_000,
});
