export const DEVICE_KINDS = ["keyboard", "xbox", "playstation", "generic-pad"] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number];

export interface Vec2 {
  x: number;
  y: number;
}

/** One polled sample. Analog values are in the range -1..1. */
export interface InputFrame {
  move: Vec2;
  /** Gamepad stick or d-pad only. Keyboard movement stays in `move`. */
  padMove: Vec2;
  /** Stick and keys. Positive x turns right. Positive y looks up. */
  camera: Vec2;
  /** Pixel deltas for this frame. Positive mouseY is downward. */
  mouse: Vec2;
  jump: boolean;
  jumpPressed: boolean;
  attack: boolean;
  attackPressed: boolean;
  action: boolean;
  actionPressed: boolean;
  pausePressed: boolean;
  confirmPressed: boolean;
  /** Debug tuning overlay. Not part of the play HUD. */
  tune: boolean;
  tunePressed: boolean;
  device: DeviceKind;
}

export interface DigitalDown {
  jump: boolean;
  attack: boolean;
  action: boolean;
  pause: boolean;
  confirm: boolean;
  tune: boolean;
}

export function emptyInputFrame(device: DeviceKind = "keyboard"): InputFrame {
  return {
    move: { x: 0, y: 0 },
    padMove: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    jump: false,
    jumpPressed: false,
    attack: false,
    attackPressed: false,
    action: false,
    actionPressed: false,
    pausePressed: false,
    confirmPressed: false,
    tune: false,
    tunePressed: false,
    device,
  };
}
