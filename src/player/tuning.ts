/**
 * Every gameplay and camera number the controller reads.
 * Sliders edit a copy of these defaults. Nothing here is written to disk.
 */

export interface PlayerTuning {
  gravity: number;
  topSpeed: number;
  overspeedCap: number;
  runAccel: number;
  runAccelFloor: number;
  accelExponent: number;
  brakeAccel: number;
  airAccel: number;
  idleSpeed: number;
  groundStick: number;
  slopeInfluence: number;
  coyoteTime: number;
  groundedMaxRise: number;
  turnResponse: number;
  jumpSpeed: number;
  jumpHoldWindow: number;
  jumpGravityScale: number;
  fallGravityScale: number;
  jumpCut: number;
  minAirTime: number;
  rollChargeTime: number;
  rollFriction: number;
  rollBurstMin: number;
  rollBurstMax: number;
  rollBurstTime: number;
  rollSteer: number;
  dashSpeed: number;
  dashDuration: number;
  dashRange: number;
  dashConeDot: number;
  dashFallbackLift: number;
  railGrabRadius: number;
  railMinSpeed: number;
  railHover: number;
  railAccel: number;
  railCruise: number;
  railMaxSpeed: number;
  railBalanceRate: number;
  railBalanceRecover: number;
  railFallBalance: number;
  railJumpSpeed: number;
  railEndSlack: number;
  railRegrab: number;
  springPower: number;
  springLockTime: number;
  loopEnterSpeed: number;
  loopExitSpeed: number;
  loopUprightDot: number;
  loopGlue: number;
  loopCoyote: number;
  loopAlign: number;
  probeHalfHeight: number;
  probeSkin: number;
  probeLength: number;
  probeForward: number;
  bodyRadius: number;
  cameraDistanceMin: number;
  cameraDistanceMax: number;
  cameraDistanceSpeed: number;
  cameraFovMin: number;
  cameraFovMax: number;
  cameraFovSpeed: number;
  cameraHeight: number;
  cameraLookAhead: number;
  cameraFollow: number;
  cameraOrbitSpeed: number;
  cameraOrbitReturn: number;
  cameraMouseYaw: number;
  cameraMousePitch: number;
  cameraPitchSpeed: number;
  cameraPitchMin: number;
  cameraPitchMax: number;
  cameraUpFollow: number;
  cameraPosFollow: number;
  cameraCollisionPad: number;
  cameraCollisionMin: number;
  cameraAutoSpeed: number;
  cameraOffsetMax: number;
}

