import type { Engine } from "@babylonjs/core/Engines/engine";
import type HavokPhysics from "@babylonjs/havok";
import type { AudioBus } from "../audio/audio-bus";
import type { GameStore, SceneId } from "../core/game-state";
import type { InputManager } from "../input/input-manager";
import type { UiRoot } from "../ui/overlay";

export type HavokRuntime = Awaited<ReturnType<typeof HavokPhysics>>;

export interface AppContext {
  engine: Engine;
  havok: HavokRuntime;
  store: GameStore;
  input: InputManager;
  audio: AudioBus;
  ui: UiRoot;
  requestScene: (id: SceneId) => void;
}
