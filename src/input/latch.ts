import type { InputFrame } from "./types";

/**
 * Holds edge input until a fixed step reads it. A frame with no step keeps
 * the press. Extra steps in the same frame do not see it again.
 */
export class InputLatch {
  private jump = false;
  private attack = false;
  private action = false;
  private mouseX = 0;
  private mouseY = 0;

  note(frame: InputFrame): void {
    if (frame.jumpPressed) this.jump = true;
    if (frame.attackPressed) this.attack = true;
    if (frame.actionPressed) this.action = true;
    this.mouseX += frame.mouse.x;
    this.mouseY += frame.mouse.y;
  }

  clear(): void {
    this.jump = false;
    this.attack = false;
    this.action = false;
    this.mouseX = 0;
    this.mouseY = 0;
  }

  frameForStep(frame: InputFrame, stepIndex: number): InputFrame {
    if (stepIndex !== 0) {
      return {
        ...frame,
        jumpPressed: false,
        attackPressed: false,
        actionPressed: false,
        pausePressed: false,
        confirmPressed: false,
        mouse: { x: 0, y: 0 },
      };
    }
    const next: InputFrame = {
      ...frame,
      jumpPressed: this.jump,
      attackPressed: this.attack,
      actionPressed: this.action,
      mouse: { x: this.mouseX, y: this.mouseY },
    };
    this.clear();
    return next;
  }
}
