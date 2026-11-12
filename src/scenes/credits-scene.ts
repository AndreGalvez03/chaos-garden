import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import type { AppContext } from "../core/runtime";
import type { InputFrame } from "../input/types";

export class CreditsScene {
  readonly id = "credits" as const;
  private scene: Scene | null = null;

  constructor(private readonly app: AppContext) {}

  enter(): void {
    const scene = new Scene(this.app.engine);
    scene.clearColor = new Color4(0.1, 0.13, 0.12, 1);
    const camera = new FreeCamera("credits-camera", new Vector3(0, 1.2, -4), scene);
    camera.setTarget(Vector3.Zero());
    this.scene = scene;
    this.app.ui.showCredits(() => {
      this.app.requestScene(this.app.store.get().creditsReturn);
    });
    this.app.audio.play("ui");
  }

  update(_dt: number, _input: InputFrame): void {
    this.scene?.render();
  }

  exit(): void {
    this.scene?.dispose();
    this.scene = null;
  }
}
