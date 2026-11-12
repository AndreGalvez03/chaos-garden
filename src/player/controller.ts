import {
  add,
  clamp,
  dot,
  length,
  normalize,
  projectOnPlane,
  scale,
  slerpDir,
  sub,
  VEC3_FORWARD,
  VEC3_UP,
  VEC3_ZERO,
  type Vec3,
  VECTOR_EPSILON,
} from "../core/math";
import { closestLoop, sampleLoop, type LoopCourse, type LoopFrame } from "../core/loop-path";
import type { SplineSample } from "../core/spline";
import type { PlayerTuning } from "./tuning";

export const PLAYER_MODES = [
  "idle",
  "run",
  "jump",
  "fall",
  "rollCharge",
  "rollBurst",
  "lockOnDash",
  "railGrind",
  "springLaunch",
  "loopRun",
] as const;

export type PlayerMode = (typeof PLAYER_MODES)[number];

export type SurfaceKind = "ground" | "loop" | "spring";

export interface GroundQuery {
  hit: boolean;
  normal: Vec3;
  surface: SurfaceKind;
  springDirection: Vec3 | null;
}

export interface PlayerActions {
  /** Camera-relative wish on the horizontal plane. Length is 0..1. */
  wish: Vec3;
  /** Strafe, -1..1. Pushes balance on a rail. */
  balance: number;
  /** Forward stick, -1..1. Speeds a rail up or down. */
  throttle: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  rollHeld: boolean;
  dashPressed: boolean;
}

export interface ControllerState {
  mode: PlayerMode;
  rollCharge: number;
  burstTime: number;
  dashTime: number;
  dashSpent: boolean;
  dashDir: Vec3;
  dashTarget: Vec3 | null;
  dashEntrySpeed: number;
  jumpOwned: boolean;
  jumpTime: number;
  coyote: number;
  springTime: number;
  springCoast: boolean;
  railSpeed: number;
  railSign: 1 | -1;
  railTime: number;
  railCooldown: number;
  balance: number;
  loopCoyote: number;
  loopDistance: number;
  loopSpeed: number;
  loopCooldown: number;
  loopBlend: number;
  facing: Vec3;
  up: Vec3;
}

export interface ControllerInput {
  state: ControllerState;
  position: Vec3;
  velocity: Vec3;
  actions: PlayerActions;
  ground: GroundQuery;
  rail: SplineSample | null;
  loopCourse: LoopCourse | null;
  targets: readonly Vec3[];
  dt: number;
  tuning: PlayerTuning;
}

export interface ControllerOutput {
  state: ControllerState;
  velocity: Vec3;
  snap: Vec3 | null;
  gravityFactor: number;
  supported: boolean;
  /** While riding the loop spline, the body should not collide with the ribbon. */
  ignoreLoopCollision: boolean;
  up: Vec3;
  facing: Vec3;
}

interface Motion {
  velocity: Vec3;
  snap: Vec3 | null;
  gravityFactor: number;
}

const MODE_LABELS: Record<PlayerMode, string> = {
  idle: "Idle",
  run: "Run",
  jump: "Jump",
  fall: "Fall",
  rollCharge: "Roll charge",
  rollBurst: "Roll burst",
  lockOnDash: "Lock-on dash",
  railGrind: "Rail grind",
  springLaunch: "Spring",
  loopRun: "Loop",
};

/** Below this height the runner is put back on the last safe ground. */
export const FALL_RESET_Y = -20;

export function respawnPoint(height: number, safe: Vec3): Vec3 | null {
  if (height >= FALL_RESET_Y) return null;
  return { x: safe.x, y: safe.y, z: safe.z };
}

export function modeLabel(mode: PlayerMode): string {
  return MODE_LABELS[mode];
}

export function createControllerState(): ControllerState {
  return {
    mode: "idle",
    rollCharge: 0,
    burstTime: 0,
    dashTime: 0,
    dashSpent: false,
    dashDir: { ...VEC3_FORWARD },
    dashTarget: null,
    dashEntrySpeed: 0,
    jumpOwned: false,
    jumpTime: 0,
    coyote: 0,
    springTime: 0,
    springCoast: false,
    railSpeed: 0,
    railSign: 1,
    railTime: 0,
    railCooldown: 0,
    balance: 0,
    loopCoyote: 0,
    loopDistance: -1,
    loopSpeed: 0,
    loopCooldown: 0,
    loopBlend: 0,
    facing: { ...VEC3_FORWARD },
    up: { ...VEC3_UP },
  };
}

