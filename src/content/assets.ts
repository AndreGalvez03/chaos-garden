import manifestJson from "../../assets/manifest.json" with { type: "json" };

export interface AssetRecord {
  path: string;
  title: string;
  author: string;
  sourceUrl: string;
  license: string;
  original: boolean;
}

export interface AssetManifest {
  assets: AssetRecord[];
}

export const assetManifest = manifestJson as AssetManifest;

export function renderCreditsMarkdown(manifest: AssetManifest): string {
  const lines = [
    "# Credits",
    "",
    "Generated from `assets/manifest.json`. Do not edit by hand.",
    "",
    "Code in this repository is MIT. Original art, music, and levels are CC-BY 4.0.",
    "",
  ];

  if (manifest.assets.length === 0) {
    lines.push("No asset files are listed.", "");
  }

  for (const asset of manifest.assets) {
    lines.push(`## ${asset.title}`, "");
    lines.push(`- Path: \`${asset.path}\``);
    lines.push(`- Author: ${asset.author}`);
    lines.push(`- License: ${asset.license}`);
    lines.push(`- Source: ${asset.sourceUrl}`);
    lines.push(`- Original: ${asset.original ? "yes" : "no"}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
