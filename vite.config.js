import { defineConfig } from 'vite';

export default defineConfig({
  // Three.js alone is ~600 KB minified; one chunk is fine for a single-page game.
  build: { chunkSizeWarningLimit: 900 }
});
