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
    {
      name: "movement-math-stays-pure",
      severity: "error",
      comment: "The movement controller, camera math, and tuning do not touch the scene graph.",
      from: { path: "^src/player/(controller|camera|tuning)\\.ts$" },
      to: { path: "(^node_modules/@babylonjs|^src/(scenes|ui|app|levels))" },
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
