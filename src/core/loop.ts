const MAX_STEP_SECONDS = 0.05;

export class GameLoop {
  private fps = 60;

  tick(rawSeconds: number, update: (dt: number, fps: number) => void): void {
    const dt = Math.min(Math.max(rawSeconds, 0), MAX_STEP_SECONDS);
    if (dt > 0) {
      this.fps = this.fps * 0.9 + (1 / dt) * 0.1;
    }
    update(dt, this.fps);
  }

  get framesPerSecond(): number {
    return this.fps;
  }
}
