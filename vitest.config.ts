import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "ai-spector-graph": path.resolve(__dirname, "packages/graph/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/graph/tests/**/*.test.ts"],
    environment: "node",
  },
});
