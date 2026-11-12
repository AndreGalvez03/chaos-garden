import type { Engine } from "@babylonjs/core/Engines/engine";
import { AudioBus } from "../audio/audio-bus";
import type { GameStore, SceneId } from "./game-state";
import type { InputManager } from "../input/input-manager";
import type { UiRoot } from "../ui/overlay";

export interface AppContext {
  engine: Engine;
  havok: unknown;
  store: GameStore;
  input: InputManager;
  audio: AudioBus;
  ui: UiRoot;
  requestScene: (id: SceneId) => void;
}
