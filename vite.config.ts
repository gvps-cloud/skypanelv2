import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Plugin to remove mock data from all source files in production builds
function removeMockData(): Plugin {
  return {
    name: 'remove-mock-data',
    transform(code, id) {
      // Only process TS/TSX files in src directory
      if (id.includes('/src/') && (id.endsWith('.tsx') || id.endsWith('.ts') || id.endsWith('.jsx') || id.endsWith('.js'))) {
        // Replace all example emails with generic placeholders
        const transformed = code
          // Replace specific example emails
          .replace(/admin@example\.com/gi, '***@***.***')
          .replace(/customer@example\.com/gi, '***@***.***')
          .replace(/sales@example\.com/gi, '***@***.***')
          .replace(/support@example\.com/gi, '***@***.***')
          .replace(/user@example\.com/gi, '***@***.***')
          // Replace dynamic brand emails (legal@, privacy@, security@)
          .replace(/legal@\{BRAND_NAME\.toLowerCase\(\)\}\.com/g, '***@***.***')
          .replace(/privacy@\{BRAND_NAME\.toLowerCase\(\)\}\.com/g, '***@***.***')
          .replace(/security@\{BRAND_NAME\.toLowerCase\(\)\}\.com/g, '***@***.***')
          // Replace example passwords
          .replace(/Sup3rSecure!/g, '***')
          .replace(/N3wSecurePass!/g, '***')
          // Replace example API tokens
          .replace(/sk_live_[*]+/g, 'sk_live_***')
          .replace(/reset_token_here/g, '***');

        // Only return if something actually changed
        if (transformed !== code) {
          return { code: transformed, map: null };
        }
      }
    },
  };
}

/** Keep in sync with DEFAULT_DESCRIPTION in api/lib/spaSocialMeta.ts */
const SHELL_META_DESCRIPTION =
  "Cloud VPS and hosting with a modern control panel, transparent pricing, and reliable infrastructure.";

function htmlShellDefaults(companyName: string): Plugin {
  const shellTitle = `${companyName} | Cloud`;
  return {
    name: "html-shell-defaults",
    transformIndexHtml(html) {
      return html
        .replace("__SHELL_PAGE_TITLE__", shellTitle)
        .replace("__SHELL_META_DESCRIPTION__", SHELL_META_DESCRIPTION);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const companyName = process.env.VITE_COMPANY_NAME || process.env.COMPANY_NAME || process.env.COMPANY_BRAND_NAME || 'GVPSCloud';

  return {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      esbuild: {
        drop: ['console', 'debugger'],
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@tiptap/') || id.includes('prosemirror') || id.includes('lowlight')) {
                return 'vendor-tiptap';
              }
              if (id.includes('xterm') || id.includes('xterm-addon')) {
                return 'vendor-xterm';
              }
              if (id.includes('recharts') || id.includes('d3-') || id.includes('d3/') || id.includes('victory-') || id.includes('react-smooth')) {
                return 'vendor-recharts';
              }
              if (id.includes('leaflet') || id.includes('react-leaflet')) {
                return 'vendor-leaflet';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('@radix-ui/') || id.includes('cmdk') || id.includes('react-hook-form') || id.includes('@hookform/')) {
                return 'vendor-ui';
              }
              if (id.includes('@tanstack/')) {
                return 'vendor-tanstack';
              }
              if (id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('react/') || id.includes('react@')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tsconfigPaths(),
      htmlShellDefaults(companyName),
      removeMockData(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: ['favicon.svg', 'logo.svg', 'og-default.png'],
        manifest: {
          name: `${companyName} Cloud Panel`,
          short_name: companyName,
          description: `${companyName} Cloud Management Platform`,
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB limit
        navigateFallback: null, // Disable fallback for API routes
        runtimeCaching: [
          {
            // ONLY cache GET requests for API
            urlPattern: ({ request, url }: { request: Request; url: URL }) => {
              return request.method === 'GET' && url.pathname.startsWith('/api/');
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [200] // Only cache valid 200 responses
              }
            }
          },
          // Cache third party cross-origin assets
          {
            urlPattern: ({ url }: { url: URL }) => [
              'flagcdn.com',
              'cdn.simpleicons.org',
              'cdnjs.cloudflare.com',
              'basemaps.cartocdn.com',
              'cdn.jsdelivr.net'
            ].some(domain => url.hostname.endsWith(domain)),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'third-party-assets',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  // Expose custom env prefix so frontend can read COMPANY-NAME
  envPrefix: ["VITE_"], // Removed COMPANY- to prevent accidental bundling of sensitive env vars
  server: {
    host: "0.0.0.0", // Allow connections from any IP address
    port: 5173, // Default Vite port
    strictPort: false, // Allow fallback to other ports if 5173 is busy
    allowedHosts: true, // Accept requests for any hostname (useful for custom domains)
    proxy: {
      "/api/": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
        timeout: 0, // Disable timeout for SSE connections
        proxyTimeout: 0, // Disable proxy timeout
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            // Silently handle proxy errors to avoid flooding logs
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            // For SSE connections, ensure proper headers
            if (req.url?.includes("/notifications/stream")) {
              proxyReq.setHeader("Accept", "text/event-stream");
              proxyReq.setHeader("Cache-Control", "no-cache");
            }
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            // For SSE connections, ensure proper headers are passed through
            if (req.url?.includes("/notifications/stream")) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["connection"] = "keep-alive";
            }
          });
        },
      },
    },
  },
  preview: {
    allowedHosts: true, // Mirror dev server behaviour for Vite preview builds
  },
};
});