/** Stick axes in camera space. Yaw 0 faces +Z, matching the yard camera. */
export function wishFromStick(moveX: number, moveY: number, yaw: number): Vec3 {
  const size = Math.hypot(moveX, moveY);
  if (size < VECTOR_EPSILON) return { ...VEC3_ZERO };
  const limit = size > 1 ? 1 / size : 1;
  const localX = moveX * limit;
  const localY = moveY * limit;
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = forwardZ;
  const rightZ = -forwardX;
  return {
    x: rightX * localX + forwardX * localY,
    y: 0,
    z: rightZ * localX + forwardZ * localY,
  };
}

/**
 * One fixed step of the runner. Contact, rails, and targets are supplied by
 * the caller so this function can run without a scene.
 */
export function stepController(input: ControllerInput): ControllerOutput {
  const tuning = input.tuning;
  const dt = input.dt;
  const state = cloneState(input.state);
  const wishLen = length(input.actions.wish);
  const wishDir = wishLen > VECTOR_EPSILON ? normalize(input.actions.wish) : state.facing;
  const velocity = { ...input.velocity };
  const normal = input.ground.hit ? normalize(input.ground.normal) : state.up;
  const walkable =
    !input.ground.hit || input.ground.surface === "loop" || normal.y >= tuning.walkableDot;
  const supported = input.ground.hit && walkable && dot(velocity, normal) <= tuning.groundedMaxRise;

  if (supported) state.coyote = tuning.coyoteTime;
  else state.coyote = Math.max(0, state.coyote - dt);
  state.railCooldown = Math.max(0, state.railCooldown - dt);
  state.loopCooldown = Math.max(0, state.loopCooldown - dt);

  state.facing = trackFacing(state.facing, state.up, velocity, wishDir, wishLen, tuning, dt);
  if (supported && state.mode !== "loopRun") {
    state.up = slerpDir(state.up, normal, 1 - Math.exp(-tuning.loopAlign * dt));
  }
  state.facing = alignFacing(state.facing, state.up);

  const motion = dispatch(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  return {
    state,
    velocity: motion.velocity,
    snap: motion.snap,
    gravityFactor: motion.gravityFactor,
    supported,
    ignoreLoopCollision: state.mode === "loopRun" && state.loopDistance >= 0,
    up: state.up,
    facing: state.facing,
  };
}

export function pickDashTarget(
  position: Vec3,
  facing: Vec3,
  targets: readonly Vec3[],
  tuning: PlayerTuning,
): Vec3 | null {
  const forward = normalize(facing);
  if (length(forward) < VECTOR_EPSILON) return null;
  let best: Vec3 | null = null;
  let bestDistance = tuning.dashRange;
  for (const target of targets) {
    const offset = sub(target, position);
    const distance = length(offset);
    if (distance < tuning.dashArrive || distance > tuning.dashRange || distance >= bestDistance)
      continue;
    if (dot(scale(offset, 1 / distance), forward) < tuning.dashConeDot) continue;
    best = target;
    bestDistance = distance;
  }
  return best;
}

function dispatch(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  if (state.mode === "springLaunch") return tickSpring(state, velocity, tuning, dt);
  if (state.mode === "lockOnDash") return tickDash(state, input, tuning, dt);
  if (state.mode === "rollCharge") {
    return tickCharge(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  }
  if (state.mode === "railGrind") return tickRail(state, velocity, input, tuning, dt);
  if (state.mode === "loopRun") {
    return tickLoop(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  }
  if (state.mode === "jump") {
    return tickJump(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  }
  if (state.mode === "rollBurst") {
    return tickBurst(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  }
  return tickFree(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
}

function tickFree(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  const launched = trySpring(state, input, supported, tuning);
  if (launched) return launched;
  const grabbed = tryRail(state, velocity, input, supported, tuning);
  if (grabbed) return grabbed;
  const riding = tryLoopRide(state, velocity, input, tuning);
  if (riding) return riding;
  const glued = tryLoop(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  if (glued) return glued;
  if (shouldSlipOffLoop(input, velocity, normal, supported, tuning)) {
    state.mode = "fall";
    state.jumpTime = tuning.minAirTime;
    return motion(velocity, null, tuning.fallGravityScale);
  }
  const dashed = tryDash(state, input, wishDir, wishLen, supported, tuning);
  if (dashed) return dashed;
  if (
    supported &&
    input.actions.rollHeld &&
    (state.mode === "idle" || state.mode === "run" || state.mode === "fall")
  ) {
    state.mode = "rollCharge";
    return tickCharge(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  }
  const jumped = tryJump(state, velocity, input, normal, supported, tuning);
  if (jumped) return jumped;
  if (supported) return tickGround(state, velocity, wishDir, wishLen, normal, tuning, dt);
  return tickAir(state, velocity, wishDir, wishLen, tuning, dt);
}

function tickSpring(
  state: ControllerState,
  velocity: Vec3,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  state.springTime -= dt;
  if (state.springTime <= 0) {
    state.mode = "fall";
    state.springCoast = true;
    state.jumpOwned = false;
    state.jumpTime = tuning.minAirTime;
  }
  return motion(velocity, null, 1);
}

function tickDash(
  state: ControllerState,
  input: ControllerInput,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  state.dashTime -= dt;
  const cap = Math.max(state.dashEntrySpeed, tuning.topSpeed);
  if (state.dashTarget) {
    const offset = sub(state.dashTarget, input.position);
    const dist = length(offset);
    if (dist <= tuning.dashArrive || state.dashTime <= 0)
      return finishDash(state, offset, cap, tuning);
    const direction = scale(offset, 1 / dist);
    state.dashDir = direction;
    state.facing = alignFacing(direction, state.up);
    return motion(scale(direction, Math.min(tuning.dashSpeed, dist / Math.max(dt, 1e-6))), null, 0);
  }
  if (state.dashTime <= 0) return finishDash(state, state.dashDir, cap, tuning);
  return motion(scale(state.dashDir, tuning.dashSpeed), null, 0);
}

function tickCharge(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  state.mode = "rollCharge";
  if (!supported) {
    state.rollCharge = 0;
    return tickAir(state, velocity, wishDir, wishLen, tuning, dt);
  }
  const jumped = tryJump(state, velocity, input, normal, supported, tuning);
  if (jumped) {
    state.rollCharge = 0;
    return jumped;
  }
  if (!input.actions.rollHeld) {
    return beginBurst(state, wishDir, wishLen, tuning, length(projectOnPlane(velocity, normal)));
  }
  const kept = Math.max(0, 1 - tuning.rollFriction * state.rollCharge * dt);
  const planar = scale(projectOnPlane(velocity, normal), kept);
  state.rollCharge = Math.min(1, state.rollCharge + dt / tuning.rollChargeTime);
  return motion(stick(planar, normal, tuning), null, 0);
}

function beginBurst(
  state: ControllerState,
  wishDir: Vec3,
  wishLen: number,
  tuning: PlayerTuning,
  currentSpeed: number,
): Motion {
  const direction = wishLen > 0.15 ? wishDir : state.facing;
  const charged =
    tuning.rollBurstMin + (tuning.rollBurstMax - tuning.rollBurstMin) * state.rollCharge;
  const speed = Math.max(currentSpeed, charged);
  state.mode = "rollBurst";
  state.burstTime = tuning.rollBurstTime;
  state.rollCharge = 0;
  state.facing = alignFacing(direction, state.up);
  return motion(scale(state.facing, speed), null, 0);
}

function tickBurst(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  const launched = trySpring(state, input, supported, tuning);
  if (launched) return launched;
  const grabbed = tryRail(state, velocity, input, supported, tuning);
  if (grabbed) return grabbed;
  const riding = tryLoopRide(state, velocity, input, tuning);
  if (riding) return riding;
  const glued = tryLoop(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
  if (glued) return glued;
  const jumped = tryJump(state, velocity, input, normal, supported, tuning);
  if (jumped) return jumped;
  const dashed = tryDash(state, input, wishDir, wishLen, supported, tuning);
  if (dashed) return dashed;

  state.burstTime -= dt;
  let planar = projectOnPlane(velocity, supported ? normal : VEC3_UP);
  const speed = length(planar);
  if (wishLen > 0.15 && speed > VECTOR_EPSILON) {
    const steered = normalize(add(normalize(planar), scale(wishDir, tuning.rollSteer * dt)));
    planar = scale(steered, speed);
    state.facing = alignFacing(steered, state.up);
  }
  if (state.burstTime <= 0) {
    landOrFall(state, planar, supported, tuning);
    if (supported) return tickGround(state, planar, wishDir, wishLen, normal, tuning, dt);
    return motion({ x: planar.x, y: velocity.y, z: planar.z }, null, tuning.fallGravityScale);
  }
  if (!supported)
    return motion({ x: planar.x, y: velocity.y, z: planar.z }, null, tuning.fallGravityScale);
  return motion(stick(planar, normal, tuning), null, 0);
}

function tickJump(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  const launched = trySpring(state, input, supported, tuning);
  if (launched) return launched;
  const grabbed = tryRail(state, velocity, input, supported, tuning);
  if (grabbed) return grabbed;
  const dashed = tryDash(state, input, wishDir, wishLen, supported, tuning);
  if (dashed) return dashed;

  state.jumpTime += dt;
  if (supported && state.jumpTime > tuning.minAirTime) {
    landOrFall(state, velocity, true, tuning);
    return tickGround(state, velocity, wishDir, wishLen, normal, tuning, dt);
  }

  const steered = steerAir(velocity, wishDir, wishLen, state, tuning, dt);
  const upSpeed = dot(steered, state.up);
  let gravityFactor = tuning.fallGravityScale;
  let next = steered;
  const holding =
    state.jumpOwned &&
    input.actions.jumpHeld &&
    state.jumpTime < tuning.jumpHoldWindow &&
    upSpeed > 0;
  if (holding) gravityFactor = tuning.jumpGravityScale;
  else if (state.jumpOwned && !input.actions.jumpHeld && upSpeed > tuning.jumpCut) {
    next = add(steered, scale(state.up, tuning.jumpCut - upSpeed));
  }
  if (dot(next, state.up) <= 0 && state.jumpTime > tuning.minAirTime) state.mode = "fall";
  return motion(next, null, gravityFactor);
}

function tickRail(
  state: ControllerState,
  _velocity: Vec3,
  input: ControllerInput,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  const rail = input.rail;
  state.railTime += dt;
  if (!rail || rail.gap > tuning.railGrabRadius * 2 || rail.length <= VECTOR_EPSILON) {
    return leaveRail(state, scale(state.facing, state.railSpeed), tuning);
  }
  state.balance += input.actions.balance * tuning.railBalanceRate * dt;
  state.balance *= Math.exp(-tuning.railBalanceRecover * dt);
  if (Math.abs(state.balance) > tuning.railFallBalance) {
    return leaveRail(state, scale(state.facing, state.railSpeed), tuning);
  }

  const travel = railTangent(rail, state.railSign);
  if (input.actions.jumpPressed) {
    state.mode = "jump";
    state.jumpOwned = true;
    state.jumpTime = 0;
    state.railTime = 0;
    state.railCooldown = tuning.railRegrab;
    state.facing = alignFacing(travel, state.up);
    return motion(
      add(scale(travel, state.railSpeed), scale(state.up, tuning.railJumpSpeed)),
      null,
      tuning.jumpGravityScale,
    );
  }

  const atEnd =
    state.railTime > dt &&
    ((state.railSign > 0 && rail.distance >= rail.length - tuning.railEndSlack) ||
      (state.railSign < 0 && rail.distance <= tuning.railEndSlack));
  if (atEnd) return leaveRail(state, scale(travel, state.railSpeed), tuning);

  const throttle = clamp(input.actions.throttle, -1, 1);
  const cruise = tuning.railCruise + throttle * (tuning.railMaxSpeed - tuning.railCruise) * 0.35;
  if (state.railSpeed < cruise)
    state.railSpeed = Math.min(cruise, state.railSpeed + tuning.railAccel * dt);
  else state.railSpeed = Math.max(cruise, state.railSpeed - tuning.railAccel * dt);
  state.railSpeed = clamp(state.railSpeed, 0, tuning.railMaxSpeed);

  const hover = add(rail.point, { x: 0, y: tuning.railHover, z: 0 });
  state.facing = alignFacing(travel, state.up);
  return motion(scale(travel, state.railSpeed), hover, 0);
}

function tickLoop(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  if (state.loopDistance >= 0) return tickLoopRide(state, input, tuning, dt);
  if (supported && input.ground.surface !== "loop" && normal.y >= tuning.walkableDot) {
    state.loopDistance = -1;
    return tickGround(state, velocity, wishDir, wishLen, normal, tuning, dt);
  }
  const surfaceNormal = supported ? normal : state.up;
  if (input.actions.jumpPressed) {
    state.mode = "jump";
    state.jumpOwned = true;
    state.jumpTime = 0;
    state.up = surfaceNormal;
    state.facing = alignFacing(state.facing, surfaceNormal);
    const jumped = add(
      projectOnPlane(velocity, surfaceNormal),
      scale(surfaceNormal, tuning.jumpSpeed),
    );
    return motion(jumped, null, tuning.jumpGravityScale);
  }
  if (!supported) {
    state.loopCoyote -= dt;
    if (state.loopCoyote <= 0) {
      state.mode = "fall";
      state.jumpTime = tuning.minAirTime;
      return motion(velocity, null, tuning.fallGravityScale);
    }
  } else {
    state.loopCoyote = tuning.loopCoyote;
    state.up = slerpDir(state.up, surfaceNormal, 1 - Math.exp(-tuning.loopAlign * dt));
  }

  let tangent = projectOnPlane(velocity, state.up);
  if (length(tangent) < tuning.loopExitSpeed) {
    state.mode = "fall";
    state.jumpTime = tuning.minAirTime;
    return motion({ x: tangent.x, y: velocity.y, z: tangent.z }, null, tuning.fallGravityScale);
  }
  tangent = add(tangent, scale(slopePush(state.up, tuning), dt));
  if (wishLen > 0.05) {
    tangent = accelerate(
      tangent,
      wishDir,
      tuning.topSpeed,
      curveAccel(length(tangent), wishDir, tangent, tuning),
      dt,
    );
  }
  tangent = capSpeed(tangent, tuning.overspeedCap);
  state.facing = alignFacing(length(tangent) > 0.5 ? tangent : state.facing, state.up);
  return motion(add(tangent, scale(state.up, -tuning.loopGlue)), null, 0);
}

function tickGround(
  state: ControllerState,
  velocity: Vec3,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  state.dashSpent = false;
  let planar = projectOnPlane(velocity, normal);
  planar = add(planar, scale(slopePush(normal, tuning), dt));
  if (wishLen > 0.05) {
    const alongSlope = projectOnPlane(wishDir, normal);
    const steer = length(alongSlope) > VECTOR_EPSILON ? normalize(alongSlope) : wishDir;
    const accel = curveAccel(length(planar), steer, planar, tuning);
    planar = accelerate(planar, steer, tuning.topSpeed * wishLen, accel, dt);
    state.mode = "run";
    state.facing = alignFacing(steer, state.up);
  } else {
    planar = decelerate(planar, tuning.brakeAccel, dt);
    state.mode = length(planar) <= tuning.idleSpeed ? "idle" : "run";
    state.jumpOwned = false;
  }
  return motion(stick(capSpeed(planar, tuning.overspeedCap), normal, tuning), null, 0);
}

function tickAir(
  state: ControllerState,
  velocity: Vec3,
  wishDir: Vec3,
  wishLen: number,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  state.mode = "fall";
  const steered = steerAir(velocity, wishDir, wishLen, state, tuning, dt);
  if (state.springCoast && steered.y <= 0) state.springCoast = false;
  return motion(steered, null, state.springCoast ? 1 : tuning.fallGravityScale);
}

function shouldSlipOffLoop(
  input: ControllerInput,
  velocity: Vec3,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
): boolean {
  if (!supported || input.ground.surface !== "loop") return false;
  if (normal.y > tuning.loopUprightDot) return false;
  return length(projectOnPlane(velocity, normal)) < tuning.loopEnterSpeed;
}

function trySpring(
  state: ControllerState,
  input: ControllerInput,
  supported: boolean,
  tuning: PlayerTuning,
): Motion | null {
  if (!supported || input.ground.surface !== "spring" || !input.ground.springDirection) return null;
  const direction = normalize(input.ground.springDirection);
  if (length(direction) < VECTOR_EPSILON) return null;
  state.mode = "springLaunch";
  state.springTime = tuning.springLockTime;
  state.jumpTime = 0;
  state.dashSpent = false;
  state.up = { ...VEC3_UP };
  state.facing = alignFacing(projectOnPlane(direction, VEC3_UP), state.up);
  return motion(scale(direction, tuning.springPower), null, 1);
}

function tryRail(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  supported: boolean,
  tuning: PlayerTuning,
): Motion | null {
  const rail = input.rail;
  if (state.railCooldown > 0) return null;
  if (!rail || rail.gap > tuning.railGrabRadius) return null;
  const speed = length(projectOnPlane(velocity, VEC3_UP));
  const airborne = !supported || state.mode === "jump" || state.mode === "fall";
  if (!airborne && speed < tuning.railMinSpeed) return null;
  const along = dot(velocity, rail.tangent);
  state.railSign = along < 0 ? -1 : 1;
  if (Math.abs(along) < 1 && dot(state.facing, rail.tangent) < 0) state.railSign = -1;
  state.railSpeed = clamp(
    Math.max(Math.abs(along), airborne ? speed : tuning.railMinSpeed),
    0,
    tuning.railMaxSpeed,
  );
  if (state.railSpeed < tuning.railMinSpeed) state.railSpeed = tuning.railMinSpeed;
  state.mode = "railGrind";
  state.balance = 0;
  state.railTime = 0;
  state.up = { ...VEC3_UP };
  const travel = railTangent(rail, state.railSign);
  state.facing = alignFacing(travel, state.up);
  const hover = add(rail.point, { x: 0, y: tuning.railHover, z: 0 });
  return motion(scale(travel, state.railSpeed), hover, 0);
}

function tryLoop(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
  dt: number,
): Motion | null {
  if (!supported || input.ground.surface !== "loop") return null;
  if (length(projectOnPlane(velocity, normal)) < tuning.loopEnterSpeed) return null;
  state.mode = "loopRun";
  state.loopCoyote = tuning.loopCoyote;
  state.up = normal;
  state.facing = alignFacing(state.facing, normal);
  return tickLoop(state, velocity, input, wishDir, wishLen, normal, supported, tuning, dt);
}

function tryDash(
  state: ControllerState,
  input: ControllerInput,
  wishDir: Vec3,
  wishLen: number,
  supported: boolean,
  tuning: PlayerTuning,
): Motion | null {
  if (supported || state.dashSpent || !input.actions.dashPressed) return null;
  if (state.mode !== "jump" && state.mode !== "fall" && state.mode !== "rollBurst") return null;
  const facing = wishLen > 0.2 ? wishDir : state.facing;
  const target = pickDashTarget(input.position, facing, input.targets, tuning);
  const direction = target
    ? normalize(sub(target, input.position))
    : normalize(
        add(alignFacing(facing, VEC3_UP), {
          x: 0,
          y: tuning.dashFallbackLift / Math.max(tuning.dashSpeed, 1),
          z: 0,
        }),
      );
  state.mode = "lockOnDash";
  state.dashSpent = true;
  state.dashTime = tuning.dashDuration;
  state.dashDir = direction;
  state.dashTarget = target ? { ...target } : null;
  state.dashEntrySpeed = Math.hypot(input.velocity.x, input.velocity.z);
  state.facing = alignFacing(projectOnPlane(direction, state.up), state.up);
  return motion(scale(direction, tuning.dashSpeed), null, 0);
}

function tryJump(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  normal: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
): Motion | null {
  if (!input.actions.jumpPressed || !(supported || state.coyote > 0)) return null;
  if (state.mode === "jump" || state.mode === "springLaunch" || state.mode === "lockOnDash")
    return null;
  const up = supported ? normal : state.up;
  state.mode = "jump";
  state.jumpOwned = true;
  state.jumpTime = 0;
  state.coyote = 0;
  state.dashSpent = false;
  state.up = up;
  state.facing = alignFacing(state.facing, up);
  return motion(
    add(projectOnPlane(velocity, up), scale(up, tuning.jumpSpeed)),
    null,
    tuning.jumpGravityScale,
  );
}

function leaveRail(state: ControllerState, velocity: Vec3, tuning: PlayerTuning): Motion {
  state.mode = "fall";
  state.jumpTime = tuning.minAirTime;
  state.railTime = 0;
  state.balance = 0;
  state.railCooldown = tuning.railRegrab;
  return motion(velocity, null, tuning.fallGravityScale);
}

function landOrFall(
  state: ControllerState,
  velocity: Vec3,
  supported: boolean,
  tuning: PlayerTuning,
): void {
  if (supported) {
    const speed = length(projectOnPlane(velocity, state.up));
    state.mode = speed <= tuning.idleSpeed ? "idle" : "run";
    state.dashSpent = false;
    return;
  }
  state.mode = "fall";
  state.jumpTime = tuning.minAirTime;
}

function steerAir(
  velocity: Vec3,
  wishDir: Vec3,
  wishLen: number,
  state: ControllerState,
  tuning: PlayerTuning,
  dt: number,
): Vec3 {
  let planar = { x: velocity.x, y: 0, z: velocity.z };
  if (wishLen > 0.05) {
    planar = accelerate(planar, wishDir, tuning.topSpeed * wishLen, tuning.airAccel, dt);
    state.facing = alignFacing(wishDir, state.up);
  }
  return { x: planar.x, y: velocity.y, z: planar.z };
}

function curveAccel(speed: number, wishDir: Vec3, planar: Vec3, tuning: PlayerTuning): number {
  if (dot(planar, wishDir) < 0) return tuning.brakeAccel;
  const ratio = clamp(speed / tuning.topSpeed, 0, 1);
  return tuning.runAccel * Math.pow(1 - ratio, tuning.accelExponent) + tuning.runAccelFloor;
}

function accelerate(
  velocity: Vec3,
  wishDir: Vec3,
  wishSpeed: number,
  accel: number,
  dt: number,
): Vec3 {
  const room = wishSpeed - dot(velocity, wishDir);
  if (room <= 0) return velocity;
  return add(velocity, scale(wishDir, Math.min(accel * dt, room)));
}

function slopePush(normal: Vec3, tuning: PlayerTuning): Vec3 {
  const gravity: Vec3 = { x: 0, y: -tuning.gravity, z: 0 };
  const n = normalize(normal);
  return scale(sub(gravity, scale(n, dot(gravity, n))), tuning.slopeInfluence);
}

function stick(planar: Vec3, normal: Vec3, tuning: PlayerTuning): Vec3 {
  return add(planar, scale(normalize(normal), -tuning.groundStick));
}

function capSpeed(velocity: Vec3, cap: number): Vec3 {
  const speed = length(velocity);
  if (speed <= cap || speed < VECTOR_EPSILON) return velocity;
  return scale(velocity, cap / speed);
}

function trackFacing(
  facing: Vec3,
  up: Vec3,
  velocity: Vec3,
  wishDir: Vec3,
  wishLen: number,
  tuning: PlayerTuning,
  dt: number,
): Vec3 {
  const planar = projectOnPlane(velocity, up);
  const target =
    length(planar) > tuning.idleSpeed ? normalize(planar) : wishLen > 0.2 ? wishDir : facing;
  const blend = 1 - Math.exp(-tuning.turnResponse * dt);
  return alignFacing(add(scale(facing, 1 - blend), scale(target, blend)), up);
}

function alignFacing(facing: Vec3, up: Vec3): Vec3 {
  const n = length(up) > VECTOR_EPSILON ? normalize(up) : VEC3_UP;
  let flat = projectOnPlane(facing, n);
  if (length(flat) < 1e-4) flat = projectOnPlane(VEC3_FORWARD, n);
  if (length(flat) < 1e-4) flat = projectOnPlane({ x: 1, y: 0, z: 0 }, n);
  return normalize(flat);
}

function railTangent(rail: SplineSample, sign: 1 | -1): Vec3 {
  const tangent = length(rail.tangent) > VECTOR_EPSILON ? normalize(rail.tangent) : VEC3_FORWARD;
  return sign < 0 ? scale(tangent, -1) : tangent;
}

function motion(velocity: Vec3, snap: Vec3 | null, gravityFactor: number): Motion {
  return { velocity, snap, gravityFactor };
}

function cloneState(state: ControllerState): ControllerState {
  return {
    ...state,
    dashDir: { ...state.dashDir },
    dashTarget: state.dashTarget ? { ...state.dashTarget } : null,
    facing: { ...state.facing },
    up: { ...state.up },
  };
}

function tryLoopRide(
  state: ControllerState,
  velocity: Vec3,
  input: ControllerInput,
  tuning: PlayerTuning,
): Motion | null {
  const course = input.loopCourse;
  if (!course || state.loopCooldown > 0) return null;
  if (state.mode === "springLaunch" || state.mode === "lockOnDash") return null;
  const nearest = closestLoop(course, input.position);
  if (nearest.distance > tuning.loopEntryWindow || nearest.gap > tuning.loopGrab) return null;
  const along = dot(velocity, nearest.tangent);
  if (along < tuning.loopEnterSpeed) return null;
  if (dot(normalize(state.facing), nearest.tangent) < tuning.loopEntryAlign) return null;
  state.mode = "loopRun";
  state.loopDistance = nearest.distance;
  state.loopSpeed = along;
  state.loopBlend = 0;
  return tickLoopRide(state, input, tuning, input.dt);
}

function tickLoopRide(
  state: ControllerState,
  input: ControllerInput,
  tuning: PlayerTuning,
  dt: number,
): Motion {
  const course = input.loopCourse;
  if (!course) return leaveLoop(state, null, tuning);
  const here = sampleLoop(course, state.loopDistance);
  const gravity: Vec3 = { x: 0, y: -tuning.gravity, z: 0 };
  state.loopSpeed += dot(gravity, here.tangent) * tuning.slopeInfluence * dt;
  if (input.actions.jumpPressed) {
    state.mode = "jump";
    state.jumpOwned = true;
    state.jumpTime = 0;
    state.loopDistance = -1;
    state.loopCooldown = tuning.railRegrab;
    state.up = here.up;
    state.facing = alignFacing(here.tangent, here.up);
    return motion(
      add(scale(here.tangent, Math.max(state.loopSpeed, 0)), scale(here.up, tuning.jumpSpeed)),
      null,
      tuning.jumpGravityScale,
    );
  }
  if (state.loopSpeed < tuning.loopExitSpeed) return leaveLoop(state, here, tuning);
  state.loopDistance += state.loopSpeed * dt;
  state.loopBlend = Math.min(1, state.loopBlend + dt / Math.max(tuning.loopBlendTime, 0.02));
  if (state.loopDistance >= course.spline.length) {
    const end = sampleLoop(course, course.spline.length);
    state.mode = "run";
    state.loopDistance = -1;
    state.loopSpeed = Math.max(state.loopSpeed, 0);
    state.loopCooldown = tuning.railRegrab;
    state.up = { ...VEC3_UP };
    state.facing = alignFacing(end.tangent, VEC3_UP);
    state.dashSpent = false;
    return motion(
      scale(end.tangent, state.loopSpeed),
      add(end.point, scale(VEC3_UP, tuning.probeHalfHeight)),
      1,
    );
  }
  const next = sampleLoop(course, state.loopDistance);
  const curve = add(next.point, scale(next.up, tuning.probeHalfHeight));
  const blend = state.loopBlend;
  const pulled = lerpToward(input.position, curve, blend);
  const gap = length(sub(pulled, input.position));
  const stepLimit = state.loopSpeed * dt + 0.3;
  const snap =
    gap <= stepLimit || gap <= VECTOR_EPSILON
      ? pulled
      : lerpToward(input.position, pulled, stepLimit / gap);
  state.up = slerpDir(state.up, next.up, blend < 1 ? Math.min(blend, 0.35) : 1);
  state.facing = alignFacing(next.tangent, state.up);
  return motion(scale(next.tangent, state.loopSpeed), snap, 0);
}

function lerpToward(from: Vec3, to: Vec3, t: number): Vec3 {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

function leaveLoop(state: ControllerState, frame: LoopFrame | null, tuning: PlayerTuning): Motion {
  const tangent = frame ? frame.tangent : state.facing;
  state.mode = "fall";
  state.jumpTime = tuning.minAirTime;
  state.loopDistance = -1;
  state.loopCooldown = tuning.railRegrab;
  state.springCoast = false;
  return motion(scale(tangent, Math.max(state.loopSpeed, 0)), null, tuning.fallGravityScale);
}

function finishDash(
  state: ControllerState,
  direction: Vec3,
  cap: number,
  tuning: PlayerTuning,
): Motion {
  const dir = length(direction) > VECTOR_EPSILON ? normalize(direction) : state.dashDir;
  state.mode = "fall";
  state.jumpTime = tuning.minAirTime;
  state.dashTarget = null;
  const aimed = scale(dir, Math.min(tuning.dashSpeed, cap));
  const horizontal = Math.hypot(aimed.x, aimed.z);
  const limited =
    horizontal > cap
      ? { x: (aimed.x * cap) / horizontal, y: aimed.y, z: (aimed.z * cap) / horizontal }
      : aimed;
  return motion(limited, null, tuning.fallGravityScale);
}

function decelerate(velocity: Vec3, decel: number, dt: number): Vec3 {
  const speed = length(velocity);
  if (speed <= VECTOR_EPSILON) return { x: 0, y: 0, z: 0 };
  const next = Math.max(0, speed - decel * dt);
  return scale(velocity, next / speed);
}
