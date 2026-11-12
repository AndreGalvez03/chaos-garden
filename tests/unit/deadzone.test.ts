import { describe, expect, it } from "vitest";
import { applyRadialDeadzone } from "../../src/input/deadzone";

describe("radial deadzone", () => {
  it("zeroes a stick inside the radius", () => {
    expect(applyRadialDeadzone(0.1, 0, 0.18)).toEqual({ x: 0, y: 0 });
    expect(applyRadialDeadzone(0.1, 0.1, 0.18)).toEqual({ x: 0, y: 0 });
  });

  it("keeps full deflection at the edge", () => {
    expect(applyRadialDeadzone(1, 0, 0.2)).toEqual({ x: 1, y: 0 });
    expect(applyRadialDeadzone(-1, 0, 0.2)).toEqual({ x: -1, y: 0 });
  });

  it("rescales the range outside the radius", () => {
    const value = applyRadialDeadzone(0.6, 0, 0.2);
    expect(value.y).toBe(0);
    expect(value.x).toBeCloseTo(0.5, 5);
  });

  it("treats a diagonal inside the circle as idle", () => {
    expect(applyRadialDeadzone(0.12, 0.12, 0.2)).toEqual({ x: 0, y: 0 });
  });
});
