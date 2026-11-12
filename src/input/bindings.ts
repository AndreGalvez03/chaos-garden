export interface AxisBinding {
  axisX: number;
  axisY: number;
  /** Browser sticks report down as positive. Invert so up is positive. */
  invertY: boolean;
}

export interface DigitalBinding {
  keys: string[];
  buttons: number[];
}

export interface Bindings {
  deadzone: number;
  move: {
    positiveX: string[];
    negativeX: string[];
    positiveY: string[];
    negativeY: string[];
    stick: AxisBinding;
  };
  camera: {
    positiveX: string[];
    negativeX: string[];
    positiveY: string[];
    negativeY: string[];
    stick: AxisBinding;
  };
  jump: DigitalBinding;
  attack: DigitalBinding;
  action: DigitalBinding;
  pause: DigitalBinding;
  confirm: DigitalBinding;
}

export type DigitalAction = "jump" | "attack" | "action" | "pause" | "confirm";

export function createDefaultBindings(): Bindings {
  return {
    deadzone: 0.18,
    move: {
      positiveX: ["KeyD"],
      negativeX: ["KeyA"],
      positiveY: ["KeyW"],
      negativeY: ["KeyS"],
      stick: { axisX: 0, axisY: 1, invertY: true },
    },
    camera: {
      positiveX: ["ArrowRight"],
      negativeX: ["ArrowLeft"],
      positiveY: ["ArrowUp"],
      negativeY: ["ArrowDown"],
      stick: { axisX: 2, axisY: 3, invertY: true },
    },
    jump: { keys: ["Space"], buttons: [0] },
    attack: { keys: ["KeyK"], buttons: [2] },
    action: { keys: ["KeyF"], buttons: [3] },
    pause: { keys: ["Escape"], buttons: [9] },
    confirm: { keys: ["Enter", "NumpadEnter"], buttons: [9] },
  };
}

export function rebindKey(bindings: Bindings, action: DigitalAction, code: string): Bindings {
  const next = structuredClone(bindings);
  next[action].keys = [code];
  return next;
}

export function rebindButton(bindings: Bindings, action: DigitalAction, button: number): Bindings {
  const next = structuredClone(bindings);
  next[action].buttons = [button];
  return next;
}
