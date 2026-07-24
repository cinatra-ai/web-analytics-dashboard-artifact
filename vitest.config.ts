import { defineConfig } from "vitest/config";

// This pack ships manifest + type only (no renderer / UI bundle), so the
// suite runs in a plain node environment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
