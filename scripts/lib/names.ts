export interface NameHit {
  path: string;
  line: number;
  term: string;
}

export const NAME_CHECK_EXCLUSIONS = new Set(["config/name-denylist.json"]);

export function shouldScan(filePath: string): boolean {
  return !NAME_CHECK_EXCLUSIONS.has(filePath);
}

/**
 * Make separators and letter case comparable before matching.
 * Diacritics are removed, camel case is split, and -, _, ., and / become spaces.
 */
export function normalizeForNameCheck(value: string): string {
  const decomposed = value.normalize("NFKD").replace(/\p{M}/gu, "");
  const splitCamel = decomposed.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return splitCamel.replace(/[-_./]+/g, " ").toLowerCase();
}

export function termPattern(term: string): RegExp {
  const words = normalizeForNameCheck(term)
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const body = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "i");
}

export function findTerms(text: string, terms: readonly string[]): string[] {
  const normalized = normalizeForNameCheck(text);
  const hits: string[] = [];
  for (const term of terms) {
    if (term.trim().length === 0) continue;
    if (termPattern(term).test(normalized)) hits.push(term);
  }
  return hits;
}

export function scanText(filePath: string, text: string, terms: readonly string[]): NameHit[] {
  const hits: NameHit[] = [];
  for (const term of findTerms(filePath, terms)) {
    hits.push({ path: filePath, line: 0, term });
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const term of findTerms(line, terms)) {
      hits.push({ path: filePath, line: index + 1, term });
    }
  });
  return hits;
}
