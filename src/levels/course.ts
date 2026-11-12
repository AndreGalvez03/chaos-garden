import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateRibbon } from "@babylonjs/core/Meshes/Builders/ribbonBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePolyhedron } from "@babylonjs/core/Meshes/Builders/polyhedronBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";
import type { Vec3 } from "../core/math";
import { buildSpline, type Spline } from "../core/spline";
import type { SurfaceMeta } from "./surface";

export interface CourseContent {
  rails: Spline[];
  targets: Vec3[];
}

const RAIL_CONTROLS: readonly Vec3[] = [
  { x: 5.4, y: 0.55, z: 46 },
  { x: 7.6, y: 2.6, z: 60 },
  { x: 6.4, y: 4.8, z: 76 },
  { x: 4.2, y: 3.2, z: 90 },
  { x: 3.6, y: 1.35, z: 104 },
];

/**
 * Original gray-box ribbon past the yard: a straight, a slope, one lifted loop,
 * one rail, two springs, and lock-on beacons. Nothing here traces a published level.
 */
export function buildCourse(scene: Scene): CourseContent {
  const tones = {
    path: tone(scene, "path", new Color3(0.5, 0.52, 0.5)),
    stone: tone(scene, "stone", new Color3(0.62, 0.63, 0.61)),
    slope: tone(scene, "slope", new Color3(0.4, 0.42, 0.4)),
    loop: loopTone(scene),
    rail: tone(scene, "rail", new Color3(0.46, 0.4, 0.34)),
    spring: tone(scene, "spring", new Color3(0.62, 0.46, 0.3)),
    beacon: tone(scene, "beacon", new Color3(0.48, 0.58, 0.38)),
  };

  box(scene, "terrace-straight", [8, 1, 104], [0, -0.5, 76], tones.path, { kind: "ground" });
  ledge(scene, tones.stone);
  slope(scene, tones.slope);
  approach(scene, tones.path);
  const loopExit = liftedLoop(scene, tones.loop);
  exitDeck(scene, tones.path, loopExit);
  gateway(scene, tones.stone);
  sideWall(scene, tones.stone);

  const springDirection = normalize({ x: 0.28, y: 1, z: 0.42 });
  spring(scene, "spring-yard", [-12, 0.35, -2], springDirection, tones.spring);
  spring(
    scene,
    "spring-exit",
    [loopExit.x, loopExit.y, loopExit.z + 8],
    { x: 0.05, y: 0.86, z: 0.5 },
    tones.spring,
  );

  const targets: Vec3[] = [
    { x: -5, y: 8.2, z: 8 },
    { x: loopExit.x - 1, y: loopExit.y + 7, z: loopExit.z + 18 },
    { x: loopExit.x + 3, y: loopExit.y + 9, z: loopExit.z + 32 },
    { x: loopExit.x - 2, y: loopExit.y + 6.5, z: loopExit.z + 46 },
  ];
  for (const [index, target] of targets.entries()) {
    const marker = CreatePolyhedron(`beacon-${index + 1}`, { type: 1, size: 0.55 }, scene);
    marker.position.set(target.x, target.y, target.z);
    marker.material = tones.beacon;
  }

  railMesh(scene, tones.rail);
  return { rails: [buildSpline(RAIL_CONTROLS, 8)], targets };
}

function ledge(scene: Scene, material: StandardMaterial): void {
  box(scene, "rail-ledge", [3.4, 0.45, 12], [5.6, 0.22, 48], material, { kind: "ground" });
}

function slope(scene: Scene, material: StandardMaterial): void {
  const run = 42;
  const rise = 7;
  const startZ = 128;
  const angle = Math.atan2(rise, run);
  const thickness = 0.4;
  const normal = new Vector3(0, Math.cos(angle), -Math.sin(angle));
  const center = new Vector3(0, rise / 2, startZ + run / 2).subtract(normal.scale(thickness / 2));
  const mesh = CreateBox(
    "terrace-slope",
    { width: 8, height: thickness, depth: Math.hypot(run, rise) },
    scene,
  );
  mesh.position.copyFrom(center);
  mesh.rotation.x = -angle;
  mesh.material = material;
  mesh.metadata = { kind: "ground" } satisfies SurfaceMeta;
  mesh.computeWorldMatrix(true);
  new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 0, friction: 0.85, restitution: 0 },
    scene,
  );
}

function approach(scene: Scene, material: StandardMaterial): void {
  // Ends at the loop mouth. The crest of the slope lands on this deck.
  box(scene, "loop-approach", [8, 0.7, 36], [0, 6.15, 186], material, { kind: "ground" });
}

