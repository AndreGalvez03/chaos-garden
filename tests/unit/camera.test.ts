import { describe, expect, it } from "vitest";
import { add, dot, length, scale, sub, type Vec3 } from "../../src/core/math";
import { buildLoopPath, LOOP_RADIUS, sampleLoop } from "../../src/core/loop-path";
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

  it("keeps the ride camera inside the loop and aimed at the runner", () => {
    const course = buildLoopPath({
      mouth: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      radius: LOOP_RADIUS,
      lateralShift: 8,
      samples: 64,
    });
    const pitches = [DEFAULT_TUNING.cameraPitchMin, 0.42, DEFAULT_TUNING.cameraPitchMax];
    for (const pitch of pitches) {
      for (const speed of [29, 34, 40]) {
        let rig = createCameraRig(0, pitch);
        let previousView: Vec3 | null = null;
        const steps = 72;
        for (let index = 0; index <= steps; index += 1) {
          const frame = sampleLoop(course, (index / steps) * course.spline.length);
          const position = add(frame.point, scale(frame.up, 0.62));
          const center = add(frame.point, scale(frame.up, course.radius));
          const repeats = index === 0 ? 90 : 1;
          let aim = advanceCameraRig(
            rig,
            look,
            position,
            frame.up,
            scale(frame.tangent, speed),
            frame.tangent,
            FIXED_STEP_SECONDS,
            DEFAULT_TUNING,
            true,
            { center, radius: course.radius },
          );
          for (let extra = 1; extra < repeats; extra += 1) {
            aim = advanceCameraRig(
              aim.rig,
              look,
              position,
              frame.up,
              scale(frame.tangent, speed),
              frame.tangent,
              FIXED_STEP_SECONDS,
              DEFAULT_TUNING,
              true,
              { center, radius: course.radius },
            );
          }
          rig = aim.rig;
          const view = sub(aim.lookAt, aim.desired);
          const viewLength = length(view);
          const tangentLength = length(frame.tangent) || 1;
          expect(viewLength).toBeGreaterThan(0.5);
          expect(dot(view, frame.tangent) / (viewLength * tangentLength)).toBeGreaterThan(0.5);
          expect(length(sub(aim.desired, center))).toBeLessThan(course.radius - 0.3);
          if (previousView) {
            const turn = angleBetween(previousView, view);
            expect(turn).toBeLessThan((25 * Math.PI) / 180);
          }
          previousView = view;
        }
      }
    }
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

function angleBetween(from: Vec3, to: Vec3): number {
  const left = length(from) || 1;
  const right = length(to) || 1;
  const cosine = dot(from, to) / (left * right);
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}
