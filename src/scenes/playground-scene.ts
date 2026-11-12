import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import type { AppContext } from "../core/runtime";
import { deviceLabel } from "../input/pad-profile";
import type { InputFrame } from "../input/types";
import { buildYard, YARD_SPAWN } from "../levels/yard";
import { createPlaceholderHero } from "../player/hero";
import { cameraOffset, desiredVelocity, stepCamera, type CameraPose } from "../player/motor";
import { controlSections, familyForDevice } from "../ui/control-list";

const GRAVITY = new Vector3(0, -18, 0);
const PHYSICS_STEP = 1 / 60;

export class PlaygroundScene {
  readonly id = "playground" as const;
  private scene: Scene | null = null;
  private hero: ReturnType<typeof createPlaceholderHero> | null = null;
  private camera: FreeCamera | null = null;
  private pose: CameraPose = { yaw: 0, pitch: 0.42 };
  private hint = "";
  private hintTimer = 0;
  private pulse = 0;
  private readonly rayFrom = new Vector3();
  private readonly rayTo = new Vector3();
  private readonly velocity = new Vector3();
  private readonly zero = new Vector3(0, 0, 0);
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();
  private readonly onClick = (): void => {
    if (this.app.store.get().paused) return;
    void this.app.engine.getRenderingCanvas()?.requestPointerLock();
  };

  constructor(private readonly app: AppContext) {}

  enter(): void {
    const scene = new Scene(this.app.engine);
    scene.clearColor = new Color4(0.62, 0.68, 0.66, 1);
    const hemi = new HemisphericLight("yard-hemi", new Vector3(0.15, 1, 0.2), scene);
    hemi.intensity = 0.75;
    const sun = new DirectionalLight("yard-sun", new Vector3(-0.4, -1, 0.25), scene);
    sun.intensity = 0.65;

    const plugin = new HavokPlugin(true, this.app.havok);
    scene.enablePhysics(GRAVITY, plugin);
    buildYard(scene);
    this.hero = createPlaceholderHero(scene, YARD_SPAWN.clone());
    this.camera = new FreeCamera("follow", new Vector3(0, 3, -12), scene);
    this.camera.minZ = 0.05;
    this.scene = scene;
    this.pose = { yaw: 0, pitch: 0.42 };
    this.app.engine.getRenderingCanvas()?.addEventListener("click", this.onClick);
    this.app.audio.play("ui");
  }

  update(dt: number, input: InputFrame, fps: number): void {
    const scene = this.scene;
    const hero = this.hero;
    const camera = this.camera;
    if (!scene || !hero || !camera) return;

    if (input.pausePressed) {
      const paused = !this.app.store.get().paused;
      this.app.store.set({ paused });
      if (paused) document.exitPointerLock();
    }

    const paused = this.app.store.get().paused;
    scene.getPhysicsEngine()?.setTimeStep(paused ? 0 : PHYSICS_STEP);

    if (!paused) {
      this.pose = stepCamera(
        this.pose,
        { x: input.camera.x, y: input.camera.y, mouseX: input.mouse.x, mouseY: input.mouse.y },
        dt,
      );
      const body = hero.aggregate.body;
      const current = body.getLinearVelocity();
      const grounded = this.isGrounded(scene, hero.body, body);
      const next = desiredVelocity({
        currentY: current.y,
        move: input.move,
        yaw: this.pose.yaw,
        jump: input.jumpPressed,
        grounded,
      });
      this.velocity.set(next.x, next.y, next.z);
      body.setLinearVelocity(this.velocity);
      body.setAngularVelocity(this.zero);

      if (input.attackPressed) this.pulse = 0.18;
      if (input.actionPressed) {
        this.hint = "Action";
        this.hintTimer = 1.2;
      }
      this.pulse = Math.max(0, this.pulse - dt);
      this.hintTimer = Math.max(0, this.hintTimer - dt);
      if (this.hintTimer === 0) this.hint = "";
      const scale = 1 + this.pulse;
      hero.head.scaling.setAll(scale);
    }

    const offset = cameraOffset(this.pose.yaw, this.pose.pitch);
    this.camTarget.copyFrom(hero.body.position);
    this.camTarget.y += 1.05;
    this.camPos.set(
      this.camTarget.x + offset.x,
      this.camTarget.y + offset.y,
      this.camTarget.z + offset.z,
    );
    camera.position.copyFrom(this.camPos);
    camera.setTarget(this.camTarget);

    this.app.ui.showPlay({
      paused,
      deviceLabel: deviceLabel(input.device),
      fps,
      hint: this.hint,
      controls: controlSections(this.app.input.getBindings(), familyForDevice(input.device)),
      onResume: () => {
        this.app.store.set({ paused: false });
      },
      onCredits: () => {
        this.app.store.set({ creditsReturn: "playground", paused: false });
        document.exitPointerLock();
        this.app.requestScene("credits");
      },
    });
    scene.render();
  }

  exit(): void {
    this.app.engine.getRenderingCanvas()?.removeEventListener("click", this.onClick);
    document.exitPointerLock();
    this.scene?.dispose();
    this.scene = null;
    this.hero = null;
    this.camera = null;
  }

  private isGrounded(
    scene: Scene,
    mesh: { position: Vector3; getBoundingInfo(): { boundingBox: { extendSize: Vector3 } } },
    body: PhysicsBody,
  ): boolean {
    const physics = scene.getPhysicsEngine();
    if (!physics) return false;
    const half = mesh.getBoundingInfo().boundingBox.extendSize.y;
    this.rayFrom.set(mesh.position.x, mesh.position.y - half + 0.08, mesh.position.z);
    this.rayTo.set(mesh.position.x, mesh.position.y - half - 0.14, mesh.position.z);
    const hit = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: body });
    return hit.hasHit && hit.hitNormalWorld.y > 0.45;
  }
}
