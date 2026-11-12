# Architecture

Chaos Garden is a browser game. Milestone M0 keeps the pieces small: a renderer bootstrap, an input layer, a scene switcher, an in-memory store, and a gray-box yard. Later milestones fill in movement, levels, pets, and the garden. Nothing is written to disk. Refreshing the page clears the store.

The title string lives only in `GAME_TITLE` inside `src/config.ts`.

## Modules

| Path          | Role                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| `src/app`     | Wires the engine, input, scenes, and overlay together                                    |
| `src/core`    | Fixed-step game loop, scene manager, and in-memory store                                 |
| `src/input`   | Keyboard and Gamepad API mapped to named actions, with deadzones and remappable bindings |
| `src/player`  | Placeholder hero mesh and the simple run-and-jump motor                                  |
| `src/levels`  | Gray-box yard geometry                                                                   |
| `src/pets`    | Pure TypeScript growth and temperament rules. This folder imports only itself            |
| `src/garden`  | Names of the light, neutral, and dark gardens                                            |
| `src/ui`      | HTML overlay: title, HUD, pause menu, credits                                            |
| `src/audio`   | Silent bus until cues exist                                                              |
| `src/scenes`  | Title, yard, and credits scenes that the scene manager swaps                             |
| `src/content` | Asset manifest types and the credits markdown renderer                                   |

## Data flow

Each displayed frame, the bootstrap asks the input manager for a snapshot. The manager reads the keyboard, the pointer, and `navigator.getGamepads()`, then a pure function turns that snapshot into an `InputFrame`. Jump and other edge presses wait in a latch until a fixed step reads them. The game loop adds frame time to one accumulator and runs zero or more steps of 1/60 second, at most eight. Gameplay and physics both use that step. The frame then draws once, blending the previous pose and the latest pose. A paused frame adds no time and takes no steps, so the hero stays where it is.

The scene manager owns one active scene. A scene may request another id; the switch happens after the current update, so a scene is never disposed mid-update. Switching resets the paused flag and updates the store. The store notifies nothing on its own beyond subscribers: there is no save file and no network.

```mermaid
flowchart LR
  keys[Keyboard and gamepad] --> input[Input manager]
  input --> loop[Game loop]
  loop --> scenes[Scene manager]
  store[In-memory store] --> scenes
  scenes --> title[Title]
  scenes --> yard[Graybox yard]
  scenes --> credits[Credits]
  yard --> motor[Simple motor]
  motor --> physics[Havok]
  scenes --> overlay[HTML overlay]
```

The yard scene is the only one that turns on physics. It builds static boxes, drops the placeholder hero in, and sets linear velocity from the motor on each fixed step. The follow camera is placed after that step, on the blended pose. The real momentum controller replaces this motor later; the input frame stays the same. `src/core` does not import scenes or the overlay. `src/app` is the only place that connects them.

The overlay reads the active scene, the device label, and the frame rate. The pause menu reads the current binding table, so a remapped key shows up without a second list. The credits screen and `CREDITS.md` both come from `assets/manifest.json`.

Pet rules and garden names are not simulated yet. Pet modules import only other files under `src/pets`. ESLint rejects anything else written in a pet file, and the dependency check rejects a pet module that can reach the renderer or another source folder.
