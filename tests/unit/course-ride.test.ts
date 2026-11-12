import { readFileSync } from "node:fs";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import { describe, expect, it } from "vitest";
import { FIXED_STEP_SECONDS } from "../../src/core/loop";
import { closestOnSpline, type Spline } from "../../src/core/spline";
import { buildCourse } from "../../src/levels/course";
import { LOOP_COLLISION_BIT, readSurface } from "../../src/levels/surface";
import { buildYard, YARD_SPAWN } from "../../src/levels/yard";
import {
  createControllerState,
  FALL_RESET_Y,
  isSafeGroundSample,
  respawnPoint,
  SAFE_EDGE_MARGIN,
  stepController,
  wishFromStick,
  type ControllerState,
  type GroundQuery,
} from "../../src/player/controller";
import { createPlaceholderHero, type PlaceholderHero } from "../../src/player/hero";
import { DEFAULT_TUNING } from "../../src/player/tuning";

const wasm = readFileSync(
  new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url),
);
const havok = await HavokPhysics({ wasmBinary: wasm });
const engine = new NullEngine();

interface Ride {
  scene: Scene;
  hero: PlaceholderHero;
  sim: ControllerState;
  safe: Vector3;
  respawns: number;
  spring: boolean;
  loop: ReturnType<typeof buildCourse>["loop"];
  rail: Spline;
}

function makeRide(at: Vector3, velocity?: Vector3): Ride {
  const scene = new Scene(engine);
  scene.enablePhysics(new Vector3(0, -DEFAULT_TUNING.gravity, 0), new HavokPlugin(false, havok));
  scene.physicsEnabled = false;
  scene.getPhysicsEngine()?.setTimeStep(FIXED_STEP_SECONDS);
  buildYard(scene);
  const course = buildCourse(scene);
  const hero = createPlaceholderHero(scene, at);
  if (velocity) hero.aggregate.body.setLinearVelocity(velocity);
  return {
    scene,
    hero,
    sim: createControllerState(),
    safe: YARD_SPAWN.clone(),
    respawns: 0,
    spring: false,
    loop: course.loop,
    rail: course.rails[0]!,
  };
}

function ground(ride: Ride): GroundQuery {
  const tuning = DEFAULT_TUNING;
  const position = ride.hero.body.position;
  const up = ride.sim.up;
  const body = ride.hero.aggregate.body;
  const physics = ride.scene.getPhysicsEngine();
  if (!physics) {
    return { hit: false, normal: { x: 0, y: 1, z: 0 }, surface: "ground", springDirection: null };
  }
  const reach = tuning.probeHalfHeight + tuning.probeLength;
  const start = tuning.probeHalfHeight - tuning.probeSkin;
  const from = new Vector3(
    position.x - up.x * start,
    position.y - up.y * start,
    position.z - up.z * start,
  );
  const to = new Vector3(
    position.x - up.x * reach,
    position.y - up.y * reach,
    position.z - up.z * reach,
  );
  const hit = physics.raycast(from, to, { ignoreBody: body, shouldHitTriggers: true });
  if (!hit.hasHit) {
    return { hit: false, normal: { x: 0, y: 1, z: 0 }, surface: "ground", springDirection: null };
  }
  const surface = readSurface(hit.body?.transformNode.metadata);
  return {
    hit: true,
    normal: { x: hit.hitNormalWorld.x, y: hit.hitNormalWorld.y, z: hit.hitNormalWorld.z },
    surface: surface.kind,
    springDirection: surface.springDirection ?? null,
  };
}

function standIsSafe(ride: Ride, at: Vector3): boolean {
  const physics = ride.scene.getPhysicsEngine();
  if (!physics) return false;
  const margin = SAFE_EDGE_MARGIN;
  const spots = [
    [0, 0],
    [margin, 0],
    [-margin, 0],
    [0, margin],
    [0, -margin],
  ];
  return spots.every(([x, z]) => {
    const from = new Vector3(at.x + x!, at.y, at.z + z!);
    const to = new Vector3(from.x, from.y - 2, from.z);
    const hit = physics.raycast(from, to, { ignoreBody: ride.hero.aggregate.body });
    if (!hit.hasHit) return false;
    const surface = readSurface(hit.body?.transformNode.metadata);
    return isSafeGroundSample(true, surface.kind, hit.hitNormalWorld.y);
  });
}

