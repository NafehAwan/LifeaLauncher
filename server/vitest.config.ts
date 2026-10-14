import { defineConfig } from 'vitest/config';

// Own config so vitest never walks up to the launcher's root config (which needs the root node_modules).
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
