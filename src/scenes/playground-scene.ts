import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import type { AppContext } from "../app/context";
import { FIXED_STEP_SECONDS } from "../core/loop";
import { deviceLabel } from "../input/pad-profile";
import type { DeviceKind, InputFrame } from "../input/types";
import { buildYard, YARD_SPAWN } from "../levels/yard";
import { createPlaceholderHero } from "../player/hero";
import { cameraOffset, desiredVelocity, stepCamera, type CameraPose } from "../player/motor";
import { controlSections, familyForDevice, type ControlSection } from "../ui/control-list";
import { MenuCursor } from "../ui/menu-nav";

const GRAVITY = new Vector3(0, -18, 0);

export class PlaygroundScene {
  readonly id = "playground" as const;
  private scene: Scene | null = null;
  private hero: ReturnType<typeof createPlaceholderHero> | null = null;
  private camera: FreeCamera | null = null;
  private pose: CameraPose = { yaw: 0, pitch: 0.42 };
  private hint = "";
  private hintTimer = 0;
  private pulse = 0;
  private steppedThisFrame = false;
  private hadPointerLock = false;
  private lockLostThisFrame = false;
  private lastDevice: DeviceKind = "keyboard";
  private controlsDevice: DeviceKind | null = null;
  private controls: ControlSection[] = [];
  private readonly menu = new MenuCursor();
  private readonly previousPos = new Vector3();
  private readonly currentPos = new Vector3();
  private readonly visualPos = new Vector3();
  private readonly rayFrom = new Vector3();
  private readonly rayTo = new Vector3();
  private readonly velocity = new Vector3();
  private readonly zero = new Vector3(0, 0, 0);
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();
  private readonly onClick = (): void => {
    if (this.app.store.get().paused) return;
    void this.canvas()?.requestPointerLock();
  };
  private readonly onBlur = (): void => {
    this.pauseFromOutside();
  };
  private readonly onVisibility = (): void => {
    if (document.hidden) this.pauseFromOutside();
  };
  private readonly onPointerLock = (): void => {
    const locked = document.pointerLockElement === this.canvas();
    if (this.hadPointerLock && !locked) {
      this.lockLostThisFrame = true;
      this.pauseFromOutside();
    }
    this.hadPointerLock = locked;
  };

  constructor(private readonly app: AppContext) {}

  enter(): void {
    const scene = new Scene(this.app.engine);
    scene.clearColor = new Color4(0.62, 0.68, 0.66, 1);
    const hemi = new HemisphericLight("yard-hemi", new Vector3(0.15, 1, 0.2), scene);
    hemi.intensity = 0.75;
    const sun = new DirectionalLight("yard-sun", new Vector3(-0.4, -1, 0.25), scene);
    sun.intensity = 0.65;

    const plugin = new HavokPlugin(false, this.app.havok);
    scene.enablePhysics(GRAVITY, plugin);
    // The game loop steps physics itself. Rendering must not advance it.
    scene.physicsEnabled = false;
    scene.getPhysicsEngine()?.setTimeStep(FIXED_STEP_SECONDS);

    buildYard(scene);
    this.hero = createPlaceholderHero(scene, YARD_SPAWN.clone());
    this.previousPos.copyFrom(this.hero.body.position);
    this.currentPos.copyFrom(this.hero.body.position);
    this.camera = new FreeCamera("follow", new Vector3(0, 3, -12), scene);
    this.camera.minZ = 0.05;
    this.scene = scene;
    this.pose = { yaw: 0, pitch: 0.42 };
    this.menu.reset();

    this.canvas()?.addEventListener("click", this.onClick);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    this.app.audio.play("ui");
  }

  beginFrame(input: InputFrame): void {
    this.steppedThisFrame = false;
    this.lastDevice = input.device;
    if (input.pausePressed) {
      if (this.lockLostThisFrame || !this.app.store.get().paused) {
        this.app.store.set({ paused: true });
        document.exitPointerLock();
      } else {
        this.app.store.set({ paused: false });
      }
    }
    this.lockLostThisFrame = false;
    if (this.app.store.get().paused) {
      this.menu.update(input.move.y, input.jumpPressed, this.app.ui);
    }
  }

  fixedUpdate(step: number, input: InputFrame): void {
    const scene = this.scene;
    const hero = this.hero;
    if (!scene || !hero || this.app.store.get().paused) return;

    if (!this.steppedThisFrame) {
      this.previousPos.copyFrom(this.currentPos);
      this.steppedThisFrame = true;
    }

    this.pose = stepCamera(
      this.pose,
      { x: input.camera.x, y: input.camera.y, mouseX: input.mouse.x, mouseY: input.mouse.y },
      step,
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
    scene.getPhysicsEngine()?._step(step);
    this.currentPos.copyFrom(hero.body.position);

    if (input.attackPressed) this.pulse = 0.18;
    if (input.actionPressed) {
      this.hint = "Action";
      this.hintTimer = 1.2;
    }
    this.pulse = Math.max(0, this.pulse - step);
    this.hintTimer = Math.max(0, this.hintTimer - step);
    if (this.hintTimer === 0) this.hint = "";
    hero.head.scaling.setAll(1 + this.pulse);
  }

  render(alpha: number, fps: number): void {
    const scene = this.scene;
    const hero = this.hero;
    const camera = this.camera;
    if (!scene || !hero || !camera) return;

    Vector3.LerpToRef(this.previousPos, this.currentPos, alpha, this.visualPos);
    hero.body.position.copyFrom(this.visualPos);

    const offset = cameraOffset(this.pose.yaw, this.pose.pitch);
    this.camTarget.copyFrom(this.visualPos);
    this.camTarget.y += 1.05;
    this.camPos.set(
      this.camTarget.x + offset.x,
      this.camTarget.y + offset.y,
      this.camTarget.z + offset.z,
    );
    camera.position.copyFrom(this.camPos);
    camera.setTarget(this.camTarget);

    this.app.ui.showPlay({
      paused: this.app.store.get().paused,
      deviceLabel: deviceLabel(this.lastDevice),
      fps,
      hint: this.hint,
      controls: this.controlsFor(this.lastDevice),
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
    this.canvas()?.removeEventListener("click", this.onClick);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    document.exitPointerLock();
    this.scene?.dispose();
    this.scene = null;
    this.hero = null;
    this.camera = null;
  }

  private controlsFor(device: DeviceKind): ControlSection[] {
    if (this.controlsDevice !== device) {
      this.controlsDevice = device;
      this.controls = controlSections(this.app.input.getBindings(), familyForDevice(device));
    }
    return this.controls;
  }

  private canvas(): HTMLCanvasElement | null {
    return this.app.engine.getRenderingCanvas();
  }

  private pauseFromOutside(): void {
    if (this.app.store.get().sceneId !== "playground") return;
    if (this.app.store.get().paused) return;
    this.app.store.set({ paused: true });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private isGrounded(
    scene: Scene,
    mesh: { getBoundingInfo(): { boundingBox: { extendSize: Vector3 } } },
    body: PhysicsBody,
  ): boolean {
    const physics = scene.getPhysicsEngine();
    if (!physics) return false;
    const half = mesh.getBoundingInfo().boundingBox.extendSize.y;
    this.rayFrom.set(this.currentPos.x, this.currentPos.y - half + 0.08, this.currentPos.z);
    this.rayTo.set(this.currentPos.x, this.currentPos.y - half - 0.14, this.currentPos.z);
    const hit = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: body });
    return hit.hasHit && hit.hitNormalWorld.y > 0.45;
  }
}
