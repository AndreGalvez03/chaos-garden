import { statSync } from "node:fs";
import path from "node:path";
import { budgetErrors, measureDist } from "./lib/bundle";

const distDir = path.join(process.cwd(), "dist");
try {
  if (!statSync(distDir).isDirectory()) throw new Error("missing");
} catch {
  console.error("dist/ is missing. Run npm run build first.");
  process.exit(1);
}

const files = measureDist(distDir);
for (const file of files) {
  console.log(`${file.name}: ${file.bytes} bytes (${file.gzip} gzip)`);
}
const errors = budgetErrors(files);
if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log("Bundle is within budget.");
