import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@sagespan/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    // UI component tests (src/ui/__tests__/*.test.tsx) render with react-dom/server in this node environment;
    // the JSX transform comes from tsconfig's "jsx": "react-jsx" (no esbuild/oxc override: its option types differ between hosts).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
