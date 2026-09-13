/**
 * Delete the runtime caches a previous build left behind.
 *
 * The pose model and MediaPipe's runtime are kept on first use rather than
 * precached, and the runtime's file name never changes — so its cache carries
 * the version of the package that put it there, and an upgrade writes to a
 * different one. Workbox will not clear the old one: `cleanupOutdatedCaches`
 * only sweeps caches whose name contains `-precache-`, and an expiration plugin
 * only prunes entries within its own cache. Left alone, every upgrade would
 * strand close to twelve megabytes of Cache Storage for good.
 *
 * So the app does it, from the page rather than the service worker: the page
 * knows which version it was built against, and one pass on start is enough.
 * Anything that fails here is not worth telling anybody about — the app works
 * either way, this only reclaims space.
 */

/** Runtime caches whose name ends in a version this build may have superseded. */
const VERSIONED = /^kinetrace-mediapipe-wasm-/;

/** The name this build's service worker writes to, injected at build time. */
declare const __MEDIAPIPE_CACHE__: string;

/** The cache this build keeps. Falls back to nothing outside a build. */
export const CURRENT_CACHE: string =
  typeof __MEDIAPIPE_CACHE__ === 'string' ? __MEDIAPIPE_CACHE__ : '';

export async function sweepStaleCaches(
  keep: string,
  storage: Pick<CacheStorage, 'keys' | 'delete'> | undefined = globalThis.caches,
): Promise<string[]> {
  if (!storage) return [];
  try {
    const names = await storage.keys();
    const stale = names.filter((name) => VERSIONED.test(name) && name !== keep);
    await Promise.all(stale.map((name) => storage.delete(name)));
    return stale;
  } catch {
    // Private browsing, a denied storage permission, a browser without the
    // API. Nothing to do and nothing to say.
    return [];
  }
}
