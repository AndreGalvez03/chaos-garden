import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AssetManifest, AssetRecord } from "../../src/content/assets";

export const ALLOWED_LICENSES = ["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "MIT", "OFL-1.1"] as const;

const IGNORED = new Set(["assets/manifest.json"]);

export function listShippedFiles(root: string): string[] {
  const found: string[] = [];
  for (const folder of ["assets", "public"]) {
    walk(path.join(root, folder), root, found);
  }
  return found.sort();
}

function walk(dir: string, root: string, found: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, found);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = path.relative(root, full).split(path.sep).join("/");
    if (IGNORED.has(relative)) continue;
    found.push(relative);
  }
}

export function readManifest(root: string): unknown {
  return JSON.parse(readFileSync(path.join(root, "assets", "manifest.json"), "utf8")) as unknown;
}

export function auditAssets(
  root: string,
  manifest: unknown,
  files = listShippedFiles(root),
): string[] {
  const errors: string[] = [];
  if (!isRecord(manifest) || !Array.isArray(manifest.assets)) {
    return ["assets/manifest.json must contain an assets array."];
  }

  const seen = new Set<string>();
  const listed: string[] = [];
  manifest.assets.forEach((entry, index) => {
    const label = `assets[${index}]`;
    if (!isAssetRecord(entry)) {
      errors.push(`${label} must include path, title, author, sourceUrl, license, and original.`);
      return;
    }
    if (seen.has(entry.path)) errors.push(`${label} repeats path ${entry.path}.`);
    seen.add(entry.path);
    listed.push(entry.path);
    if (!ALLOWED_LICENSES.includes(entry.license as (typeof ALLOWED_LICENSES)[number])) {
      errors.push(`${entry.path} uses license ${entry.license}, which is outside the allowlist.`);
    }
    const full = path.join(root, ...entry.path.split("/"));
    if (!existsFile(full))
      errors.push(`${entry.path} is listed in the manifest but missing on disk.`);
  });

  for (const file of files) {
    if (!seen.has(file)) errors.push(`${file} has no manifest entry.`);
  }
  return errors;
}

function existsFile(full: string): boolean {
  try {
    return statSync(full).isFile();
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAssetRecord(value: unknown): value is AssetRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.path === "string" &&
    value.path.length > 0 &&
    !value.path.includes("\\") &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.author === "string" &&
    value.author.length > 0 &&
    typeof value.sourceUrl === "string" &&
    value.sourceUrl.length > 0 &&
    typeof value.license === "string" &&
    typeof value.original === "boolean"
  );
}

export function asManifest(value: unknown): AssetManifest {
  if (!isRecord(value) || !Array.isArray(value.assets) || !value.assets.every(isAssetRecord)) {
    throw new Error("assets/manifest.json is not a valid manifest.");
  }
  return { assets: value.assets };
}
