import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { PhysicsShapeSphere } from "@babylonjs/core/Physics/v2/physicsShape";
import { ShapeCastResult } from "@babylonjs/core/Physics/shapeCastResult";
import { Scene } from "@babylonjs/core/scene";
import type { AppContext } from "../app/context";
import type { Vec3 } from "../core/math";
import { FIXED_STEP_SECONDS } from "../core/loop";
import { closestOnSpline } from "../core/spline";
import { deviceLabel } from "../input/pad-profile";
import type { DeviceKind, InputFrame } from "../input/types";
import { buildCourse, type CourseContent } from "../levels/course";
import { LOOP_COLLISION_BIT, readSurface } from "../levels/surface";
import { buildYard, YARD_SPAWN } from "../levels/yard";
import {
  advanceCameraRig,
  blendCameraRig,
  createCameraRig,
  smoothCameraClearance,
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
  private ready = false;
  private disposed = false;
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
  private readonly prevCam = new Vector3();
  private readonly currCam = new Vector3();
  private readonly prevLook = new Vector3();
  private readonly currLook = new Vector3();
  private readonly prevUp = new Vector3(0, 1, 0);
  private readonly currUp = new Vector3(0, 1, 0);
  private readonly bodyVelocity = new Vector3();
  private readonly castRotation = Quaternion.Identity();
  private readonly castStart = new ShapeCastResult();
  private readonly castHit = new ShapeCastResult();
  private prevFov = 0.9;
  private currFov = 0.9;
  private clearance = 6;
  private cameraSphere: PhysicsShapeSphere | null = null;
  private readonly onResume = (): void => {
    this.app.store.set({ paused: false });
  };
  private readonly onCredits = (): void => {
    this.app.store.set({ creditsReturn: "playground", paused: false });
    document.exitPointerLock();
    this.app.requestScene("credits");
  };
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

  enter(): Promise<void> {
    this.disposed = false;
    return this.mount();
  }

  private async mount(): Promise<void> {
    const havok = await this.app.havok;
    if (this.disposed) return;
    const scene = new Scene(this.app.engine);
    scene.clearColor = new Color4(0.62, 0.68, 0.66, 1);
    const hemi = new HemisphericLight("yard-hemi", new Vector3(0.15, 1, 0.2), scene);
    hemi.intensity = 0.75;
    const sun = new DirectionalLight("yard-sun", new Vector3(-0.4, -1, 0.25), scene);
    sun.intensity = 0.65;

    const plugin = new HavokPlugin(false, havok);
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
    this.cameraSphere = new PhysicsShapeSphere(Vector3.Zero(), this.app.tuning.cameraSphere, scene);
    this.seedCamera();
    this.scene = scene;
    this.ready = true;
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
    if (!this.ready) return;
    this.lastDevice = input.device;
    if (this.app.tuningUi.isVisible) this.app.tuningUi.steer(input.move.x, input.move.y);
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
    if (!scene || !hero || !this.ready || this.app.store.get().paused) return;

    this.previousPos.copyFrom(this.currentPos);
    this.prevCam.copyFrom(this.currCam);
    this.prevLook.copyFrom(this.currLook);
    this.prevUp.copyFrom(this.currUp);
    this.prevFov = this.currFov;

    const tuning = this.app.tuning;
    this.gravity.set(0, -tuning.gravity, 0);
    scene.getPhysicsEngine()?.setGravity(this.gravity);

    const body = hero.aggregate.body;
    const position = toVec(hero.body.position);
    body.getLinearVelocityToRef(this.bodyVelocity);
    const velocity = {
      x: this.bodyVelocity.x,
      y: this.bodyVelocity.y,
      z: this.bodyVelocity.z,
    };
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
      loopCourse: this.course?.loop ?? null,
      targets: this.course?.targets ?? [],
      dt: step,
      tuning,
    });
    this.sim = output.state;
    this.supported = output.supported;

    const riding = output.ignoreLoopCollision && output.snap !== null;
    this.velocity.set(
      riding ? 0 : output.velocity.x,
      riding ? 0 : output.velocity.y,
      riding ? 0 : output.velocity.z,
    );
    if (output.snap) hero.body.position.set(output.snap.x, output.snap.y, output.snap.z);
    this.aimBody(hero, output.facing, output.up);
    body.setGravityFactor(output.gravityFactor);
    body.setLinearVelocity(this.velocity);
    body.setAngularVelocity(this.zero);
    hero.aggregate.shape.filterCollideMask = output.ignoreLoopCollision
      ? ~LOOP_COLLISION_BIT
      : 0xffffffff;
    hero.body.computeWorldMatrix(true);
    const preStep = body.disablePreStep;
    body.disablePreStep = false;
    scene.getPhysicsEngine()?._step(step);
    body.disablePreStep = preStep;
    this.currentPos.copyFrom(hero.body.position);

    body.getLinearVelocityToRef(this.bodyVelocity);
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
      riding
        ? output.velocity
        : { x: this.bodyVelocity.x, y: this.bodyVelocity.y, z: this.bodyVelocity.z },
      output.facing,
      step,
      tuning,
      output.state.mode === "loopRun" || output.state.mode === "railGrind",
    );
    const obstruction = this.cameraClearance(aim.lookAt, aim.desired, body);
    const desiredDistance = Math.hypot(
      aim.desired.x - aim.lookAt.x,
      aim.desired.y - aim.lookAt.y,
      aim.desired.z - aim.lookAt.z,
    );
    const allowed =
      obstruction === null
        ? desiredDistance
        : Math.min(desiredDistance, Math.max(0, obstruction - tuning.cameraCollisionPad));
    this.clearance = smoothCameraClearance(this.clearance, allowed, step, tuning);
    const span = Math.max(desiredDistance, 1e-6);
    this.rig = aim.rig;
    this.rig.position = {
      x: aim.lookAt.x + ((aim.desired.x - aim.lookAt.x) * this.clearance) / span,
      y: aim.lookAt.y + ((aim.desired.y - aim.lookAt.y) * this.clearance) / span,
      z: aim.lookAt.z + ((aim.desired.z - aim.lookAt.z) * this.clearance) / span,
    };
    this.currCam.set(this.rig.position.x, this.rig.position.y, this.rig.position.z);
    this.currLook.set(this.rig.lookAt.x, this.rig.lookAt.y, this.rig.lookAt.z);
    this.currUp.set(this.rig.up.x, this.rig.up.y, this.rig.up.z);
    this.currFov = this.rig.fov;

    const charge = this.sim.rollCharge;
    hero.visual.scaling.set(1 + charge * 0.14, 1 - charge * 0.2, 1 + charge * 0.14);
    this.hintTimer = Math.max(0, this.hintTimer - step);
    if (this.hintTimer === 0) this.hint = "";
  }

  render(alpha: number, fps: number): void {
    const scene = this.scene;
    const hero = this.hero;
    const camera = this.camera;
    if (!scene || !hero || !camera || !this.ready) return;

    Vector3.LerpToRef(this.previousPos, this.currentPos, alpha, this.visualPos);
    hero.visual.position.copyFrom(this.visualPos);
    this.aimBody(hero, this.sim.facing, this.sim.up);

    const view = blendCameraRig(
      {
        ...this.rig,
        position: { x: this.prevCam.x, y: this.prevCam.y, z: this.prevCam.z },
        lookAt: { x: this.prevLook.x, y: this.prevLook.y, z: this.prevLook.z },
        up: { x: this.prevUp.x, y: this.prevUp.y, z: this.prevUp.z },
        fov: this.prevFov,
      },
      {
        ...this.rig,
        position: { x: this.currCam.x, y: this.currCam.y, z: this.currCam.z },
        lookAt: { x: this.currLook.x, y: this.currLook.y, z: this.currLook.z },
        up: { x: this.currUp.x, y: this.currUp.y, z: this.currUp.z },
        fov: this.currFov,
      },
      alpha,
    );
    this.camTarget.set(view.lookAt.x, view.lookAt.y, view.lookAt.z);
    this.camPos.set(view.position.x, view.position.y, view.position.z);
    this.camUp.set(view.up.x, view.up.y, view.up.z);
    camera.position.copyFrom(this.camPos);
    camera.upVector.copyFrom(this.camUp);
    camera.fov = view.fov;
    camera.setTarget(this.camTarget);

    const canvas = this.canvas();
    if (canvas) {
      canvas.dataset.runnerX = this.currentPos.x.toFixed(2);
      canvas.dataset.runnerZ = this.currentPos.z.toFixed(2);
    }
    hero.aggregate.body.getLinearVelocityToRef(this.bodyVelocity);
    const speed = this.bodyVelocity.length();
    this.app.tuningUi.setReadout(modeLabel(this.sim.mode), speed, this.supported);

    this.app.ui.showPlay({
      paused: this.app.store.get().paused,
      deviceLabel: deviceLabel(this.lastDevice),
      fps,
      hint: this.hint,
      status: modeLabel(this.sim.mode),
      controls: this.controlsFor(this.lastDevice),
      onResume: this.onResume,
      onCredits: this.onCredits,
    });
    scene.render();
  }

  exit(): void {
    this.disposed = true;
    this.ready = false;
    this.cameraSphere?.dispose();
    this.cameraSphere = null;
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
    if (!hit.hasHit && this.bodyVelocity.length() >= tuning.loopEnterSpeed) {
      const facing = this.sim.facing;
      this.rayFrom.set(position.x, position.y, position.z);
      this.rayTo.set(
        position.x + facing.x * tuning.probeForward,
        position.y + facing.y * tuning.probeForward,
        position.z + facing.z * tuning.probeForward,
      );
      const ahead = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: hero.aggregate.body });
      if (ahead.hasHit && readSurface(ahead.body?.transformNode.metadata).kind === "loop") {
        hit = ahead;
      }
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
    const plugin = physics?.getPhysicsPlugin();
    if (!physics || !plugin || !this.cameraSphere) return null;
    this.rayFrom.set(lookAt.x, lookAt.y, lookAt.z);
    this.rayTo.set(desired.x, desired.y, desired.z);
    const distance = Vector3.Distance(this.rayFrom, this.rayTo);
    if (distance < 1e-4) return null;
    if (plugin instanceof HavokPlugin) {
      this.castStart.reset();
      this.castHit.reset();
      plugin.shapeCast(
        {
          shape: this.cameraSphere,
          rotation: this.castRotation,
          startPosition: this.rayFrom,
          endPosition: this.rayTo,
          shouldHitTriggers: false,
          ignoreBody: body,
        },
        this.castStart,
        this.castHit,
      );
      if (this.castHit.hasHit) return this.castHit.hitFraction * distance;
    }
    const hit = physics.raycast(this.rayFrom, this.rayTo, { ignoreBody: body });
    if (!hit.hasHit) return null;
    return hit.hitDistance;
  }

  private seedCamera(): void {
    this.currCam.set(this.rig.position.x, this.rig.position.y, this.rig.position.z);
    this.prevCam.copyFrom(this.currCam);
    this.currLook.set(this.rig.lookAt.x, this.rig.lookAt.y, this.rig.lookAt.z);
    this.prevLook.copyFrom(this.currLook);
    this.currUp.set(this.rig.up.x, this.rig.up.y, this.rig.up.z);
    this.prevUp.copyFrom(this.currUp);
    this.currFov = this.rig.fov;
    this.prevFov = this.rig.fov;
    this.clearance = this.rig.distance;
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
