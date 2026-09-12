import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Plain multi-entry Rollup config instead of @crxjs/vite-plugin.
// See CLAUDE.md-adjacent decision note in README for the reasoning:
// crxjs's manifest-driven pipeline is convenient but has historically lagged
// behind Vite major versions and adds a layer of "magic" manifest rewriting
// that is hard to debug mid-hackathon. A plain multi-entry build gives full
// control over output filenames (which the static manifest.json references
// directly) and has no dependency on a third-party plugin's release cadence.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
