import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits, clientIp, rateLimit } from "./rate-limit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows the budget then refuses", () => {
    const options = { limit: 3, windowMs: 60_000 };
    const results = [1, 2, 3, 4].map(() => rateLimit("caller", options).ok);
    expect(results).toEqual([true, true, true, false]);
  });

  it("keeps callers apart", () => {
    const options = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", options).ok).toBe(true);
    expect(rateLimit("a", options).ok).toBe(false);
    expect(rateLimit("b", options).ok).toBe(true);
  });

  it("refills as time passes", () => {
    vi.useFakeTimers();
    const options = { limit: 2, windowMs: 1000 };

    expect(rateLimit("caller", options).ok).toBe(true);
    expect(rateLimit("caller", options).ok).toBe(true);
    expect(rateLimit("caller", options).ok).toBe(false);

    // Half the window buys back one token.
    vi.advanceTimersByTime(500);
    expect(rateLimit("caller", options).ok).toBe(true);
    expect(rateLimit("caller", options).ok).toBe(false);
  });

  it("reports how long to wait", () => {
    const options = { limit: 1, windowMs: 10_000 };
    rateLimit("caller", options);
    const blocked = rateLimit("caller", options);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});

describe("clientIp", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18" },
    });
    expect(clientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then to a placeholder", () => {
    expect(
      clientIp(new Request("https://example.test", { headers: { "x-real-ip": "198.51.100.4" } })),
    ).toBe("198.51.100.4");
    expect(clientIp(new Request("https://example.test"))).toBe("unknown");
  });
});
