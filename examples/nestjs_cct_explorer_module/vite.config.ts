import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  root: 'browser-src',
  build: {
    outDir: '../dist/public/browser',
    emptyOutDir: true,
  },
});
