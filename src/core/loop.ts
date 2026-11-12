/** Simulation step shared by gameplay and physics. */
export const FIXED_STEP_SECONDS = 1 / 60;

/** A hitch cannot run more steps than this. 100 ms is six steps, under the cap. */
export const MAX_SUBSTEPS = 8;

const STEP_EPSILON = 1e-8;

export interface LoopHandlers {
  paused: boolean;
  fixedUpdate: (step: number, index: number) => void;
  render: (alpha: number) => void;
}

export interface LoopTick {
  steps: number;
  alpha: number;
}

/**
 * One accumulator for the whole simulation. Frames only sample time.
 * Paused frames do not add time and do not step.
 */
export class GameLoop {
  private accumulator = 0;
  private fps = 60;

  tick(rawSeconds: number, handlers: LoopHandlers): LoopTick {
    const raw = Math.max(rawSeconds, 0);
    if (raw > 0) {
      const instant = 1 / raw;
      this.fps = this.fps * 0.9 + instant * 0.1;
    }

    if (handlers.paused) {
      handlers.render(1);
      return { steps: 0, alpha: 1 };
    }

    this.accumulator += raw;
    const cap = FIXED_STEP_SECONDS * MAX_SUBSTEPS;
    if (this.accumulator > cap) this.accumulator = cap;

    let steps = 0;
    while (this.accumulator >= FIXED_STEP_SECONDS - STEP_EPSILON && steps < MAX_SUBSTEPS) {
      handlers.fixedUpdate(FIXED_STEP_SECONDS, steps);
      this.accumulator -= FIXED_STEP_SECONDS;
      if (this.accumulator < STEP_EPSILON) this.accumulator = 0;
      steps += 1;
    }

    const alpha = this.accumulator / FIXED_STEP_SECONDS;
    handlers.render(alpha);
    return { steps, alpha };
  }

  get framesPerSecond(): number {
    return this.fps;
  }

  get remainder(): number {
    return this.accumulator;
  }
}
