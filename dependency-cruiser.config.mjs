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
      name: "core-does-not-import-upward",
      severity: "error",
      comment:
        "Core stays below scenes, UI, the app, levels, and the player, including through other files.",
      from: { path: "^src/core" },
      to: {
        path: "^src/(app|scenes|ui|levels|player)",
        reachable: true,
      },
    },
    {
      name: "core-stays-free-of-the-renderer",
      severity: "error",
      comment:
        "A Babylon import under src/core fails, even when another core file is the one that imports it.",
      from: { path: "^src/core" },
      to: {
        path: "^node_modules/@babylonjs",
        reachable: true,
      },
    },
    {
      name: "pets-stay-free-of-the-renderer",
      severity: "error",
      comment:
        "A Babylon import under src/pets fails, even when it is reached through another pet file.",
      from: { path: "^src/pets" },
      to: {
        path: "^node_modules/@babylonjs",
        reachable: true,
      },
    },
    {
      name: "movement-math-stays-pure",
      severity: "error",
      comment:
        "The movement controller, camera math, and tuning do not touch the scene graph, directly or through another module.",
      from: { path: "^src/player/(controller|camera|tuning)\\.ts$" },
      to: {
        path: "(^node_modules/@babylonjs|^src/(scenes|ui|app|levels))",
        reachable: true,
      },
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
