export const SCENE_IDS = ["title", "playground", "credits"] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export interface GameState {
  sceneId: SceneId;
  paused: boolean;
  /** Scene to open when leaving the credits screen. */
  creditsReturn: SceneId;
}

export const INITIAL_STATE: GameState = {
  sceneId: "title",
  paused: false,
  creditsReturn: "title",
};

export class GameStore {
  private state: GameState;
  private readonly listeners = new Set<(state: GameState) => void>();

  constructor(initial: GameState = INITIAL_STATE) {
    this.state = initial;
  }

  get(): GameState {
    return this.state;
  }

  set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
