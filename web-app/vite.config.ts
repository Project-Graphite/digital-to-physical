import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // Never inline WASM — let the browser stream it directly
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Stable chunk names for long-term CDN cache hits
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
          if (id.includes('node_modules/fflate')) return 'fflate';
          if (id.includes('node_modules/node-unrar-js')) return 'unrar';
        },
      },
    },
  },
});
