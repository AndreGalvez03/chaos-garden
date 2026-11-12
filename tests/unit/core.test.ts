import { describe, expect, it } from "vitest";
import { GameStore } from "../../src/core/game-state";
import { FIXED_STEP_SECONDS, GameLoop, MAX_SUBSTEPS } from "../../src/core/loop";
import { SceneManager, type SceneController } from "../../src/core/scene-manager";
import { emptyInputFrame } from "../../src/input/types";

const idle = emptyInputFrame();

function fakeScene(id: SceneController["id"], log: string[]): SceneController {
  return {
    id,
    enter() {
      log.push(`enter:${id}`);
    },
    exit() {
      log.push(`exit:${id}`);
    },
    beginFrame() {
      log.push(`frame:${id}`);
    },
    fixedUpdate() {
      log.push(`step:${id}`);
    },
    render() {
      log.push(`render:${id}`);
    },
  };
}

describe("scene manager", () => {
  it("switches scenes and clears pause", () => {
    const log: string[] = [];
    const store = new GameStore({ sceneId: "title", paused: true, creditsReturn: "title" });
    const scenes = new SceneManager(store, {
      title: () => fakeScene("title", log),
      playground: () => fakeScene("playground", log),
      credits: () => fakeScene("credits", log),
    });
    scenes.start("title");
    scenes.request("playground");
    scenes.beginFrame(idle);
    expect(log).toEqual(["enter:title", "frame:title", "exit:title", "enter:playground"]);
    expect(scenes.currentId).toBe("playground");
    expect(store.get().paused).toBe(false);
    expect(store.get().sceneId).toBe("playground");
  });

  it("ignores a request for the scene that is already showing", () => {
    const log: string[] = [];
    const store = new GameStore();
    const scenes = new SceneManager(store, {
      title: () => fakeScene("title", log),
      playground: () => fakeScene("playground", log),
      credits: () => fakeScene("credits", log),
    });
    scenes.start("title");
    scenes.request("title");
    scenes.beginFrame(idle);
    expect(log).toEqual(["enter:title", "frame:title"]);
  });
});

describe("game loop", () => {
  function countSteps(seconds: number[], paused = false): { steps: number; remainder: number } {
    const loop = new GameLoop();
    let steps = 0;
    for (const raw of seconds) {
      const tick = loop.tick(raw, {
        paused,
        fixedUpdate: () => {
          steps += 1;
        },
        render: () => {},
      });
      if (paused) expect(tick.steps).toBe(0);
    }
    return { steps, remainder: loop.remainder };
  }

  it("turns 100 ms into six fixed steps", () => {
    expect(countSteps([0.1]).steps).toBe(6);
  });

  it("caps a long hitch at the maximum number of steps", () => {
    expect(countSteps([2]).steps).toBe(MAX_SUBSTEPS);
  });

  it("carries the remainder into the next frame", () => {
    const half = FIXED_STEP_SECONDS / 2;
    const first = countSteps([half]);
    expect(first.steps).toBe(0);
    expect(first.remainder).toBeGreaterThan(0);
    const loop = new GameLoop();
    let steps = 0;
    loop.tick(half, {
      paused: false,
      fixedUpdate: () => {
        steps += 1;
      },
      render: () => {},
    });
    const second = loop.tick(half, {
      paused: false,
      fixedUpdate: () => {
        steps += 1;
      },
      render: () => {},
    });
    expect(steps).toBe(1);
    expect(second.steps).toBe(1);
  });

  it("takes no steps while paused and does not bank the missed time", () => {
    const loop = new GameLoop();
    loop.tick(1, {
      paused: true,
      fixedUpdate: () => {
        throw new Error("paused frames must not step");
      },
      render: () => {},
    });
    const resumed = loop.tick(FIXED_STEP_SECONDS, {
      paused: false,
      fixedUpdate: () => {},
      render: () => {},
    });
    expect(resumed.steps).toBe(1);
    expect(loop.remainder).toBe(0);
  });

  it("produces the same step count at 60 Hz and 144 Hz", () => {
    const frames60 = Array.from({ length: 60 }, () => 1 / 60);
    const frames144 = Array.from({ length: 144 }, () => 1 / 144);
    expect(countSteps(frames60).steps).toBe(60);
    expect(countSteps(frames144).steps).toBe(60);
  });

  it("reads the frame rate from the raw frame time", () => {
    const loop = new GameLoop();
    for (let frame = 0; frame < 40; frame += 1) {
      loop.tick(0.1, { paused: true, fixedUpdate: () => {}, render: () => {} });
    }
    expect(loop.framesPerSecond).toBeGreaterThan(9);
    expect(loop.framesPerSecond).toBeLessThan(15);
  });
});

describe("game store", () => {
  it("notifies subscribers with the next state", () => {
    const store = new GameStore();
    const seen: string[] = [];
    const stop = store.subscribe((state) => seen.push(state.sceneId));
    store.set({ sceneId: "credits" });
    stop();
    store.set({ sceneId: "title" });
    expect(seen).toEqual(["credits"]);
    expect(store.get().sceneId).toBe("title");
  });
});
