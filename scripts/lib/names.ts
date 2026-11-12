export interface NameHit {
  path: string;
  line: number;
  term: string;
}

export const NAME_CHECK_EXCLUSIONS = new Set(["config/name-denylist.json"]);

export function shouldScan(filePath: string): boolean {
  return !NAME_CHECK_EXCLUSIONS.has(filePath);
}

export function termPattern(term: string): RegExp {
  const escaped = term
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
}

export function findTerms(text: string, terms: readonly string[]): string[] {
  const hits: string[] = [];
  for (const term of terms) {
    if (term.trim().length === 0) continue;
    if (termPattern(term).test(text)) hits.push(term);
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
