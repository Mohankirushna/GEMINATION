import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "SurakshaFlow — Fraud Detection",
          short_name: "SurakshaFlow",
          description: "Real-time fraud detection & digital twin platform",
          theme_color: "#7c3aed",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/gemination\.onrender\.com\/api\/.*/i,
              handler: "NetworkFirst",
              options: { cacheName: "api-cache", expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
            },
          ],
        },
      }),
    ],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      allowedHosts: ["gemination-frontend.onrender.com"],
      hmr: true,
      proxy: {
        "/api": {
          target: "https://gemination.onrender.com",
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-charts": ["recharts"],
            "vendor-d3": ["d3"],
            "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
          },
        },
      },
    },
  };
});
