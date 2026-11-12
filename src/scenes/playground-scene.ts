import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import type { AppContext } from "../app/context";
import { length, type Vec3 } from "../core/math";
import { FIXED_STEP_SECONDS } from "../core/loop";
import { closestOnSpline } from "../core/spline";
import { deviceLabel } from "../input/pad-profile";
import type { DeviceKind, InputFrame } from "../input/types";
import { buildCourse, type CourseContent } from "../levels/course";
import { readSurface } from "../levels/surface";
import { buildYard, YARD_SPAWN } from "../levels/yard";
import {
  advanceCameraRig,
  createCameraRig,
  resolveCameraPosition,
  type CameraRig,
} from "../player/camera";
import {
  createControllerState,
  modeLabel,
  stepController,
  wishFromStick,
  type ControllerState,
  type GroundQuery,
} from "../player/controller";
import { createPlaceholderHero, type PlaceholderHero } from "../player/hero";
import { controlSections, familyForDevice, type ControlSection } from "../ui/control-list";
import { MenuCursor } from "../ui/menu-nav";

export class PlaygroundScene {
  readonly id = "playground" as const;
  private scene: Scene | null = null;
  private hero: PlaceholderHero | null = null;
  private camera: FreeCamera | null = null;
  private course: CourseContent | null = null;
  private rig: CameraRig = createCameraRig();
  private sim: ControllerState = createControllerState();
  private supported = false;
  private hint = "";
  private hintTimer = 0;
  private steppedThisFrame = false;
  private hadPointerLock = false;
  private lockLostThisFrame = false;
  private ignoreLockLoss = false;
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
  private readonly gravity = new Vector3(0, -24, 0);
  private readonly aim = new Quaternion();
  private readonly visualAim = new Quaternion();
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();
  private readonly camUp = new Vector3(0, 1, 0);
  private readonly onClick = (): void => {
    if (this.app.store.get().paused || this.app.tuningUi.isVisible) return;
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
    if (this.ignoreLockLoss) {
      this.ignoreLockLoss = false;
      this.hadPointerLock = locked;
      return;
    }
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
    this.gravity.set(0, -this.app.tuning.gravity, 0);
    scene.enablePhysics(this.gravity, plugin);
    scene.physicsEnabled = false;
    scene.getPhysicsEngine()?.setTimeStep(FIXED_STEP_SECONDS);

    buildYard(scene);
    this.course = buildCourse(scene);
    this.hero = createPlaceholderHero(scene, YARD_SPAWN.clone());
    this.sim = createControllerState();
    this.previousPos.copyFrom(this.hero.body.position);
    this.currentPos.copyFrom(this.hero.body.position);
    this.rig = createCameraRig(0, 0.42);
    this.rig.lookAt = { x: YARD_SPAWN.x, y: YARD_SPAWN.y + 1, z: YARD_SPAWN.z };
    this.rig.position = { x: YARD_SPAWN.x, y: YARD_SPAWN.y + 3, z: YARD_SPAWN.z - 6 };
    this.camera = new FreeCamera("follow", new Vector3(0, 3, -12), scene);
    this.camera.minZ = 0.05;
    this.scene = scene;
    this.menu.reset();
    this.supported = false;

    const canvas = this.canvas();
    if (canvas) canvas.dataset.course = "terrace";
    canvas?.addEventListener("click", this.onClick);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    this.app.audio.play("ui");
  }

  beginFrame(input: InputFrame): void {
    this.steppedThisFrame = false;
    this.lastDevice = input.device;
    if (input.tunePressed) this.toggleTuning();
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

    const tuning = this.app.tuning;
    this.gravity.set(0, -tuning.gravity, 0);
    scene.getPhysicsEngine()?.setGravity(this.gravity);

    const body = hero.aggregate.body;
    const position = toVec(hero.body.position);
    const currentVelocity = body.getLinearVelocity();
    const velocity = toVec(currentVelocity);
    const ground = this.probe(scene, hero, position);
    const output = stepController({
      state: this.sim,
      position,
      velocity,
      actions: {
        wish: wishFromStick(input.move.x, input.move.y, this.rig.yaw),
        balance: input.move.x,
        throttle: input.move.y,
        jumpHeld: input.jump,
        jumpPressed: input.jumpPressed,
        rollHeld: input.attack,
        dashPressed: input.actionPressed,
      },
      ground,
      rail: this.nearestRail(position),
      targets: this.course?.targets ?? [],
      dt: step,
      tuning,
    });
    this.sim = output.state;
    this.supported = output.supported;

    this.velocity.set(output.velocity.x, output.velocity.y, output.velocity.z);
    if (output.snap) hero.body.position.set(output.snap.x, output.snap.y, output.snap.z);
    this.aimBody(hero, output.facing, output.up);
    body.setGravityFactor(output.gravityFactor);
    body.setLinearVelocity(this.velocity);
    body.setAngularVelocity(this.zero);
    hero.body.computeWorldMatrix(true);
    const preStep = body.disablePreStep;
    body.disablePreStep = false;
    scene.getPhysicsEngine()?._step(step);
    body.disablePreStep = preStep;
    this.currentPos.copyFrom(hero.body.position);

    const planar = {
      x: body.getLinearVelocity().x,
      y: 0,
      z: body.getLinearVelocity().z,
    };
    const aim = advanceCameraRig(
      this.rig,
      {
        lookX: input.camera.x,
        lookY: input.camera.y,
        mouseX: input.mouse.x,
        mouseY: input.mouse.y,
        pointerLocked: document.pointerLockElement === this.canvas(),
      },
      toVec(this.currentPos),
      output.up,
      planar,
      output.facing,
      step,
      tuning,
    );
    const obstruction = this.cameraClearance(aim.lookAt, aim.desired, body);
    const resolved = resolveCameraPosition(aim.lookAt, aim.desired, obstruction, tuning);
    this.rig = aim.rig;
    this.rig.position = resolved;

    const charge = this.sim.rollCharge;
    hero.visual.scaling.set(1 + charge * 0.14, 1 - charge * 0.2, 1 + charge * 0.14);
    this.hintTimer = Math.max(0, this.hintTimer - step);
    if (this.hintTimer === 0) this.hint = "";
  }

