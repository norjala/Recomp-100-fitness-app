/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['__tests__/setup/vitest.setup.ts'],
    include: [
      '__tests__/frontend/**/*.test.{ts,tsx}',
      'client/src/**/*.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '__tests__/backend/**/*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage/frontend',
      include: [
        'client/src/**/*.{ts,tsx}'
      ],
      exclude: [
        'client/src/**/*.d.ts',
        'client/src/main.tsx',
        'client/src/vite-env.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared')
    }
  }
});