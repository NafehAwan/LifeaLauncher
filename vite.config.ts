import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import electron from 'vite-plugin-electron';
import { visualizer } from 'rollup-plugin-visualizer';

const alias = { '@': path.resolve(__dirname, 'src'), '@shared': path.resolve(__dirname, 'src/shared') };
// Runtime deps that must stay as real node_modules (native/optional requires).
const mainExternal = ['electron', 'ws', 'yauzl', 'electron-updater', 'bufferutil', 'utf-8-validate'];

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          resolve: { alias },
          build: {
            outDir: 'dist-electron/main',
            minify: mode === 'production',
            sourcemap: true,
            rollupOptions: {
              external: mainExternal,
              output: { format: 'cjs', entryFileNames: '[name].cjs', chunkFileNames: '[name]-[hash].cjs' },
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart({ reload }) {
          reload();
        },
        vite: {
          resolve: { alias },
          build: {
            outDir: 'dist-electron/preload',
            minify: mode === 'production',
            rollupOptions: {
              external: ['electron'],
              output: { format: 'cjs', entryFileNames: '[name].cjs', inlineDynamicImports: true },
            },
          },
        },
      },
    ]),
    mode === 'analyze' && (visualizer({ filename: 'dist/stats.html', gzipSize: true }) as PluginOption),
  ],
  resolve: { alias },
  server: { port: 5173, strictPort: true },
  build: {
    target: 'chrome128',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], query: ['@tanstack/react-query', 'zustand'] },
      },
    },
  },
}));
