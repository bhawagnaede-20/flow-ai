import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// FLOW AI frontend build configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
