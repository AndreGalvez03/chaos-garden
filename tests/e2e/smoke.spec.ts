import { expect, test } from "@playwright/test";
import { GAME_TITLE } from "../../src/config";

test("title screen enters the yard without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/chaos-garden/");
  await expect(page.getByRole("heading", { level: 1, name: GAME_TITLE })).toBeVisible();
  await expect(page.getByText("Press Start / Enter")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.locator("#overlay")).toHaveAttribute("data-scene", "playground");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate((element: HTMLCanvasElement) => element.width > 0 && element.height > 0),
    )
    .toBe(true);
  await expect(page.getByText("Keyboard")).toBeVisible();
  await expect(page.getByText(/FPS/)).toBeVisible();
  await expect(canvas).toHaveAttribute("data-course", "terrace");
  const startZ = Number(await canvas.getAttribute("data-runner-z"));
  expect(Number.isFinite(startZ)).toBe(true);

  await page.keyboard.down("KeyW");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-runner-z")), { timeout: 5000 })
    .toBeGreaterThan(startZ + 3);
  await page.keyboard.up("KeyW");

  await expect(page.locator("#tuning")).toBeHidden();
  await page.keyboard.press("Backquote");
  await expect(page.locator("#tuning")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset to defaults" })).toBeVisible();
  await page.keyboard.press("Backquote");
  await expect(page.locator("#tuning")).toBeHidden();

  await page.keyboard.down("w");
  await page.keyboard.down("Space");
  await page.waitForTimeout(400);
  await page.keyboard.up("Space");
  await page.keyboard.up("w");

  await page.keyboard.press("Escape");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Space")).toBeVisible();
  await expect(dialog.getByText("Esc")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Credits" }).click();
  await expect(page.locator("#overlay")).toHaveAttribute("data-scene", "credits");
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expect(page.getByText("CC-BY-4.0")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("#overlay")).toHaveAttribute("data-scene", "playground");

  expect(errors).toEqual([]);
});

test("credits are reachable from the title screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/chaos-garden/");
  await page.getByRole("button", { name: "Credits" }).click();
  await expect(page.locator("#overlay")).toHaveAttribute("data-scene", "credits");
  await expect(page.getByText("Sprout mark")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { level: 1, name: GAME_TITLE })).toBeVisible();
  expect(errors).toEqual([]);
});
