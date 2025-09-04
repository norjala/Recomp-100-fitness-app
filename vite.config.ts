import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false, // Disable source maps for production
    minify: "esbuild", // Faster minification
    chunkSizeWarningLimit: 1000, // Increase chunk size limit
    rollupOptions: {
      output: {
        // Dependency-aware chunking with guaranteed loading order
        manualChunks(id) {
          // PHASE 1: React core (must load first)
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          
          // PHASE 2: Form ecosystem (depends on React, must stay together) 
          if (id.includes('react-hook-form') || 
              id.includes('@hookform/resolvers') || 
              id.includes('zod')) {
            return 'forms';
          }
          
          // PHASE 3: UI libraries (safe, no React dependencies in global scope)
          if (id.includes('@radix-ui/') || id.includes('lucide-react')) {
            return 'ui-libs';
          }
          
          // PHASE 4: Other vendor libraries (load after React is available)
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});