(function runPhysicsSmoke(global) {
  "use strict";

  const powers = [0.08, 0.2, 0.38, 0.55, 0.72, 0.88, 1];
  const runs = [];

  function makeRng(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
      return value / 4_294_967_296;
    };
  }

  let failed = 0;
  powers.forEach((power, powerIndex) => {
    for (let sample = 0; sample < 40; sample += 1) {
      const result = global.MarbleGame.simulateLaunch(power, makeRng(1000 + powerIndex * 101 + sample));
      const valid = Number.isInteger(result.landing)
        && result.landing >= 0
        && result.landing < 12
        && result.elapsed <= 20
        && Number.isFinite(result.ball.x + result.ball.y)
        && result.ball.maxSubstepTravel <= result.ball.radius * 0.7;
      if (!valid) failed += 1;
      runs.push({ power, sample, landing: result.landing, elapsed: result.elapsed, valid });
    }
  });

  const geometry = global.MarbleGame.Geometry;
  const config = global.MarbleGame.CONFIG;
  const dividerSurface = geometry.playfield.launcherDividerX - 7 / 2;
  const requiredRightPegMaximum = dividerSurface
    - config.BALL_RADIUS * 2
    - geometry.pegs[0].radius
    - 2;
  const geometrySafe = geometry.safePegRight <= requiredRightPegMaximum + 0.001
    && geometry.pegs.every((peg) => peg.x <= geometry.safePegRight + 0.001);
  if (!geometrySafe) failed += 1;
  const collisionRhythmRuns = runs.filter((run) => run.power <= 0.55);
  const averageElapsed = collisionRhythmRuns.reduce((total, run) => total + run.elapsed, 0)
    / collisionRhythmRuns.length;
  const bumperRemovalSafe = geometry.bumpers.length === 0
    && geometry.collisionCircles.length === geometry.pegs.length
    && averageElapsed >= 3.4
    && averageElapsed <= 5.2;
  if (!bumperRemovalSafe) failed += 1;

  const curveSegments = [...geometry.launcherCurves.outer, ...geometry.launcherCurves.inner];
  const launcherGeometrySafe = geometry.launcherCurves.outer.length === 8
    && geometry.launcherCurves.inner.length === 8
    && curveSegments.every((segment) => geometry.segments.includes(segment))
    && geometry.launcherExit.x === 468
    && geometry.launcherExit.y === 78
    && config.BALL_RADIUS === 9.6;
  if (!launcherGeometrySafe) failed += 1;

  const meanSlot = (subset) => subset.reduce((total, run) => total + run.landing, 0) / subset.length;
  const lowMean = meanSlot(runs.filter((run) => run.power <= 0.2));
  const highMean = meanSlot(runs.filter((run) => run.power >= 0.88));
  const coveredSlots = new Set(runs.map((run) => run.landing));
  const regionsCovered = [
    runs.some((run) => run.landing <= 3),
    runs.some((run) => run.landing >= 4 && run.landing <= 7),
    runs.some((run) => run.landing >= 8),
  ].every(Boolean);
  const perPowerConcentrationSafe = powers.every((power) => {
    const counts = new Map();
    runs.filter((run) => run.power === power).forEach((run) => {
      counts.set(run.landing, (counts.get(run.landing) || 0) + 1);
    });
    return Math.max(...counts.values()) / 40 <= 0.35;
  });
  const powerDistributionSafe = lowMean - highMean >= 2
    && coveredSlots.size >= 10
    && regionsCovered
    && perPowerConcentrationSafe;
  if (!powerDistributionSafe) failed += 1;

  const pinWorld = new global.MarbleGame.PhysicsWorld();
  pinWorld.ball.active = true;
  pinWorld.ball.ejected = true;
  pinWorld.ball.x = geometry.playfield.launcherDividerX - config.BALL_RADIUS - 4;
  pinWorld.ball.y = geometry.pegs[geometry.pegs.length - 1].y;
  pinWorld.ball.vx = 0;
  pinWorld.ball.vy = 0;
  for (let index = 0; index < 60 && pinWorld.ball.rightPinRescues === 0; index += 1) {
    pinWorld.releaseRightPin(1 / 120, geometry.playfield.launcherDividerX - config.BALL_RADIUS - 4);
  }
  const pinReleaseSafe = pinWorld.ball.maxRightPinDuration <= 0.75
    && config.STALL_ASSIST_SCALE === 0.7;
  if (!pinReleaseSafe) failed += 1;

  const summary = document.getElementById("summary");
  const output = document.getElementById("results");
  summary.textContent = failed === 0
    ? `${runs.length}/${runs.length} 次模拟及防卡检查通过`
    : `${failed} 项物理检查失败`;
  summary.className = failed === 0 ? "pass" : "fail";
  output.textContent = runs.map((run) => (
    `${run.valid ? "✓" : "✗"} 力度 ${Math.round(run.power * 100)}% / 样本 ${run.sample + 1} / `
        + `落洞 ${run.landing === null ? "无" : run.landing + 1} / ${run.elapsed.toFixed(2)}s`
  )).join("\n")
    + `\n${geometrySafe ? "✓" : "✗"} 最右碰撞柱保留完整球径安全间隙`
    + `\n${bumperRemovalSafe ? "✓" : "✗"} 白色大柱为0且碰撞段平均飞行 ${averageElapsed.toFixed(2)} 秒`
    + `\n${launcherGeometrySafe ? "✓" : "✗"} 16段弧轨渲染与物理共享，真实半径9.6`
    + `\n${powerDistributionSafe ? "✓" : "✗"} 弱力度均值 ${lowMean.toFixed(2)} / 强力度均值 ${highMean.toFixed(2)} / 覆盖${coveredSlots.size}洞`
    + `\n${pinReleaseSafe ? "✓" : "✗"} 夹角接触保护小于0.75秒且辅助力为70%`;
  document.documentElement.dataset.testStatus = failed === 0 ? "passed" : "failed";
  global.MarblePhysicsTestResults = {
    runs,
    geometrySafe,
    bumperRemovalSafe,
    launcherGeometrySafe,
    powerDistributionSafe,
    lowMean,
    highMean,
    averageElapsed,
    pinReleaseSafe,
    pinBall: { ...pinWorld.ball },
  };
})(window);
