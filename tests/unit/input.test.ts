import { describe, expect, it } from "vitest";
import { createDefaultBindings, rebindButton, rebindKey } from "../../src/input/bindings";
import { evaluateInput, applyFreshKeyEdges } from "../../src/input/evaluate";
import { buttonLegend, detectPadFamily, deviceLabel } from "../../src/input/pad-profile";

const bindings = createDefaultBindings();

describe("pad family", () => {
  it("detects an Xbox pad on the standard mapping", () => {
    expect(
      detectPadFamily("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)", "standard"),
    ).toBe("xbox");
    expect(detectPadFamily("xinput", "standard")).toBe("xbox");
  });

  it("detects a PlayStation pad on the standard mapping", () => {
    expect(detectPadFamily("054c-09cc-Wireless Controller", "standard")).toBe("playstation");
    expect(detectPadFamily("DualSense Wireless Controller", "standard")).toBe("playstation");
  });

  it("stays generic when the mapping is not standard", () => {
    expect(detectPadFamily("Xbox 360", "")).toBe("generic");
  });

  it("labels the south button for the detected family", () => {
    expect(buttonLegend(0, "xbox")).toBe("A (Cross)");
    expect(buttonLegend(0, "playstation")).toBe("Cross (A)");
    expect(deviceLabel("playstation")).toBe("PlayStation pad");
  });
});

describe("bindings", () => {
  it("replaces a key without mutating the previous map", () => {
    const next = rebindKey(bindings, "jump", "KeyJ");
    expect(next.jump.keys).toEqual(["KeyJ"]);
    expect(bindings.jump.keys).toEqual(["Space"]);
  });

  it("replaces a button without mutating the previous map", () => {
    const next = rebindButton(bindings, "attack", 1);
    expect(next.attack.buttons).toEqual([1]);
    expect(bindings.attack.buttons).toEqual([2]);
  });
});

describe("evaluateInput", () => {
  it("maps WASD to a camera-relative move vector", () => {
    const { frame } = evaluateInput(
      { keys: new Set(["KeyW", "KeyD"]), mouseX: 0, mouseY: 0, pad: null },
      bindings,
    );
    expect(frame.move).toEqual({ x: 1, y: 1 });
    expect(frame.device).toBe("keyboard");
  });

  it("inverts the left stick so up is forward", () => {
    const { frame } = evaluateInput(
      {
        keys: new Set(),
        mouseX: 0,
        mouseY: 0,
        pad: { family: "xbox", buttons: [], axes: [0, -1, 0, 0] },
      },
      bindings,
    );
    expect(frame.move.x).toBeCloseTo(0, 5);
    expect(frame.move.y).toBeCloseTo(1, 5);
    expect(frame.device).toBe("xbox");
  });

  it("applies the deadzone to a resting stick", () => {
    const { frame } = evaluateInput(
      {
        keys: new Set(),
        mouseX: 0,
        mouseY: 0,
        pad: { family: "generic", buttons: [], axes: [0.05, 0.05, 0, 0] },
      },
      bindings,
    );
    expect(frame.move).toEqual({ x: 0, y: 0 });
  });

  it("fires jump from the south button and only on the edge", () => {
    const buttons = Array.from({ length: 16 }, () => false);
    buttons[0] = true;
    const first = evaluateInput(
      { keys: new Set(), mouseX: 0, mouseY: 0, pad: { family: "playstation", buttons, axes: [] } },
      bindings,
    );
    expect(first.frame.jumpPressed).toBe(true);
    expect(first.frame.device).toBe("playstation");
    const second = evaluateInput(
      { keys: new Set(), mouseX: 0, mouseY: 0, pad: { family: "playstation", buttons, axes: [] } },
      bindings,
      first.down,
      first.device,
    );
    expect(second.frame.jump).toBe(true);
    expect(second.frame.jumpPressed).toBe(false);
  });

  it("fires pause once from Escape or the start button", () => {
    const fromKey = evaluateInput(
      { keys: new Set(["Escape"]), mouseX: 0, mouseY: 0, pad: null },
      bindings,
    );
    expect(fromKey.frame.pausePressed).toBe(true);
    const held = evaluateInput(
      { keys: new Set(["Escape"]), mouseX: 0, mouseY: 0, pad: null },
      bindings,
      fromKey.down,
    );
    expect(held.frame.pausePressed).toBe(false);

    const buttons = Array.from({ length: 16 }, () => false);
    buttons[9] = true;
    const fromPad = evaluateInput(
      { keys: new Set(), mouseX: 0, mouseY: 0, pad: { family: "xbox", buttons, axes: [] } },
      bindings,
    );
    expect(fromPad.frame.pausePressed).toBe(true);
    expect(fromPad.frame.confirmPressed).toBe(true);
  });

  it("uses a remapped attack key", () => {
    const remapped = rebindKey(bindings, "attack", "KeyJ");
    const { frame } = evaluateInput(
      { keys: new Set(["KeyJ"]), mouseX: 0, mouseY: 0, pad: null },
      remapped,
    );
    expect(frame.attackPressed).toBe(true);
    const original = evaluateInput(
      { keys: new Set(["KeyJ"]), mouseX: 0, mouseY: 0, pad: null },
      bindings,
    );
    expect(original.frame.attackPressed).toBe(false);
  });

  it("prefers the stronger move source when keyboard and pad overlap", () => {
    const { frame } = evaluateInput(
      {
        keys: new Set(["ArrowLeft"]),
        mouseX: 0,
        mouseY: 0,
        pad: { family: "xbox", buttons: [], axes: [1, 0, 0, 0] },
      },
      bindings,
    );
    expect(frame.device).toBe("xbox");
    expect(frame.move.x).toBeCloseTo(1, 5);
  });

  it("treats a fresh keydown as a pause edge even if the key already looked held", () => {
    const held = evaluateInput(
      { keys: new Set(["Escape"]), mouseX: 0, mouseY: 0, pad: null },
      bindings,
      { jump: false, attack: false, action: false, pause: true, confirm: false },
    );
    expect(held.frame.pausePressed).toBe(false);
    const recovered = applyFreshKeyEdges(held.frame, new Set(["Escape"]), bindings);
    expect(recovered.pausePressed).toBe(true);
  });
});
