import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'html',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  }
});