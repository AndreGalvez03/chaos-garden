import { describe, expect, it } from "vitest";
import {
  cloneTuning,
  DEFAULT_TUNING,
  TUNING_SCHEMA,
  validateTuning,
  type PlayerTuning,
} from "../../src/player/tuning";

describe("tuning schema", () => {
  it("lists every tunable once and keeps the defaults inside the sliders", () => {
    const keys = Object.keys(DEFAULT_TUNING) as (keyof PlayerTuning)[];
    const schemaKeys = TUNING_SCHEMA.map((field) => field.key);
    expect(new Set(schemaKeys).size).toBe(schemaKeys.length);
    expect(schemaKeys.slice().sort()).toEqual(keys.slice().sort());
    expect(validateTuning(DEFAULT_TUNING)).toEqual([]);
    for (const field of TUNING_SCHEMA) {
      expect(field.label.trim().length).toBeGreaterThan(0);
      expect(field.group.trim().length).toBeGreaterThan(0);
      expect(field.min).toBeLessThan(field.max);
      expect(field.step).toBeGreaterThan(0);
    }
  });

  it("rejects a value outside its slider and a broken speed ordering", () => {
    const missing = { ...DEFAULT_TUNING, topSpeed: 400 };
    expect(validateTuning(missing).some((error) => error.includes("topSpeed"))).toBe(true);

    const reversed = cloneTuning();
    reversed.loopExitSpeed = reversed.loopEnterSpeed;
    expect(validateTuning(reversed).some((error) => error.includes("Loop exit"))).toBe(true);

    const broken = { ...DEFAULT_TUNING, gravity: Number.NaN };
    expect(validateTuning(broken).some((error) => error.includes("gravity"))).toBe(true);
  });
});
