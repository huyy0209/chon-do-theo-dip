import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE: đường dẫn gốc khi deploy. GitHub Pages = '/<tên-repo>/', Vercel/Netlify = '/'
// DEMO=1: bản chạy thử nhúng (đường dẫn tương đối, không service worker)
const demo = process.env.DEMO === '1';
const base = demo ? './' : process.env.BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // PWA: cài lên màn hình chính + chạy offline
    !demo && VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Chọn đồ theo dịp',
        short_name: 'Chọn đồ',
        lang: 'vi',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fdf0f7',
        theme_color: '#fdf0f7',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /\/models\/.*\.vrm$/, handler: 'CacheFirst', options: { cacheName: 'vrm-models' } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
  server: { host: true }, // mở được từ điện thoại cùng mạng Wi-Fi
  test: { environment: 'node' },
});
