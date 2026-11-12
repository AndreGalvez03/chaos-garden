import type { Bindings } from "../input/bindings";
import { buttonLegend, type PadFamily } from "../input/pad-profile";

export interface ControlRow {
  action: string;
  binding: string;
}

export interface ControlSection {
  heading: string;
  rows: ControlRow[];
}

export function formatKeyCode(code: string): string {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code === "Escape") return "Esc";
  if (code === "Space") return "Space";
  return code;
}

function formatKeys(codes: readonly string[]): string {
  return codes.map(formatKeyCode).join(" / ");
}

function gamepadHeading(family: PadFamily): string {
  if (family === "xbox") return "Gamepad (Xbox)";
  if (family === "playstation") return "Gamepad (PlayStation)";
  return "Gamepad";
}

function buttonList(indexes: readonly number[], family: PadFamily): string {
  if (indexes.length === 0) return "Unbound";
  return indexes.map((index) => buttonLegend(index, family)).join(" / ");
}

export function familyForDevice(
  device: "keyboard" | "xbox" | "playstation" | "generic-pad",
): PadFamily {
  if (device === "xbox") return "xbox";
  if (device === "playstation") return "playstation";
  return "generic";
}

export function controlSections(bindings: Bindings, family: PadFamily): ControlSection[] {
  const moveKeys = formatKeys([
    ...bindings.move.positiveY,
    ...bindings.move.negativeX,
    ...bindings.move.negativeY,
    ...bindings.move.positiveX,
  ]);
  const cameraKeys = formatKeys([
    ...bindings.camera.negativeX,
    ...bindings.camera.positiveX,
    ...bindings.camera.positiveY,
    ...bindings.camera.negativeY,
  ]);

  return [
    {
      heading: "Keyboard",
      rows: [
        { action: "Move", binding: moveKeys },
        { action: "Camera", binding: `${cameraKeys}, mouse` },
        { action: "Jump", binding: formatKeys(bindings.jump.keys) },
        { action: "Attack", binding: formatKeys(bindings.attack.keys) },
        { action: "Action", binding: formatKeys(bindings.action.keys) },
        { action: "Pause", binding: formatKeys(bindings.pause.keys) },
        { action: "Begin", binding: formatKeys(bindings.confirm.keys) },
      ],
    },
    {
      heading: gamepadHeading(family),
      rows: [
        { action: "Move", binding: "Left stick" },
        { action: "Camera", binding: "Right stick" },
        { action: "Jump", binding: buttonList(bindings.jump.buttons, family) },
        { action: "Attack", binding: buttonList(bindings.attack.buttons, family) },
        { action: "Action", binding: buttonList(bindings.action.buttons, family) },
        { action: "Pause", binding: buttonList(bindings.pause.buttons, family) },
        { action: "Begin", binding: buttonList(bindings.confirm.buttons, family) },
      ],
    },
  ];
}
