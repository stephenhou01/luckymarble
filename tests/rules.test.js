(function runRuleTests(global) {
  "use strict";

  const Rules = global.MarbleGame.Rules;
  const C = global.MarbleGame.CONFIG;
  const results = [];

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

  function throws(callback, message = "预期应抛出错误") {
    let didThrow = false;
    try { callback(); } catch { didThrow = true; }
    if (!didThrow) throw new Error(message);
  }

  function sequenceRng(values, fallback = 0) {
    const queue = [...values];
    return () => queue.length ? queue.shift() : fallback;
  }

  test("以 100 分和 5 分下注草稿开局", () => {
    const state = Rules.createGameState();
    equal(state.balance, 100);
    equal(state.draftWager, 5);
    equal(state.wagerLimit, 100);
    equal(state.cardRewards.points, 0);
    equal(state.cardRewards.progress, 0);
    equal(state.cardRewards.totalCards, 0);
  });

  test("上分可重复累加且不计入中奖、统计或卡片分", () => {
    const initial = Rules.createGameState();
    const credited = Rules.creditBalance(Rules.creditBalance(initial, 100), 500);
    equal(credited.balance, 700);
    equal(credited.stats.totalPayout, 0);
    equal(credited.cardRewards.points, 0);
    equal(initial.balance, 100, "上分不得修改原状态");
    throws(() => Rules.creditBalance(initial, 0));
    throws(() => Rules.creditBalance(initial, -100));
  });

  test("回合进行中上分只增加可用余额且不改已锁定倍率与下注", () => {
    const started = Rules.startRound(Rules.createGameState(), 10, () => 0);
    const credited = Rules.creditBalance(started, 1_000);
    equal(credited.balance, 1_090);
    equal(credited.activeRound.wager, 10);
    equal(credited.activeRound.multiplier, started.activeRound.multiplier);
  });

  test("下注最低5分、默认上限100分且不能超过余额", () => {
    assert(Rules.validateWager(5, 100));
    assert(Rules.validateWager(99, 100));
    assert(Rules.validateWager(100, 100));
    assert(!Rules.validateWager(4, 100));
    assert(!Rules.validateWager(101, 500));
  });

  test("投注上限可切换100、200、300并收窄下注草稿", () => {
    let state = Rules.createGameState(500);
    state = Rules.setWagerLimit(state, 300);
    state = Rules.setDraftWager(state, 300);
    equal(state.wagerLimit, 300);
    equal(state.draftWager, 300);
    state = Rules.setWagerLimit(state, 100);
    equal(state.draftWager, 100);
    assert(!Rules.validateWager(101, 500, state.wagerLimit));
    throws(() => Rules.setWagerLimit(state, 250));
  });

  test("五档倍率按30/30/16/14/10权重边界映射", () => {
    const samples = [
      [0, 2], [0.299999, 2],
      [0.3, 4], [0.599999, 4],
      [0.6, 6], [0.759999, 6],
      [0.76, 8], [0.899999, 8],
      [0.9, 10], [0.999999, 10],
    ];
    samples.forEach(([value, expected]) => equal(Rules.randomMultiplier(() => value), expected));
  });

  test("一万等距样本精确落在30/30/16/14/10分布", () => {
    const counts = Object.fromEntries(C.MULTIPLIERS.map((value) => [value, 0]));
    for (let index = 0; index < 10_000; index += 1) {
      const value = (index + 0.5) / 10_000;
      counts[Rules.randomMultiplier(() => value)] += 1;
    }
    equal(counts[2], 3_000);
    equal(counts[4], 3_000);
    equal(counts[6], 1_600);
    equal(counts[8], 1_400);
    equal(counts[10], 1_000);
  });

  test("倍率对应 4/3/2/1/1 个中奖灯", () => {
    equal(Rules.getLightCount(2), 4);
    equal(Rules.getLightCount(4), 3);
    equal(Rules.getLightCount(6), 2);
    equal(Rules.getLightCount(8), 1);
    equal(Rules.getLightCount(10), 1);
  });

  test("宝宝模式将中奖灯增至两倍且不超过12个洞", () => {
    equal(Rules.getLightCount(2, true), 8);
    equal(Rules.getLightCount(4, true), 6);
    equal(Rules.getLightCount(6, true), 4);
    equal(Rules.getLightCount(8, true), 2);
    equal(Rules.getLightCount(10, true), 2);
  });

  test("中奖洞唯一且均位于 0-11", () => {
    C.MULTIPLIERS.forEach((multiplier) => {
      let value = 0x12345678;
      const rng = () => {
        value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
        return value / 4_294_967_296;
      };
      const holes = Rules.pickLitHoles(multiplier, rng);
      equal(holes.length, Rules.getLightCount(multiplier));
      equal(new Set(holes).size, holes.length);
      assert(holes.every((hole) => hole >= 0 && hole < 12));
    });
  });

  test("宝宝模式在开始时锁定本回合的两倍中奖洞", () => {
    const state = Rules.startRound(
      Rules.createGameState(),
      10,
      sequenceRng([0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      { babyMode: true },
    );
    equal(state.activeRound.multiplier, 4);
    equal(state.activeRound.litHoles.length, 6);
    equal(state.activeRound.babyMode, true);
    equal(new Set(state.activeRound.litHoles).size, 6);
  });

  test("开始时扣除初始下注并公开倍率", () => {
    const state = Rules.startRound(Rules.createGameState(), 10, sequenceRng([0.3, 0, 0, 0]));
    equal(state.balance, 90);
    equal(state.activeRound.multiplier, 4);
    equal(state.activeRound.wager, 10);
  });

  test("倍率公开后只能续投并立即扣分", () => {
    const started = Rules.startRound(Rules.createGameState(), 10, () => 0);
    const raised = Rules.increaseRoundWager(started, 18);
    equal(raised.balance, 82);
    equal(raised.activeRound.wager, 18);
    throws(() => Rules.increaseRoundWager(raised, 7));
  });

  test("锁注后不能继续修改下注", () => {
    const started = Rules.startRound(Rules.createGameState(), 10, () => 0);
    const locked = Rules.lockRound(started);
    throws(() => Rules.increaseRoundWager(locked, 11));
  });

  test("下注 10 命中 4 倍时返还 40，净赚 30", () => {
    const started = Rules.startRound(Rules.createGameState(), 10, sequenceRng([0.3, 0, 0, 0]));
    const settled = Rules.settleRound(Rules.lockRound(started), 0);
    equal(settled.lastResult.payout, 40);
    equal(settled.lastResult.netProfit, 30);
    equal(settled.balance, 130);
  });

  test("未命中时保留已扣除的余额", () => {
    const started = Rules.startRound(Rules.createGameState(), 10, () => 0);
    const settled = Rules.settleRound(Rules.lockRound(started), 11);
    equal(settled.lastResult.payout, 0);
    equal(settled.balance, 90);
    equal(settled.stats.losses, 1);
  });

  test("同一回合不能重复结算", () => {
    const started = Rules.startRound(Rules.createGameState(), 10, () => 0);
    const settled = Rules.settleRound(Rules.lockRound(started), 0);
    throws(() => Rules.settleRound(settled, 0));
  });

  test("卡片分按30分换卡并保留不足30分余数", () => {
    const cases = [
      [29, 0, 29],
      [30, 1, 0],
      [59, 1, 29],
      [60, 2, 0],
      [270, 9, 0],
    ];
    cases.forEach(([payout, expectedCards, expectedProgress]) => {
      const reward = Rules.calculateCardReward(null, payout);
      equal(reward.cardRewards.points, payout);
      equal(reward.cardsAwarded, expectedCards);
      equal(reward.cardRewards.progress, expectedProgress);
      equal(reward.cardsDiscarded, 0);
    });
  });

  test("跨局20加10卡片分正确获得1张卡", () => {
    const first = Rules.calculateCardReward(null, 20);
    const second = Rules.calculateCardReward(first.cardRewards, 10);
    equal(first.cardsAwarded, 0);
    equal(first.cardRewards.progress, 20);
    equal(second.cardsAwarded, 1);
    equal(second.cardRewards.points, 30);
    equal(second.cardRewards.progress, 0);
    equal(second.cardRewards.totalCards, 1);
  });

  test("单局300分只发9张且超出1张永久作废", () => {
    const first = Rules.calculateCardReward(null, 300);
    equal(first.cardsAwarded, 9);
    equal(first.cardsDiscarded, 1);
    equal(first.cardRewards.points, 300);
    equal(first.cardRewards.totalCards, 9);
    equal(first.cardRewards.progress, 0);

    const second = Rules.calculateCardReward(first.cardRewards, 30);
    equal(second.cardsAwarded, 1, "上局作废卡片不能在下局补发");
    equal(second.cardsDiscarded, 0);
    equal(second.cardRewards.totalCards, 10);
  });

  test("累计卡片分和总卡数没有全局上限", () => {
    const reward = Rules.calculateCardReward({ points: 9_990, progress: 0, totalCards: 333 }, 270);
    equal(reward.cardRewards.points, 10_260);
    equal(reward.cardRewards.totalCards, 342);
    equal(reward.cardsAwarded, 9);
  });

  test("回合结算快照包含发卡与作废差量", () => {
    const started = Rules.startRound(Rules.createGameState(), 30, sequenceRng([0.9, 0]));
    const settled = Rules.settleRound(Rules.lockRound(started), started.activeRound.litHoles[0]);
    equal(settled.lastResult.payout, 300);
    equal(settled.lastResult.cardPointsAdded, 300);
    equal(settled.lastResult.cardsAwarded, 9);
    equal(settled.lastResult.cardsDiscarded, 1);
    equal(settled.cardRewards.points, 300);
    equal(settled.cardRewards.totalCards, 9);
  });

  test("下一轮保留上一轮下注并按余额收窄", () => {
    let state = Rules.startRound(Rules.createGameState(12), 10, () => 0);
    state = Rules.settleRound(Rules.lockRound(state), 11);
    state = Rules.prepareNextRound(state);
    equal(state.balance, 2);
    equal(state.draftWager, 5);
  });

  const passed = results.filter((result) => result.passed).length;
  const summary = document.getElementById("summary");
  const output = document.getElementById("results");
  summary.textContent = `${passed}/${results.length} 项通过`;
  summary.className = passed === results.length ? "pass" : "fail";
  output.textContent = results.map((result) => (
    result.passed ? `✓ ${result.name}` : `✗ ${result.name}\n  ${result.error?.stack || result.error}`
  )).join("\n");
  document.documentElement.dataset.testStatus = passed === results.length ? "passed" : "failed";
  global.MarbleRuleTestResults = results;
})(window);
