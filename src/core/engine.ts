import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { Engine } from "@babylonjs/core/Engines/engine";
import { assetManifest } from "../content/assets";
import { AudioBus } from "../audio/audio-bus";
import { GameLoop } from "./loop";
import { GameStore } from "./game-state";
import type { AppContext } from "./runtime";
import { SceneManager } from "./scene-manager";
import { InputManager } from "../input/input-manager";
import { CreditsScene } from "../scenes/credits-scene";
import { PlaygroundScene } from "../scenes/playground-scene";
import { TitleScene } from "../scenes/title-scene";
import { UiRoot } from "../ui/overlay";

export async function startGame(canvas: HTMLCanvasElement, overlay: HTMLElement): Promise<void> {
  const engine = new Engine(canvas, true, {
    adaptToDeviceRatio: true,
    powerPreference: "high-performance",
  });
  const havok = await HavokPhysics({
    locateFile: (file: string) => (file.endsWith(".wasm") ? havokWasmUrl : file),
  });

  const store = new GameStore();
  const input = new InputManager(canvas);
  const audio = new AudioBus();
  const ui = new UiRoot(overlay, assetManifest);
  const app: AppContext = {
    engine,
    havok,
    store,
    input,
    audio,
    ui,
    requestScene: () => {},
  };
  const scenes = new SceneManager(store, {
    title: () => new TitleScene(app),
    playground: () => new PlaygroundScene(app),
    credits: () => new CreditsScene(app),
  });
  app.requestScene = (id) => {
    scenes.request(id);
  };

  const loop = new GameLoop();
  scenes.start("title");
  ui.setScene(store.get().sceneId);

  engine.runRenderLoop(() => {
    const frame = input.poll();
    loop.tick(engine.getDeltaTime() / 1000, (dt, fps) => {
      scenes.update(dt, frame, fps);
      ui.setScene(store.get().sceneId);
    });
  });

  const onResize = (): void => {
    engine.resize();
  };
  window.addEventListener("resize", onResize);
  engine.resize();
}
