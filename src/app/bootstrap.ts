import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { Engine } from "@babylonjs/core/Engines/engine";
import { AudioBus } from "../audio/audio-bus";
import { assetManifest } from "../content/assets";
import { GameStore } from "../core/game-state";
import { GameLoop } from "../core/loop";
import { SceneManager } from "../core/scene-manager";
import { InputLatch } from "../input/latch";
import { InputManager } from "../input/input-manager";
import { cloneTuning } from "../player/tuning";
import { CreditsScene } from "../scenes/credits-scene";
import { PlaygroundScene } from "../scenes/playground-scene";
import { TitleScene } from "../scenes/title-scene";
import { hasStartupFailure, showFailure, UiRoot } from "../ui/overlay";
import { TuningOverlay } from "../ui/tuning-overlay";
import type { AppContext } from "./context";

export async function startGame(canvas: HTMLCanvasElement, overlay: HTMLElement): Promise<void> {
  const engine = new Engine(canvas, true, {
    adaptToDeviceRatio: true,
    powerPreference: "high-performance",
  });
  const havok = HavokPhysics({
    locateFile: (file: string) => (file.endsWith(".wasm") ? havokWasmUrl : file),
  });
  void havok.catch((error: unknown) => {
    showFailure(overlay, error);
  });

  const store = new GameStore();
  const input = new InputManager(canvas);
  const latch = new InputLatch();
  const audio = new AudioBus();
  const tuningRoot = document.querySelector<HTMLElement>("#tuning");
  if (!tuningRoot) throw new Error("The tuning overlay is missing from the page.");
  const tuning = cloneTuning();
  const ui = new UiRoot(overlay, assetManifest);
  const tuningUi = new TuningOverlay(tuningRoot, tuning);
  const app: AppContext = {
    engine,
    havok,
    store,
    input,
    audio,
    ui,
    tuning,
    tuningUi,
    requestScene: () => {},
  };
  const scenes = new SceneManager(
    store,
    {
      title: () => new TitleScene(app),
      playground: () => new PlaygroundScene(app),
      credits: () => new CreditsScene(app),
    },
    (error) => {
      showFailure(overlay, error);
    },
    () => !hasStartupFailure(),
  );
  app.requestScene = (id) => {
    scenes.request(id);
  };

  const loop = new GameLoop();
  scenes.start("title");
  ui.setScene(store.get().sceneId);

  engine.runRenderLoop(() => {
    const frame = input.poll();
    const wasPaused = store.get().paused;
    scenes.beginFrame(frame);
    if (store.get().paused) latch.clear();
    else if (!wasPaused) latch.note(frame);

    loop.tick(engine.getDeltaTime() / 1000, {
      paused: store.get().paused,
      fixedUpdate: (step, index) => {
        scenes.fixedUpdate(step, latch.frameForStep(frame, index));
      },
      render: (alpha) => {
        scenes.render(alpha, loop.framesPerSecond);
        ui.setScene(store.get().sceneId);
      },
    });
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
  engine.resize();
}
