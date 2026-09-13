import { describe, expect, it } from 'vitest';
import { sweepStaleCaches } from '../caches.js';

function storage(names: string[]): Pick<CacheStorage, 'keys' | 'delete'> & { left: string[] } {
  const left = [...names];
  return {
    left,
    keys: () => Promise.resolve([...left]),
    delete: (name: string) => {
      const at = left.indexOf(name);
      if (at >= 0) left.splice(at, 1);
      return Promise.resolve(at >= 0);
    },
  };
}

describe('sweepStaleCaches', () => {
  it('deletes the runtime cache a previous version of the package left behind', async () => {
    const caches = storage([
      'kinetrace-mediapipe-wasm-1.0.0',
      'kinetrace-mediapipe-wasm-1.0.1',
      'kinetrace-pose-models',
      'workbox-precache-v2-https://example.test/',
    ]);
    const swept = await sweepStaleCaches('kinetrace-mediapipe-wasm-1.0.1', caches);
    expect(swept).toEqual(['kinetrace-mediapipe-wasm-1.0.0']);
    expect(caches.left).toEqual([
      'kinetrace-mediapipe-wasm-1.0.1',
      'kinetrace-pose-models',
      'workbox-precache-v2-https://example.test/',
    ]);
  });

  it('leaves the pose models alone: their cache is not versioned', async () => {
    const caches = storage(['kinetrace-pose-models']);
    expect(await sweepStaleCaches('kinetrace-mediapipe-wasm-1.0.1', caches)).toEqual([]);
    expect(caches.left).toEqual(['kinetrace-pose-models']);
  });

  it('does nothing on a build whose cache is the only one there', async () => {
    const caches = storage(['kinetrace-mediapipe-wasm-1.0.1']);
    expect(await sweepStaleCaches('kinetrace-mediapipe-wasm-1.0.1', caches)).toEqual([]);
  });

  it('says nothing where there is no cache storage at all', async () => {
    expect(await sweepStaleCaches('kinetrace-mediapipe-wasm-1.0.1', undefined)).toEqual([]);
  });

  it('swallows a storage that throws', async () => {
    const broken = {
      keys: () => Promise.reject(new Error('denied')),
      delete: () => Promise.resolve(false),
    };
    expect(await sweepStaleCaches('kinetrace-mediapipe-wasm-1.0.1', broken)).toEqual([]);
  });
});
