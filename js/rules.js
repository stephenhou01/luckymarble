(function initRules(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;

  function assertSafeNonNegative(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${label} 必须是非负安全整数`);
    }
  }

  function randomIndex(size, rng) {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("随机数必须位于 [0, 1) 区间");
    }
    return Math.floor(value * size);
  }

  function createCryptoRng(cryptoSource = global.crypto) {
    let seedValue;
    if (cryptoSource && typeof cryptoSource.getRandomValues === "function") {
      const seed = new Uint32Array(1);
      cryptoSource.getRandomValues(seed);
      seedValue = seed[0];
    } else {
      seedValue = Math.floor(Math.random() * 0x1_0000_0000);
    }

    let state = seedValue >>> 0;
    return function nextRandom() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
  }

  function createStats() {
    return {
      roundsPlayed: 0,
      wins: 0,
      losses: 0,
      totalWagered: 0,
      totalPayout: 0,
      netProfit: 0,
    };
  }

  function createCardRewards() {
    return {
      points: 0,
      progress: 0,
      totalCards: 0,
    };
  }

  function calculateCardReward(previous, payout) {
    const current = previous || createCardRewards();
    assertSafeNonNegative(current.points, "累计卡片分");
    assertSafeNonNegative(current.progress, "卡片进度");
    assertSafeNonNegative(current.totalCards, "累计卡片数");
    assertSafeNonNegative(payout, "卡片奖励积分");
    if (current.progress >= C.CARD_POINTS_PER_CARD) {
      throw new RangeError("卡片进度必须小于每张卡所需积分");
    }

    const eligiblePoints = current.progress + payout;
    const rawCards = Math.floor(eligiblePoints / C.CARD_POINTS_PER_CARD);
    const cardsAwarded = Math.min(C.CARD_MAX_PER_ROUND, rawCards);
    return {
      cardRewards: {
        points: current.points + payout,
        progress: eligiblePoints % C.CARD_POINTS_PER_CARD,
        totalCards: current.totalCards + cardsAwarded,
      },
      pointsAdded: payout,
      cardsAwarded,
      cardsDiscarded: Math.max(0, rawCards - cardsAwarded),
    };
  }

  function createGameState(initialBalance = C.INITIAL_BALANCE) {
    assertSafeNonNegative(initialBalance, "初始积分");
    return {
      balance: initialBalance,
      draftWager: C.MIN_WAGER,
      wagerLimit: C.DEFAULT_WAGER_LIMIT,
      activeRound: null,
      lastResult: null,
      stats: createStats(),
      cardRewards: createCardRewards(),
    };
  }

  function validateWager(wager, availableBalance, wagerLimit = C.DEFAULT_WAGER_LIMIT) {
    if (!Number.isSafeInteger(availableBalance) || availableBalance < 0) return false;
    if (!C.WAGER_LIMIT_OPTIONS.includes(wagerLimit)) return false;
    const maximum = Math.min(availableBalance, wagerLimit, C.MAX_WAGER);
    return Number.isSafeInteger(wager) && wager >= C.MIN_WAGER && wager <= maximum;
  }

  function setWagerLimit(state, wagerLimit) {
    if (state.activeRound) throw new Error("回合进行中不能修改投注上限");
    if (!C.WAGER_LIMIT_OPTIONS.includes(wagerLimit)) throw new RangeError("不支持的投注上限");
    return {
      ...state,
      wagerLimit,
      draftWager: Math.max(C.MIN_WAGER, Math.min(state.draftWager, state.balance, wagerLimit)),
    };
  }

  function creditBalance(state, amount) {
    assertSafeNonNegative(state.balance, "当前积分");
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError("上分数量必须是正安全整数");
    }
    const nextBalance = state.balance + amount;
    if (!Number.isSafeInteger(nextBalance)) throw new RangeError("上分后积分超出安全范围");
    return { ...state, balance: nextBalance };
  }

  function setDraftWager(state, nextWager) {
    if (state.activeRound) throw new Error("回合进行中不能修改下注草稿");
    if (!validateWager(nextWager, state.balance, state.wagerLimit)) throw new RangeError("下注超出可用积分");
    return { ...state, draftWager: nextWager };
  }

  function randomMultiplier(rng) {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("随机数必须位于 [0, 1) 区间");
    }
    const totalWeight = C.MULTIPLIERS.reduce(
      (total, multiplier) => total + C.MULTIPLIER_WEIGHTS[multiplier],
      0,
    );
    const target = value * totalWeight;
    let cumulative = 0;
    for (const multiplier of C.MULTIPLIERS) {
      cumulative += C.MULTIPLIER_WEIGHTS[multiplier];
      if (target < cumulative) return multiplier;
    }
    return C.MULTIPLIERS[C.MULTIPLIERS.length - 1];
  }

  function getLightCount(multiplier, babyMode = false) {
    const count = C.LIGHT_COUNT_BY_MULTIPLIER[multiplier];
    if (count === undefined) throw new RangeError(`不支持的倍率：${multiplier}`);
    return Math.min(C.SLOT_COUNT, count * (babyMode ? 2 : 1));
  }

  function pickLitHoles(multiplier, rng, babyMode = false) {
    const count = getLightCount(multiplier, babyMode);
    const holes = Array.from({ length: C.SLOT_COUNT }, (_, index) => index);
    for (let index = 0; index < count; index += 1) {
      const swapIndex = index + randomIndex(C.SLOT_COUNT - index, rng);
      [holes[index], holes[swapIndex]] = [holes[swapIndex], holes[index]];
    }
    return holes.slice(0, count);
  }

  function startRound(state, wager, rng, options = {}) {
    if (state.activeRound) throw new Error("已有正在进行的回合");
    if (!validateWager(wager, state.balance, state.wagerLimit)) throw new RangeError("下注超出可用积分");

    const babyMode = options.babyMode === true;
    const multiplier = randomMultiplier(rng);
    const litHoles = pickLitHoles(multiplier, rng, babyMode);
    return {
      ...state,
      balance: state.balance - wager,
      draftWager: wager,
      activeRound: {
        wager,
        multiplier,
        litHoles,
        babyMode,
        locked: false,
      },
      lastResult: null,
    };
  }

  function increaseRoundWager(state, nextWager) {
    const round = state.activeRound;
    if (!round) throw new Error("没有可续投的回合");
    if (round.locked) throw new Error("蓄力后下注已锁定");
    if (!Number.isSafeInteger(nextWager) || nextWager <= round.wager) {
      throw new RangeError("开始后只能增加下注");
    }

    const totalAvailable = state.balance + round.wager;
    if (!validateWager(nextWager, totalAvailable, state.wagerLimit)) throw new RangeError("下注超出可用积分");
    return {
      ...state,
      balance: totalAvailable - nextWager,
      draftWager: nextWager,
      activeRound: { ...round, wager: nextWager },
    };
  }

  function lockRound(state) {
    if (!state.activeRound) throw new Error("没有可锁定的回合");
    if (state.activeRound.locked) throw new Error("回合已经锁定");
    return {
      ...state,
      activeRound: { ...state.activeRound, locked: true },
    };
  }

  function settleRound(state, landingHole) {
    const round = state.activeRound;
    if (!round) throw new Error("没有可结算的回合");
    if (!round.locked) throw new Error("回合尚未发射");
    if (!Number.isInteger(landingHole) || landingHole < 0 || landingHole >= C.SLOT_COUNT) {
      throw new RangeError("落洞编号无效");
    }

    const won = round.litHoles.includes(landingHole);
    const payout = won ? round.wager * round.multiplier : 0;
    const nextBalance = state.balance + payout;
    const cardReward = calculateCardReward(state.cardRewards, payout);
    assertSafeNonNegative(nextBalance, "结算后积分");

    const result = {
      wager: round.wager,
      multiplier: round.multiplier,
      litHoles: [...round.litHoles],
      landingHole,
      won,
      payout,
      netProfit: payout - round.wager,
      cardPointsAdded: cardReward.pointsAdded,
      cardsAwarded: cardReward.cardsAwarded,
      cardsDiscarded: cardReward.cardsDiscarded,
    };
    const stats = {
      roundsPlayed: state.stats.roundsPlayed + 1,
      wins: state.stats.wins + (won ? 1 : 0),
      losses: state.stats.losses + (won ? 0 : 1),
      totalWagered: state.stats.totalWagered + round.wager,
      totalPayout: state.stats.totalPayout + payout,
      netProfit: state.stats.netProfit + result.netProfit,
    };

    return {
      ...state,
      balance: nextBalance,
      activeRound: null,
      lastResult: result,
      stats,
      cardRewards: cardReward.cardRewards,
    };
  }

  function prepareNextRound(state) {
    if (state.activeRound) throw new Error("回合仍在进行中");
    const previousWager = state.lastResult ? state.lastResult.wager : state.draftWager;
    const draftWager = state.balance >= C.MIN_WAGER
      ? Math.max(C.MIN_WAGER, Math.min(previousWager, state.balance, state.wagerLimit, C.MAX_WAGER))
      : C.MIN_WAGER;
    return { ...state, draftWager };
  }

  Game.Rules = Object.freeze({
    createCryptoRng,
    createGameState,
    calculateCardReward,
    creditBalance,
    getLightCount,
    increaseRoundWager,
    lockRound,
    pickLitHoles,
    prepareNextRound,
    randomMultiplier,
    setDraftWager,
    setWagerLimit,
    settleRound,
    startRound,
    validateWager,
  });
})(window);
