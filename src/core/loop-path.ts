import { add, cross, length, normalize, scale, sub, type Vec3, VECTOR_EPSILON } from "./math";
import { closestOnSpline, sampleSpline, type Spline, type SplineSample } from "./spline";

export interface LoopFrame {
  point: Vec3;
  tangent: Vec3;
  up: Vec3;
  distance: number;
  length: number;
  gap: number;
}

/** A full turn whose exit is shifted sideways so it does not land on the entrance. */
export interface LoopCourse {
  spline: Spline;
  ups: readonly Vec3[];
  radius: number;
}

export function buildLoopPath(spec: {
  mouth: Vec3;
  forward: Vec3;
  up: Vec3;
  radius: number;
  lateralShift: number;
  samples: number;
}): LoopCourse {
  const forward = normalize(spec.forward);
  const up = normalize(spec.up);
  const right = normalize(cross(up, forward));
  const count = Math.max(12, Math.floor(spec.samples));
  const points: Vec3[] = [];
  const ups: Vec3[] = [];
  for (let index = 0; index <= count; index += 1) {
    const phi = (index / count) * Math.PI * 2;
    const center = add(
      add(spec.mouth, scale(up, spec.radius)),
      scale(right, spec.lateralShift * (phi / (Math.PI * 2))),
    );
    const point = add(
      add(center, scale(up, -spec.radius * Math.cos(phi))),
      scale(forward, spec.radius * Math.sin(phi)),
    );
    points.push(point);
    const inward = sub(center, point);
    ups.push(length(inward) > VECTOR_EPSILON ? normalize(inward) : up);
  }
  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += length(sub(points[index]!, points[index - 1]!));
    cumulative.push(total);
  }
  return {
    spline: { points, cumulative, length: total },
    ups,
    radius: spec.radius,
  };
}

export function sampleLoop(course: LoopCourse, distance: number): LoopFrame {
  const sample = sampleSpline(course.spline, distance);
  return { ...sample, up: upAt(course, sample.distance) };
}

export function closestLoop(course: LoopCourse, position: Vec3): LoopFrame {
  const sample = closestOnSpline(course.spline, position);
  return { ...sample, up: upAt(course, sample.distance) };
}

function upAt(course: LoopCourse, distance: number): Vec3 {
  const spline = course.spline;
  if (course.ups.length === 0) return { x: 0, y: 1, z: 0 };
  if (course.ups.length === 1 || spline.length <= VECTOR_EPSILON) return course.ups[0]!;
  const clamped = Math.min(spline.length, Math.max(0, distance));
  let index = 1;
  while (index < spline.cumulative.length - 1 && spline.cumulative[index]! < clamped) index += 1;
  const end = spline.cumulative[index] ?? spline.length;
  const start = spline.cumulative[index - 1] ?? 0;
  const span = Math.max(end - start, VECTOR_EPSILON);
  const t = (clamped - start) / span;
  const from = course.ups[index - 1] ?? course.ups[0]!;
  const to = course.ups[index] ?? from;
  return normalize({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  });
}

export type { SplineSample };
