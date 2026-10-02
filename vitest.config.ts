import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  test: {
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globals: false,
  },
});
