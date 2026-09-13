import { copyFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Kinetrace is served from the root on Vercel and from `/kinetrace/` on GitHub
 * Pages, so the base is a build input. It must start and end with a slash.
 */
const base = process.env.BASE_PATH ?? '/';

/**
 * The version of MediaPipe whose runtime this build ships.
 *
 * The WebAssembly binary has a fixed file name, and a cache-first rule on a
 * fixed name keeps the first copy it ever saw. Upgrading the dependency then
 * ships a new loader against a stale binary, which fails at instantiation —
 * camera mode stops working for exactly the people who already used it. Naming
 * the cache after the version means an upgrade writes to a different cache
 * instead, and the old one is dropped. Nobody has to remember.
 */
const mediapipeVersion = ((): string => {
  try {
    // The package does not export its own manifest, so walk up from the entry
    // point it does export until the manifest that describes it turns up.
    const require = createRequire(import.meta.url);
    let dir = dirname(require.resolve('@mediapipe/tasks-vision'));
    for (;;) {
      try {
        const read = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
          name?: string;
          version?: string;
        };
        if (read.name === '@mediapipe/tasks-vision' && read.version) return read.version;
      } catch {
        // Not this directory. Keep going.
      }
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
    return 'unknown';
  } catch {
    // A build that cannot read it still works; it just loses the automatic
    // invalidation, which is no worse than a hand-written name.
    return 'unknown';
  }
})();

/**
 * Static hosts without rewrites — GitHub Pages among them — serve `404.html`
 * for any path they do not have a file for. Shipping a copy of the app there
 * is what makes a deep link like `/library/glute-bridge` load the app instead
 * of a "not found" page.
 */
/**
 * The privacy promise, enforced rather than intended.
 *
 * Everything Kinetrace needs is its own origin: the app, the pose models, the
 * MediaPipe and ONNX WebAssembly. The only exceptions are the weights of the
 * two optional on-device engines, which their libraries fetch from a public
 * model host the first time somebody turns the feature on.
 *
 * With `connect-src` this narrow, there is nowhere for a landmark, an angle or
 * a note to go — and a dependency that tries grows a console error instead of
 * quietly phoning home. `blob:` covers the audio worklet and the module
 * workers; `wasm-unsafe-eval` is what compiling the pose model needs.
 *
 * It is kept here as well as in `vercel.json` so that `pnpm preview`, and
 * therefore the end to end suite, runs against the same policy the deployment
 * serves. A CSP nobody exercises is a CSP that breaks in production.
 */
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; manifest-src 'self'; connect-src 'self' blob: https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://raw.githubusercontent.com";

function spaFallback(): Plugin {
  return {
    name: 'kinetrace:spa-fallback',
    apply: 'build',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist');
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base,
  preview: { headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kinetrace',
        short_name: 'Kinetrace',
        description: 'Haz tus ejercicios de fisioterapia en casa, con un entrenador que te ve.',
        theme_color: '#f7f5f2',
        background_color: '#f7f5f2',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The pose model is large and versioned by file name: cache it on first use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // The optional sheet import and speech recognition engines are
        // megabytes each and are only loaded if the user asks for the feature,
        // so they are never precached. The ONNX runtime's WebAssembly is left
        // out by the pattern above, which only matches code the app always
        // needs.
        globIgnores: ['**/sheet-import-*.js', '**/transformers*.js', '**/*.map'],
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.task$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kinetrace-pose-models-v1',
              expiration: { maxEntries: 4, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // MediaPipe's runtime, about eleven megabytes, picked at load time:
            // the SIMD build or the one without, never both. The loader beside
            // it is a few hundred kilobytes of JavaScript and is precached by
            // the pattern above — so offline the loader would start, reach for
            // this, and find nothing. Same bargain as the model: too big to
            // hand everybody on their first visit, kept for good once somebody
            // has actually turned the camera on.
            urlPattern: /\/mediapipe\/wasm\/.*\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: `kinetrace-mediapipe-wasm-${mediapipeVersion}`,
              expiration: { maxEntries: 2, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
    spaFallback(),
  ],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              // Keep the OCR and language model runtimes in one lazy chunk.
              name: 'sheet-import',
              test: /node_modules\/(@mlc-ai|tesseract\.js)/,
            },
          ],
        },
      },
    },
  },
  server: { host: true },
});
