export const DEVICE_KINDS = ["keyboard", "xbox", "playstation", "generic-pad"] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number];

export interface Vec2 {
  x: number;
  y: number;
}

/** One polled sample. Analog values are in the range -1..1. */
export interface InputFrame {
  move: Vec2;
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
  device: DeviceKind;
}

export interface DigitalDown {
  jump: boolean;
  attack: boolean;
  action: boolean;
  pause: boolean;
  confirm: boolean;
}
