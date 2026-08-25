(function runWagerQueueTests(global) {
  "use strict";

  const results = [];
  const fixture = document.getElementById("fixture");
  const countElement = fixture.querySelector("[data-stake-count]");
  const inlet = fixture.querySelector(".stake-inlet");
  const canvas = fixture.querySelector("canvas");
  let enteredEvents = 0;
  const queue = new global.MarbleGame.WagerMarbleQueue(fixture, {
    canvas,
    countElement,
    inlet,
    autoStart: false,
    onEnter: () => { enteredEvents += 1; },
  });
  queue.setVisualRadius(10);

  function test(name, callback) {
    try {
      callback();
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

  function feedAndAdvanceUntilIdle(maximumSeconds = 10) {
    const maximumFrames = Math.ceil(maximumSeconds * 60);
    const releaseInterval = global.MarbleGame.CONFIG.REWARD_WITHDRAW_CADENCE_MS / 1000;
    let releaseClock = 1;
    for (let frame = 0; frame < maximumFrames && !queue.isIdle(); frame += 1) {
      releaseClock += 1 / 60;
      while (queue.getSnapshot().pendingCount > 0 && releaseClock >= releaseInterval) {
        releaseClock -= releaseInterval;
        queue.feedFromBank(1);
      }
      queue.advance(1 / 60);
    }
    if (!queue.isIdle()) throw new Error(`物理投珠未在 ${maximumSeconds} 秒内结束`);
    return queue.getSnapshot();
  }

  queue.reset(5);
  queue.setDraft(50);
  test("开始前修改下注不会生成弹珠", () => {
    const snapshot = queue.getSnapshot();
    equal(snapshot.targetCount, 50);
    equal(snapshot.visibleCount, 0);
    equal(snapshot.enteredCount, 0);
    equal(snapshot.started, false);
    equal(snapshot.idle, true);
  });

  enteredEvents = 0;
  queue.reset(1);
  queue.startCommit(1);
  queue.feedFromBank(1);
  let sawSinking = false;
  for (let frame = 0; frame < 720 && !queue.isIdle(); frame += 1) {
    queue.advance(1 / 120);
    const snapshot = queue.getSnapshot();
    if (snapshot.sinkingCount > 0) {
      sawSinking = true;
      test("筹码球越过洞沿后仍执行吸入动画", () => {
        equal(snapshot.enteredCount, 0, "吸入完成前不能计数");
        equal(snapshot.idle, false, "吸入完成前不能开放发射");
        assert(snapshot.holeGlow > 0, "吸入时黑洞必须发光");
      });
      break;
    }
  }
  test("能够观察到独立黑洞吸入阶段", () => assert(sawSinking));
  while (!queue.isIdle()) queue.advance(1 / 120);
  test("完全消失后才产生一次入洞事件", () => {
    equal(queue.getSnapshot().enteredCount, 1);
    equal(enteredEvents, 1);
  });

  enteredEvents = 0;
  queue.startCommit(50);
  test("点击开始后投珠进入忙碌状态", () => {
    equal(queue.isIdle(), false);
    equal(queue.getSnapshot().pendingCount, 50);
    equal(queue.getSnapshot().entrySpeedMultiplier, 2);
  });
  const fiftyResult = feedAndAdvanceUntilIdle(8);
  test("50 颗全部从左下洞口进入", () => {
    equal(fiftyResult.enteredCount, 50);
    equal(enteredEvents, 50);
    assert(fiftyResult.exitXMin >= 20 && fiftyResult.exitXMax <= 86, "出口不在左下洞口范围");
    assert(fiftyResult.sourceXMin >= 560 && fiftyResult.sourceXMax <= 584, "弹珠未从右侧积分仓入口出现");
    equal(fiftyResult.invalidRescues, 0, "不应出现无效物理状态");
  });
  test("50 颗以2倍入口速度完成且保持真实堆积", () => {
    assert(fiftyResult.completedAt >= 4 && fiftyResult.completedAt <= 6.2,
      `物理完成时间应为 4-6.2 秒，实际 ${fiftyResult.completedAt?.toFixed(2)} 秒`);
    assert(fiftyResult.maxVisibleCount >= 12, "同时可见弹珠不足，未形成存量");
    assert(fiftyResult.maxPileRows >= 2, "没有形成两层以上堆积");
  });

  enteredEvents = 0;
  queue.reset(10);
  queue.startCommit(10);
  let releaseClock = 1;
  const releaseInterval = global.MarbleGame.CONFIG.REWARD_WITHDRAW_CADENCE_MS / 1000;
  for (let frame = 0; frame < 78; frame += 1) {
    releaseClock += 1 / 60;
    while (queue.getSnapshot().pendingCount > 0 && releaseClock >= releaseInterval) {
      releaseClock -= releaseInterval;
      queue.feedFromBank(1);
    }
    queue.advance(1 / 60);
  }
  const beforeAdd = queue.getSnapshot();
  queue.addStock(20);
  const afterAdd = queue.getSnapshot();
  test("续投只增加存量且保留已入洞进度", () => {
    equal(afterAdd.targetCount, 30);
    equal(afterAdd.enteredCount, beforeAdd.enteredCount);
    equal(afterAdd.stockCount, beforeAdd.stockCount + 20);
  });
  const addedResult = feedAndAdvanceUntilIdle(8);
  test("续投后累计恰好投入 30 颗", () => {
    equal(addedResult.enteredCount, 30);
    equal(enteredEvents, 30);
  });

  enteredEvents = 0;
  queue.reset(99);
  queue.startCommit(99);
  const maximumResult = feedAndAdvanceUntilIdle(12);
  test("99颗放大弹珠仍全部滚入左下黑洞", () => {
    equal(maximumResult.enteredCount, 99);
    equal(enteredEvents, 99);
    equal(maximumResult.invalidRescues, 0);
  });

  queue.destroy();
  const passed = results.filter((result) => result.passed).length;
  const summary = document.getElementById("summary");
  const output = document.getElementById("results");
  summary.textContent = `${passed}/${results.length} 项通过`;
  summary.className = passed === results.length ? "pass" : "fail";
  output.textContent = results.map((result) => (
    result.passed ? `✓ ${result.name}` : `✗ ${result.name}\n  ${result.error?.stack || result.error}`
  )).join("\n");
  document.documentElement.dataset.testStatus = passed === results.length ? "passed" : "failed";
  global.MarbleWagerQueueTestResults = { results, fiftyResult, addedResult, maximumResult };
})(window);
