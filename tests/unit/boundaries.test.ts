import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("module boundaries", () => {
  it("fails when Babylon is imported under core, including through another core file", () => {
    const result = cruise({
      "src/core/boundary-bridge.ts":
        'import { Vector3 } from "@babylonjs/core/Maths/math.vector";\nexport const origin = Vector3.Zero();\n',
      "src/core/boundary-leak.ts":
        'import { origin } from "./boundary-bridge";\nexport const marker = origin;\n',
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("core-stays-free-of-the-renderer");
  });

  it("fails when Babylon is imported under pets through another pet file", () => {
    const result = cruise({
      "src/pets/boundary-bridge.ts":
        'import { Vector3 } from "@babylonjs/core/Maths/math.vector";\nexport const origin = Vector3.Zero();\n',
      "src/pets/boundary-leak.ts":
        'import { origin } from "./boundary-bridge";\nexport const marker = origin;\n',
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("pets-stay-free-of-the-renderer");
  });
});

function cruise(files: Record<string, string>): { status: number | null; output: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "chaos-boundaries-"));
  try {
    expect(path.resolve(dir).startsWith(path.resolve(tmpdir()))).toBe(true);
    mkdirSync(path.join(dir, "src/core"), { recursive: true });
    mkdirSync(path.join(dir, "src/pets"), { recursive: true });
    for (const [relative, contents] of Object.entries(files)) {
      writeFileSync(path.join(dir, relative), contents);
    }
    copyFileSync(path.join(root, "tsconfig.json"), path.join(dir, "tsconfig.json"));
    const realConfig = readFileSync(path.join(root, "dependency-cruiser.config.mjs"), "utf8");
    writeFileSync(
      path.join(dir, "dependency-cruiser.config.mjs"),
      realConfig.replace("options: {", "options: {\n    preserveSymlinks: true,"),
    );
    symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"));
    const bin = path.join(dir, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
    const result = spawnSync(
      process.execPath,
      [bin, "src", "--config", "dependency-cruiser.config.mjs", "--output-type", "err"],
      { cwd: dir, encoding: "utf8" },
    );
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
