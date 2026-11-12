import { clamp } from "../core/math";
import type { Vec2 } from "./types";

/**
 * Radial deadzone. Values inside the radius become zero, and the rest of the
 * stick range is rescaled so the edge still reaches full deflection.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone: number): Vec2 {
  if (deadzone <= 0) {
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  if (deadzone >= 1) {
    return { x: 0, y: 0 };
  }
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone || magnitude === 0) {
    return { x: 0, y: 0 };
  }
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return {
    x: clamp((x / magnitude) * scaled, -1, 1),
    y: clamp((y / magnitude) * scaled, -1, 1),
  };
}
