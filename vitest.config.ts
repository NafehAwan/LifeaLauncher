import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared'), '@': path.resolve(__dirname, 'src') } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
