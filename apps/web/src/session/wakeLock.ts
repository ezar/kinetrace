/**
 * Keeping the screen on while somebody exercises.
 *
 * The whole premise is that the phone is propped up two or three metres away
 * and nobody touches it for ten minutes. Every phone dims and locks its screen
 * a minute or two after the last touch, and a running camera does not reliably
 * prevent it whatever the folklore says. Without this the numbers go dark
 * halfway through the second set.
 *
 * The browser drops the lock whenever the page stops being visible and does not
 * give it back on its own, so `refresh` exists to ask again on the way back.
 *
 * The API is passed in rather than reached for, so the behaviour can be tested
 * without a browser — and so that not having it at all is an ordinary state
 * rather than a crash.
 */

export interface WakeLockSentinel {
  readonly released: boolean;
  release: () => Promise<void>;
}

export type RequestWakeLock = () => Promise<WakeLockSentinel>;

/** The browser's own wake lock, or null where there is not one. */
export function browserWakeLock(): RequestWakeLock | null {
  if (typeof navigator === 'undefined') return null;
  const api = (
    navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    }
  ).wakeLock;
  if (!api) return null;
  return () => api.request('screen');
}

export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private pending: Promise<void> | null = null;

  constructor(private readonly request: RequestWakeLock | null) {}

  get supported(): boolean {
    return this.request !== null;
  }

  /** True while the screen is being held awake. */
  get held(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }

  /**
   * Ask for the lock. Safe to call repeatedly: an existing lock is kept, and
   * overlapping calls share one request rather than stacking up.
   */
  async acquire(): Promise<boolean> {
    if (!this.request || this.held) return this.held;
    if (this.pending) {
      await this.pending;
      return this.held;
    }
    const attempt = this.request()
      .then((sentinel) => {
        this.sentinel = sentinel;
      })
      .catch(() => {
        // A refused lock is not a failure worth interrupting a session for: the
        // screen may sleep, and everything else still works.
        this.sentinel = null;
      })
      .finally(() => {
        this.pending = null;
      });
    this.pending = attempt;
    await attempt;
    return this.held;
  }

  /** Ask again after the page was hidden, which is when the browser takes it back. */
  async refresh(): Promise<boolean> {
    if (this.held) return true;
    return this.acquire();
  }

  async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (!sentinel || sentinel.released) return;
    try {
      await sentinel.release();
    } catch {
      // Already gone; nothing to do.
    }
  }
}
