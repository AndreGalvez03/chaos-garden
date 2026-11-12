import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderCreditsMarkdown } from "../../src/content/assets";
import { ALLOWED_LICENSES, asManifest, auditAssets, readManifest } from "../../scripts/lib/assets";
import { findTerms, scanText, shouldScan } from "../../scripts/lib/names";
import { budgetErrors, MAX_JS_GZIP_BYTES, MAX_WASM_BYTES } from "../../scripts/lib/bundle";

describe("asset manifest", () => {
  it("accepts this repository", () => {
    expect(auditAssets(process.cwd(), readManifest(process.cwd()))).toEqual([]);
  });

  it("rejects a missing file, an extra file, and a license outside the allowlist", () => {
    const root = mkdtempSync(path.join(tmpdir(), "garden-assets-"));
    mkdirSync(path.join(root, "assets"));
    mkdirSync(path.join(root, "public"));
    writeFileSync(path.join(root, "public", "mark.svg"), "<svg></svg>");
    writeFileSync(path.join(root, "public", "extra.svg"), "<svg></svg>");
    const manifest = {
      assets: [
        {
          path: "public/missing.svg",
          title: "Missing",
          author: "Someone",
          sourceUrl: "https://example.com/missing",
          license: "CC-BY-NC-4.0",
          original: false,
        },
      ],
    };
    const errors = auditAssets(root, manifest);
    expect(errors.some((error) => error.includes("missing.svg"))).toBe(true);
    expect(errors.some((error) => error.includes("extra.svg"))).toBe(true);
    expect(errors.some((error) => error.includes("allowlist"))).toBe(true);
    expect(ALLOWED_LICENSES).toEqual(["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "MIT", "OFL-1.1"]);
  });

  it("renders credits from the same records the game reads", () => {
    const manifest = asManifest(readManifest(process.cwd()));
    const markdown = renderCreditsMarkdown(manifest);
    expect(markdown).toContain(manifest.assets[0]?.title);
    expect(markdown).toContain("Do not edit by hand.");
    expect(readFileSync("CREDITS.md", "utf8")).toBe(markdown);
  });
});

describe("name check", () => {
  const denylist = JSON.parse(readFileSync("config/name-denylist.json", "utf8")) as {
    terms: string[];
  };

  it("does not scan the denylist itself", () => {
    expect(shouldScan("config/name-denylist.json")).toBe(false);
    expect(shouldScan("README.md")).toBe(true);
  });

  it("matches a configured term as a whole word and ignores a longer word", () => {
    const term = denylist.terms[0];
    expect(term).toBeTruthy();
    expect(scanText("notes.md", `see ${term} here`, denylist.terms).map((hit) => hit.line)).toEqual(
      [1],
    );
    expect(scanText("notes.md", `see ${term}s here`, denylist.terms)).toEqual([]);
    const nested = denylist.terms.find(
      (entry) => entry.length >= 3 && "chaos".startsWith(entry.toLowerCase()),
    );
    expect(nested).toBeTruthy();
    expect(
      scanText("src/config.ts", 'export const GAME_TITLE = "Chaos Garden";', denylist.terms),
    ).toEqual([]);
  });

  it("matches a phrase regardless of case", () => {
    const phrase = denylist.terms.find((entry) => entry.includes(" "));
    expect(phrase).toBeTruthy();
    if (!phrase) return;
    expect(findTerms(phrase.toUpperCase(), denylist.terms)).toContain(phrase);
    expect(findTerms(phrase.replace(" ", "x"), denylist.terms)).not.toContain(phrase);
  });
});

describe("bundle budget", () => {
  it("flags an empty build and an oversized script", () => {
    expect(budgetErrors([])).toHaveLength(2);
    const errors = budgetErrors([
      { name: "assets/index.js", bytes: 10, gzip: MAX_JS_GZIP_BYTES + 1 },
      { name: "assets/physics.wasm", bytes: MAX_WASM_BYTES + 1, gzip: 10 },
    ]);
    expect(errors).toHaveLength(2);
  });
});
