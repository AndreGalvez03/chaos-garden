import { GAME_TITLE } from "./config";
import { startGame } from "./app/bootstrap";
import "./ui/styles.css";

document.title = GAME_TITLE;

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const overlay = document.querySelector<HTMLElement>("#overlay");

if (!canvas || !overlay) {
  throw new Error("The game view is missing from the page.");
}

startGame(canvas, overlay).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "The view failed to start.";
  overlay.replaceChildren();
  const panel = document.createElement("section");
  panel.className = "panel";
  const heading = document.createElement("h1");
  heading.textContent = GAME_TITLE;
  const body = document.createElement("p");
  body.textContent = message;
  panel.append(heading, body);
  overlay.append(panel);
  console.error(error);
});
