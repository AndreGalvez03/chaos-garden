import { describe, expect, it } from "vitest";
import { add, length, scale, sub, type Vec3 } from "../../src/core/math";
import {
  buildLoopPath,
  closestLoop,
  LOOP_EXIT_DECK_DEPTH,
  LOOP_RADIUS,
  loopExitDeck,
  sampleLoop,
  type LoopCourse,
} from "../../src/core/loop-path";
import { buildSpline, closestOnSpline } from "../../src/core/spline";
import { FIXED_STEP_SECONDS } from "../../src/core/loop";
import {
  createControllerState,
  FALL_RESET_Y,
  respawnPoint,
  stepController,
  type ControllerState,
  type GroundQuery,
  type PlayerActions,
} from "../../src/player/controller";
import { DEFAULT_TUNING, type PlayerTuning } from "../../src/player/tuning";

const DT = FIXED_STEP_SECONDS;
const tuning = DEFAULT_TUNING;

interface Body {
  state: ControllerState;
  position: Vec3;
  velocity: Vec3;
  gravityFactor: number;
}

function body(patch: Partial<Body> = {}): Body {
  return {
    state: patch.state ?? createControllerState(),
    position: patch.position ?? { x: 0, y: 0, z: 0 },
    velocity: patch.velocity ?? { x: 0, y: 0, z: 0 },
    gravityFactor: patch.gravityFactor ?? 0,
  };
}

function actions(patch: Partial<PlayerActions> = {}): PlayerActions {
  return {
    wish: { x: 0, y: 0, z: 0 },
    balance: 0,
    throttle: 0,
    jumpHeld: false,
    jumpPressed: false,
    rollHeld: false,
    dashPressed: false,
    ...patch,
  };
}

function ground(patch: Partial<GroundQuery> = {}): GroundQuery {
  return {
    hit: true,
    normal: { x: 0, y: 1, z: 0 },
    surface: "ground",
    springDirection: null,
    ...patch,
  };
}

function step(
  current: Body,
  nextActions: PlayerActions,
  nextGround: GroundQuery,
  options: {
    rail?: ReturnType<typeof closestOnSpline> | null;
    loopCourse?: LoopCourse | null;
    targets?: readonly Vec3[];
    rules?: PlayerTuning;
  } = {},
): Body {
  const rules = options.rules ?? tuning;
  const output = stepController({
    state: current.state,
    position: current.position,
    velocity: current.velocity,
    actions: nextActions,
    ground: nextGround,
    rail: options.rail ?? null,
    loopCourse: options.loopCourse ?? null,
    targets: options.targets ?? [],
    dt: DT,
    tuning: rules,
  });
  const velocity = add(
    output.velocity,
    scale({ x: 0, y: -rules.gravity, z: 0 }, output.gravityFactor * DT),
  );
  const anchored = output.snap ?? current.position;
  return {
    state: output.state,
    velocity,
    position:
      output.ignoreLoopCollision && output.snap ? output.snap : add(anchored, scale(velocity, DT)),
    gravityFactor: output.gravityFactor,
  };
}

function planarSpeed(velocity: Vec3): number {
  return Math.hypot(velocity.x, velocity.z);
}

function surfaceSpeed(velocity: Vec3, normal: Vec3): number {
  const n = unit(normal.x, normal.y, normal.z);
  const into = velocity.x * n.x + velocity.y * n.y + velocity.z * n.z;
  return Math.hypot(velocity.x - n.x * into, velocity.y - n.y * into, velocity.z - n.z * into);
}

