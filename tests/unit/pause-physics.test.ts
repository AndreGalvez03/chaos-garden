import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import HavokPhysics from "@babylonjs/havok";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { FIXED_STEP_SECONDS } from "../../src/core/loop";

describe("paused physics", () => {
  it("does not move a dynamic body while rendering without a physics step", async () => {
    const wasmFile = readFileSync(
      new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url),
    );
    const wasmBinary = wasmFile.buffer.slice(
      wasmFile.byteOffset,
      wasmFile.byteOffset + wasmFile.byteLength,
    );
    const havok = await HavokPhysics({ wasmBinary });
    const engine = new NullEngine();
    const scene = new Scene(engine);
    new FreeCamera("camera", new Vector3(0, 2, -5), scene);
    const plugin = new HavokPlugin(false, havok);
    scene.enablePhysics(new Vector3(0, -18, 0), plugin);
    scene.physicsEnabled = false;
    scene.getPhysicsEngine()?.setTimeStep(FIXED_STEP_SECONDS);

    const body = CreateBox("runner", { size: 1 }, scene);
    body.position.y = 4;
    const aggregate = new PhysicsAggregate(body, PhysicsShapeType.BOX, { mass: 1 }, scene);
    aggregate.body.setLinearVelocity(new Vector3(8, 0, 0));

    const startX = body.position.x;
    const startY = body.position.y;
    for (let frame = 0; frame < 30; frame += 1) scene.render();
    expect(body.position.x).toBeCloseTo(startX, 4);
    expect(body.position.y).toBeCloseTo(startY, 4);

    const physics = scene.getPhysicsEngine();
    expect(physics).toBeTruthy();
    for (let step = 0; step < 30; step += 1) physics?._step(FIXED_STEP_SECONDS);
    expect(body.position.y).toBeLessThan(startY - 0.2);

    scene.dispose();
    engine.dispose();
  });
});
