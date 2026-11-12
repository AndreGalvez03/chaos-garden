import { createDefaultBindings, type Bindings } from "./bindings";
import {
  applyFreshKeyEdges,
  evaluateInput,
  type InputSnapshot,
  type PadSnapshot,
} from "./evaluate";
import { detectPadFamily } from "./pad-profile";
import { applyRadialDeadzone } from "./deadzone";
import type { DeviceKind, DigitalDown, InputFrame } from "./types";

const SCROLL_CODES = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * DOM adapter around {@link evaluateInput}. Key taps that land between frames
 * are queued so a short press is still visible to the next poll.
 */
export class InputManager {
  private bindings: Bindings = createDefaultBindings();
  private readonly held = new Set<string>();
  private readonly queued = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private previous: DigitalDown = {
    jump: false,
    attack: false,
    action: false,
    pause: false,
    confirm: false,
  };
  private device: DeviceKind = "keyboard";
  private preferredPad: number | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (SCROLL_CODES.has(event.code) && !isTypingTarget(event.target)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    this.held.add(event.code);
    this.queued.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.mouseX += event.movementX;
    this.mouseY += event.movementY;
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.queued.clear();
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("blur", this.onBlur);
  }

  getBindings(): Bindings {
    return this.bindings;
  }

  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
  }

  poll(): InputFrame {
    const pressed = new Set(this.queued);
    this.queued.clear();
    const keys = new Set(this.held);
    for (const code of pressed) keys.add(code);

    const snapshot: InputSnapshot = {
      keys,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      pad: this.readPad(),
    };
    this.mouseX = 0;
    this.mouseY = 0;

    const evaluated = evaluateInput(snapshot, this.bindings, this.previous, this.device);
    const frame = applyFreshKeyEdges(evaluated.frame, pressed, this.bindings);
    this.previous = evaluated.down;
    this.device = frame.device;
    return frame;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("blur", this.onBlur);
  }

  private readPad(): PadSnapshot | null {
    const pads = navigator.getGamepads?.() ?? [];
    let fallback: Gamepad | null = null;
    let active: Gamepad | null = null;
    for (const pad of pads) {
      if (!pad?.connected) continue;
      if (this.preferredPad === pad.index) fallback = pad;
      if (!fallback) fallback = pad;
      if (padIsActive(pad, this.bindings.deadzone)) {
        active = pad;
        this.preferredPad = pad.index;
        break;
      }
    }
    const chosen = active ?? fallback;
    if (!chosen) return null;
    return {
      family: detectPadFamily(chosen.id, chosen.mapping),
      buttons: chosen.buttons.map((button) => button.pressed || button.value > 0.5),
      axes: Array.from(chosen.axes),
    };
  }
}

function padIsActive(pad: Gamepad, deadzone: number): boolean {
  if (pad.buttons.some((button) => button.pressed || button.value > 0.5)) return true;
  const left = applyRadialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, deadzone);
  const right = applyRadialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, deadzone);
  return left.x !== 0 || left.y !== 0 || right.x !== 0 || right.y !== 0;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