function stepRide(ride: Ride, moveY = 0, moveX = 0): void {
  const body = ride.hero.aggregate.body;
  const position = ride.hero.body.position;
  const velocity = body.getLinearVelocity();
  const floor = ground(ride);
  const place = { x: position.x, y: position.y, z: position.z };
  const rails = closestOnSpline(ride.rail, place);
  const output = stepController({
    state: ride.sim,
    position: place,
    velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
    actions: {
      wish: wishFromStick(moveX, moveY, 0),
      balance: moveX,
      throttle: moveY,
      jumpHeld: false,
      jumpPressed: false,
      rollHeld: false,
      dashPressed: false,
    },
    ground: floor,
    rail: rails.gap <= DEFAULT_TUNING.railGrabRadius * 2.2 ? rails : null,
    loopCourse: ride.loop,
    targets: [],
    dt: FIXED_STEP_SECONDS,
    tuning: DEFAULT_TUNING,
  });
  ride.sim = output.state;
  if (output.state.mode === "springLaunch") ride.spring = true;
  const riding = output.ignoreLoopCollision && output.snap !== null;
  if (output.snap) position.set(output.snap.x, output.snap.y, output.snap.z);
  const facing = new Vector3(output.facing.x, output.facing.y, output.facing.z);
  const upward = new Vector3(output.up.x, output.up.y, output.up.z);
  const aim = new Quaternion();
  Quaternion.FromLookDirectionLHToRef(facing, upward, aim);
  ride.hero.body.rotationQuaternion = aim;
  body.setGravityFactor(output.gravityFactor);
  body.setLinearVelocity(
    riding ? Vector3.Zero() : new Vector3(output.velocity.x, output.velocity.y, output.velocity.z),
  );
  body.setAngularVelocity(Vector3.Zero());
  ride.hero.aggregate.shape.filterCollideMask = output.ignoreLoopCollision
    ? ~LOOP_COLLISION_BIT
    : 0xffffffff;
  ride.hero.body.computeWorldMatrix(true);
  const pre = body.disablePreStep;
  body.disablePreStep = false;
  ride.scene.getPhysicsEngine()?._step(FIXED_STEP_SECONDS);
  body.disablePreStep = pre;
  const here = ride.hero.body.position;
  if (respawnPoint(here.y, { x: ride.safe.x, y: ride.safe.y, z: ride.safe.z })) {
    here.copyFrom(ride.safe);
    body.setLinearVelocity(Vector3.Zero());
    body.setAngularVelocity(Vector3.Zero());
    ride.sim = createControllerState();
    ride.respawns += 1;
  } else if (
    output.supported &&
    (output.state.mode === "idle" || output.state.mode === "run") &&
    here.y > FALL_RESET_Y &&
    standIsSafe(ride, here)
  ) {
    ride.safe.copyFrom(here);
  }
}

describe("course ride", () => {
  it("reaches the loop from a straight run and launches off the exit spring", () => {
    const ride = makeRide(YARD_SPAWN.clone());
    let mouth = 0;
    let entered = false;
    let completed = false;
    let slowestPastLip = 99;
    for (let frame = 0; frame < 1600; frame += 1) {
      const before = ride.hero.body.position.z;
      const speed = ride.hero.aggregate.body.getLinearVelocity().length();
      if (before > 168 && before < 176) slowestPastLip = Math.min(slowestPastLip, speed);
      stepRide(ride, 1);
      const riding = ride.sim.mode === "loopRun" && ride.sim.loopDistance >= 0;
      if (riding && !entered) {
        entered = true;
        mouth = ride.sim.loopSpeed;
      }
      if (entered && ride.sim.mode === "run" && ride.hero.body.position.x > 6) completed = true;
      if (completed && ride.spring) break;
    }
    const at = ride.hero.body.position;
    expect(slowestPastLip, `stalled near the lip at ${at.z.toFixed(1)}`).toBeGreaterThan(8);
    expect(entered, `never entered, ended at z=${at.z.toFixed(1)}`).toBe(true);
    expect(mouth).toBeGreaterThanOrEqual(29);
    expect(completed).toBe(true);
    expect(ride.spring).toBe(true);
    ride.scene.dispose();
  }, 30_000);

  it("stays put after respawning off the side of the straight", () => {
    const ride = makeRide(new Vector3(0, 0.62, 60));
    for (let frame = 0; frame < 70; frame += 1) stepRide(ride, 0, 1);
    for (let frame = 0; frame < 700; frame += 1) stepRide(ride, 0, 0);
    expect(ride.respawns).toBe(1);
    const settled = ride.hero.body.position.clone();
    for (let frame = 0; frame < 120; frame += 1) stepRide(ride, 0, 0);
    expect(ride.respawns).toBe(1);
    expect(ride.hero.body.position.y).toBeGreaterThan(settled.y - 0.2);
    expect(Math.abs(ride.hero.body.position.x - settled.x)).toBeLessThan(0.3);
    ride.scene.dispose();
  }, 30_000);
});
