/** Move between menu buttons without taking the Tab key away. */
export function menuStep(axis: number, y: number): { axis: number; direction: -1 | 0 | 1 } {
  if (y > 0.55 && axis !== 1) return { axis: 1, direction: -1 };
  if (y < -0.55 && axis !== -1) return { axis: -1, direction: 1 };
  if (Math.abs(y) < 0.35) return { axis: 0, direction: 0 };
  return { axis, direction: 0 };
}

export class MenuCursor {
  private axis = 0;

  reset(): void {
    this.axis = 0;
  }

  update(inputY: number, jumpPressed: boolean, ui: MenuSurface): void {
    const step = menuStep(this.axis, inputY);
    this.axis = step.axis;
    if (step.direction !== 0) ui.moveMenuFocus(step.direction);
    if (jumpPressed) ui.activateMenuButton();
  }
}

export interface MenuSurface {
  moveMenuFocus(direction: -1 | 1): void;
  activateMenuButton(): void;
}
