import path from "node:path";
import { auditAssets, readManifest } from "./lib/assets";

const root = process.cwd();
const errors = auditAssets(root, readManifest(root));
if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`Asset manifest matches files under assets/ and public/ (${path.basename(root)}).`);
