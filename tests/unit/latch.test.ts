import { describe, expect, it } from "vitest";
import { InputLatch } from "../../src/input/latch";
import { emptyInputFrame, type InputFrame } from "../../src/input/types";

function pressedJump(): InputFrame {
  return { ...emptyInputFrame(), jump: true, jumpPressed: true };
}

describe("input latch", () => {
  it("keeps a jump until a fixed step consumes it", () => {
    const latch = new InputLatch();
    latch.note(pressedJump());
    const later = latch.frameForStep(emptyInputFrame(), 0);
    expect(later.jumpPressed).toBe(true);
    expect(latch.frameForStep(emptyInputFrame(), 0).jumpPressed).toBe(false);
  });

  it("gives a jump to only the first step of a frame", () => {
    const latch = new InputLatch();
    latch.note(pressedJump());
    const held = emptyInputFrame();
    expect(latch.frameForStep(held, 0).jumpPressed).toBe(true);
    expect(latch.frameForStep(held, 1).jumpPressed).toBe(false);
  });

  it("adds mouse deltas until the first step reads them", () => {
    const latch = new InputLatch();
    latch.note({ ...emptyInputFrame(), mouse: { x: 3, y: 4 } });
    latch.note({ ...emptyInputFrame(), mouse: { x: 1, y: -2 } });
    const step = latch.frameForStep(emptyInputFrame(), 0);
    expect(step.mouse).toEqual({ x: 4, y: 2 });
    expect(latch.frameForStep(emptyInputFrame(), 1).mouse).toEqual({ x: 0, y: 0 });
  });
});
