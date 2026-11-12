import { GAME_TITLE } from "./config";
import { startGame } from "./app/bootstrap";
import { showFailure } from "./ui/overlay";
import "./ui/styles.css";

document.title = GAME_TITLE;

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const overlay = document.querySelector<HTMLElement>("#overlay");

if (!canvas || !overlay) {
  throw new Error("The game view is missing from the page.");
}

startGame(canvas, overlay).catch((error: unknown) => {
  showFailure(overlay, error);
});
