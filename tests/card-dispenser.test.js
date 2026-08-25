(async function runCardDispenserTests(global) {
  "use strict";

  const results = [];
  const fixture = document.getElementById("fixture");
  const metrics = document.getElementById("fixture-metrics");
  const showcase = document.getElementById("fixture-showcase");
  const wait = (milliseconds) => new Promise((resolve) => global.setTimeout(resolve, milliseconds));

  async function test(name, callback) {
    try {
      await callback();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error });
    }
  }

  function assert(condition, message = "断言失败") {
    if (!condition) throw new Error(message);
  }

  function equal(actual, expected, message = "数值不一致") {
    if (actual !== expected) throw new Error(`${message}：得到 ${actual}，预期 ${expected}`);
  }

  const dispenser = new global.MarbleGame.CardDispenser(fixture, {
    showcase,
    metricsContainer: metrics,
    countElement: metrics.querySelector("[data-card-count]"),
    pointsElement: metrics.querySelector("[data-card-points]"),
    totalElement: metrics.querySelector("[data-card-total]"),
    progressElement: metrics.querySelector("[data-card-progress]"),
    statusElement: metrics.querySelector("[data-card-status]"),
    timings: { stagger: 5, move: 10, hold: 30, dismiss: 8, pointsPulse: 15 },
    reducedMotion: false,
  });

  await test("重置准确恢复累计卡片状态", () => {
    const snapshot = dispenser.reset({ points: 20, progress: 20, totalCards: 2 });
    equal(snapshot.visibleRewards.points, 20);
    equal(snapshot.visibleRewards.progress, 20);
    equal(snapshot.visibleRewards.totalCards, 2);
    assert(snapshot.idle);
    equal(showcase.children.length, 0);
  });

  await test("未满30分只更新内部进度且不改变卡片包数量", async () => {
    dispenser.timings.pointsPulse = 100;
    const active = dispenser.dispense({
      cardPointsAdded: 9,
      cardsAwarded: 0,
      cardsDiscarded: 0,
      cardRewards: { points: 29, progress: 29, totalCards: 2 },
    });
    equal(active.mode, "counting");
    equal(active.activeCount, 0);
    equal(metrics.querySelector("[data-card-count]").textContent, "2");
    await wait(35);
    assert(!fixture.textContent.includes("NaN"), "卡片分滚动期间不得出现 NaN");
    await wait(90);
    const finished = dispenser.getSnapshot();
    assert(finished.idle);
    equal(finished.visibleRewards.points, 29);
    equal(finished.visibleRewards.progress, 29);
    dispenser.timings.pointsPulse = 15;
  });

  await test("单张居中并完成弹出、停留、淡出", async () => {
    const active = dispenser.dispense({
      cardPointsAdded: 1,
      cardsAwarded: 1,
      cardsDiscarded: 0,
      cardRewards: { points: 30, progress: 0, totalCards: 3 },
    });
    equal(active.activeCount, 1);
    equal(showcase.dataset.columns, "1");
    await wait(220);
    const finished = dispenser.getSnapshot();
    assert(finished.idle);
    equal(finished.visibleRewards.totalCards, 3);
    equal(showcase.children.length, 0);
  });

  await test("2至4张使用两列阵列", async () => {
    dispenser.reset({ points: 30, progress: 0, totalCards: 3 });
    dispenser.timings.hold = 30;
    dispenser.dispense({
      cardPointsAdded: 120,
      cardsAwarded: 4,
      cardsDiscarded: 0,
      cardRewards: { points: 150, progress: 0, totalCards: 7 },
    });
    equal(showcase.dataset.columns, "2");
    equal(showcase.children.length, 4);
    await wait(250);
    assert(dispenser.isIdle());
  });

  await test("9张使用三列且超额状态不创建第10张", async () => {
    dispenser.reset({ points: 150, progress: 0, totalCards: 7 });
    dispenser.timings.hold = 30;
    dispenser.dispense({
      cardPointsAdded: 300,
      cardsAwarded: 9,
      cardsDiscarded: 1,
      cardRewards: { points: 450, progress: 0, totalCards: 16 },
    });
    equal(showcase.dataset.columns, "3");
    equal(showcase.children.length, 9);
    equal(dispenser.getSnapshot().visibleRewards.totalCards, 7);
    assert(metrics.textContent.includes("本局已满9张"));
    await wait(300);
    assert(dispenser.isIdle());
    equal(dispenser.getSnapshot().visibleRewards.totalCards, 16);
  });

  await test("重置取消未完成的9张动画", async () => {
    dispenser.reset({ points: 450, progress: 0, totalCards: 16 });
    dispenser.timings.hold = 120;
    dispenser.dispense({
      cardPointsAdded: 270,
      cardsAwarded: 9,
      cardsDiscarded: 0,
      cardRewards: { points: 720, progress: 0, totalCards: 25 },
    });
    await wait(18);
    dispenser.reset({ points: 720, progress: 0, totalCards: 25 });
    assert(dispenser.isIdle());
    equal(showcase.children.length, 0);
    await wait(150);
    assert(dispenser.isIdle(), "已取消的定时器不应重启动画");
  });

  await test("减少动态效果时跳过逐张位移并正常收尾", async () => {
    dispenser.reset({ points: 720, progress: 0, totalCards: 25 });
    dispenser.reducedMotion = true;
    dispenser.timings.hold = 20;
    dispenser.dispense({
      cardPointsAdded: 30,
      cardsAwarded: 1,
      cardsDiscarded: 0,
      cardRewards: { points: 750, progress: 0, totalCards: 26 },
    });
    await wait(180);
    assert(dispenser.isIdle());
    equal(dispenser.getSnapshot().visibleRewards.totalCards, 26);
    dispenser.reducedMotion = false;
  });

  await test("正式配置的卡片到位后停留3秒", () => {
    const defaultDispenser = new global.MarbleGame.CardDispenser(fixture, {
      showcase,
      metricsContainer: metrics,
      countElement: metrics.querySelector("[data-card-count]"),
      pointsElement: metrics.querySelector("[data-card-points]"),
      totalElement: metrics.querySelector("[data-card-total]"),
      progressElement: metrics.querySelector("[data-card-progress]"),
      statusElement: metrics.querySelector("[data-card-status]"),
    });
    equal(defaultDispenser.timings.hold, 3_000);
    defaultDispenser.destroy();
  });

  dispenser.destroy();
  const passed = results.filter((result) => result.passed).length;
  const summary = document.getElementById("summary");
  const output = document.getElementById("results");
  summary.textContent = `${passed}/${results.length} 项通过`;
  summary.className = passed === results.length ? "pass" : "fail";
  output.textContent = results.map((result) => (
    result.passed ? `✓ ${result.name}` : `✗ ${result.name}\n  ${result.error?.stack || result.error}`
  )).join("\n");
  document.documentElement.dataset.testStatus = passed === results.length ? "passed" : "failed";
  global.MarbleCardDispenserTestResults = results;
})(window);