describe("controller states", () => {
  it("stays idle without input", () => {
    const next = step(body(), actions(), ground());
    expect(next.state.mode).toBe("idle");
    expect(planarSpeed(next.velocity)).toBeLessThan(tuning.idleSpeed);
  });

  it("runs when the stick is pushed", () => {
    const next = step(body(), actions({ wish: { x: 0, y: 0, z: 1 } }), ground());
    expect(next.state.mode).toBe("run");
    expect(next.velocity.z).toBeGreaterThan(0);
  });

  it("accelerates harder early in a run than near top speed", () => {
    let runner = body();
    const forward = actions({ wish: { x: 0, y: 0, z: 1 } });
    const samples: number[] = [];
    for (let frame = 0; frame < 50; frame += 1) {
      runner = step(runner, forward, ground());
      samples.push(planarSpeed(runner.velocity));
    }
    const early = samples[12]! - samples[0]!;
    const later = samples[36]! - samples[24]!;
    expect(early).toBeGreaterThan(later);
    expect(samples[49]!).toBeGreaterThan(tuning.topSpeed * 0.45);
    expect(samples[49]!).toBeLessThanOrEqual(tuning.topSpeed + 0.05);
  });

  it("lets a downhill slope outrun flat ground and an uphill slow it down", () => {
    const forward = actions({ wish: { x: 0, y: 0, z: 1 } });
    const flatGround = ground();
    const downGround = ground({ normal: unit(0, Math.cos(0.5), Math.sin(0.5)) });
    const upGround = ground({ normal: unit(0, Math.cos(0.5), -Math.sin(0.5)) });
    const flat = runFor(24, forward, flatGround);
    const down = runFor(24, forward, downGround);
    const up = runFor(24, forward, upGround);
    expect(surfaceSpeed(up.velocity, upGround.normal)).toBeLessThan(
      surfaceSpeed(flat.velocity, flatGround.normal),
    );
    expect(surfaceSpeed(flat.velocity, flatGround.normal)).toBeLessThan(
      surfaceSpeed(down.velocity, downGround.normal),
    );
  });

  it("jumps from the ground and then falls once the upward speed is spent", () => {
    let runner = body();
    let sawJump = false;
    let peak = 0;
    for (let frame = 0; frame < 160; frame += 1) {
      const held = frame < 20;
      runner = step(
        runner,
        actions({ jumpPressed: frame === 0, jumpHeld: held }),
        ground({ hit: frame === 0 }),
      );
      if (runner.state.mode === "jump") sawJump = true;
      peak = Math.max(peak, runner.position.y);
      if (sawJump && runner.state.mode === "fall") break;
    }
    expect(sawJump).toBe(true);
    expect(runner.state.mode).toBe("fall");
    expect(peak).toBeGreaterThan(0.4);
  });

  it("reaches a higher peak when the jump is held", () => {
    expect(peakJump(30)).toBeGreaterThan(peakJump(1) + 0.35);
  });

  it("lands in a run with the stick held and in idle without it", () => {
    const falling = body({
      state: { ...createControllerState(), mode: "fall", jumpTime: 1 },
      velocity: { x: 0, y: -4, z: 6 },
    });
    const running = step(falling, actions({ wish: { x: 0, y: 0, z: 1 } }), ground());
    const standing = step(
      body({
        state: { ...createControllerState(), mode: "fall", jumpTime: 1 },
        velocity: { x: 0, y: -4, z: 0 },
      }),
      actions(),
      ground(),
    );
    expect(running.state.mode).toBe("run");
    expect(standing.state.mode).toBe("idle");
    expect(running.state.dashSpent).toBe(false);
  });

  it("still jumps during coyote time and not after it expires", () => {
    let runner = step(body(), actions(), ground());
    runner = step(runner, actions({ jumpPressed: true, jumpHeld: true }), ground({ hit: false }));
    expect(runner.state.mode).toBe("jump");
    expect(runner.velocity.y).toBeGreaterThan(0);

    let late = step(body(), actions(), ground());
    for (let frame = 0; frame < 12; frame += 1) {
      late = step(late, actions(), ground({ hit: false }));
    }
    late = step(late, actions({ jumpPressed: true, jumpHeld: true }), ground({ hit: false }));
    expect(late.state.mode).not.toBe("jump");
  });

  it("does not jump from the air when there is no coyote time", () => {
    const airborne = step(
      body({ state: { ...createControllerState(), mode: "fall" } }),
      actions({ jumpPressed: true, jumpHeld: true }),
      ground({ hit: false }),
    );
    expect(airborne.state.mode).not.toBe("jump");
  });

  it("builds roll charge while the button is held", () => {
    let runner = body();
    const held = actions({ rollHeld: true });
    for (let frame = 0; frame < 20; frame += 1) runner = step(runner, held, ground());
    expect(runner.state.mode).toBe("rollCharge");
    expect(runner.state.rollCharge).toBeGreaterThan(0.4);
    expect(runner.state.rollCharge).toBeLessThanOrEqual(1);
  });

  it("bursts faster from a full charge than from a short one", () => {
    const full = releaseCharge(40);
    const short = releaseCharge(2);
    expect(full.state.mode).toBe("rollBurst");
    expect(short.state.mode).toBe("rollBurst");
    expect(planarSpeed(full.velocity)).toBeGreaterThan(planarSpeed(short.velocity) + 8);
    expect(planarSpeed(full.velocity)).toBeGreaterThan(tuning.rollBurstMax - 1);
  });

  it("returns to a run when the burst ends on the ground", () => {
    let runner = releaseCharge(10);
    const forward = actions({ wish: { x: 0, y: 0, z: 1 } });
    for (let frame = 0; frame < 40; frame += 1) runner = step(runner, forward, ground());
    expect(runner.state.mode).toBe("run");
  });

  it("dashes toward the nearest target inside the cone", () => {
    const runner = dashAt([
      { x: 3, y: 1, z: 8 },
      { x: 0, y: 1, z: 16 },
    ]);
    expect(runner.state.mode).toBe("lockOnDash");
    expect(runner.velocity.x).toBeGreaterThan(0);
    expect(runner.velocity.z).toBeGreaterThan(0);
    expect(runner.state.dashSpent).toBe(true);
  });

  it("dashes forward when no target sits in the cone", () => {
    const runner = dashAt([{ x: 0, y: 1, z: -8 }]);
    expect(runner.state.mode).toBe("lockOnDash");
    expect(runner.velocity.z).toBeGreaterThan(0);
    expect(Math.abs(runner.velocity.x)).toBeLessThan(1);
  });

  it("refuses a second air dash until the runner lands", () => {
    let runner = dashAt([{ x: 0, y: 1, z: 8 }]);
    for (let frame = 0; frame < 20; frame += 1) {
      runner = step(runner, actions(), ground({ hit: false }), {
        targets: [{ x: 8, y: 1, z: 2 }],
      });
    }
    expect(runner.state.mode).not.toBe("lockOnDash");
    const blocked = step(runner, actions({ dashPressed: true }), ground({ hit: false }), {
      targets: [{ x: 8, y: 1, z: 2 }],
    });
    expect(blocked.state.mode).not.toBe("lockOnDash");
    expect(blocked.velocity.x).toBeLessThan(4);

    let landed = step(blocked, actions(), ground());
    landed = step(landed, actions(), ground({ hit: false }));
    const again = step(landed, actions({ dashPressed: true }), ground({ hit: false }), {
      targets: [{ x: 0, y: 1, z: 8 }],
    });
    expect(again.state.mode).toBe("lockOnDash");
  });

  it("grinds along a rail, falls when balance is lost, and jumps off", () => {
    const spline = buildSpline(
      [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 10 },
        { x: 0, y: 1, z: 20 },
        { x: 0, y: 1, z: 240 },
      ],
      4,
    );
    let runner = body({
      position: { x: 0.2, y: 1.2, z: 2 },
      velocity: { x: 0, y: 0, z: 12 },
      state: { ...createControllerState(), mode: "fall" },
    });
    runner = step(runner, actions(), ground({ hit: false }), {
      rail: closestOnSpline(spline, runner.position),
    });
    expect(runner.state.mode).toBe("railGrind");
    const startZ = runner.position.z;
    for (let frame = 0; frame < 20; frame += 1) {
      runner = step(runner, actions(), ground({ hit: false }), {
        rail: closestOnSpline(spline, runner.position),
      });
    }
    expect(runner.state.mode).toBe("railGrind");
    expect(runner.position.z).toBeGreaterThan(startZ + 1);
    expect(Math.abs(runner.position.x)).toBeLessThan(0.5);

    let unbalanced = runner;
    for (let frame = 0; frame < 80 && unbalanced.state.mode === "railGrind"; frame += 1) {
      unbalanced = step(unbalanced, actions({ balance: 1 }), ground({ hit: false }), {
        rail: closestOnSpline(spline, unbalanced.position),
      });
    }
    expect(unbalanced.state.mode).toBe("fall");

    const hopped = step(runner, actions({ jumpPressed: true }), ground({ hit: false }), {
      rail: closestOnSpline(spline, runner.position),
    });
    expect(hopped.state.mode).toBe("jump");
    expect(hopped.velocity.y).toBeGreaterThan(tuning.railJumpSpeed - 1);
    const stillAirborne = step(hopped, actions(), ground({ hit: false }), {
      rail: closestOnSpline(spline, hopped.position),
    });
    expect(stillAirborne.state.mode).not.toBe("railGrind");
  });

  it("launches along a spring direction", () => {
    const launched = step(
      body(),
      actions(),
      ground({ surface: "spring", springDirection: { x: 0, y: 1, z: 0 } }),
    );
    expect(launched.state.mode).toBe("springLaunch");
    expect(launched.velocity.y).toBeGreaterThan(tuning.springPower - 1);
  });

  it("glues a fast runner to a curved surface and lets a slow one fall", () => {
    const ceiling = ground({ surface: "loop", normal: { x: 0, y: -1, z: 0 } });
    const fast = step(
      body({
        velocity: { x: 0, y: 0, z: -30 },
        state: { ...createControllerState(), mode: "run" },
      }),
      actions(),
      ceiling,
    );
    expect(fast.state.mode).toBe("loopRun");
    expect(fast.gravityFactor).toBe(0);
    expect(fast.velocity.y).toBeGreaterThan(0);

    const slow = step(
      body({ velocity: { x: 0, y: 0, z: -4 }, state: { ...createControllerState(), mode: "run" } }),
      actions(),
      ceiling,
    );
    expect(slow.state.mode).toBe("fall");
    expect(slow.gravityFactor).toBeGreaterThan(0);
  });

  it("reaches the full spring height without holding jump", () => {
    let runner = step(
      body(),
      actions(),
      ground({ surface: "spring", springDirection: { x: 0, y: 1, z: 0 } }),
    );
    let peak = runner.position.y;
    for (let frame = 0; frame < 160; frame += 1) {
      runner = step(runner, actions(), ground({ hit: false }));
      peak = Math.max(peak, runner.position.y);
    }
    const ideal = (tuning.springPower * tuning.springPower) / (2 * tuning.gravity);
    expect(peak).toBeGreaterThan(ideal * 0.75);
  });

  it("brakes to idle when the stick is released", () => {
    let runner = body({
      state: { ...createControllerState(), mode: "run" },
      velocity: { x: 0, y: 0, z: 20 },
    });
    for (let frame = 0; frame < 40; frame += 1) runner = step(runner, actions(), ground());
    expect(runner.state.mode).toBe("idle");
    expect(planarSpeed(runner.velocity)).toBeLessThan(tuning.idleSpeed);
  });

  it("leaves a loop ride when the floor is ordinary ground", () => {
    let runner = step(
      body({ velocity: { x: 0, y: 0, z: 30 } }),
      actions(),
      ground({ surface: "loop" }),
    );
    expect(runner.state.mode).toBe("loopRun");
    runner = step(runner, actions(), ground());
    expect(runner.state.mode).toBe("run");
    for (let frame = 0; frame < 80; frame += 1) runner = step(runner, actions(), ground());
    expect(planarSpeed(runner.velocity)).toBeLessThan(5);
  });

  it("does not treat a wall as a floor", () => {
    const runner = step(
      body({
        state: { ...createControllerState(), mode: "fall" },
        velocity: { x: 4, y: 0, z: 0 },
      }),
      actions({ wish: { x: 1, y: 0, z: 0 } }),
      ground({ hit: true, normal: { x: -1, y: 0, z: 0 }, surface: "ground" }),
    );
    expect(runner.state.mode).toBe("fall");
    expect(runner.gravityFactor).toBeGreaterThan(0);
    expect(runner.state.up.y).toBeGreaterThan(0.5);
  });

  it("homes a dash onto the target and then bleeds the extra speed", () => {
    const far = dashUntilDone([{ x: 0, y: 1, z: 12 }]);
    expect(far.position.z).toBeGreaterThan(10);
    expect(far.position.z).toBeLessThan(13.5);
    expect(planarSpeed(far.velocity)).toBeLessThanOrEqual(tuning.topSpeed + 0.2);

    const near = dashUntilDone([{ x: 0, y: 1, z: 2 }]);
    expect(near.position.z).toBeGreaterThan(1.2);
    expect(near.position.z).toBeLessThan(3.2);
  });

  it("keeps speed on a quick roll tap and still jumps, dashes, and enters the loop", () => {
    let runner = body();
    const forward = actions({ wish: { x: 0, y: 0, z: 1 } });
    for (let frame = 0; frame < 180; frame += 1) runner = step(runner, forward, ground());
    const before = planarSpeed(runner.velocity);
    runner = step(runner, actions({ ...forward, rollHeld: true }), ground());
    runner = step(runner, forward, ground());
    expect(runner.state.mode).toBe("rollBurst");
    expect(planarSpeed(runner.velocity)).toBeGreaterThan(before * 0.9);

    const hopped = step(runner, actions({ jumpPressed: true, jumpHeld: true }), ground());
    expect(hopped.state.mode).toBe("jump");
    expect(hopped.velocity.y).toBeGreaterThan(0);

    let airborne = releaseCharge(30);
    airborne = step(airborne, actions(), ground({ hit: false }));
    const dashed = step(airborne, actions({ dashPressed: true }), ground({ hit: false }), {
      targets: [{ x: 0, y: 1, z: 8 }],
    });
    expect(dashed.state.mode).toBe("lockOnDash");

    const course = buildLoopPath({
      mouth: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      radius: 7,
      lateralShift: 8,
      samples: 48,
    });
    const burst = body({
      state: {
        ...createControllerState(),
        mode: "rollBurst",
        burstTime: 0.3,
        facing: { x: 0, y: 0, z: 1 },
      },
      position: { x: 0, y: 0.6, z: 0 },
      velocity: { x: 0, y: 0, z: 40 },
    });
    const entered = step(burst, actions({ wish: { x: 0, y: 0, z: 1 } }), ground(), {
      loopCourse: course,
    });
    expect(entered.state.mode).toBe("loopRun");
    expect(entered.state.loopDistance).toBeGreaterThanOrEqual(0);
  });

  it("completes a radius 7 loop from a fast entry and falls off a slow one", () => {
    const course = buildLoopPath({
      mouth: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      radius: 7,
      lateralShift: 8,
      samples: 64,
    });
    let fast = body({
      state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
      position: { x: 0, y: 0.6, z: 0 },
      velocity: { x: 0, y: 0, z: 34 },
    });
    fast = step(fast, actions({ wish: { x: 0, y: 0, z: 1 } }), ground(), { loopCourse: course });
    expect(fast.state.mode).toBe("loopRun");
    for (let frame = 0; frame < 400 && fast.state.mode === "loopRun"; frame += 1) {
      fast = step(fast, actions(), ground({ hit: false }), { loopCourse: course });
    }
    expect(fast.state.mode).toBe("run");
    expect(fast.position.x).toBeGreaterThan(6);
    expect(Math.abs(fast.velocity.x)).toBeLessThan(Math.abs(fast.velocity.z) * 0.08);

    const accepted = rideLoop(course, tuning.loopEnterSpeed + 0.05);
    expect(accepted.state.mode).toBe("run");
    expect(accepted.position.x).toBeGreaterThan(6);

    const refused = step(
      body({
        state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
        position: { x: 0, y: 0.6, z: 0 },
        velocity: { x: 0, y: 0, z: tuning.loopEnterSpeed - 4 },
      }),
      actions({ wish: { x: 0, y: 0, z: 1 } }),
      ground(),
      { loopCourse: course },
    );
    expect(refused.state.mode).toBe("run");
    expect(refused.state.loopDistance).toBeLessThan(0);

    let dropping = body({
      state: {
        ...createControllerState(),
        mode: "loopRun",
        loopDistance: 8,
        loopSpeed: tuning.loopExitSpeed - 3,
        loopBlend: 1,
        facing: { x: 0, y: 0, z: 1 },
      },
      position: { x: 0, y: 1, z: 4 },
      velocity: { x: 0, y: 0, z: tuning.loopExitSpeed - 3 },
    });
    dropping = step(dropping, actions(), ground({ hit: false }), { loopCourse: course });
    expect(dropping.state.mode).toBe("fall");
  });

  it("eases onto the loop without a position or up-vector pop", () => {
    const course = loopCourse();
    const start = { x: 0.45, y: 0.7, z: 0.25 };
    const nearest = closestLoop(course, start);
    expect(nearest.gap).toBeLessThanOrEqual(tuning.loopGrab);
    expect(nearest.distance).toBeLessThanOrEqual(tuning.loopEntryWindow);
    const entered = step(
      body({
        state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
        position: start,
        velocity: { x: 0, y: 0, z: 32 },
      }),
      actions({ wish: { x: 0, y: 0, z: 1 } }),
      ground(),
      { loopCourse: course },
    );
    expect(entered.state.mode).toBe("loopRun");
    const moved = length(sub(entered.position, start));
    expect(moved).toBeGreaterThan(32 * DT * 0.75);
    expect(moved).toBeLessThan(32 * DT + 0.35);
  });

  it("grabs a lateral offset of 0.85 m and ignores one past it", () => {
    const course = loopCourse();
    const inside = step(
      body({
        state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
        position: { x: 0.85, y: tuning.probeHalfHeight, z: 0.2 },
        velocity: { x: 0, y: 0, z: 32 },
      }),
      actions({ wish: { x: 0, y: 0, z: 1 } }),
      ground(),
      { loopCourse: course },
    );
    const outside = step(
      body({
        state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
        position: { x: 1.05, y: tuning.probeHalfHeight, z: 0.2 },
        velocity: { x: 0, y: 0, z: 32 },
      }),
      actions({ wish: { x: 0, y: 0, z: 1 } }),
      ground(),
      { loopCourse: course },
    );
    expect(inside.state.mode).toBe("loopRun");
    expect(outside.state.mode).not.toBe("loopRun");
  });

  it("does not snap the up vector while blending onto the loop", () => {
    const course = loopCourse();
    for (const speed of [34, 40]) {
      let runner = body({
        state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
        position: { x: 0, y: tuning.probeHalfHeight, z: 0 },
        velocity: { x: 0, y: 0, z: speed },
      });
      let previousUp = { ...runner.state.up };
      let riding = false;
      for (let frame = 0; frame < 40; frame += 1) {
        const before = sampleLoop(course, Math.max(runner.state.loopDistance, 0));
        runner = step(runner, actions({ wish: { x: 0, y: 0, z: 1 } }), ground({ hit: false }), {
          loopCourse: course,
        });
        if (runner.state.mode !== "loopRun") continue;
        riding = true;
        const after = sampleLoop(course, runner.state.loopDistance);
        const frameTurn = angleBetween(before.up, after.up);
        const bodyTurn = angleBetween(previousUp, runner.state.up);
        expect(bodyTurn).toBeLessThan(frameTurn + (3 * Math.PI) / 180 + 1e-4);
        previousUp = { ...runner.state.up };
      }
      expect(riding).toBe(true);
    }
  });

  it("leaves the loop straight and lands on a deck that reaches the exit spring", () => {
    const course = loopCourse();
    const mouth = sampleLoop(course, 0);
    const exit = sampleLoop(course, course.spline.length);
    expect(Math.abs(mouth.tangent.x)).toBeLessThan(0.05);
    expect(Math.abs(exit.tangent.x)).toBeLessThan(0.05);
    expect(exit.tangent.z).toBeGreaterThan(0.9);
    const deck = loopExitDeck(exit.point);
    const half = LOOP_EXIT_DECK_DEPTH / 2;
    expect(deck.center.x).toBeCloseTo(exit.point.x, 5);
    expect(deck.center.z + half - exit.point.z).toBeGreaterThanOrEqual(25);
    const springZ = exit.point.z + 6;
    expect(springZ).toBeGreaterThan(deck.center.z - half);
    expect(springZ).toBeLessThan(deck.center.z + half);
  });

  it("respawns below the fall line onto the last safe point", () => {
    const safe = { x: 2, y: 1, z: 4 };
    expect(respawnPoint(FALL_RESET_Y, safe)).toBeNull();
    expect(respawnPoint(FALL_RESET_Y - 0.1, safe)).toEqual(safe);
  });

  it("jumps off a curved surface along its normal", () => {
    const entered = step(
      body({ velocity: { x: 0, y: 0, z: 30 } }),
      actions(),
      ground({ surface: "loop" }),
    );
    expect(entered.state.mode).toBe("loopRun");
    const hopped = step(entered, actions({ jumpPressed: true }), ground({ surface: "loop" }));
    expect(hopped.state.mode).toBe("jump");
    expect(hopped.velocity.y).toBeGreaterThan(tuning.jumpSpeed - 1);
  });
});

