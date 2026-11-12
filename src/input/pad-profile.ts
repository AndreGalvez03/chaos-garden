import type { DeviceKind } from "./types";

export type PadFamily = "xbox" | "playstation" | "generic";

export interface ButtonNames {
  xbox: string;
  playstation: string;
  generic: string;
}

/** Standard mapping button indexes. Labels follow the W3C gamepad layout. */
export const STANDARD_BUTTONS: Readonly<Record<number, ButtonNames>> = {
  0: { xbox: "A", playstation: "Cross", generic: "South" },
  1: { xbox: "B", playstation: "Circle", generic: "East" },
  2: { xbox: "X", playstation: "Square", generic: "West" },
  3: { xbox: "Y", playstation: "Triangle", generic: "North" },
  4: { xbox: "LB", playstation: "L1", generic: "Left shoulder" },
  5: { xbox: "RB", playstation: "R1", generic: "Right shoulder" },
  6: { xbox: "LT", playstation: "L2", generic: "Left trigger" },
  7: { xbox: "RT", playstation: "R2", generic: "Right trigger" },
  8: { xbox: "View", playstation: "Share", generic: "Select" },
  9: { xbox: "Menu", playstation: "Options", generic: "Start" },
  10: { xbox: "Left stick click", playstation: "L3", generic: "Left stick click" },
  11: { xbox: "Right stick click", playstation: "R3", generic: "Right stick click" },
  12: { xbox: "D-pad up", playstation: "D-pad up", generic: "D-pad up" },
  13: { xbox: "D-pad down", playstation: "D-pad down", generic: "D-pad down" },
  14: { xbox: "D-pad left", playstation: "D-pad left", generic: "D-pad left" },
  15: { xbox: "D-pad right", playstation: "D-pad right", generic: "D-pad right" },
};

/**
 * Xbox and PlayStation pads both expose the standard mapping. The id string
 * tells them apart so on-screen labels can use the matching button names.
 * Pads that do not report the standard mapping stay generic, because their
 * button indexes are not reliable.
 */
export function detectPadFamily(id: string, mapping: string): PadFamily {
  if (mapping !== "standard") return "generic";
  const haystack = id.toLowerCase();
  if (/xbox|xinput|045e/.test(haystack)) return "xbox";
  if (/054c|playstation|dualshock|dualsense|sony|wireless controller/.test(haystack)) {
    return "playstation";
  }
  return "generic";
}

export function familyToDevice(family: PadFamily): DeviceKind {
  if (family === "xbox") return "xbox";
  if (family === "playstation") return "playstation";
  return "generic-pad";
}

export function deviceLabel(device: DeviceKind): string {
  switch (device) {
    case "keyboard":
      return "Keyboard";
    case "xbox":
      return "Xbox pad";
    case "playstation":
      return "PlayStation pad";
    case "generic-pad":
      return "Gamepad";
  }
}

export function buttonLegend(index: number, family: PadFamily): string {
  const names = STANDARD_BUTTONS[index];
  if (!names) return `Button ${index}`;
  if (family === "xbox") return `${names.xbox} (${names.playstation})`;
  if (family === "playstation") return `${names.playstation} (${names.xbox})`;
  return `${names.generic} (${names.xbox} / ${names.playstation})`;
}
