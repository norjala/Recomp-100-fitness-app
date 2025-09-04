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
        // Smart chunking that respects React Hook Form dependencies
        manualChunks(id) {
          // Keep React core together
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          
          // Keep form-related libraries together to prevent cross-chunk issues
          if (id.includes('react-hook-form') || 
              id.includes('@hookform/resolvers') || 
              id.includes('zod')) {
            return 'forms';
          }
          
          // Safe UI libraries (no form dependencies)
          if (id.includes('@radix-ui/') && !id.includes('form')) {
            return 'ui-vendor';
          }
          
          // Node modules vendor chunk for other libraries
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