function liftedLoop(scene: Scene, material: StandardMaterial): Vec3 {
  const steps = 18;
  const radius = 7;
  const baseY = 6.5;
  const mouthZ = 204;
  const sweep = Math.PI * 0.92;
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const phi = (index / steps) * sweep;
    const point = loopPoint(phi, radius, baseY + radius, mouthZ);
    left.push(point.add(new Vector3(-3, 0, 0)));
    right.push(point.add(new Vector3(3, 0, 0)));
  }
  const ribbon = CreateRibbon(
    "loop-ribbon",
    { pathArray: [right, left], sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  ribbon.material = material;
  ribbon.isPickable = false;

  const angle = 0.9;
  const length = 8;
  const thickness = 0.4;
  const rise = Math.sin(angle) * length;
  const run = Math.cos(angle) * length;
  const ramp = CreateBox("loop-ramp", { width: 6, height: thickness, depth: length }, scene);
  const normal = new Vector3(0, Math.cos(angle), -Math.sin(angle));
  ramp.position
    .set(0, baseY + rise / 2, mouthZ + run / 2)
    .subtractInPlace(normal.scale(thickness / 2));
  ramp.rotation.x = -angle;
  ramp.material = material;
  ramp.metadata = { kind: "loop" } satisfies SurfaceMeta;
  ramp.computeWorldMatrix(true);
  new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0, friction: 1, restitution: 0 }, scene);

  return { x: 0, y: baseY + rise, z: mouthZ + run + 6 };
}

function exitDeck(scene: Scene, material: StandardMaterial, exit: Vec3): void {
  box(scene, "loop-exit", [8, 0.7, 28], [exit.x, exit.y - 0.35, exit.z + 10], material, {
    kind: "ground",
  });
}

function gateway(scene: Scene, material: StandardMaterial): void {
  box(scene, "gate-left", [0.7, 3.2, 0.7], [-1.55, 1.6, 96], material, { kind: "ground" });
  box(scene, "gate-right", [0.7, 3.2, 0.7], [1.55, 1.6, 96], material, { kind: "ground" });
  box(scene, "gate-lintel", [3.9, 0.45, 0.7], [0, 3.2, 96], material, { kind: "ground" });
}

function sideWall(scene: Scene, material: StandardMaterial): void {
  box(scene, "camera-wall", [0.45, 2.6, 16], [3.7, 1.3, 78], material, { kind: "ground" });
}

function spring(
  scene: Scene,
  name: string,
  position: [number, number, number],
  direction: Vec3,
  material: StandardMaterial,
): void {
  const pad = CreateCylinder(name, { height: 0.28, diameter: 1.5, tessellation: 10 }, scene);
  pad.position.set(position[0], position[1], position[2]);
  pad.material = material;
  const unitDirection = normalize(direction);
  pad.metadata = { kind: "spring", springDirection: unitDirection } satisfies SurfaceMeta;
  pad.computeWorldMatrix(true);
  new PhysicsAggregate(
    pad,
    PhysicsShapeType.BOX,
    { mass: 0, friction: 0.4, restitution: 0 },
    scene,
  );
}

function railMesh(scene: Scene, material: StandardMaterial): void {
  const spline = buildSpline(RAIL_CONTROLS, 6);
  for (let index = 0; index < spline.points.length; index += 3) {
    const point = spline.points[index];
    if (!point) continue;
    const rung = CreateBox(`rail-rung-${index}`, { width: 0.18, height: 0.12, depth: 0.7 }, scene);
    rung.position.set(point.x, point.y, point.z);
    rung.material = material;
  }
}

function loopPoint(phi: number, radius: number, centerY: number, centerZ: number): Vector3 {
  return new Vector3(0, centerY - radius * Math.cos(phi), centerZ + radius * Math.sin(phi));
}

function box(
  scene: Scene,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: StandardMaterial,
  meta: SurfaceMeta,
): void {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.material = material;
  mesh.metadata = meta;
  mesh.computeWorldMatrix(true);
  new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 0, friction: 0.85, restitution: 0 },
    scene,
  );
}

function loopTone(scene: Scene): StandardMaterial {
  const material = tone(scene, "loop", new Color3(0.55, 0.56, 0.52));
  material.backFaceCulling = false;
  material.emissiveColor = new Color3(0.16, 0.17, 0.15);
  return material;
}

function tone(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(`course-${name}`, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.02, 0.02, 0.02);
  return material;
}

function normalize(value: Vec3): Vec3 {
  const size = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / size, y: value.y / size, z: value.z / size };
}
