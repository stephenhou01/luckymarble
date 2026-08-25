(function runRewardBankTests(global) {
  "use strict";

  const results = [];
  const fixture = document.getElementById("fixture");
  let withdrawEvents = 0;
  let depositEvents = 0;
  const bank = new global.MarbleGame.RewardMarbleBank(fixture, {
    canvas: fixture.querySelector("canvas"),
    mouth: fixture.querySelector(".reward-bank-mouth"),
    autoStart: false,
    onWithdrawMarble: () => { withdrawEvents += 1; },
    onDepositMarble: () => { depositEvents += 1; },
  });
  bank.setVisualRadius(10);

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

  function advanceUntilIdle(maximumSeconds) {
    const maximumFrames = Math.ceil(maximumSeconds * 60);
    for (let frame = 0; frame < maximumFrames && !bank.isIdle(); frame += 1) {
      bank.advance(1 / 60);
    }
    if (!bank.isIdle()) throw new Error(`弹珠仓未在 ${maximumSeconds} 秒内完成`);
    return bank.getSnapshot();
  }

  function advanceLoopUntilIdle(maximumSeconds) {
    const maximumFrames = Math.ceil(maximumSeconds * 60);
    let maximumActive = 0;
    for (let frame = 0; frame < maximumFrames && !bank.isIdle(); frame += 1) {
      const snapshot = bank.advance(1 / 60);
      maximumActive = Math.max(maximumActive, snapshot.activeVisualCount);
    }
    if (!bank.isIdle()) throw new Error(`循环奖珠未在 ${maximumSeconds} 秒内完成`);
    return { snapshot: bank.getSnapshot(), maximumActive };
  }

  bank.reset(100);
  test("初始100分直接进入仓内且不播放动画", () => {
    const snapshot = bank.getSnapshot();
      equal(snapshot.storedCount, 100);
      equal(snapshot.visibleStoredCount, 100);
      equal(snapshot.renderedStoredCount, Math.min(100, snapshot.visualCapacity));
      equal(snapshot.overflow, false);
      assert(snapshot.visualCapacity >= 100 && snapshot.visualCapacity <= 180,
        `动态可视容量异常：${snapshot.visualCapacity}`);
      assert(snapshot.minimumStoredDistance >= snapshot.visualRadiusWorld * 2,
        `仓内弹珠发生重叠：${snapshot.minimumStoredDistance}`);
    equal(snapshot.mode, "idle");
    equal(snapshot.processedCount, 0);
  });

  test("存量球在0、1、容量边界、999、1000准确显示", () => {
    const capacity = bank.getSnapshot().visualCapacity;
    [0, 1, capacity, capacity + 1, 999, 1000].forEach((count) => {
      const snapshot = bank.reset(count);
      equal(snapshot.storedCount, count);
      equal(snapshot.visibleStoredCount, count);
      equal(snapshot.renderedStoredCount, Math.min(count, capacity));
      equal(snapshot.overflow, count > 999);
      equal(snapshot.visuallyTruncated, count > capacity);
    });
  });

  bank.reset(100);
  test("上分可在仓内连续即时累加", () => {
    bank.credit(100);
    bank.credit(500);
    const snapshot = bank.getSnapshot();
    equal(snapshot.storedCount, 700);
    equal(snapshot.visibleStoredCount, 700);
    equal(snapshot.renderedStoredCount, snapshot.visualCapacity);
  });

  bank.reset(100);
  withdrawEvents = 0;
  bank.withdraw(5);
  for (let frame = 0; frame < 8; frame += 1) bank.advance(1 / 60);
  const withdrawing = bank.getSnapshot();
  test("规则余额立即扣除而可视存量逐颗减少", () => {
    equal(withdrawing.storedCount, 95);
    assert(withdrawing.visibleStoredCount < 100 && withdrawing.visibleStoredCount >= 95);
  });
  const withdrawal = advanceUntilIdle(2);
  test("下注逐颗放出并立即扣除仓内余额", () => {
    equal(withdrawEvents, 5);
    equal(withdrawal.processedCount, 5);
    equal(withdrawal.storedCount, 95);
    equal(withdrawal.visibleStoredCount, 95);
  });

  depositEvents = 0;
  bank.deposit(10);
  const smallDeposit = advanceUntilIdle(4);
  test("小额中奖严格一分一颗且约3秒完成", () => {
    equal(depositEvents, 10);
    equal(smallDeposit.storedCount, 105);
    equal(smallDeposit.visibleStoredCount, 105);
    assert(smallDeposit.completedAt >= 2.3 && smallDeposit.completedAt <= 3.4,
      `10颗完成时间异常：${smallDeposit.completedAt}`);
    equal(smallDeposit.invalidRescues, 0);
  });

  bank.reset(999);
  depositEvents = 0;
  bank.deposit(1);
  const overflowDeposit = advanceUntilIdle(4);
  test("第1000颗入仓后保持动态满仓并进入999+状态", () => {
    equal(overflowDeposit.storedCount, 1000);
    equal(overflowDeposit.visibleStoredCount, 1000);
    equal(overflowDeposit.renderedStoredCount, overflowDeposit.visualCapacity);
    equal(overflowDeposit.overflow, true);
    equal(depositEvents, 1);
  });

  [100, 101, 300, 990, 1000].forEach((count) => {
    bank.reset(1);
    depositEvents = 0;
    bank.deposit(count);
    const { snapshot, maximumActive } = count > 100
      ? advanceLoopUntilIdle(6.6)
      : { snapshot: advanceUntilIdle(4.5), maximumActive: 0 };
    test(`${count}颗使用正确动画模式并准确结算`, () => {
      equal(snapshot.animationMode, count > 100 ? "loop" : "exact");
      equal(snapshot.storedCount, count + 1);
      equal(snapshot.visibleStoredCount, count + 1);
      equal(snapshot.logicalProcessedCount, count);
      equal(snapshot.processedCount, count);
      if (count > 100) {
        assert(snapshot.completedAt >= 5.8 && snapshot.completedAt <= 6.2,
          `${count}颗完成时间异常：${snapshot.completedAt}`);
        assert(maximumActive <= 24, `${count}颗活动代表球超过24：${maximumActive}`);
        assert(depositEvents > 0 && depositEvents < count,
          `${count}颗不应产生逐颗回调：${depositEvents}`);
        assert(snapshot.storageRedraws <= 90,
          `${count}颗静态层重绘次数过多：${snapshot.storageRedraws}`);
        assert(snapshot.renderFrames <= 190,
          `${count}颗大奖绘制帧数超过30fps预算：${snapshot.renderFrames}`);
        assert(snapshot.storedMarblesDrawn <= snapshot.visualCapacity,
          `${count}颗存量层发生重复全量绘制：${snapshot.storedMarblesDrawn}`);
      } else {
        equal(depositEvents, count);
      }
    });
  });

  test("大奖入仓过程中上分不会中断动画且最终余额准确", () => {
    bank.reset(10);
    bank.deposit(300);
    for (let frame = 0; frame < 60; frame += 1) bank.advance(1 / 60);
    bank.credit(1_000);
    const snapshot = advanceUntilIdle(6.6);
    equal(snapshot.storedCount, 1_310);
    equal(snapshot.logicalProcessedCount, 300);
    equal(snapshot.activeVisualCount, 0);
  });

  test("连续10次300颗和990颗循环不会累积活动对象", () => {
    for (let round = 0; round < 10; round += 1) {
      [300, 990].forEach((count) => {
        bank.reset(100 + round);
        bank.deposit(count);
        const { snapshot, maximumActive } = advanceLoopUntilIdle(6.6);
        equal(snapshot.storedCount, 100 + round + count);
        equal(snapshot.activeVisualCount, 0);
        assert(maximumActive <= 24, `第${round + 1}轮${count}颗活动对象超过24`);
        assert(snapshot.storageRedraws <= 90, `第${round + 1}轮${count}颗重绘次数过多`);
        assert(snapshot.renderFrames <= 190, `第${round + 1}轮${count}颗绘制帧数超过30fps预算`);
      });
    }
  });

  test("减少动态效果时大奖立即写入准确余额", () => {
    const reducedFixture = document.createElement("div");
    reducedFixture.style.cssText = "position:relative;width:115.2px;height:680px";
    reducedFixture.innerHTML = '<canvas style="width:100%;height:100%"></canvas><div class="reward-bank-mouth"></div>';
    document.body.appendChild(reducedFixture);
    const reducedBank = new global.MarbleGame.RewardMarbleBank(reducedFixture, {
      canvas: reducedFixture.querySelector("canvas"),
      mouth: reducedFixture.querySelector(".reward-bank-mouth"),
      autoStart: false,
      reducedMotion: true,
    });
    reducedBank.setVisualRadius(10);
    reducedBank.reset(10);
    const snapshot = reducedBank.deposit(1000);
    equal(snapshot.storedCount, 1010);
    equal(snapshot.logicalProcessedCount, 1000);
    equal(snapshot.activeVisualCount, 0);
    equal(snapshot.idle, true);
    reducedBank.destroy();
    reducedFixture.remove();
  });

  bank.reset(40);
  withdrawEvents = 0;
  bank.withdraw(10);
  for (let frame = 0; frame < 15; frame += 1) bank.advance(1 / 60);
  bank.withdraw(20);
  const appendedWithdrawal = advanceUntilIdle(4);
  test("进行中的续投追加放珠且不重置进度", () => {
    equal(withdrawEvents, 30);
    equal(appendedWithdrawal.targetCount, 30);
    equal(appendedWithdrawal.storedCount, 10);
  });

  test("不能取出超过仓内余额的弹珠", () => {
    let threw = false;
    try { bank.withdraw(11); } catch { threw = true; }
    assert(threw);
  });

  bank.destroy();
  const passed = results.filter((result) => result.passed).length;
  const summary = document.getElementById("summary");
  const output = document.getElementById("results");
  summary.textContent = `${passed}/${results.length} 项通过`;
  summary.className = passed === results.length ? "pass" : "fail";
  output.textContent = results.map((result) => (
    result.passed ? `✓ ${result.name}` : `✗ ${result.name}\n  ${result.error?.stack || result.error}`
  )).join("\n");
  document.documentElement.dataset.testStatus = passed === results.length ? "passed" : "failed";
  global.MarbleRewardBankTestResults = { results, withdrawal, smallDeposit };
})(window);
