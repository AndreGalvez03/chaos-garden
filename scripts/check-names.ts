import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { scanText, shouldScan, type NameHit } from "./lib/names";

interface DenylistFile {
  terms: string[];
}

const denylist = JSON.parse(readFileSync("config/name-denylist.json", "utf8")) as DenylistFile;
if (!Array.isArray(denylist.terms) || denylist.terms.length === 0) {
  console.error("config/name-denylist.json needs a non-empty terms array.");
  process.exit(1);
}

const tracked = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((file) => file.length > 0 && shouldScan(file));

const hits: NameHit[] = [];
for (const file of tracked) {
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  if (bytes.includes(0)) {
    hits.push(...scanText(file, "", denylist.terms));
    continue;
  }
  hits.push(...scanText(file, bytes.toString("utf8"), denylist.terms));
}

if (hits.length > 0) {
  for (const hit of hits) {
    const place = hit.line === 0 ? "filename" : `line ${hit.line}`;
    console.error(`${hit.path} (${place}) matches denylisted term "${hit.term}".`);
  }
  process.exit(1);
}
console.log(`Name check passed for ${tracked.length} tracked files.`);
