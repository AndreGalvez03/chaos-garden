# ADR 0001: Babylon.js and Havok

## Status

Accepted

## Context

The game is a 3D action-platformer that will ship as a static site on GitHub Pages. The client is Vite and TypeScript. Physics has to support a character, ramps, platforms, and later rails and loops. The project also needs unit tests that do not boot a renderer, plus a browser smoke test of the production build.

Three stacks were considered:

- Babylon.js with its Havok plugin
- Three.js plus a separate physics library
- PlayCanvas

## Decision

Use Babylon.js (`@babylonjs/core`) and the Havok plugin (`@babylonjs/havok`) as ES modules. Vite resolves the physics WebAssembly file with an explicit `locateFile` URL so the same path works in `npm run dev` and in the Pages build.

## Consequences

- Rendering, cameras, materials, and physics share one scene graph. The yard can enable a physics plugin without a second integration layer.
- Havok is distributed as WebAssembly. The bundle budget tracks that file separately from JavaScript. The dev server excludes the package from dependency pre-bundling so the WASM response is not replaced by an HTML fallback.
- The simple motor in this milestone sets velocity directly. A later milestone can move to a character controller on the same plugin without changing the input frame or the scene manager.
- Three.js is a strong renderer, but a physics-heavy character would still need another library and a glue layer. That is more moving parts for a static Pages deploy than this project wants in the foundation.
- PlayCanvas is a capable engine. Its usual path is an editor project and an engine runtime. This repository is a code-first Vite app with unit tests and a `dist/` folder, and Babylon fits that shape more directly.
- Both packages stay dependencies. `@babylonjs/core` is Apache-2.0. `@babylonjs/havok` is MIT. They are not art assets and are not listed in `assets/manifest.json`.
