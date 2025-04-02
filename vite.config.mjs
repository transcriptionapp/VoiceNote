import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'html',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  }
});