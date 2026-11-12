import { describe, expect, it } from "vitest";
import { GameStore } from "../../src/core/game-state";
import { GameLoop } from "../../src/core/loop";
import { SceneManager, type SceneController } from "../../src/core/scene-manager";
import type { InputFrame } from "../../src/input/types";

const idle = {} as InputFrame;

function fakeScene(id: SceneController["id"], log: string[]): SceneController {
  return {
    id,
    enter() {
      log.push(`enter:${id}`);
    },
    update() {
      log.push(`update:${id}`);
    },
    exit() {
      log.push(`exit:${id}`);
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
    scenes.update(0.016, idle, 60);
    expect(log).toEqual(["enter:title", "update:title", "exit:title", "enter:playground"]);
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
    scenes.update(0.016, idle, 60);
    expect(log).toEqual(["enter:title", "update:title"]);
  });
});

describe("game loop", () => {
  it("caps a long frame and keeps a finite frame rate", () => {
    const loop = new GameLoop();
    let seen = 0;
    loop.tick(2, (dt, fps) => {
      seen = dt;
      expect(fps).toBeGreaterThan(0);
      expect(Number.isFinite(fps)).toBe(true);
    });
    expect(seen).toBeLessThanOrEqual(0.05);
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
