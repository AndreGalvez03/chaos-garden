import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";

export interface PlaceholderHero {
  body: Mesh;
  head: Mesh;
  aggregate: PhysicsAggregate;
}

function matte(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  return material;
}

/** A geometric stand-in. The real runner model comes in a later milestone. */
export function createPlaceholderHero(scene: Scene, at: Vector3): PlaceholderHero {
  const body = CreateCapsule(
    "runner-body",
    { height: 1.55, radius: 0.32, tessellation: 12, capSubdivisions: 4 },
    scene,
  );
  body.position.copyFrom(at);
  body.material = matte(scene, "runner-body-mat", new Color3(0.77, 0.42, 0.28));
  body.computeWorldMatrix(true);

  const aggregate = new PhysicsAggregate(
    body,
    PhysicsShapeType.CAPSULE,
    { mass: 1, friction: 0.5, restitution: 0 },
    scene,
  );
  aggregate.body.setLinearDamping(0.05);
  aggregate.body.setAngularDamping(12);

  const head = CreateSphere("runner-head", { diameter: 0.4, segments: 12 }, scene);
  head.position.y = 0.62;
  head.material = matte(scene, "runner-head-mat", new Color3(0.93, 0.84, 0.7));
  head.parent = body;

  const visor = CreateBox("runner-visor", { width: 0.26, height: 0.08, depth: 0.08 }, scene);
  visor.position.set(0, 0.02, 0.18);
  visor.material = matte(scene, "runner-visor-mat", new Color3(0.18, 0.2, 0.18));
  visor.parent = head;

  for (const side of [-1, 1]) {
    const arm = CreateBox(
      side < 0 ? "runner-arm-left" : "runner-arm-right",
      { width: 0.12, height: 0.42, depth: 0.12 },
      scene,
    );
    arm.position.set(0.42 * side, 0.12, 0);
    arm.material = body.material;
    arm.parent = body;
  }

  return { body, head, aggregate };
}
