import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["**/*.ts"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/pets/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@babylonjs/*", "@babylonjs/**"],
              message: "Pet rules stay inside src/pets.",
            },
            {
              group: ["../*", "../**"],
              message: "Pet rules stay inside src/pets.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../scenes", "../scenes/**", "../ui", "../ui/**"],
              message: "Core does not import scenes or UI. Wire those from src/app.",
            },
          ],
        },
      ],
    },
  },
);
