import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import type { InputFrame } from "../input/types";
import type { AppContext } from "../core/runtime";

export class TitleScene {
  readonly id = "title" as const;
  private scene: Scene | null = null;
  private spin: Mesh | null = null;

  constructor(private readonly app: AppContext) {}

  enter(): void {
    const scene = new Scene(this.app.engine);
    scene.clearColor = new Color4(0.1, 0.14, 0.12, 1);
    const light = new HemisphericLight("title-light", new Vector3(0.2, 1, 0.3), scene);
    light.intensity = 0.9;

    const pot = CreateBox("title-pot", { width: 1.1, height: 0.7, depth: 1.1 }, scene);
    pot.position.y = 0.35;
    const potMat = new StandardMaterial("title-pot-mat", scene);
    potMat.diffuseColor = new Color3(0.45, 0.32, 0.24);
    potMat.specularColor = new Color3(0.04, 0.04, 0.04);
    pot.material = potMat;

    const bud = CreateSphere("title-bud", { diameter: 0.7, segments: 12 }, scene);
    bud.position.y = 1.15;
    const budMat = new StandardMaterial("title-bud-mat", scene);
    budMat.diffuseColor = new Color3(0.55, 0.68, 0.4);
    budMat.specularColor = new Color3(0.04, 0.04, 0.04);
    bud.material = budMat;
    bud.parent = pot;
    this.spin = pot;

    const camera = new FreeCamera("title-camera", new Vector3(0, 1.6, -3.2), scene);
    camera.minZ = 0.05;
    camera.setTarget(new Vector3(0, 0.9, 0));

    this.scene = scene;
    this.app.ui.showTitle(
      () => {
        this.app.requestScene("playground");
      },
      () => {
        this.app.store.set({ creditsReturn: "title" });
        this.app.requestScene("credits");
      },
    );
    this.app.audio.play("ui");
  }

  update(dt: number, input: InputFrame): void {
    if (this.spin) this.spin.rotation.y += dt * 0.35;
    if (input.confirmPressed) this.app.requestScene("playground");
    this.scene?.render();
  }

  exit(): void {
    this.scene?.dispose();
    this.scene = null;
    this.spin = null;
  }
}
