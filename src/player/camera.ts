import {
  add,
  clamp,
  damp,
  dampAngle,
  dampVec,
  length,
  lerpVec,
  scale,
  slerpDir,
  sub,
  VEC3_FORWARD,
  VEC3_UP,
  type Vec3,
  VECTOR_EPSILON,
} from "../core/math";
import type { PlayerTuning } from "./tuning";

export interface CameraRig {
  yaw: number;
  pitch: number;
  yawOffset: number;
  fov: number;
  distance: number;
  lookAt: Vec3;
  position: Vec3;
  up: Vec3;
}

export interface CameraLook {
  lookX: number;
  lookY: number;
  mouseX: number;
  mouseY: number;
  pointerLocked: boolean;
}

export interface CameraAim {
  rig: CameraRig;
  lookAt: Vec3;
  /** Desired camera position before the wall ray shortens it. */
  desired: Vec3;
}

export function createCameraRig(yaw = 0, pitch = 0.42): CameraRig {
  return {
    yaw,
    pitch,
    yawOffset: 0,
    fov: 0.9,
    distance: 6,
    lookAt: { x: 0, y: 1, z: 0 },
    position: { x: 0, y: 3, z: -6 },
    up: { ...VEC3_UP },
  };
}

/**
 * Follows behind the runner, widens with speed, and orbits from the right
 * stick. Mouse orbit applies only while the pointer is locked. The scene
 * passes a wall distance from a ray cast after the physics step.
 */
export function advanceCameraRig(
  rig: CameraRig,
  look: CameraLook,
  playerPosition: Vec3,
  playerUp: Vec3,
  velocity: Vec3,
  facing: Vec3,
  dt: number,
  tuning: PlayerTuning,
  headingFromFacing = false,
): CameraAim {
  const next = cloneRig(rig);
  const lookActive = Math.hypot(look.lookX, look.lookY) > 0.2;
  const mouseActive = look.pointerLocked && (look.mouseX !== 0 || look.mouseY !== 0);
  if (lookActive || mouseActive) {
    const mouseYaw = look.pointerLocked ? look.mouseX * tuning.cameraMouseYaw : 0;
    next.yawOffset = clamp(
      next.yawOffset + look.lookX * tuning.cameraOrbitSpeed * dt + mouseYaw,
      -tuning.cameraOffsetMax,
      tuning.cameraOffsetMax,
    );
  } else {
    next.yawOffset = damp(next.yawOffset, 0, tuning.cameraOrbitReturn, dt);
  }

  const mousePitch = look.pointerLocked ? look.mouseY * tuning.cameraMousePitch : 0;
  next.pitch = clamp(
    next.pitch + look.lookY * tuning.cameraPitchSpeed * dt - mousePitch,
    tuning.cameraPitchMin,
    tuning.cameraPitchMax,
  );

  const speed = length(velocity);
  const headingSource = headingFromFacing || speed < tuning.cameraAutoSpeed ? facing : velocity;
  const flat = { x: headingSource.x, y: 0, z: headingSource.z };
  if (length(flat) > 0.35) {
    next.yaw = dampAngle(
      next.yaw,
      Math.atan2(flat.x, flat.z) + next.yawOffset,
      tuning.cameraFollow,
      dt,
    );
  }

  const pace = clamp(speed / Math.max(tuning.cameraDistanceSpeed, 0.001), 0, 1);
  const fovPace = clamp(speed / Math.max(tuning.cameraFovSpeed, 0.001), 0, 1);
  next.distance = damp(
    next.distance,
    tuning.cameraDistanceMin + (tuning.cameraDistanceMax - tuning.cameraDistanceMin) * pace,
    tuning.cameraPosFollow,
    dt,
  );
  next.fov = damp(
    next.fov,
    tuning.cameraFovMin + (tuning.cameraFovMax - tuning.cameraFovMin) * fovPace,
    tuning.cameraPosFollow,
    dt,
  );

  const up = length(playerUp) > VECTOR_EPSILON ? playerUp : VEC3_UP;
  next.up = slerpDir(next.up, up, 1 - Math.exp(-tuning.cameraUpFollow * dt));
  const forward = length(facing) > VECTOR_EPSILON ? facing : VEC3_FORWARD;
  const lookAt = add(
    add(playerPosition, scale(next.up, tuning.cameraHeight)),
    scale(forward, tuning.cameraLookAhead),
  );
  next.lookAt = dampVec(next.lookAt, lookAt, tuning.cameraPosFollow, dt);

  const offset = cameraOffset(next.yaw, next.pitch, next.distance);
  return { rig: next, lookAt: next.lookAt, desired: add(next.lookAt, offset) };
}

/** Midpoint blend used while drawing between two fixed steps. */
export function blendCameraRig(
  previous: CameraRig,
  current: CameraRig,
  alpha: number,
): { position: Vec3; lookAt: Vec3; up: Vec3; fov: number } {
  const t = clamp(alpha, 0, 1);
  return {
    position: lerpVec(previous.position, current.position, t),
    lookAt: lerpVec(previous.lookAt, current.lookAt, t),
    up: slerpDir(previous.up, current.up, t),
    fov: previous.fov + (current.fov - previous.fov) * t,
  };
}

/**
 * A closer wall snaps in. Opening back up eases out, so the view does not pop.
 */
export function smoothCameraClearance(
  current: number,
  allowed: number,
  dt: number,
  tuning: PlayerTuning,
): number {
  const lambda = allowed + 0.02 < current ? tuning.cameraSnapIn : tuning.cameraEaseOut;
  return Math.max(tuning.cameraCollisionMin, damp(current, allowed, lambda, dt));
}

/** Pulls the camera in when a cast from the look point hits a wall. */
export function resolveCameraPosition(
  lookAt: Vec3,
  desired: Vec3,
  obstruction: number | null,
  tuning: PlayerTuning,
): Vec3 {
  const offset = sub(desired, lookAt);
  const distance = length(offset);
  if (distance < VECTOR_EPSILON) return desired;
  let allowed = distance;
  if (obstruction !== null && Number.isFinite(obstruction)) {
    allowed = Math.min(allowed, obstruction - tuning.cameraCollisionPad);
  }
  allowed = Math.max(tuning.cameraCollisionMin, allowed);
  if (allowed >= distance) return desired;
  return add(lookAt, scale(offset, allowed / distance));
}

/** Yaw 0 sits the camera on -Z so it looks toward +Z. */
export function cameraOffset(yaw: number, pitch: number, distance: number): Vec3 {
  const horizontal = Math.cos(pitch) * distance;
  const vertical = Math.sin(pitch) * distance;
  return {
    x: -Math.sin(yaw) * horizontal,
    y: vertical,
    z: -Math.cos(yaw) * horizontal,
  };
}

function cloneRig(rig: CameraRig): CameraRig {
  return {
    ...rig,
    lookAt: { ...rig.lookAt },
    position: { ...rig.position },
    up: { ...rig.up },
  };
}
