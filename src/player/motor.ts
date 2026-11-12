import { clamp, type Vec3 } from "../core/math";
import type { Vec2 } from "../input/types";

export const MOVE_SPEED = 8;
export const JUMP_SPEED = 7.2;
export const YAW_SPEED = 2.2;
export const PITCH_SPEED = 1.4;
export const MOUSE_YAW = 0.0022;
export const MOUSE_PITCH = 0.0018;
export const CAMERA_DISTANCE = 6.4;
export const MIN_PITCH = 0.25;
export const MAX_PITCH = 1.05;

export interface CameraPose {
  yaw: number;
  pitch: number;
}

export interface LookInput {
  x: number;
  y: number;
  mouseX: number;
  mouseY: number;
}

/**
 * Direct velocity for checks that want an instant stick response.
 * The course steps the movement state machine instead.
 */
export function desiredVelocity(args: {
  currentY: number;
  move: Vec2;
  yaw: number;
  jump: boolean;
  grounded: boolean;
  moveSpeed?: number;
  jumpSpeed?: number;
}): Vec3 {
  const moveSpeed = args.moveSpeed ?? MOVE_SPEED;
  const jumpSpeed = args.jumpSpeed ?? JUMP_SPEED;
  const length = Math.hypot(args.move.x, args.move.y);
  const scale = length > 1 ? 1 / length : 1;
  const localX = args.move.x * scale;
  const localY = args.move.y * scale;
  const forwardX = Math.sin(args.yaw);
  const forwardZ = Math.cos(args.yaw);
  const rightX = forwardZ;
  const rightZ = -forwardX;

  let y = args.currentY;
  if (args.grounded && args.jump) y = jumpSpeed;
  else if (args.grounded && y < 0) y = 0;

  return {
    x: (rightX * localX + forwardX * localY) * moveSpeed,
    y,
    z: (rightZ * localX + forwardZ * localY) * moveSpeed,
  };
}

export function stepCamera(pose: CameraPose, look: LookInput, dt: number): CameraPose {
  return {
    yaw: pose.yaw + look.x * YAW_SPEED * dt + look.mouseX * MOUSE_YAW,
    pitch: clamp(
      pose.pitch + look.y * PITCH_SPEED * dt - look.mouseY * MOUSE_PITCH,
      MIN_PITCH,
      MAX_PITCH,
    ),
  };
}

/** Offset from the runner to the camera. Yaw 0 looks toward +Z, so the camera sits on -Z. */
export function cameraOffset(yaw: number, pitch: number, distance = CAMERA_DISTANCE): Vec3 {
  const horizontal = Math.cos(pitch) * distance;
  const vertical = Math.sin(pitch) * distance;
  return {
    x: -Math.sin(yaw) * horizontal,
    y: vertical,
    z: -Math.cos(yaw) * horizontal,
  };
}
