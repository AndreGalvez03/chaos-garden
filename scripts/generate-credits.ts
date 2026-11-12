import { writeFileSync } from "node:fs";
import { renderCreditsMarkdown } from "../src/content/assets";
import { asManifest, readManifest } from "./lib/assets";

const markdown = renderCreditsMarkdown(asManifest(readManifest(process.cwd())));
writeFileSync("CREDITS.md", markdown);
console.log("Wrote CREDITS.md");
