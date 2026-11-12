import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";

interface Block {
  name: string;
  size: [number, number, number];
  position: [number, number, number];
  rotationX?: number;
  tone: "ground" | "stone" | "ramp";
}

const BLOCKS: readonly Block[] = [
  { name: "ground", size: [48, 1, 48], position: [0, -0.5, 0], tone: "ground" },
  { name: "ramp", size: [6, 0.4, 10], position: [0, 1.45, 8], rotationX: -0.32, tone: "ramp" },
  { name: "platform-low", size: [4, 0.4, 4], position: [6.5, 0.9, 3], tone: "stone" },
  { name: "platform-mid", size: [4.5, 0.4, 4], position: [-5.5, 2, 9], tone: "stone" },
  { name: "platform-high", size: [5, 0.4, 4], position: [1.5, 2.9, 14.5], tone: "stone" },
  { name: "step-a", size: [3, 0.5, 3], position: [-8, 0.25, -3], tone: "stone" },
  { name: "step-b", size: [3, 1, 3], position: [-8, 0.5, -5.6], tone: "stone" },
  { name: "step-c", size: [3, 1.5, 3], position: [-8, 0.75, -8.2], tone: "stone" },
  { name: "wall", size: [0.6, 2.4, 8], position: [11, 1.2, -2], tone: "ramp" },
];

const TONES: Record<Block["tone"], Color3> = {
  ground: new Color3(0.45, 0.47, 0.46),
  stone: new Color3(0.62, 0.64, 0.63),
  ramp: new Color3(0.38, 0.4, 0.39),
};

/** Static gray boxes: a ground plane, a ramp, steps, and a few platforms. */
export function buildYard(scene: Scene): void {
  const materials = new Map<Block["tone"], StandardMaterial>();
  for (const tone of Object.keys(TONES) as Block["tone"][]) {
    const material = new StandardMaterial(`yard-${tone}`, scene);
    material.diffuseColor = TONES[tone]!;
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    materials.set(tone, material);
  }

  for (const block of BLOCKS) {
    const mesh = CreateBox(
      block.name,
      { width: block.size[0], height: block.size[1], depth: block.size[2] },
      scene,
    );
    mesh.position.set(block.position[0], block.position[1], block.position[2]);
    if (block.rotationX) mesh.rotation.x = block.rotationX;
    mesh.material = materials.get(block.tone) ?? null;
    mesh.computeWorldMatrix(true);
    new PhysicsAggregate(
      mesh,
      PhysicsShapeType.BOX,
      { mass: 0, friction: 0.9, restitution: 0 },
      scene,
    );
  }
}

export const YARD_SPAWN = new Vector3(0, 2.4, -6);
