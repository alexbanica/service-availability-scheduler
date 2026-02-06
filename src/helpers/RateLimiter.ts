type RateLimitState = {
  windowStart: number;
  count: number;
};

export class RateLimiter {
  private readonly states = new Map<string, RateLimitState>();

  constructor(
    private readonly windowDurationMs: number,
    private readonly maxRequests: number,
  ) {
    if (!Number.isFinite(windowDurationMs) || windowDurationMs <= 0) {
      throw new Error('WindowDuration must be a positive number');
    }
    if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
      throw new Error('MaxRequests must be a positive integer');
    }
  }

  allowRequest(key: string, nowMs: number): boolean {
    if (!Number.isFinite(nowMs)) {
      throw new Error('nowMs must be a finite number');
    }

    const windowStart =
      Math.floor(nowMs / this.windowDurationMs) * this.windowDurationMs;
    const state = this.states.get(key);

    if (!state || state.windowStart !== windowStart) {
      this.states.set(key, { windowStart, count: 1 });
      return true;
    }

    if (state.count >= this.maxRequests) {
      return false;
    }

    state.count += 1;
    return true;
  }
}