  render(alpha: number, fps: number): void {
    const scene = this.scene;
    const hero = this.hero;
    const camera = this.camera;
    if (!scene || !hero || !camera) return;

    Vector3.LerpToRef(this.previousPos, this.currentPos, alpha, this.visualPos);
    hero.visual.position.copyFrom(this.visualPos);
    this.aimBody(hero, this.sim.facing, this.sim.up);

    this.camTarget.set(this.rig.lookAt.x, this.rig.lookAt.y, this.rig.lookAt.z);
    this.camPos.set(this.rig.position.x, this.rig.position.y, this.rig.position.z);
    this.camUp.set(this.rig.up.x, this.rig.up.y, this.rig.up.z);
    camera.position.copyFrom(this.camPos);
    camera.upVector.copyFrom(this.camUp);
    camera.fov = this.rig.fov;
    camera.setTarget(this.camTarget);

    const canvas = this.canvas();
    if (canvas) {
      canvas.dataset.runnerX = this.currentPos.x.toFixed(2);
      canvas.dataset.runnerZ = this.currentPos.z.toFixed(2);
    }
    const speed = length({
      x: hero.aggregate.body.getLinearVelocity().x,
      y: hero.aggregate.body.getLinearVelocity().y,
      z: hero.aggregate.body.getLinearVelocity().z,
    });
    this.app.tuningUi.setReadout(modeLabel(this.sim.mode), speed, this.supported);

    this.app.ui.showPlay({
      paused: this.app.store.get().paused,
      deviceLabel: deviceLabel(this.lastDevice),
      fps,
      hint: this.hint,
      status: modeLabel(this.sim.mode),
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
    this.app.tuningUi.setVisible(false);
    this.scene?.dispose();
    this.scene = null;
    this.hero = null;
    this.camera = null;
    this.course = null;
  }

  private toggleTuning(): void {
    const next = !this.app.tuningUi.isVisible;
    if (next && document.pointerLockElement) {
      this.ignoreLockLoss = true;
      document.exitPointerLock();
    }
    this.app.tuningUi.setVisible(next);
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

  private probe(scene: Scene, hero: PlaceholderHero, position: Vec3): GroundQuery {
    const physics = scene.getPhysicsEngine();
    const empty: GroundQuery = {
      hit: false,
      normal: { x: 0, y: 1, z: 0 },
      surface: "ground",
      springDirection: null,
    };
    if (!physics) return empty;
    const tuning = this.app.tuning;
    const up = this.sim.up;
    const reach = tuning.probeHalfHeight + tuning.probeLength;
    const start = tuning.probeHalfHeight - tuning.probeSkin;
    this.rayFrom.set(
      position.x - up.x * start,
      position.y - up.y * start,
      position.z - up.z * start,
    );
    this.rayTo.set(position.x - up.x * reach, position.y - up.y * reach, position.z - up.z * reach);
    let hit = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: hero.aggregate.body });
    if (!hit.hasHit) {
      const facing = this.sim.facing;
      this.rayFrom.set(position.x, position.y, position.z);
      this.rayTo.set(
        position.x + facing.x * tuning.probeForward,
        position.y + facing.y * tuning.probeForward,
        position.z + facing.z * tuning.probeForward,
      );
      hit = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: hero.aggregate.body });
    }
    if (!hit.hasHit) return empty;
    const surface = readSurface(hit.body?.transformNode.metadata);
    const normal = hit.hitNormalWorld;
    return {
      hit: true,
      normal: { x: normal.x, y: normal.y, z: normal.z },
      surface: surface.kind,
      springDirection: surface.springDirection ?? null,
    };
  }

  private nearestRail(position: Vec3) {
    const rails = this.course?.rails ?? [];
    let best: ReturnType<typeof closestOnSpline> | null = null;
    for (const rail of rails) {
      const sample = closestOnSpline(rail, position);
      if (!best || sample.gap < best.gap) best = sample;
    }
    const limit = this.app.tuning.railGrabRadius * 2.2;
    if (!best || best.gap > limit) return null;
    return best;
  }

  private cameraClearance(
    lookAt: Vec3,
    desired: Vec3,
    body: PlaceholderHero["aggregate"]["body"],
  ): number | null {
    const physics = this.scene?.getPhysicsEngine();
    if (!physics) return null;
    this.rayFrom.set(lookAt.x, lookAt.y, lookAt.z);
    this.rayTo.set(desired.x, desired.y, desired.z);
    const hit = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: body });
    if (!hit.hasHit) return null;
    return hit.hitDistance;
  }

  private aimBody(hero: PlaceholderHero, facing: Vec3, up: Vec3): void {
    const forward = this.rayTo;
    const upward = this.rayFrom;
    forward.set(facing.x, facing.y, facing.z);
    upward.set(up.x, up.y, up.z);
    if (forward.lengthSquared() < 1e-8) forward.set(0, 0, 1);
    if (upward.lengthSquared() < 1e-8) upward.set(0, 1, 0);
    Quaternion.FromLookDirectionLHToRef(forward, upward, this.aim);
    this.visualAim.copyFrom(this.aim);
    hero.body.rotationQuaternion = this.aim;
    hero.visual.rotationQuaternion = this.visualAim;
  }
}

function toVec(value: Vector3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}
