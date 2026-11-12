import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";
import { DEFAULT_TUNING } from "./tuning";

export interface PlaceholderHero {
  body: Mesh;
  visual: TransformNode;
  aggregate: PhysicsAggregate;
}

function matte(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  return material;
}

/**
 * A clay-and-moss sprout. The collider is a capsule; the visible pieces are
 * parented to a separate node so the render pose can interpolate.
 */
export function createPlaceholderHero(scene: Scene, at: Vector3): PlaceholderHero {
  const height = DEFAULT_TUNING.probeHalfHeight * 2;
  const radius = DEFAULT_TUNING.bodyRadius;
  const body = CreateCapsule(
    "runner-body",
    { height, radius, tessellation: 12, capSubdivisions: 4 },
    scene,
  );
  body.position.copyFrom(at);
  body.rotationQuaternion = Quaternion.Identity();
  body.visibility = 0;
  body.computeWorldMatrix(true);

  const aggregate = new PhysicsAggregate(
    body,
    PhysicsShapeType.CAPSULE,
    { mass: 1, friction: 0, restitution: 0 },
    scene,
  );
  aggregate.body.setLinearDamping(0);
  aggregate.body.setAngularDamping(8);

  const visual = new TransformNode("runner-visual", scene);
  visual.position.copyFrom(at);
  visual.rotationQuaternion = Quaternion.Identity();

  const clay = matte(scene, "runner-clay", new Color3(0.64, 0.42, 0.26));
  const cream = matte(scene, "runner-cream", new Color3(0.91, 0.84, 0.68));
  const moss = matte(scene, "runner-moss", new Color3(0.34, 0.46, 0.28));
  const leaf = matte(scene, "runner-leaf", new Color3(0.46, 0.62, 0.3));
  const ink = matte(scene, "runner-ink", new Color3(0.16, 0.18, 0.15));

  const torso = CreateCapsule(
    "runner-torso",
    { height: height * 0.86, radius: radius * 0.92, tessellation: 12, capSubdivisions: 3 },
    scene,
  );
  torso.material = clay;
  torso.parent = visual;

  const belly = CreateSphere("runner-belly", { diameter: radius * 1.15, segments: 10 }, scene);
  belly.position.set(0, -height * 0.08, radius * 0.35);
  belly.material = cream;
  belly.parent = visual;

  for (const side of [-1, 1]) {
    const foot = CreateSphere(
      side < 0 ? "runner-foot-left" : "runner-foot-right",
      { diameter: radius * 0.72, segments: 8 },
      scene,
    );
    foot.scaling.set(1, 0.55, 1.15);
    foot.position.set(radius * 0.55 * side, -height * 0.42, radius * 0.15);
    foot.material = moss;
    foot.parent = visual;

    const eye = CreateSphere(
      side < 0 ? "runner-eye-left" : "runner-eye-right",
      { diameter: 0.1, segments: 8 },
      scene,
    );
    eye.position.set(radius * 0.28 * side, height * 0.18, radius * 0.78);
    eye.material = ink;
    eye.parent = visual;
  }

  for (const [name, tilt] of [
    ["runner-sprout-left", -0.5],
    ["runner-sprout-right", 0.5],
  ] as const) {
    const sprout = CreateBox(name, { width: 0.16, height: 0.34, depth: 0.05 }, scene);
    sprout.position.set(tilt * 0.18, height * 0.48, 0);
    sprout.rotation.z = tilt;
    sprout.material = leaf;
    sprout.parent = visual;
  }

  return { body, visual, aggregate };
}
