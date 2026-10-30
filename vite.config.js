/**
 * Vite config: React + Tailwind v4 + PWA.
 *
 * vite-plugin-pwa generates manifest.webmanifest and the service worker at
 * build time. `autoUpdate` swaps in new versions silently on the next load.
 * The service worker only precaches the app shell (JS/CSS/icons); Supabase
 * and Garmin API calls are never cached, so data is always live.
 *
 * Icons live in /public. iOS "Add to Home Screen" uses apple-touch-icon.png,
 * which index.html references explicitly.
 */
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// App version shown in the footer comes from package.json "version".
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Training Tracker',
        short_name: 'Tracker',
        description: 'All-in-one real-time training progress tracker.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
