export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const VEC3_ZERO: Vec3 = { x: 0, y: 0, z: 0 };
export const VEC3_UP: Vec3 = { x: 0, y: 1, z: 0 };
export const VEC3_FORWARD: Vec3 = { x: 0, y: 0, z: 1 };

/** Below this length, a vector is treated as zero. */
export const VECTOR_EPSILON = 1e-8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, scalar: number): Vec3 {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function lengthSq(a: Vec3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function normalize(a: Vec3): Vec3 {
  const size = length(a);
  if (size < VECTOR_EPSILON) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / size);
}

export function projectOnPlane(vector: Vec3, normal: Vec3): Vec3 {
  const n = normalize(normal);
  return sub(vector, scale(n, dot(vector, n)));
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = target - current;
  const turn = Math.PI * 2;
  while (delta > Math.PI) delta -= turn;
  while (delta < -Math.PI) delta += turn;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export function dampVec(current: Vec3, target: Vec3, lambda: number, dt: number): Vec3 {
  const t = 1 - Math.exp(-lambda * dt);
  return lerpVec(current, target, t);
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return add(a, scale(sub(b, a), t));
}

/** Spherical blend of two directions. Returns a unit vector. */
export function slerpDir(from: Vec3, to: Vec3, t: number): Vec3 {
  const a = normalize(from);
  const b = normalize(to);
  if (lengthSq(a) < VECTOR_EPSILON) return b;
  if (lengthSq(b) < VECTOR_EPSILON) return a;
  const cosTheta = clamp(dot(a, b), -1, 1);
  const theta = Math.acos(cosTheta);
  if (theta < 1e-4) return b;
  const sinTheta = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinTheta;
  const w2 = Math.sin(t * theta) / sinTheta;
  return normalize(add(scale(a, w1), scale(b, w2)));
}
