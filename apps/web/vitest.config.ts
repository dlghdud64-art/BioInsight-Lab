import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Next.js 와 동일하게 automatic JSX runtime — TSX 파일에서 `import React` 불필요.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // next-auth ESM import chain 을 피하기 위해 manual mock 으로 리다이렉트.
      // 기존 jest.config.js 의 moduleNameMapper 를 이관.
      "next-auth": path.resolve(__dirname, "./src/__mocks__/next-auth.ts"),
      "@auth": path.resolve(__dirname, "./src/__mocks__/next-auth.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    testTimeout: 15_000,
  },
});
