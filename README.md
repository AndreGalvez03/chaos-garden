# Chaos Garden

Chaos Garden is a browser 3D action-platformer with a virtual-pet garden. You run through momentum-based levels, bring collectibles home, and raise pets in one of three gardens: light, neutral, or dark. The name is a placeholder and lives in one place, `GAME_TITLE` in `src/config.ts`.

This repository is milestone M1: the toolchain, the scene flow, and a tuned runner on a gray-box course. Nothing is saved. Game state lives in memory and disappears on refresh.

The dev server and the production build both use the `/chaos-garden/` base path, matching GitHub Pages at <https://andregalvez03.github.io/chaos-garden/>.

## Play locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173/chaos-garden/>.

```bash
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm run build` writes the static site to `dist/`. Preview it with `npm run preview` at <http://127.0.0.1:4173/chaos-garden/>.

## Controls

| Action | Keyboard                                         | Gamepad                     |
| ------ | ------------------------------------------------ | --------------------------- |
| Move   | W A S D                                          | Left stick                  |
| Camera | Arrow keys, or the mouse after clicking the view | Right stick                 |
| Jump   | Space (hold for a higher jump)                   | South button (A / Cross)    |
| Roll   | K (hold to charge, release to burst)             | West button (X / Square)    |
| Dash   | F (in the air, toward a beacon in front)         | North button (Y / Triangle) |
| Pause  | Esc                                              | Menu / Options              |
| Begin  | Enter                                            | Menu / Options              |

Sticks use a radial deadzone. Bindings can be replaced through the input module, and the pause menu lists the active map. Xbox and PlayStation pads that report the standard gamepad mapping are labeled automatically. Other pads keep generic names and the same standard indexes when the browser says the mapping is standard.

On the pause menu and the credits screen, the left stick or D-pad moves between buttons and the south button activates the focused one. Esc and the menu button always go back. Tab still moves focus. The course pauses if the window blurs, the tab is hidden, or the pointer lock ends. Simulation steps are fixed, so a pause leaves the runner where it is.

The yard continues into a terrace course: a long straight, a slope, a loop, a rail, two springs, and floating beacons. Run off a ledge or jump, then press Dash to home toward the nearest beacon in front of you. With no beacon in that cone, the dash goes forward and the extra speed bleeds off. Hold Roll and release it to burst; a quick tap keeps the speed you already have. Jump, dash, and the loop still work during a burst. Enter the loop near top speed and you ride the curve, then land on the deck beside the entrance. Drop below the exit speed and you fall off. Let go of the stick and you brake to a stop. Step onto a spring and you get the full launch without holding jump. Touch the rail while moving and you grind it; steer left or right to keep your balance, and jump to leave it.

The tuning overlay is hidden and is not listed in the pause menu. Press the backquote key, or hold both shoulder buttons (LB + RB / L1 + R1), to open it. Sliders edit the live numbers, and Reset to defaults restores them. Nothing is saved.

## Scripts

- `npm run dev` starts the development server.
- `npm test` runs the unit tests.
- `npm run test:e2e` builds the site and runs the browser smoke test.
- `npm run lint`, `npm run format:check`, and `npm run typecheck` check the source.
- `npm run check` checks the asset manifest, that `CREDITS.md` is current, and the name list.
- `npm run credits` regenerates `CREDITS.md`.
- `npm run check:bundle` checks the production build against the size budget. Run it after `npm run build`.
- `npm run build` writes `dist/`.

## Milestones

- **M0 Foundations.** Tooling, input, scene manager, in-memory state, gray-box yard, licensing checks, continuous integration, and the Pages workflow.
- **M1 Movement.** A tuned controller: roll burst, lock-on dash, grind rails, springs, and loops, plus a high-speed camera and a hidden tuning overlay.
- **M2 Journey.** A world map, several levels, and collectibles (fruit, small animals, and power orbs) that come back with you.
- **M3 Garden.** Three garden variants. Pets grow from egg to child to adult and lean light, neutral, or dark based on care and the items they receive.
- **M4 Release.** Audio, presentation, and the public GitHub Pages release.

## Licensing and credits

Code is MIT, copyright André Gálvez (`LICENSE`). Original art, music, and levels are CC-BY 4.0 (`ASSETS_LICENSE.md`).

Every file under `assets/` and `public/` has an entry in `assets/manifest.json` with its path, title, author, source, license, and whether it is original. `npm run credits` writes `CREDITS.md` from that manifest. The in-game credits screen reads the same manifest. Third-party assets are limited to CC0-1.0, CC-BY 3.0, CC-BY 4.0, MIT, and OFL-1.1.

Runtime dependencies keep their own licenses. `@babylonjs/core` is Apache-2.0. `@babylonjs/havok` is MIT.

A name check scans tracked files, and untracked files that are not ignored, against `config/name-denylist.json`. It fails when a denylisted name appears. That config file is the only excluded path.

## GitHub Pages

The Pages workflow publishes `dist/` only after the CI workflow has succeeded for that commit on `main`. In the repository settings, set the Pages source to **GitHub Actions** if it is not already, and require the `verify` check before merging to `main`.
