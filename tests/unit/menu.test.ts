import { describe, expect, it } from "vitest";
import { menuStep } from "../../src/ui/menu-nav";

describe("menu focus", () => {
  it("moves once per stick deflection and waits for the stick to return", () => {
    const first = menuStep(0, -1);
    expect(first.direction).toBe(1);
    const held = menuStep(first.axis, -1);
    expect(held.direction).toBe(0);
    const released = menuStep(held.axis, 0);
    expect(released.axis).toBe(0);
    expect(menuStep(0, 1).direction).toBe(-1);
  });
});
