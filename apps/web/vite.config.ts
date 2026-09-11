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
        // The optional sheet import engines are several megabytes and are only
        // loaded if the user imports a sheet, so they are never precached.
        globIgnores: ['**/sheet-import-*.js', '**/*.map'],
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
