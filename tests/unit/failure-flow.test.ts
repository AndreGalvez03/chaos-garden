import { describe, expect, it } from "vitest";
import { GameStore } from "../../src/core/game-state";
import { SceneManager } from "../../src/core/scene-manager";
import { emptyInputFrame } from "../../src/input/types";
import { TitleScene } from "../../src/scenes/title-scene";
import { hasStartupFailure, showFailure, UiRoot } from "../../src/ui/overlay";
import type { AppContext } from "../../src/app/context";

class El {
  children: El[] = [];
  textContent = "";
  className = "";
  attrs: Record<string, string> = {};
  parent: El | null = null;

  constructor(public tag: string) {}

  replaceChildren(): void {
    this.children = [];
  }

  append(...nodes: El[]): void {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  setAttribute(key: string, value: string): void {
    this.attrs[key] = value;
  }

  addEventListener(): void {}

  focus(): void {
    documentShim.activeElement = this;
    focusedLabel = this.textContent;
  }

  querySelector(): null {
    return null;
  }
}

let focusedLabel = "";

const documentShim: { activeElement: El | null; createElement: (tag: string) => El } = {
  activeElement: null,
  createElement: (tag: string) => new El(tag),
};

function panelText(root: El): string {
  return root.children
    .map((panel) => panel.children.map((child) => child.textContent || child.tag).join(" | "))
    .join(" // ");
}

describe("startup failure", () => {
  it("keeps the error panel and focuses Retry after confirm", async () => {
    documentShim.activeElement = null;
    focusedLabel = "";
    Object.assign(globalThis, {
      document: documentShim,
      window: { location: { reload() {} } },
    });
    const root = new El("div");
    const ui = new UiRoot(root as unknown as HTMLElement, { assets: [] });
    const havok = Promise.reject(new Error("Havok wasm failed"));
    await havok.catch((error: unknown) => {
      showFailure(root as unknown as HTMLElement, error);
    });

    const retry = root.children[0]?.children.find((child) => child.textContent === "Retry");
    expect(root.children[0]?.attrs.role).toBe("alert");
    expect(panelText(root)).toContain("Havok wasm failed");
    expect(retry).toBeDefined();
    expect(focusedLabel).toBe("Retry");

    let requested = false;
    const store = new GameStore();
    const scenes = new SceneManager(
      store,
      {
        title: () => ({
          id: "title" as const,
          enter() {},
          exit() {},
          beginFrame() {},
          fixedUpdate() {},
          render() {},
        }),
        playground: () => ({
          id: "playground" as const,
          async enter() {
            ui.showLoading();
            await havok;
          },
          exit() {},
          beginFrame() {},
          fixedUpdate() {},
          render() {},
        }),
        credits: () => ({
          id: "credits" as const,
          enter() {},
          exit() {},
          beginFrame() {},
          fixedUpdate() {},
          render() {},
        }),
      },
      (error) => {
        showFailure(root as unknown as HTMLElement, error);
      },
      () => !hasStartupFailure(),
    );
    scenes.start("title");
    const title = new TitleScene({
      requestScene: (id) => {
        requested = true;
        scenes.request(id);
      },
    } as AppContext);
    title.beginFrame({ ...emptyInputFrame(), confirmPressed: true });
    scenes.beginFrame(emptyInputFrame());
    ui.showLoading();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requested).toBe(false);
    expect(scenes.currentId).toBe("title");
    expect(panelText(root)).toContain("Havok wasm failed");
    expect(panelText(root)).not.toContain("Loading");
    expect(panelText(root)).toContain("Retry");
    expect(focusedLabel).toBe("Retry");
  });
});
