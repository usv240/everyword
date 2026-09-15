import { defineConfig } from "vitest/config";

/**
 * Root test run: the workspace packages only.
 *
 * tv/ is deliberately outside the npm workspaces (it needs its own React
 * Native toolchain and a pinned React copy; see tv/metro.config.js), and it
 * runs its own jest suite via `npm test` inside tv/. Without this exclusion
 * vitest walks into tv/__tests__ and tries to resolve tv/tsconfig.json,
 * which extends @react-native/typescript-config. That package only exists
 * in tv/node_modules, so a fresh clone that has only run the root install
 * fails the whole test run before any assertion executes.
 */
export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tv/**", "**/dist/**"],
  },
});
