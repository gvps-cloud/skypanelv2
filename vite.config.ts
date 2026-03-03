import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // Expose custom env prefix so frontend can read COMPANY-NAME
  envPrefix: ["VITE_", "COMPANY-"],
  server: {
    host: "0.0.0.0", // Allow connections from any IP address
    port: 8000, // Default Vite port
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
});
