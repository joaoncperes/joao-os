import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // OpenNext build output (Cloudflare Worker deploy target) — generated,
    // gitignored, and huge; linting it OOMs eslint and only surfaces noise.
    ".open-next/**",
    "next-env.d.ts",
    // Standalone Cloudflare Worker — has its own tsconfig + lint scope.
    "cron-worker/**",
  ]),
]);

export default eslintConfig;
