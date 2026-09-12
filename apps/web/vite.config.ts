import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
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
              cacheName: 'kinetrace-pose-models',
              expiration: { maxEntries: 4 },
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
