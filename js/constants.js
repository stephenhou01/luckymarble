(function initConstants(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};

  const CONFIG = Object.freeze({
    INITIAL_BALANCE: 100,
    MANUAL_CREDIT_AMOUNTS: Object.freeze([100, 500, 1_000]),
    SKINS: Object.freeze([
      Object.freeze({ id: "classic", label: "经典乐园" }),
      Object.freeze({ id: "ocean", label: "深海水晶" }),
      Object.freeze({ id: "cosmic", label: "星际霓虹" }),
      Object.freeze({ id: "candy", label: "糖果乐园" }),
    ]),
    MIN_WAGER: 5,
    DEFAULT_WAGER_LIMIT: 100,
    WAGER_LIMIT_OPTIONS: Object.freeze([100, 200, 300]),
    MAX_WAGER: 300,
    CARD_POINTS_PER_CARD: 30,
    CARD_MAX_PER_ROUND: 9,
    MULTIPLIERS: Object.freeze([2, 4, 6, 8, 10]),
    MULTIPLIER_WEIGHTS: Object.freeze({ 2: 30, 4: 30, 6: 16, 8: 14, 10: 10 }),
    LIGHT_COUNT_BY_MULTIPLIER: Object.freeze({ 2: 4, 4: 3, 6: 2, 8: 1, 10: 1 }),
    SLOT_COUNT: 12,
    WORLD_WIDTH: 560,
    WORLD_HEIGHT: 720,
    BALL_RADIUS: 9.6,
    REVEAL_DURATION_MS: 1_100,
    RESULT_DURATION_MS: 1_500,
    MULTIPLIER_POPUP_MS: 1_200,
    POWER_MIN: 0.08,
    POWER_MAX: 1,
    POWER_SWEEP_MS: 1_200,
    FIXED_TIME_STEP: 1 / 240,
    MAX_FRAME_DELTA: 0.05,
    MAX_PHYSICS_SUBSTEPS: 8,
    MAX_SUBSTEP_TRAVEL_RATIO: 0.42,
    WAGER_PHYSICS_STEP: 1 / 120,
    WAGER_MARBLE_CADENCE_MS: 37,
    WAGER_GATE_DELAY_MS: 250,
    WAGER_ENTRY_SPEED_MULTIPLIER: 2,
    WAGER_WORLD_WIDTH: 600,
    WAGER_WORLD_HEIGHT: 100,
    REWARD_BANK_PHYSICS_STEP: 1 / 120,
    REWARD_LOOP_PHYSICS_STEP: 1 / 60,
    REWARD_BANK_WORLD_WIDTH: 115.2,
    REWARD_BANK_WORLD_HEIGHT: 680,
    REWARD_WITHDRAW_CADENCE_MS: 18,
    REWARD_FINISH_HOLD_MS: 400,
    REWARD_LOOP_THRESHOLD: 100,
    REWARD_LOOP_POOL_SIZE: 24,
    REWARD_LOOP_DURATION_MS: 6_000,
    REWARD_LOOP_RENDER_FPS: 30,
    REWARD_PROGRESS_FPS: 12,
    REWARD_CELEBRATION_TIMEOUT_MS: 7_000,
    STALL_ASSIST_SCALE: 0.7,
    RIGHT_PIN_RELEASE_SECONDS: 0.45,
    LAUNCHER_EXIT_MIN_VX: -520,
    LAUNCHER_EXIT_MAX_VX: -150,
    LAUNCHER_RESCUE_SECONDS: 1.4,
  });

  function sampleQuadraticCurve(start, control, end, segmentCount, properties) {
    const points = [];
    for (let index = 0; index <= segmentCount; index += 1) {
      const t = index / segmentCount;
      const inverse = 1 - t;
      points.push({
        x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
        y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
      });
    }
    return points.slice(0, -1).map((point, index) => ({
      ax: point.x,
      ay: point.y,
      bx: points[index + 1].x,
      by: points[index + 1].y,
      ...properties,
    }));
  }

  function createGeometry() {
    const playfield = Object.freeze({
      left: 22,
      right: 488,
      top: 14,
      bottom: 708,
      lampY: 574,
      dividerTop: 596,
      dividerBottom: 704,
      sensorY: 684,
      launcherDividerX: 506,
      launcherX: 530,
    });
    const slotWidth = (playfield.right - playfield.left) / CONFIG.SLOT_COUNT;
    const pegRadius = 7;
    const launcherDividerHalfThickness = 7 / 2;
    const pegBoundaryClearance = 2;
    const safePegRight = playfield.launcherDividerX
      - launcherDividerHalfThickness
      - CONFIG.BALL_RADIUS * 2
      - pegRadius
      - pegBoundaryClearance;
    const slotCenters = Array.from({ length: CONFIG.SLOT_COUNT }, (_, index) => (
      playfield.left + slotWidth * (index + 0.5)
    ));

    // Compatibility surface: the former large white bumper row is intentionally empty.
    const bumpers = [];

    const pegRows = [
      { y: 176, count: 8, start: 48, end: safePegRight },
      { y: 254, count: 9, start: 30, end: safePegRight },
      { y: 332, count: 8, start: 52, end: safePegRight },
      { y: 410, count: 9, start: 30, end: safePegRight },
      { y: 488, count: 8, start: 52, end: safePegRight },
    ];
    const pegs = [];
    pegRows.forEach(({ y, count, start, end }) => {
      const step = (end - start) / (count - 1);
      for (let index = 0; index < count; index += 1) {
        pegs.push({
          x: start + step * index,
          y,
          radius: pegRadius,
          restitution: 0.86,
          kind: "peg",
        });
      }
    });

    const launcherCurves = Object.freeze({
      outer: Object.freeze(sampleQuadraticCurve(
        { x: 552, y: 118 },
        { x: 552, y: 62 },
        { x: 486, y: 50 },
        8,
        { thickness: 7, restitution: 0.2, kind: "launcher-curve" },
      )),
      inner: Object.freeze(sampleQuadraticCurve(
        { x: 506, y: 132 },
        { x: 510, y: 90 },
        { x: 468, y: 78 },
        8,
        { thickness: 7, restitution: 0.2, kind: "launcher-curve" },
      )),
    });
    const launcherExit = Object.freeze({
      x: 468,
      y: 78,
      tangentX: -42,
      tangentY: -12,
      rescueAfter: CONFIG.LAUNCHER_RESCUE_SECONDS,
    });

    const segments = [
      { ax: 8, ay: 12, bx: 8, by: 708, thickness: 12, restitution: 0.7, kind: "outer" },
      { ax: 552, ay: 12, bx: 552, by: 708, thickness: 12, restitution: 0.7, kind: "outer" },
      { ax: 8, ay: 8, bx: 552, by: 8, thickness: 12, restitution: 0.72, kind: "outer" },
      { ax: 8, ay: 712, bx: 552, by: 712, thickness: 12, restitution: 0.3, kind: "outer" },
      {
        ax: playfield.launcherDividerX,
        ay: 128,
        bx: playfield.launcherDividerX,
        by: 706,
        thickness: 7,
        restitution: 0.56,
        kind: "launcher-divider",
      },
      { ax: 8, ay: 540, bx: playfield.left, by: playfield.dividerTop, thickness: 7, restitution: 0.54, kind: "funnel" },
      { ax: playfield.launcherDividerX, ay: 540, bx: playfield.right, by: playfield.dividerTop, thickness: 7, restitution: 0.54, kind: "funnel" },
      { ax: playfield.left, ay: playfield.dividerTop, bx: playfield.left, by: playfield.dividerBottom, thickness: 6, restitution: 0.45, kind: "divider" },
      { ax: playfield.right, ay: playfield.dividerTop, bx: playfield.right, by: playfield.dividerBottom, thickness: 6, restitution: 0.45, kind: "divider" },
      ...launcherCurves.outer,
      ...launcherCurves.inner,
    ];

    for (let index = 1; index < CONFIG.SLOT_COUNT; index += 1) {
      const x = playfield.left + slotWidth * index;
      segments.push({
        ax: x,
        ay: playfield.dividerTop,
        bx: x,
        by: playfield.dividerBottom,
        thickness: 6,
        restitution: 0.42,
        kind: "divider",
      });
    }

    return Object.freeze({
      playfield,
      safePegRight,
      slotWidth,
      slotCenters: Object.freeze(slotCenters),
      bumpers: Object.freeze(bumpers),
      pegs: Object.freeze(pegs),
      collisionCircles: Object.freeze([...pegs]),
      launcherCurves,
      launcherExit,
      segments: Object.freeze(segments),
    });
  }

  Game.CONFIG = CONFIG;
  Game.Geometry = Object.freeze(createGeometry());
})(window);
