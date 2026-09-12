import { describe, expect, it, vi } from 'vitest';
import { ScreenWakeLock, type WakeLockSentinel } from '../wakeLock.js';

function fakeSentinel(): WakeLockSentinel & { release: ReturnType<typeof vi.fn> } {
  const sentinel = {
    released: false,
    release: vi.fn(async () => {
      (sentinel as { released: boolean }).released = true;
    }),
  };
  return sentinel as WakeLockSentinel & { release: ReturnType<typeof vi.fn> };
}

describe('ScreenWakeLock', () => {
  it('holds the screen awake while a session runs', async () => {
    const sentinel = fakeSentinel();
    const lock = new ScreenWakeLock(async () => sentinel);
    expect(lock.supported).toBe(true);
    expect(await lock.acquire()).toBe(true);
    expect(lock.held).toBe(true);
  });

  it('asks once however many times it is told to', async () => {
    const request = vi.fn(async () => fakeSentinel());
    const lock = new ScreenWakeLock(request);
    await Promise.all([lock.acquire(), lock.acquire(), lock.acquire()]);
    await lock.acquire();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('asks again after the browser took it back', async () => {
    const request = vi.fn(async () => fakeSentinel());
    const lock = new ScreenWakeLock(request);
    await lock.acquire();
    // Hiding the page releases the lock without telling us to ask again.
    await lock.release();
    expect(lock.held).toBe(false);
    await lock.refresh();
    expect(lock.held).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps the lock it already has when refreshed', async () => {
    const request = vi.fn(async () => fakeSentinel());
    const lock = new ScreenWakeLock(request);
    await lock.acquire();
    await lock.refresh();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releases what it took', async () => {
    const sentinel = fakeSentinel();
    const lock = new ScreenWakeLock(async () => sentinel);
    await lock.acquire();
    await lock.release();
    expect(sentinel.release).toHaveBeenCalled();
    expect(lock.held).toBe(false);
  });

  it('carries on when the browser refuses', async () => {
    const lock = new ScreenWakeLock(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    expect(await lock.acquire()).toBe(false);
    expect(lock.held).toBe(false);
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it('is simply unsupported where there is no such API', async () => {
    const lock = new ScreenWakeLock(null);
    expect(lock.supported).toBe(false);
    expect(await lock.acquire()).toBe(false);
    await expect(lock.release()).resolves.toBeUndefined();
  });
});
