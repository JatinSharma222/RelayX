export class RateLimiter {

  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60_000);
  }

  private requests = new Map<
    string,
    {
      count: number;
      windowStart: number;
      windowMs: number;
    }
  >();

  allow(
    userId: string,
    eventType: string,
    limit: number,
    windowMs: number
  ): boolean {
    const now = Date.now();

    // Each user + event type gets an independent rate-limit bucket.
    const key = `${userId}:${eventType}`;

    const userRequests = this.requests.get(key);

    // First request for this user and event type.
    if (!userRequests) {
      this.requests.set(key, {
        count: 1,
        windowStart: now,
        windowMs
      });

      return true;
    }

    // Reset the counter when the time window expires.
    if (now - userRequests.windowStart >= windowMs) {
      this.requests.set(key, {
        count: 1,
        windowStart: now,
        windowMs
      });

      return true;
    }

    // Reject requests after the limit is reached.
    if (userRequests.count >= limit) {
      return false;
    }

    // Allow the request and increment the counter.
    userRequests.count++;

    return true;
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, request] of this.requests.entries()) {
      if (now - request.windowStart >= request.windowMs) {
        this.requests.delete(key);
      }
    }
  }

  public shutdown(): void {
    clearInterval(this.cleanupInterval);
  }
}
