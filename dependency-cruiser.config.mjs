/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "pets-stay-inside-pets",
      severity: "error",
      comment: "Pet rules cannot import the renderer or any other source module.",
      from: { path: "^src/pets" },
      to: { pathNot: "^src/pets" },
    },
    {
      name: "core-does-not-import-scenes-or-ui",
      severity: "error",
      comment: "Wire scenes and UI from src/app, not from core.",
      from: { path: "^src/core" },
      to: { path: "^src/(scenes|ui)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
      mainFields: ["module", "main", "types"],
    },
  },
};
