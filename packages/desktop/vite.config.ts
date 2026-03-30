import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Build optimizations for better chunking
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - stable, rarely changes
          "vendor-react": ["react", "react-dom"],
          // Animation libraries - heavy but can be cached separately
          "vendor-animation": ["motion", "@tsparticles/react", "@tsparticles/engine", "@tsparticles/slim"],
          // Supabase - database client
          "vendor-supabase": ["@supabase/supabase-js"],
          // Tauri APIs - platform specific
          "vendor-tauri": ["@tauri-apps/api", "@tauri-apps/plugin-deep-link", "@tauri-apps/plugin-global-shortcut", "@tauri-apps/plugin-opener", "@tauri-apps/plugin-process", "@tauri-apps/plugin-store", "@tauri-apps/plugin-updater"],
          // Icons and utilities - frequently used across app
          "vendor-ui": ["lucide-react", "clsx", "tailwind-merge"],
        },
      },
    },
    // Increase warning limit slightly since we're now splitting chunks
    chunkSizeWarningLimit: 400,
  },
}));
