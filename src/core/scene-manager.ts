import type { InputFrame } from "../input/types";
import type { GameStore, SceneId } from "./game-state";

export interface SceneController {
  readonly id: SceneId;
  enter(): void;
  exit(): void;
  beginFrame(input: InputFrame): void;
  fixedUpdate(step: number, input: InputFrame): void;
  render(alpha: number, fps: number): void;
}

export class SceneManager {
  private current: SceneController | null = null;
  private pending: SceneId | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly factory: Record<SceneId, () => SceneController>,
  ) {}

  get currentId(): SceneId | null {
    return this.current?.id ?? null;
  }

  request(id: SceneId): void {
    if (this.pending === id) return;
    if (this.pending === null && this.current?.id === id) return;
    this.pending = id;
  }

  start(id: SceneId): void {
    this.activate(id);
  }

  beginFrame(input: InputFrame): void {
    try {
      this.current?.beginFrame(input);
    } finally {
      this.flush();
    }
  }

  fixedUpdate(step: number, input: InputFrame): void {
    try {
      this.current?.fixedUpdate(step, input);
    } finally {
      this.flush();
    }
  }

  render(alpha: number, fps: number): void {
    try {
      this.current?.render(alpha, fps);
    } finally {
      this.flush();
    }
  }

  private flush(): void {
    if (!this.pending) return;
    const next = this.pending;
    this.pending = null;
    this.activate(next);
  }

  private activate(id: SceneId): void {
    this.current?.exit();
    const next = this.factory[id]();
    next.enter();
    this.current = next;
    this.store.set({ sceneId: id, paused: false });
  }
}
