import type { Engine } from "@babylonjs/core/Engines/engine";
import type HavokPhysics from "@babylonjs/havok";
import type { AudioBus } from "../audio/audio-bus";
import type { GameStore, SceneId } from "../core/game-state";
import type { InputManager } from "../input/input-manager";
import type { PlayerTuning } from "../player/tuning";
import type { UiRoot } from "../ui/overlay";
import type { TuningOverlay } from "../ui/tuning-overlay";

export type HavokRuntime = Awaited<ReturnType<typeof HavokPhysics>>;

export interface AppContext {
  engine: Engine;
  havok: HavokRuntime;
  store: GameStore;
  input: InputManager;
  audio: AudioBus;
  ui: UiRoot;
  tuning: PlayerTuning;
  tuningUi: TuningOverlay;
  requestScene: (id: SceneId) => void;
}
