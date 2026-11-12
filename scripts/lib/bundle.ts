import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Gzip size of every emitted JavaScript file, combined. The current build is about 401 KB. */
export const MAX_JS_GZIP_BYTES = 550_000;
/** Raw WebAssembly. The current physics file is about 2.1 MB. */
export const MAX_WASM_BYTES = 2_600_000;

export interface MeasuredFile {
  name: string;
  bytes: number;
  gzip: number;
}

export function measureDist(distDir: string): MeasuredFile[] {
  return walk(distDir).map((file) => {
    const bytes = readFileSync(file);
    return {
      name: path.relative(distDir, file).split(path.sep).join("/"),
      bytes: bytes.byteLength,
      gzip: gzipSync(bytes).byteLength,
    };
  });
}

export function budgetErrors(files: readonly MeasuredFile[]): string[] {
  const errors: string[] = [];
  const scripts = files.filter((file) => file.name.endsWith(".js"));
  const wasm = files.filter((file) => file.name.endsWith(".wasm"));
  if (scripts.length === 0) errors.push("The build did not emit any JavaScript.");
  if (wasm.length === 0) errors.push("The build did not emit the physics WebAssembly file.");
  const jsGzip = scripts.reduce((sum, file) => sum + file.gzip, 0);
  const wasmBytes = wasm.reduce((sum, file) => sum + file.bytes, 0);
  if (jsGzip > MAX_JS_GZIP_BYTES) {
    errors.push(`JavaScript gzip is ${jsGzip} bytes, over the ${MAX_JS_GZIP_BYTES} byte budget.`);
  }
  if (wasmBytes > MAX_WASM_BYTES) {
    errors.push(`WebAssembly is ${wasmBytes} bytes, over the ${MAX_WASM_BYTES} byte budget.`);
  }
  return errors;
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}
