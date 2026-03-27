import { defineConfig } from "vite";
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

// https://vite.dev/config/
export default defineConfig(({ _mode }) => {
  // Load env file based on mode
  const companyName = process.env.VITE_COMPANY_NAME || process.env.COMPANY_NAME || process.env.COMPANY_BRAND_NAME || 'GVPSCloud';
  
  return {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    plugins: [
      react(),
      tsconfigPaths(),
      removeMockData(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'logo.svg'],
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // React ecosystem
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('/react-router')) {
            return 'vendor-react';
          }
          // Radix UI primitives
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          // Icons (lucide is large)
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // Framer Motion
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }
          // Terminal (xterm)
          if (id.includes('@xterm')) {
            return 'vendor-xterm';
          }
          // TanStack
          if (id.includes('@tanstack')) {
            return 'vendor-query';
          }
          // Charts
          if (id.includes('recharts') || id.includes('chart.js')) {
            return 'vendor-charts';
          }
          // DOMPurify / sanitization
          if (id.includes('dompurify') || id.includes('isomorphic-dompurify')) {
            return 'vendor-sanitize';
          }
          // Forms (react-hook-form, zod)
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod')) {
            return 'vendor-forms';
          }
          // Date utilities
          if (id.includes('date-fns') || id.includes('react-day-picker')) {
            return 'vendor-date';
          }
          // Toast / notifications
          if (id.includes('sonner') || id.includes('react-hot-toast')) {
            return 'vendor-toast';
          }
          // Command palette / drawer / dialog
          if (id.includes('cmdk') || id.includes('vaul')) {
            return 'vendor-ui-utils';
          }
          // PayPal
          if (id.includes('@paypal')) {
            return 'vendor-paypal';
          }
          // Three.js (3D globe)
          if (id.includes('/three/') || id.includes('three.js')) {
            return 'vendor-three';
          }
          // Maps
          if (id.includes('react-simple-maps') || id.includes('d3-') || id.includes('topojson')) {
            return 'vendor-maps';
          }
          // Drag and drop
          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }
          // Everything else from node_modules
          return 'vendor-misc';
        },
      },
    },
  },
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
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
            // For SSE connections, ensure proper headers
            if (req.url?.includes("/notifications/stream")) {
              proxyReq.setHeader("Accept", "text/event-stream");
              proxyReq.setHeader("Cache-Control", "no-cache");
            }
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from the Target:",
              proxyRes.statusCode,
              req.url,
            );
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
