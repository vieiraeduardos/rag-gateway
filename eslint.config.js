import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  {
    ignores: ["dist", "node_modules"],
  },

  js.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      prettier: prettierPlugin,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...ts.configs["recommended-requiring-type-checking"].rules,

      "prettier/prettier": "error",
    },
  },
  prettierConfig,
];
