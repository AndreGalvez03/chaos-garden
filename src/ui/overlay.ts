import type { AssetManifest } from "../content/assets";
import { GAME_TITLE } from "../config";
import { GARDEN_THEMES } from "../garden";
import type { SceneId } from "../core/game-state";
import type { ControlSection } from "./control-list";
import type { MenuSurface } from "./menu-nav";

export interface PlayHudState {
  paused: boolean;
  deviceLabel: string;
  fps: number;
  hint: string;
  controls: ControlSection[];
  onResume: () => void;
  onCredits: () => void;
}

export class UiRoot implements MenuSurface {
  private mode: SceneId | null = null;
  private pauseOpen = false;
  private pauseDevice = "";
  private deviceNode: HTMLElement | null = null;
  private fpsNode: HTMLElement | null = null;
  private hintNode: HTMLElement | null = null;
  private shownDevice = "";
  private shownHint = "";
  private shownFps = -1;
  private lastFpsWrite = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly manifest: AssetManifest,
  ) {}

  setScene(id: SceneId): void {
    this.root.dataset.scene = id;
  }

  showTitle(onStart: () => void, onCredits: () => void): void {
    this.mode = "title";
    this.pauseOpen = false;
    this.root.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "panel title-panel";

    const heading = document.createElement("h1");
    heading.textContent = GAME_TITLE;

    const lede = document.createElement("p");
    lede.className = "lede";
    lede.textContent = "Run and jump through a gray-box yard. Pets and gardens come later.";

    const gardens = document.createElement("p");
    gardens.className = "gardens";
    gardens.textContent = GARDEN_THEMES.map((theme) => theme.label).join(" · ");

    const prompt = document.createElement("p");
    prompt.className = "prompt";
    prompt.textContent = "Press Start / Enter";

    const row = document.createElement("div");
    row.className = "row";
    const start = button("Start", "primary", onStart);
    const credits = button("Credits", "", onCredits);
    row.append(start, credits);
    panel.append(heading, lede, gardens, prompt, row);
    this.root.append(panel);
    start.focus();
  }

  showCredits(onBack: () => void): void {
    this.mode = "credits";
    this.pauseOpen = false;
    this.root.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "panel credits-panel";

    const heading = document.createElement("h2");
    heading.textContent = "Credits";

    const note = document.createElement("p");
    note.className = "lede";
    note.textContent =
      "Code in this project is MIT. Original art, music, and levels are CC-BY 4.0.";

    const list = document.createElement("ul");
    for (const asset of this.manifest.assets) {
      const item = document.createElement("li");
      item.dataset.assetPath = asset.path;
      const title = document.createElement("h3");
      title.textContent = asset.title;
      const author = document.createElement("p");
      author.textContent = asset.author;
      const license = document.createElement("p");
      license.textContent = asset.license;
      const path = document.createElement("p");
      path.textContent = asset.path;
      item.append(title, author, license, path);
      if (asset.sourceUrl) {
        const link = document.createElement("a");
        link.href = asset.sourceUrl;
        link.textContent = asset.sourceUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        item.append(link);
      }
      list.append(item);
    }

    const back = button("Back", "primary", onBack);
    panel.append(heading, note, list, back);
    this.root.append(panel);
    requestAnimationFrame(() => {
      if (back.isConnected) back.focus();
    });
  }

  showPlay(state: PlayHudState): void {
    if (this.mode !== "playground") {
      this.mode = "playground";
      this.pauseOpen = false;
      this.shownDevice = "";
      this.shownHint = "";
      this.shownFps = -1;
      this.mountHud();
    }
    if (this.deviceNode && state.deviceLabel !== this.shownDevice) {
      this.deviceNode.textContent = state.deviceLabel;
      this.shownDevice = state.deviceLabel;
    }
    const roundedFps = Math.round(state.fps);
    const now = performance.now();
    if (
      this.fpsNode &&
      roundedFps !== this.shownFps &&
      (this.lastFpsWrite === 0 || now - this.lastFpsWrite >= 250)
    ) {
      this.fpsNode.textContent = `${roundedFps} FPS`;
      this.shownFps = roundedFps;
      this.lastFpsWrite = now;
    }
    if (this.hintNode && state.hint !== this.shownHint) {
      this.hintNode.textContent = state.hint;
      this.hintNode.hidden = state.hint.length === 0;
      this.shownHint = state.hint;
    }
    if (state.paused && this.pauseOpen && state.deviceLabel !== this.pauseDevice) {
      this.clearPause();
    }
    if (state.paused && !this.pauseOpen) {
      this.pauseDevice = state.deviceLabel;
      this.mountPause(state);
    }
    if (!state.paused && this.pauseOpen) this.clearPause();
  }

  moveMenuFocus(direction: -1 | 1): void {
    const buttons = [...this.root.querySelectorAll(".panel button")];
    if (buttons.length === 0) return;
    const current = buttons.findIndex((entry) => entry === document.activeElement);
    const start = current < 0 ? (direction > 0 ? -1 : 0) : current;
    const next = (start + direction + buttons.length) % buttons.length;
    const target = buttons[next];
    if (target instanceof HTMLButtonElement) target.focus();
  }

  activateMenuButton(): void {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && this.root.contains(active)) active.click();
  }

  private mountHud(): void {
    this.root.replaceChildren();
    const hud = document.createElement("div");
    hud.className = "hud";
    const place = document.createElement("p");
    place.className = "hud-place";
    place.textContent = "Graybox yard";
    this.deviceNode = document.createElement("p");
    this.fpsNode = document.createElement("p");
    this.hintNode = document.createElement("p");
    this.hintNode.className = "hud-hint";
    hud.append(place, this.deviceNode, this.fpsNode, this.hintNode);
    this.root.append(hud);
  }

  private mountPause(state: PlayHudState): void {
    this.pauseOpen = true;
    const panel = document.createElement("section");
    panel.className = "panel pause-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "pause-title");

    const heading = document.createElement("h2");
    heading.id = "pause-title";
    heading.textContent = "Paused";

    const intro = document.createElement("p");
    intro.className = "lede";
    intro.textContent = "Click the view, then move the mouse, to look around.";

    for (const section of state.controls) {
      const title = document.createElement("h3");
      title.textContent = section.heading;
      const grid = document.createElement("dl");
      grid.className = "control-grid";
      for (const row of section.rows) {
        const term = document.createElement("dt");
        term.textContent = row.action;
        const detail = document.createElement("dd");
        detail.textContent = row.binding;
        grid.append(term, detail);
      }
      panel.append(title, grid);
    }

    const row = document.createElement("div");
    row.className = "row";
    const resume = button("Resume", "primary", state.onResume);
    const credits = button("Credits", "", state.onCredits);
    row.append(resume, credits);
    panel.prepend(heading, intro);
    panel.append(row);
    this.root.append(panel);
    requestAnimationFrame(() => {
      if (resume.isConnected) resume.focus();
    });
  }

  private clearPause(): void {
    this.pauseOpen = false;
    this.root.querySelector(".pause-panel")?.remove();
  }
}

function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (variant) element.className = variant;
  element.addEventListener("click", onClick);
  return element;
}
