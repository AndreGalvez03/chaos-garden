import { describe, expect, it } from "vitest";
import { length, sub } from "../../src/core/math";
import { FIXED_STEP_SECONDS } from "../../src/core/loop";
import {
  advanceCameraRig,
  blendCameraRig,
  createCameraRig,
  resolveCameraPosition,
  smoothCameraClearance,
} from "../../src/player/camera";
import { DEFAULT_TUNING } from "../../src/player/tuning";

const look = { lookX: 0, lookY: 0, mouseX: 0, mouseY: 0, pointerLocked: false };

describe("follow camera", () => {
  it("pulls back and widens as speed rises", () => {
    const slow = advanceCameraRig(
      createCameraRig(),
      look,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 1 },
      FIXED_STEP_SECONDS,
      DEFAULT_TUNING,
    );
    const fast = advanceCameraRig(
      createCameraRig(),
      look,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 34 },
      { x: 0, y: 0, z: 1 },
      0.5,
      DEFAULT_TUNING,
    );
    expect(fast.rig.distance).toBeGreaterThan(slow.rig.distance);
    expect(fast.rig.fov).toBeGreaterThan(slow.rig.fov);
    expect(fast.desired.z).toBeLessThan(0);
  });

  it("orbits with the mouse only while the pointer is locked", () => {
    const start = createCameraRig();
    const locked = advanceCameraRig(
      start,
      { ...look, mouseX: 40, pointerLocked: true },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      FIXED_STEP_SECONDS,
      DEFAULT_TUNING,
    );
    const unlocked = advanceCameraRig(
      start,
      { ...look, mouseX: 40, pointerLocked: false },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      FIXED_STEP_SECONDS,
      DEFAULT_TUNING,
    );
    expect(locked.rig.yawOffset).not.toBe(0);
    expect(unlocked.rig.yawOffset).toBe(0);
  });

  it("orbits from the right stick without pointer lock", () => {
    const aimed = advanceCameraRig(
      createCameraRig(),
      { ...look, lookX: 1 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      FIXED_STEP_SECONDS,
      DEFAULT_TUNING,
    );
    expect(aimed.rig.yawOffset).toBeGreaterThan(0);
  });

  it("widens from the full velocity, including the vertical part", () => {
    const flat = advanceCameraRig(
      createCameraRig(),
      look,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 1 },
      0.4,
      DEFAULT_TUNING,
    );
    const steep = advanceCameraRig(
      createCameraRig(),
      look,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 30, z: 10 },
      { x: 0, y: 0, z: 1 },
      0.4,
      DEFAULT_TUNING,
    );
    expect(steep.rig.fov).toBeGreaterThan(flat.rig.fov);
    expect(steep.rig.distance).toBeGreaterThan(flat.rig.distance);
  });

  it("draws the halfway pose between two steps", () => {
    const previous = createCameraRig();
    previous.position = { x: 0, y: 2, z: -4 };
    previous.fov = 0.8;
    const current = createCameraRig();
    current.position = { x: 0, y: 4, z: -8 };
    current.fov = 1.2;
    const mid = blendCameraRig(previous, current, 0.5);
    expect(mid.position.y).toBeCloseTo(3, 5);
    expect(mid.position.z).toBeCloseTo(-6, 5);
    expect(mid.fov).toBeCloseTo(1, 5);
  });

  it("snaps the camera in toward a wall and eases it back out", () => {
    const snapped = smoothCameraClearance(8, 2, 1 / 60, DEFAULT_TUNING);
    const eased = smoothCameraClearance(2, 8, 1 / 60, DEFAULT_TUNING);
    expect(8 - snapped).toBeGreaterThan(eased - 2);
  });

  it("shortens the camera when a wall is in the way", () => {
    const lookAt = { x: 0, y: 1.5, z: 0 };
    const desired = { x: 0, y: 2, z: -8 };
    const clear = resolveCameraPosition(lookAt, desired, null, DEFAULT_TUNING);
    const blocked = resolveCameraPosition(lookAt, desired, 2.2, DEFAULT_TUNING);
    expect(length(sub(clear, lookAt))).toBeGreaterThan(length(sub(blocked, lookAt)));
    expect(length(sub(blocked, lookAt))).toBeGreaterThanOrEqual(
      DEFAULT_TUNING.cameraCollisionMin - 0.001,
    );
  });
});
