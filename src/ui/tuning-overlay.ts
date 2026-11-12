import { TUNING_SCHEMA, cloneTuning, type PlayerTuning } from "../player/tuning";

/**
 * Live tuning sliders. Hidden until a named input asks for it, and never written to disk.
 * It is not part of the pause menu or the default HUD.
 */
export class TuningOverlay {
  private readonly readout: HTMLElement;
  private readonly valueLabels = new Map<keyof PlayerTuning, HTMLElement>();
  private visible = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly tuning: PlayerTuning,
  ) {
    this.root.replaceChildren();
    this.root.hidden = true;
    const heading = document.createElement("h2");
    heading.textContent = "Tuning";
    this.readout = document.createElement("p");
    this.readout.className = "tuning-readout";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset to defaults";
    reset.addEventListener("click", () => {
      this.apply(cloneTuning());
    });
    this.root.append(heading, this.readout, reset);

    let group = "";
    for (const field of TUNING_SCHEMA) {
      if (field.group !== group) {
        group = field.group;
        const title = document.createElement("h3");
        title.textContent = group;
        this.root.append(title);
      }
      const row = document.createElement("label");
      row.className = "tuning-row";
      const name = document.createElement("span");
      name.textContent = field.label;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(field.min);
      slider.max = String(field.max);
      slider.step = String(field.step);
      slider.value = String(this.tuning[field.key]);
      slider.dataset.tuningKey = field.key;
      const value = document.createElement("span");
      value.className = "tuning-value";
      value.textContent = formatValue(this.tuning[field.key]);
      this.valueLabels.set(field.key, value);
      slider.addEventListener("input", () => {
        const next = Number(slider.value);
        if (!Number.isFinite(next)) return;
        this.tuning[field.key] = next;
        value.textContent = formatValue(next);
      });
      row.append(name, slider, value);
      this.root.append(row);
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
  }

  setReadout(mode: string, speed: number, grounded: boolean): void {
    this.readout.textContent = `${mode}  ·  ${speed.toFixed(1)} m/s  ·  ${grounded ? "Grounded" : "Airborne"}`;
  }

  private apply(next: PlayerTuning): void {
    const keys = Object.keys(next) as (keyof PlayerTuning)[];
    for (const key of keys) this.tuning[key] = next[key];
    for (const slider of this.root.querySelectorAll("input[type=range]")) {
      if (!(slider instanceof HTMLInputElement)) continue;
      const key = slider.dataset.tuningKey as keyof PlayerTuning | undefined;
      if (!key) continue;
      slider.value = String(this.tuning[key]);
      const label = this.valueLabels.get(key);
      if (label) label.textContent = formatValue(this.tuning[key]);
    }
  }
}

function formatValue(value: number): string {
  const digits = Math.abs(value) >= 10 ? 1 : 2;
  return value.toFixed(digits);
}
