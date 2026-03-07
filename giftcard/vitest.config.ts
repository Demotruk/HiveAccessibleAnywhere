import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // hive-tx has broken ESM exports (missing .js extensions in import paths).
    // Force Vitest to process it through Vite's transform pipeline.
    server: {
      deps: {
        inline: ['hive-tx'],
      },
    },
  },
});
