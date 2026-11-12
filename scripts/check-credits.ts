import { readFileSync } from "node:fs";
import { renderCreditsMarkdown } from "../src/content/assets";
import { asManifest, readManifest } from "./lib/assets";

const expected = renderCreditsMarkdown(asManifest(readManifest(process.cwd())));
const actual = readFileSync("CREDITS.md", "utf8");
if (actual !== expected) {
  console.error("CREDITS.md is stale. Run npm run credits.");
  process.exit(1);
}
console.log("CREDITS.md matches the asset manifest.");
