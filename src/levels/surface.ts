export type SurfaceKind = "ground" | "loop" | "spring";

export interface SurfaceMeta {
  kind: SurfaceKind;
  springDirection?: { x: number; y: number; z: number };
}

export function readSurface(metadata: unknown): SurfaceMeta {
  if (!metadata || typeof metadata !== "object") return { kind: "ground" };
  const record = metadata as Partial<SurfaceMeta>;
  const kind = record.kind;
  if (kind !== "loop" && kind !== "spring" && kind !== "ground") return { kind: "ground" };
  return {
    kind,
    springDirection: record.springDirection,
  };
}
