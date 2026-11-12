import { add, dot, length, normalize, scale, sub, type Vec3, VECTOR_EPSILON } from "./math";

export interface SplineSample {
  point: Vec3;
  tangent: Vec3;
  distance: number;
  length: number;
  gap: number;
}

export interface Spline {
  points: readonly Vec3[];
  cumulative: readonly number[];
  length: number;
}

/**
 * Dense polyline through Catmull-Rom control points.
 * `samplesPerSpan` is how many segments each control span is split into.
 */
export function buildSpline(controls: readonly Vec3[], samplesPerSpan: number): Spline {
  if (controls.length < 2) {
    const only = controls[0] ?? { x: 0, y: 0, z: 0 };
    return { points: [only], cumulative: [0], length: 0 };
  }
  const spans = Math.max(1, Math.floor(samplesPerSpan));
  const points: Vec3[] = [];
  const extended = [controls[0]!, ...controls, controls[controls.length - 1]!];
  for (let span = 0; span < controls.length - 1; span += 1) {
    const p0 = extended[span]!;
    const p1 = extended[span + 1]!;
    const p2 = extended[span + 2]!;
    const p3 = extended[span + 3]!;
    for (let step = 0; step < spans; step += 1) {
      points.push(catmullRom(p0, p1, p2, p3, step / spans));
    }
  }
  points.push(controls[controls.length - 1]!);

  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += length(sub(points[index]!, points[index - 1]!));
    cumulative.push(total);
  }
  return { points, cumulative, length: total };
}

export function sampleSpline(spline: Spline, distance: number): SplineSample {
  const point = pointAt(spline, distance);
  return {
    point: point.point,
    tangent: point.tangent,
    distance: point.distance,
    length: spline.length,
    gap: 0,
  };
}

export function closestOnSpline(spline: Spline, position: Vec3): SplineSample {
  if (spline.points.length === 0) {
    return {
      point: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 0, z: 1 },
      distance: 0,
      length: 0,
      gap: length(position),
    };
  }
  if (spline.points.length === 1) {
    const only = spline.points[0]!;
    return {
      point: only,
      tangent: { x: 0, y: 0, z: 1 },
      distance: 0,
      length: spline.length,
      gap: length(sub(position, only)),
    };
  }

  let bestGap = Number.POSITIVE_INFINITY;
  let bestPoint = spline.points[0]!;
  let bestDistance = 0;
  let bestTangent = { x: 0, y: 0, z: 1 };

  for (let index = 1; index < spline.points.length; index += 1) {
    const start = spline.points[index - 1]!;
    const end = spline.points[index]!;
    const span = sub(end, start);
    const spanLength = length(span);
    if (spanLength < VECTOR_EPSILON) continue;
    const tangent = scale(span, 1 / spanLength);
    const along = clamp01(dot(sub(position, start), tangent) / spanLength);
    const point = add(start, scale(span, along));
    const gap = length(sub(position, point));
    if (gap < bestGap) {
      bestGap = gap;
      bestPoint = point;
      bestDistance = spline.cumulative[index - 1]! + spanLength * along;
      bestTangent = tangent;
    }
  }

  return {
    point: bestPoint,
    tangent: bestTangent,
    distance: bestDistance,
    length: spline.length,
    gap: bestGap,
  };
}

function pointAt(
  spline: Spline,
  distance: number,
): { point: Vec3; tangent: Vec3; distance: number } {
  if (spline.points.length === 0) {
    return { point: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: 1 }, distance: 0 };
  }
  const clamped = Math.min(spline.length, Math.max(0, distance));
  if (spline.points.length === 1 || spline.length <= VECTOR_EPSILON) {
    return { point: spline.points[0]!, tangent: { x: 0, y: 0, z: 1 }, distance: 0 };
  }
  let index = 1;
  while (index < spline.cumulative.length - 1 && spline.cumulative[index]! < clamped) index += 1;
  const endDistance = spline.cumulative[index]!;
  const startDistance = spline.cumulative[index - 1]!;
  const span = Math.max(endDistance - startDistance, VECTOR_EPSILON);
  const t = (clamped - startDistance) / span;
  const start = spline.points[index - 1]!;
  const end = spline.points[index]!;
  return {
    point: add(start, scale(sub(end, start), t)),
    tangent: normalize(sub(end, start)),
    distance: clamped,
  };
}

function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const component = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return {
    x: component(p0.x, p1.x, p2.x, p3.x),
    y: component(p0.y, p1.y, p2.y, p3.y),
    z: component(p0.z, p1.z, p2.z, p3.z),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