export interface TunableSpec {
  key: keyof PlayerTuning;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

const FIELDS: readonly TunableSpec[] = [
  { key: "gravity", label: "Gravity", group: "Run", min: 8, max: 40, step: 0.5, value: 24 },
  { key: "topSpeed", label: "Top speed", group: "Run", min: 8, max: 48, step: 0.5, value: 34 },
  {
    key: "overspeedCap",
    label: "Overspeed cap",
    group: "Run",
    min: 12,
    max: 70,
    step: 0.5,
    value: 52,
  },
  {
    key: "runAccel",
    label: "Run acceleration",
    group: "Run",
    min: 4,
    max: 90,
    step: 0.5,
    value: 46,
  },
  {
    key: "runAccelFloor",
    label: "Acceleration floor",
    group: "Run",
    min: 0,
    max: 20,
    step: 0.1,
    value: 4,
  },
  {
    key: "accelExponent",
    label: "Acceleration curve",
    group: "Run",
    min: 0.15,
    max: 3,
    step: 0.05,
    value: 0.7,
  },
  { key: "brakeAccel", label: "Brake", group: "Run", min: 4, max: 120, step: 1, value: 64 },
  {
    key: "airAccel",
    label: "Air acceleration",
    group: "Run",
    min: 0,
    max: 60,
    step: 0.5,
    value: 16,
  },
  { key: "idleSpeed", label: "Idle speed", group: "Run", min: 0.1, max: 4, step: 0.1, value: 1.1 },
  {
    key: "groundStick",
    label: "Ground stick",
    group: "Run",
    min: 0,
    max: 12,
    step: 0.1,
    value: 2.4,
  },
  {
    key: "slopeInfluence",
    label: "Slope influence",
    group: "Run",
    min: 0,
    max: 2,
    step: 0.05,
    value: 1,
  },
  {
    key: "coyoteTime",
    label: "Coyote time",
    group: "Run",
    min: 0,
    max: 0.3,
    step: 0.01,
    value: 0.08,
  },
  {
    key: "groundedMaxRise",
    label: "Grounded rise limit",
    group: "Run",
    min: 0,
    max: 8,
    step: 0.1,
    value: 1.6,
  },
  {
    key: "turnResponse",
    label: "Turn response",
    group: "Run",
    min: 1,
    max: 30,
    step: 0.5,
    value: 14,
  },
  { key: "jumpSpeed", label: "Jump speed", group: "Jump", min: 2, max: 20, step: 0.1, value: 9.2 },
  {
    key: "jumpHoldWindow",
    label: "Jump hold window",
    group: "Jump",
    min: 0.05,
    max: 0.6,
    step: 0.01,
    value: 0.24,
  },
  {
    key: "jumpGravityScale",
    label: "Held jump gravity",
    group: "Jump",
    min: 0.1,
    max: 1.5,
    step: 0.05,
    value: 0.4,
  },
  {
    key: "fallGravityScale",
    label: "Fall gravity",
    group: "Jump",
    min: 0.5,
    max: 2.5,
    step: 0.05,
    value: 1.2,
  },
  {
    key: "jumpCut",
    label: "Jump release cut",
    group: "Jump",
    min: 0,
    max: 12,
    step: 0.1,
    value: 3.4,
  },
  {
    key: "minAirTime",
    label: "Minimum air time",
    group: "Jump",
    min: 0,
    max: 0.3,
    step: 0.01,
    value: 0.08,
  },
  {
    key: "rollChargeTime",
    label: "Roll charge time",
    group: "Roll",
    min: 0.1,
    max: 1.5,
    step: 0.01,
    value: 0.55,
  },
  {
    key: "rollFriction",
    label: "Charge slowdown",
    group: "Roll",
    min: 0,
    max: 30,
    step: 0.5,
    value: 10,
  },
  {
    key: "rollBurstMin",
    label: "Burst speed min",
    group: "Roll",
    min: 4,
    max: 40,
    step: 0.5,
    value: 16,
  },
  {
    key: "rollBurstMax",
    label: "Burst speed max",
    group: "Roll",
    min: 8,
    max: 60,
    step: 0.5,
    value: 40,
  },
  {
    key: "rollBurstTime",
    label: "Burst time",
    group: "Roll",
    min: 0.05,
    max: 1,
    step: 0.01,
    value: 0.38,
  },
  { key: "rollSteer", label: "Burst steer", group: "Roll", min: 0, max: 30, step: 0.5, value: 8 },
  { key: "dashSpeed", label: "Dash speed", group: "Dash", min: 10, max: 70, step: 0.5, value: 42 },
  {
    key: "dashDuration",
    label: "Dash time",
    group: "Dash",
    min: 0.05,
    max: 0.5,
    step: 0.01,
    value: 0.18,
  },
  { key: "dashRange", label: "Dash range", group: "Dash", min: 2, max: 40, step: 0.5, value: 18 },
  {
    key: "dashConeDot",
    label: "Dash cone dot",
    group: "Dash",
    min: 0,
    max: 1,
    step: 0.01,
    value: 0.62,
  },
  {
    key: "dashFallbackLift",
    label: "Fallback dash lift",
    group: "Dash",
    min: 0,
    max: 12,
    step: 0.1,
    value: 1.5,
  },
  {
    key: "railGrabRadius",
    label: "Rail grab radius",
    group: "Rail",
    min: 0.4,
    max: 4,
    step: 0.05,
    value: 1.45,
  },
  {
    key: "railMinSpeed",
    label: "Rail grab speed",
    group: "Rail",
    min: 0,
    max: 20,
    step: 0.5,
    value: 6,
  },
  {
    key: "railHover",
    label: "Rail hover",
    group: "Rail",
    min: 0.2,
    max: 2,
    step: 0.05,
    value: 0.85,
  },
  {
    key: "railAccel",
    label: "Rail acceleration",
    group: "Rail",
    min: 0,
    max: 40,
    step: 0.5,
    value: 8,
  },
  { key: "railCruise", label: "Rail cruise", group: "Rail", min: 4, max: 40, step: 0.5, value: 22 },
  {
    key: "railMaxSpeed",
    label: "Rail max speed",
    group: "Rail",
    min: 8,
    max: 60,
    step: 0.5,
    value: 36,
  },
  {
    key: "railBalanceRate",
    label: "Balance push",
    group: "Rail",
    min: 0,
    max: 6,
    step: 0.05,
    value: 1.7,
  },
  {
    key: "railBalanceRecover",
    label: "Balance recover",
    group: "Rail",
    min: 0,
    max: 8,
    step: 0.05,
    value: 0.85,
  },
  {
    key: "railFallBalance",
    label: "Balance fall",
    group: "Rail",
    min: 0.4,
    max: 2,
    step: 0.05,
    value: 1,
  },
  { key: "railJumpSpeed", label: "Rail jump", group: "Rail", min: 2, max: 20, step: 0.1, value: 8 },
  {
    key: "railEndSlack",
    label: "Rail end slack",
    group: "Rail",
    min: 0.05,
    max: 2,
    step: 0.05,
    value: 0.4,
  },
  {
    key: "railRegrab",
    label: "Rail regrab delay",
    group: "Rail",
    min: 0,
    max: 1.5,
    step: 0.01,
    value: 0.45,
  },
  {
    key: "springPower",
    label: "Spring power",
    group: "Spring",
    min: 6,
    max: 40,
    step: 0.5,
    value: 22,
  },
  {
    key: "springLockTime",
    label: "Spring lock time",
    group: "Spring",
    min: 0.02,
    max: 0.4,
    step: 0.01,
    value: 0.12,
  },
  {
    key: "loopEnterSpeed",
    label: "Loop enter speed",
    group: "Loop",
    min: 6,
    max: 40,
    step: 0.5,
    value: 18,
  },
  {
    key: "loopExitSpeed",
    label: "Loop exit speed",
    group: "Loop",
    min: 2,
    max: 30,
    step: 0.5,
    value: 11,
  },
  {
    key: "loopUprightDot",
    label: "Loop upright dot",
    group: "Loop",
    min: 0,
    max: 1,
    step: 0.01,
    value: 0.55,
  },
  { key: "loopGlue", label: "Loop glue", group: "Loop", min: 0, max: 20, step: 0.1, value: 6 },
  {
    key: "loopCoyote",
    label: "Loop coyote",
    group: "Loop",
    min: 0,
    max: 0.4,
    step: 0.01,
    value: 0.1,
  },
  { key: "loopAlign", label: "Loop align", group: "Loop", min: 1, max: 30, step: 0.5, value: 12 },
  {
    key: "probeHalfHeight",
    label: "Probe half height",
    group: "Probe",
    min: 0.3,
    max: 1.4,
    step: 0.01,
    value: 0.62,
  },
  {
    key: "probeSkin",
    label: "Probe skin",
    group: "Probe",
    min: 0,
    max: 0.3,
    step: 0.01,
    value: 0.08,
  },
  {
    key: "probeLength",
    label: "Probe length",
    group: "Probe",
    min: 0.1,
    max: 1.2,
    step: 0.01,
    value: 0.55,
  },
  {
    key: "probeForward",
    label: "Forward probe",
    group: "Probe",
    min: 0.2,
    max: 3,
    step: 0.05,
    value: 1.4,
  },
  {
    key: "bodyRadius",
    label: "Body radius",
    group: "Probe",
    min: 0.2,
    max: 0.8,
    step: 0.01,
    value: 0.34,
  },
  {
    key: "cameraDistanceMin",
    label: "Camera distance min",
    group: "Camera",
    min: 2,
    max: 12,
    step: 0.1,
    value: 5.4,
  },
  {
    key: "cameraDistanceMax",
    label: "Camera distance max",
    group: "Camera",
    min: 4,
    max: 18,
    step: 0.1,
    value: 9.2,
  },
  {
    key: "cameraDistanceSpeed",
    label: "Camera pullback speed",
    group: "Camera",
    min: 8,
    max: 60,
    step: 0.5,
    value: 34,
  },
  {
    key: "cameraFovMin",
    label: "FOV min",
    group: "Camera",
    min: 0.5,
    max: 1.4,
    step: 0.01,
    value: 0.86,
  },
  {
    key: "cameraFovMax",
    label: "FOV max",
    group: "Camera",
    min: 0.7,
    max: 1.8,
    step: 0.01,
    value: 1.22,
  },
  {
    key: "cameraFovSpeed",
    label: "FOV speed",
    group: "Camera",
    min: 8,
    max: 60,
    step: 0.5,
    value: 34,
  },
  {
    key: "cameraHeight",
    label: "Camera height",
    group: "Camera",
    min: 0.2,
    max: 3,
    step: 0.05,
    value: 1.15,
  },
  {
    key: "cameraLookAhead",
    label: "Look ahead",
    group: "Camera",
    min: 0,
    max: 4,
    step: 0.05,
    value: 1.2,
  },
  {
    key: "cameraFollow",
    label: "Follow response",
    group: "Camera",
    min: 1,
    max: 20,
    step: 0.1,
    value: 7,
  },
  {
    key: "cameraOrbitSpeed",
    label: "Orbit speed",
    group: "Camera",
    min: 0.2,
    max: 5,
    step: 0.05,
    value: 2.2,
  },
  {
    key: "cameraOrbitReturn",
    label: "Orbit return",
    group: "Camera",
    min: 0,
    max: 8,
    step: 0.05,
    value: 1.6,
  },
  {
    key: "cameraMouseYaw",
    label: "Mouse yaw",
    group: "Camera",
    min: 0,
    max: 0.01,
    step: 0.0001,
    value: 0.0022,
  },
  {
    key: "cameraMousePitch",
    label: "Mouse pitch",
    group: "Camera",
    min: 0,
    max: 0.01,
    step: 0.0001,
    value: 0.0018,
  },
  {
    key: "cameraPitchSpeed",
    label: "Pitch speed",
    group: "Camera",
    min: 0.2,
    max: 4,
    step: 0.05,
    value: 1.25,
  },
  {
    key: "cameraPitchMin",
    label: "Pitch min",
    group: "Camera",
    min: -0.4,
    max: 0.8,
    step: 0.01,
    value: 0.15,
  },
  {
    key: "cameraPitchMax",
    label: "Pitch max",
    group: "Camera",
    min: 0.4,
    max: 1.5,
    step: 0.01,
    value: 1.15,
  },
  {
    key: "cameraUpFollow",
    label: "Up follow",
    group: "Camera",
    min: 1,
    max: 20,
    step: 0.1,
    value: 5,
  },
  {
    key: "cameraPosFollow",
    label: "Position follow",
    group: "Camera",
    min: 1,
    max: 30,
    step: 0.1,
    value: 10,
  },
  {
    key: "cameraCollisionPad",
    label: "Collision pad",
    group: "Camera",
    min: 0.05,
    max: 1,
    step: 0.01,
    value: 0.35,
  },
  {
    key: "cameraCollisionMin",
    label: "Collision min distance",
    group: "Camera",
    min: 0.4,
    max: 3,
    step: 0.05,
    value: 1.15,
  },
  {
    key: "cameraAutoSpeed",
    label: "Auto yaw speed",
    group: "Camera",
    min: 0,
    max: 20,
    step: 0.5,
    value: 3.5,
  },
  {
    key: "cameraOffsetMax",
    label: "Orbit offset max",
    group: "Camera",
    min: 0.2,
    max: 3,
    step: 0.05,
    value: 1.35,
  },
];

export const TUNING_SCHEMA: readonly TunableSpec[] = FIELDS;

export const DEFAULT_TUNING: PlayerTuning = tuningFrom(FIELDS);

export function tuningFrom(fields: readonly TunableSpec[]): PlayerTuning {
  const tuning = {} as PlayerTuning;
  for (const field of fields) tuning[field.key] = field.value;
  return tuning;
}

export function cloneTuning(source: PlayerTuning = DEFAULT_TUNING): PlayerTuning {
  return { ...source };
}

export function tuningKeys(tuning: PlayerTuning): (keyof PlayerTuning)[] {
  return Object.keys(tuning) as (keyof PlayerTuning)[];
}

/** Empty when the object matches the schema ranges and the cross-field rules. */
export function validateTuning(tuning: PlayerTuning): string[] {
  const errors: string[] = [];
  const keys = new Set(tuningKeys(tuning));
  const seen = new Set<keyof PlayerTuning>();
  for (const field of TUNING_SCHEMA) {
    if (seen.has(field.key)) errors.push(`Duplicate schema entry ${field.key}.`);
    seen.add(field.key);
    if (!keys.has(field.key)) errors.push(`Missing tunable ${field.key}.`);
    if (!(field.min < field.max)) errors.push(`${field.key} has a reversed range.`);
    if (!(field.step > 0) || field.step > field.max - field.min) {
      errors.push(`${field.key} has a step outside its range.`);
    }
    if (field.label.trim().length === 0) errors.push(`${field.key} needs a label.`);
    const value = tuning[field.key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${field.key} must be a finite number.`);
      continue;
    }
    if (value < field.min || value > field.max) {
      errors.push(`${field.key} is outside ${field.min}..${field.max}.`);
    }
  }
  for (const key of keys) {
    if (!seen.has(key)) errors.push(`Tunable ${key} is missing from the schema.`);
  }
  if (tuning.idleSpeed >= tuning.topSpeed) errors.push("Idle speed must sit under top speed.");
  if (tuning.topSpeed > tuning.overspeedCap)
    errors.push("Top speed must sit under the overspeed cap.");
  if (tuning.loopExitSpeed >= tuning.loopEnterSpeed) {
    errors.push("Loop exit speed must sit under the enter speed.");
  }
  if (tuning.rollBurstMin > tuning.rollBurstMax) errors.push("Burst speeds are reversed.");
  if (tuning.cameraDistanceMin > tuning.cameraDistanceMax)
    errors.push("Camera distances are reversed.");
  if (tuning.cameraFovMin > tuning.cameraFovMax) errors.push("Camera fields of view are reversed.");
  if (tuning.cameraPitchMin > tuning.cameraPitchMax)
    errors.push("Camera pitch limits are reversed.");
  if (tuning.jumpCut > tuning.jumpSpeed) errors.push("Jump release cut must sit under jump speed.");
  return errors;
}
