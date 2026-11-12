import { describe, expect, it } from "vitest";
import { cameraOffset, desiredVelocity, stepCamera } from "../../src/player/motor";

describe("simple motor", () => {
  it("moves forward along +Z when the camera looks that way", () => {
    const velocity = desiredVelocity({
      currentY: 0,
      move: { x: 0, y: 1 },
      yaw: 0,
      jump: false,
      grounded: true,
    });
    expect(velocity.x).toBeCloseTo(0, 5);
    expect(velocity.z).toBeGreaterThan(0);
    expect(velocity.y).toBe(0);
  });

  it("strafes to +X from the same facing", () => {
    const velocity = desiredVelocity({
      currentY: -2,
      move: { x: 1, y: 0 },
      yaw: 0,
      jump: false,
      grounded: true,
    });
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.z).toBeCloseTo(0, 5);
    expect(velocity.y).toBe(0);
  });

  it("jumps only while grounded", () => {
    const grounded = desiredVelocity({
      currentY: 0,
      move: { x: 0, y: 0 },
      yaw: 0,
      jump: true,
      grounded: true,
    });
    const airborne = desiredVelocity({
      currentY: 3,
      move: { x: 0, y: 0 },
      yaw: 0,
      jump: true,
      grounded: false,
    });
    expect(grounded.y).toBeGreaterThan(0);
    expect(airborne.y).toBe(3);
  });

  it("places the camera behind the facing direction", () => {
    const offset = cameraOffset(0, 0, 6);
    expect(offset.z).toBeCloseTo(-6, 5);
    expect(offset.x).toBeCloseTo(0, 5);
  });

  it("clamps the pitch and turns with the mouse", () => {
    const raised = stepCamera({ yaw: 0, pitch: 0.4 }, { x: 0, y: 0, mouseX: 0, mouseY: -10 }, 0);
    expect(raised.pitch).toBeGreaterThan(0.4);
    const capped = stepCamera({ yaw: 0, pitch: 1.04 }, { x: 0, y: 1, mouseX: 0, mouseY: 0 }, 1);
    expect(capped.pitch).toBeLessThanOrEqual(1.05);
  });
});
