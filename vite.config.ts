/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
// import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // GitHub Pages is served under /shuttle-sprite/; local `npm run dev` uses /
  base: mode === "production" ? "/shuttle-sprite/" : "/",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // `$initial` confines every group to the entry's own static graph.
          // Without it a `node_modules` group would sweep Leaflet out of the
          // lazy map chunk and back into a chunk the entry has to preload —
          // undoing the split these groups exist to make legible.
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              tags: ["$initial"],
              priority: 30,
            },
            {
              name: "supabase",
              test: /node_modules[\\/]@supabase[\\/]/,
              tags: ["$initial"],
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules/,
              tags: ["$initial"],
              priority: 10,
              minSize: 20 * 1024,
            },
          ],
        },
      },
    },
    // Set only now that the split has landed: the largest initial chunk is the
    // React runtime, and a warning that always fires is a warning nobody reads.
    chunkSizeWarningLimit: 300,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
    },
  },
}));