function angleBetween(from: Vec3, to: Vec3): number {
  const a = Math.hypot(from.x, from.y, from.z) || 1;
  const b = Math.hypot(to.x, to.y, to.z) || 1;
  const cosine = (from.x * to.x + from.y * to.y + from.z * to.z) / (a * b);
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

function loopCourse(): LoopCourse {
  return buildLoopPath({
    mouth: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    radius: LOOP_RADIUS,
    lateralShift: 8,
    samples: 64,
  });
}

function rideLoop(course: LoopCourse, alongSpeed: number): Body {
  const mouth = sampleLoop(course, 0);
  const tangentLength = Math.hypot(mouth.tangent.x, mouth.tangent.y, mouth.tangent.z) || 1;
  let runner = body({
    state: { ...createControllerState(), facing: { x: 0, y: 0, z: 1 } },
    position: { x: 0, y: 0.6, z: 0 },
    velocity: {
      x: (mouth.tangent.x * alongSpeed) / tangentLength,
      y: (mouth.tangent.y * alongSpeed) / tangentLength,
      z: (mouth.tangent.z * alongSpeed) / tangentLength,
    },
  });
  runner = step(runner, actions({ wish: { x: 0, y: 0, z: 1 } }), ground(), { loopCourse: course });
  expect(runner.state.mode).toBe("loopRun");
  for (let frame = 0; frame < 500 && runner.state.mode === "loopRun"; frame += 1) {
    runner = step(runner, actions(), ground({ hit: false }), { loopCourse: course });
  }
  return runner;
}

function runFor(frames: number, nextActions: PlayerActions, nextGround: GroundQuery): Body {
  let runner = body();
  for (let frame = 0; frame < frames; frame += 1) runner = step(runner, nextActions, nextGround);
  return runner;
}

function peakJump(holdFrames: number): number {
  let runner = body();
  let peak = 0;
  for (let frame = 0; frame < 180; frame += 1) {
    runner = step(
      runner,
      actions({ jumpPressed: frame === 0, jumpHeld: frame < holdFrames }),
      ground({ hit: frame === 0 }),
    );
    peak = Math.max(peak, runner.position.y);
  }
  return peak;
}

function releaseCharge(holdFrames: number): Body {
  let runner = body();
  for (let frame = 0; frame < holdFrames; frame += 1) {
    runner = step(runner, actions({ rollHeld: true }), ground());
  }
  return step(runner, actions({ rollHeld: false, wish: { x: 0, y: 0, z: 1 } }), ground());
}

function dashUntilDone(targets: readonly Vec3[]): Body {
  let runner = dashAt(targets);
  for (let frame = 0; frame < 80 && runner.state.mode === "lockOnDash"; frame += 1) {
    runner = step(runner, actions(), ground({ hit: false }), { targets });
  }
  return runner;
}

function dashAt(targets: readonly Vec3[]): Body {
  const falling = body({
    state: { ...createControllerState(), mode: "fall", facing: { x: 0, y: 0, z: 1 } },
    position: { x: 0, y: 1, z: 0 },
    velocity: { x: 0, y: 1, z: 4 },
  });
  return step(falling, actions({ dashPressed: true }), ground({ hit: false }), { targets });
}

function unit(x: number, y: number, z: number): Vec3 {
  const size = Math.hypot(x, y, z);
  return { x: x / size, y: y / size, z: z / size };
}
