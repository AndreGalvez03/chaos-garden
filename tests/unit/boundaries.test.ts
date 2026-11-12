import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("module boundaries", () => {
  it("fails when Babylon is imported under core, including through another core file", () => {
    const bridge = path.join(root, "src/core/boundary-bridge.ts");
    const leak = path.join(root, "src/core/boundary-leak.ts");
    writeFileSync(
      bridge,
      'import { Vector3 } from "@babylonjs/core/Maths/math.vector";\nexport const origin = Vector3.Zero();\n',
    );
    writeFileSync(
      leak,
      'import { origin } from "./boundary-bridge";\nexport const marker = origin;\n',
    );
    try {
      const result = cruise();
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("core-stays-free-of-the-renderer");
    } finally {
      rmSync(bridge, { force: true });
      rmSync(leak, { force: true });
    }
  });

  it("fails when Babylon is imported under pets through another pet file", () => {
    const bridge = path.join(root, "src/pets/boundary-bridge.ts");
    const leak = path.join(root, "src/pets/boundary-leak.ts");
    writeFileSync(
      bridge,
      'import { Vector3 } from "@babylonjs/core/Maths/math.vector";\nexport const origin = Vector3.Zero();\n',
    );
    writeFileSync(
      leak,
      'import { origin } from "./boundary-bridge";\nexport const marker = origin;\n',
    );
    try {
      const result = cruise();
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("pets-stay-free-of-the-renderer");
    } finally {
      rmSync(bridge, { force: true });
      rmSync(leak, { force: true });
    }
  });
});

function cruise(): { status: number | null; output: string } {
  const bin = path.join(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
  const result = spawnSync(
    process.execPath,
    [bin, "src", "--config", "dependency-cruiser.config.mjs", "--output-type", "err"],
    { cwd: root, encoding: "utf8" },
  );
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}
