import { clamp } from "../core/math";
import type { AxisBinding, Bindings } from "./bindings";
import { applyRadialDeadzone } from "./deadzone";
import { familyToDevice, type PadFamily } from "./pad-profile";
import type { DeviceKind, DigitalDown, InputFrame, Vec2 } from "./types";

export interface PadSnapshot {
  family: PadFamily;
  buttons: readonly boolean[];
  axes: readonly number[];
}

export interface InputSnapshot {
  keys: ReadonlySet<string>;
  mouseX: number;
  mouseY: number;
  pad: PadSnapshot | null;
}

export interface Evaluation {
  frame: InputFrame;
  down: DigitalDown;
  device: DeviceKind;
}

const IDLE_DOWN: DigitalDown = {
  jump: false,
  attack: false,
  action: false,
  pause: false,
  confirm: false,
};

function axisFromKeys(
  keys: ReadonlySet<string>,
  negative: readonly string[],
  positive: readonly string[],
): number {
  const neg = negative.some((code) => keys.has(code));
  const pos = positive.some((code) => keys.has(code));
  return Number(pos) - Number(neg);
}

function readStick(axes: readonly number[], stick: AxisBinding, deadzone: number): Vec2 {
  const filtered = applyRadialDeadzone(axes[stick.axisX] ?? 0, axes[stick.axisY] ?? 0, deadzone);
  const y = stick.invertY ? -filtered.y : filtered.y;
  return { x: filtered.x, y: y === 0 ? 0 : y };
}

function keyHeld(keys: ReadonlySet<string>, codes: readonly string[]): boolean {
  return codes.some((code) => keys.has(code));
}

function buttonHeld(pad: PadSnapshot | null, buttons: readonly number[]): boolean {
  if (!pad) return false;
  return buttons.some((index) => pad.buttons[index] === true);
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

/** A fresh keydown should edge even if a missed keyup left the key looking held. */
export function applyFreshKeyEdges(
  frame: InputFrame,
  pressed: ReadonlySet<string>,
  bindings: Bindings,
): InputFrame {
  const fresh = (codes: readonly string[]): boolean => codes.some((code) => pressed.has(code));
  return {
    ...frame,
    jumpPressed: frame.jumpPressed || fresh(bindings.jump.keys),
    attackPressed: frame.attackPressed || fresh(bindings.attack.keys),
    actionPressed: frame.actionPressed || fresh(bindings.action.keys),
    pausePressed: frame.pausePressed || fresh(bindings.pause.keys),
    confirmPressed: frame.confirmPressed || fresh(bindings.confirm.keys),
  };
}

export function evaluateInput(
  snapshot: InputSnapshot,
  bindings: Bindings,
  previous: DigitalDown = IDLE_DOWN,
  lastDevice: DeviceKind = "keyboard",
): Evaluation {
  const keyMove: Vec2 = {
    x: axisFromKeys(snapshot.keys, bindings.move.negativeX, bindings.move.positiveX),
    y: axisFromKeys(snapshot.keys, bindings.move.negativeY, bindings.move.positiveY),
  };
  const keyCamera: Vec2 = {
    x: axisFromKeys(snapshot.keys, bindings.camera.negativeX, bindings.camera.positiveX),
    y: axisFromKeys(snapshot.keys, bindings.camera.negativeY, bindings.camera.positiveY),
  };
  const padMove = snapshot.pad
    ? readStick(snapshot.pad.axes, bindings.move.stick, bindings.deadzone)
    : { x: 0, y: 0 };
  const padCamera = snapshot.pad
    ? readStick(snapshot.pad.axes, bindings.camera.stick, bindings.deadzone)
    : { x: 0, y: 0 };

  const keyDigital =
    keyHeld(snapshot.keys, bindings.jump.keys) ||
    keyHeld(snapshot.keys, bindings.attack.keys) ||
    keyHeld(snapshot.keys, bindings.action.keys) ||
    keyHeld(snapshot.keys, bindings.pause.keys) ||
    keyHeld(snapshot.keys, bindings.confirm.keys);
  const keyActive =
    keyMove.x !== 0 ||
    keyMove.y !== 0 ||
    keyCamera.x !== 0 ||
    keyCamera.y !== 0 ||
    snapshot.mouseX !== 0 ||
    snapshot.mouseY !== 0 ||
    keyDigital;

  const padDigital =
    buttonHeld(snapshot.pad, bindings.jump.buttons) ||
    buttonHeld(snapshot.pad, bindings.attack.buttons) ||
    buttonHeld(snapshot.pad, bindings.action.buttons) ||
    buttonHeld(snapshot.pad, bindings.pause.buttons) ||
    buttonHeld(snapshot.pad, bindings.confirm.buttons);
  const padActive =
    snapshot.pad !== null &&
    (padMove.x !== 0 || padMove.y !== 0 || padCamera.x !== 0 || padCamera.y !== 0 || padDigital);

  const keyMag = magnitude(keyMove);
  const padMag = magnitude(padMove);
  const padWins = padActive && (!keyActive || padMag > keyMag);
  const device: DeviceKind = padWins
    ? familyToDevice(snapshot.pad?.family ?? "generic")
    : keyActive
      ? "keyboard"
      : lastDevice;

  const move = padWins && padMag > 0 ? padMove : keyMag > 0 ? keyMove : padMove;
  const down: DigitalDown = {
    jump:
      keyHeld(snapshot.keys, bindings.jump.keys) || buttonHeld(snapshot.pad, bindings.jump.buttons),
    attack:
      keyHeld(snapshot.keys, bindings.attack.keys) ||
      buttonHeld(snapshot.pad, bindings.attack.buttons),
    action:
      keyHeld(snapshot.keys, bindings.action.keys) ||
      buttonHeld(snapshot.pad, bindings.action.buttons),
    pause:
      keyHeld(snapshot.keys, bindings.pause.keys) ||
      buttonHeld(snapshot.pad, bindings.pause.buttons),
    confirm:
      keyHeld(snapshot.keys, bindings.confirm.keys) ||
      buttonHeld(snapshot.pad, bindings.confirm.buttons),
  };

  const frame: InputFrame = {
    move,
    camera: {
      x: clamp(keyCamera.x + padCamera.x, -1, 1),
      y: clamp(keyCamera.y + padCamera.y, -1, 1),
    },
    mouse: { x: snapshot.mouseX, y: snapshot.mouseY },
    jump: down.jump,
    jumpPressed: down.jump && !previous.jump,
    attack: down.attack,
    attackPressed: down.attack && !previous.attack,
    action: down.action,
    actionPressed: down.action && !previous.action,
    pausePressed: down.pause && !previous.pause,
    confirmPressed: down.confirm && !previous.confirm,
    device,
  };

  return { frame, down, device };
}
