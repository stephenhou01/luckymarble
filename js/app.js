(function initApp(global) {
  "use strict";

  const Game = global.MarbleGame;
  const C = Game.CONFIG;
  const Rules = Game.Rules;
  const rng = Rules.createCryptoRng();
  const SKIN_STORAGE_KEY = "marble-luck-skin";

  function readStoredSkin() {
    try {
      const stored = global.localStorage.getItem(SKIN_STORAGE_KEY);
      return C.SKINS.some((skin) => skin.id === stored) ? stored : C.SKINS[0].id;
    } catch (_error) {
      return C.SKINS[0].id;
    }
  }
  const audio = Game.Audio.create({
    onSpeechIdleChange: handleSpeechIdleChange,
    onPreviewChange: handlePreviewChange,
  });

  let state = Rules.createGameState();
  let phase = "betting";
  let winningSlots = [];
  let activeSlot = null;
  let displayMultiplier = null;
  let babyMode = false;
  let currentSkin = readStoredSkin();
  let power = C.POWER_MIN;
  let chargeStartedAt = 0;
  let revealInterval = 0;
  let revealTimer = 0;
  let resultTimer = 0;
  let rewardFinishTimer = 0;
  let rewardCelebrationTimer = 0;
  let multiplierAnnouncementTimer = 0;
  let multiplierAnnouncement = { visible: false, multiplier: null, potentialPayout: 0 };
  let winCelebration = { visible: false, stage: "idle", payout: 0, cardsAwarded: 0 };
  let lastFrameAt = performance.now();
  let playfieldDirty = true;
  let lastCanvasStateKey = "";
  let lastSyncedMarbleRadius = 0;
  let wagerQueue = null;
  let rewardBank = null;
  let cardDispenser = null;

  const physics = new Game.PhysicsWorld({ onSlot: settleLanding });
  const renderer = new Game.CanvasRenderer(document.getElementById("playfield"), physics);
  const ui = Game.UI.create({
    onWagerChange: changeWager,
    onWagerPreset: setWagerPreset,
    onCredit: addManualCredit,
    onSkinChange: changeSkin,
    onStart: startRound,
    onBabyModeToggle: toggleBabyMode,
    onChargeStart: beginCharge,
    onChargeRelease: releaseCharge,
    onChargeCancel: cancelCharge,
    onAudioPanelOpen: () => audio.unlock(),
    onAudioPanelClose: () => audio.stopPreview(),
    onMusicMasterToggle: toggleMusicMaster,
    onBackgroundMusicToggle: toggleBackgroundMusic,
    onBackgroundVolumeChange: setBackgroundVolume,
    onBackgroundTrackChange: setBackgroundTrack,
    onBackgroundPreview: previewBackground,
    onWinMusicToggle: toggleWinMusic,
    onWinVolumeChange: setWinVolume,
    onWinTrackChange: setWinTrack,
    onWinPreview: previewWin,
    onVoiceToggle: toggleVoice,
    onVoiceVolumeChange: setVoiceVolume,
    onWagerLimitChange: setWagerLimit,
    onReset: resetGame,
  });
  wagerQueue = new Game.WagerMarbleQueue(ui.elements.tray, {
    canvas: ui.elements.wagerCanvas,
    inlet: ui.elements.stakeInlet,
    sourceOutlet: ui.elements.bankOutlet,
    countElement: ui.elements.stakeCount,
    onIdleChange: updateView,
    onProgress: updateView,
  });
  rewardBank = new Game.RewardMarbleBank(ui.elements.rewardBank, {
    canvas: ui.elements.rewardBankCanvas,
    mouth: ui.elements.rewardBankMouth,
    onWithdrawMarble: () => wagerQueue.feedFromBank(1),
    onIdleChange: handleRewardBankIdle,
    onProgress: updateView,
  });
  cardDispenser = new Game.CardDispenser(ui.elements.cardDispenser, {
    showcase: ui.elements.cardShowcase,
    mouth: ui.elements.cardSlotMouth,
    countElement: ui.elements.cardCount,
    metricsContainer: ui.elements.cardMetrics,
    onIdleChange: handleRewardAnimationIdle,
    onProgress: updateView,
  });

  function updateView() {
    const canvasStateKey = `${winningSlots.join(",")}|${activeSlot ?? ""}`;
    if (canvasStateKey !== lastCanvasStateKey) {
      lastCanvasStateKey = canvasStateKey;
      playfieldDirty = true;
    }
    const potentialPayout = state.activeRound
      ? state.activeRound.wager * state.activeRound.multiplier
      : 0;
    ui.render(state, {
      phase,
      displayMultiplier,
      wagerQueue: wagerQueue?.getSnapshot() ?? null,
      rewardBank: rewardBank?.getSnapshot() ?? null,
      cardDispenser: cardDispenser?.getSnapshot() ?? null,
      potentialPayout,
      babyMode,
    });
    if (multiplierAnnouncement.visible) {
      multiplierAnnouncement = { ...multiplierAnnouncement, potentialPayout };
      ui.updateMultiplierAnnouncement(multiplierAnnouncement.multiplier, potentialPayout);
    }
    if (winCelebration.visible && state.lastResult?.won) {
      ui.updateWinCelebration(
        rewardBank?.getSnapshot().logicalProcessedCount || 0,
        state.lastResult,
      );
    }
  }

  function syncMarbleVisualSize(force = false) {
    const mainRadiusCss = renderer.getMetrics().ballRadiusCss;
    if (!(mainRadiusCss > 0)) return;
    if (!force && Math.abs(mainRadiusCss - lastSyncedMarbleRadius) < 0.02) return;
    lastSyncedMarbleRadius = mainRadiusCss;
    document.getElementById("machine").dataset.mainMarbleRadiusCss = mainRadiusCss.toFixed(3);
    rewardBank.setVisualRadius(mainRadiusCss);
    wagerQueue.setVisualRadius(mainRadiusCss);
  }

  function clearTimers() {
    global.clearInterval(revealInterval);
    global.clearTimeout(revealTimer);
    global.clearTimeout(resultTimer);
    global.clearTimeout(rewardFinishTimer);
    global.clearTimeout(rewardCelebrationTimer);
    global.clearTimeout(multiplierAnnouncementTimer);
    revealInterval = 0;
    revealTimer = 0;
    resultTimer = 0;
    rewardFinishTimer = 0;
    rewardCelebrationTimer = 0;
    multiplierAnnouncementTimer = 0;
  }

  function hideMultiplierAnnouncement() {
    global.clearTimeout(multiplierAnnouncementTimer);
    multiplierAnnouncementTimer = 0;
    multiplierAnnouncement = { visible: false, multiplier: null, potentialPayout: 0 };
    ui.hideMultiplierAnnouncement();
  }

  function showMultiplierAnnouncement() {
    const multiplier = state.activeRound?.multiplier;
    if (!multiplier) return;
    const potentialPayout = state.activeRound.wager * multiplier;
    hideMultiplierAnnouncement();
    multiplierAnnouncement = { visible: true, multiplier, potentialPayout };
    ui.showMultiplierAnnouncement(multiplier, potentialPayout);
    const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    multiplierAnnouncementTimer = global.setTimeout(
      hideMultiplierAnnouncement,
      reducedMotion ? 240 : C.MULTIPLIER_POPUP_MS,
    );
  }

  function changeWager(delta) {
    audio.unlock();
    if (phase === "betting") {
      const next = Math.max(C.MIN_WAGER, Math.min(state.balance, state.wagerLimit, C.MAX_WAGER, state.draftWager + delta));
      if (next === state.draftWager) return;
      state = Rules.setDraftWager(state, next);
      wagerQueue.setDraft(next);
    } else if (phase === "ready") {
      if (delta <= 0) return;
      const current = state.activeRound.wager;
      const maximum = Math.min(state.balance + current, state.wagerLimit, C.MAX_WAGER);
      const next = Math.min(maximum, current + delta);
      if (next === current) return;
      state = Rules.increaseRoundWager(state, next);
      wagerQueue.addStock(next - current);
      rewardBank.withdraw(next - current);
    } else {
      return;
    }
    updateView();
  }

  function setWagerPreset(target) {
    audio.unlock();
    if (!Number.isSafeInteger(target)) return;
    if (phase === "betting") {
      if (!Rules.validateWager(target, state.balance, state.wagerLimit) || target === state.draftWager) return;
      state = Rules.setDraftWager(state, target);
      wagerQueue.setDraft(target);
    } else if (phase === "ready") {
      const current = state.activeRound.wager;
      const maximum = Math.min(state.balance + current, state.wagerLimit, C.MAX_WAGER);
      if (target <= current || target > maximum) return;
      state = Rules.increaseRoundWager(state, target);
      wagerQueue.addStock(target - current);
      rewardBank.withdraw(target - current);
    } else {
      return;
    }
    updateView();
  }

  function addManualCredit(amount) {
    if (!C.MANUAL_CREDIT_AMOUNTS.includes(amount)) return;
    state = Rules.creditBalance(state, amount);
    rewardBank.credit(amount);
    if (phase === "gameover") {
      phase = "betting";
      wagerQueue.reset(state.draftWager);
    }
    ui.showCreditFeedback(amount, state.balance);
    updateView();
  }

  function setWagerLimit(limit) {
    if (phase !== "betting" || !C.WAGER_LIMIT_OPTIONS.includes(limit)) return;
    state = Rules.setWagerLimit(state, limit);
    wagerQueue.setDraft(state.draftWager);
    updateView();
  }

  function changeSkin(skinId, { persist = true } = {}) {
    const selected = C.SKINS.find((skin) => skin.id === skinId);
    if (!selected) return false;
    currentSkin = selected.id;
    document.documentElement.dataset.skin = currentSkin;
    document.getElementById("machine").dataset.skin = currentSkin;
    renderer.setSkin(currentSkin);
    ui.setSkin(currentSkin);
    playfieldDirty = true;
    if (persist) {
      try {
        global.localStorage.setItem(SKIN_STORAGE_KEY, currentSkin);
      } catch (_error) {
        // 皮肤切换不依赖持久化；隐私模式拒绝存储时仍保持本次选择。
      }
    }
    return true;
  }

  function startRound() {
    if (phase !== "betting" || !Rules.validateWager(state.draftWager, state.balance, state.wagerLimit)) return;
    audio.stopWin();
    audio.unlock();
    state = Rules.startRound(state, state.draftWager, rng, { babyMode });
    phase = "revealing";
    activeSlot = null;
    displayMultiplier = null;
    ui.hideResult();
    wagerQueue.startCommit(state.activeRound.wager);
    rewardBank.withdraw(state.activeRound.wager);

    let tick = 0;
    revealInterval = global.setInterval(() => {
      displayMultiplier = C.MULTIPLIERS[tick % C.MULTIPLIERS.length];
      winningSlots = Rules.pickLitHoles(displayMultiplier, rng, state.activeRound.babyMode);
      tick += 1;
      updateView();
    }, 82);

    revealTimer = global.setTimeout(() => {
      global.clearInterval(revealInterval);
      revealInterval = 0;
      displayMultiplier = state.activeRound.multiplier;
      winningSlots = [...state.activeRound.litHoles];
      phase = "ready";
      updateView();
      showMultiplierAnnouncement();
    }, C.REVEAL_DURATION_MS);
    updateView();
  }

  function calculatePower(now = performance.now()) {
    const elapsed = Math.max(0, now - chargeStartedAt);
    const progress = (elapsed / C.POWER_SWEEP_MS) % 2;
    const wave = progress <= 1 ? progress : 2 - progress;
    return C.POWER_MIN + (C.POWER_MAX - C.POWER_MIN) * wave;
  }

  function beginCharge() {
    if (phase !== "ready" || !wagerQueue.isIdle() || !rewardBank.isIdle() || !cardDispenser.isIdle()) return;
    audio.unlock();
    hideMultiplierAnnouncement();
    phase = "charging";
    chargeStartedAt = performance.now();
    power = C.POWER_MIN;
    ui.setPower(power);
    updateView();
  }

  function releaseCharge() {
    if (phase !== "charging") return;
    power = calculatePower();
    state = Rules.lockRound(state);
    phase = "flight";
    physics.prepareBall();
    physics.launch(power, rng);
    updateView();
  }

  function cancelCharge() {
    if (phase !== "charging") return;
    phase = "ready";
    power = C.POWER_MIN;
    ui.setPower(power);
    updateView();
  }

  function settleLanding(slot) {
    if (phase !== "flight") return;
    state = Rules.settleRound(state, slot);
    activeSlot = slot;
    ui.showResult(state.lastResult);
    if (state.lastResult.won) {
      phase = "rewarding";
      winCelebration = {
        visible: true,
        stage: "counting",
        payout: state.lastResult.payout,
        cardsAwarded: state.lastResult.cardsAwarded,
      };
      ui.showWinCelebration(state.lastResult);
      audio.playWin();
      audio.announceWin(state.lastResult);
      rewardBank.deposit(state.lastResult.payout);
      cardDispenser.dispense({
        ...state.lastResult,
        cardRewards: state.cardRewards,
      });
      rewardCelebrationTimer = global.setTimeout(forceFinishCelebration, C.REWARD_CELEBRATION_TIMEOUT_MS);
      updateView();
      return;
    }

    phase = "settling";
    updateView();
    resultTimer = global.setTimeout(prepareNextRound, C.RESULT_DURATION_MS);
  }

  function handleRewardBankIdle(idle) {
    handleRewardAnimationIdle(idle);
  }

  function handleSpeechIdleChange(idle) {
    if (idle) handleRewardAnimationIdle(true);
  }

  function handleRewardAnimationIdle(idle) {
    if (!idle || phase !== "rewarding" || rewardFinishTimer) return;
    if (!rewardBank?.isIdle() || !cardDispenser?.isIdle() || !audio.isSpeechIdle()) return;
    global.clearTimeout(rewardCelebrationTimer);
    rewardCelebrationTimer = 0;
    winCelebration = { ...winCelebration, stage: "finale" };
    ui.finishWinCelebration(state.lastResult);
    rewardFinishTimer = global.setTimeout(() => {
      rewardFinishTimer = 0;
      prepareNextRound();
    }, C.REWARD_FINISH_HOLD_MS);
  }

  function forceFinishCelebration() {
    rewardCelebrationTimer = 0;
    if (phase !== "rewarding") return;
    winCelebration = { ...winCelebration, stage: "finale" };
    ui.finishWinCelebration(state.lastResult);
    rewardBank.reset(state.balance);
    cardDispenser.reset(state.cardRewards);
    audio.cancelSpeech();
    handleRewardAnimationIdle(true);
  }

  function prepareNextRound() {
    if (!["settling", "rewarding"].includes(phase)) return;
    state = Rules.prepareNextRound(state);
    physics.prepareBall();
    winningSlots = [];
    activeSlot = null;
    displayMultiplier = null;
    power = C.POWER_MIN;
    ui.setPower(power);
    ui.hideResult();
    ui.hideWinCelebration();
    winCelebration = { visible: false, stage: "idle", payout: 0, cardsAwarded: 0 };
    phase = state.balance < C.MIN_WAGER ? "gameover" : "betting";
    rewardBank.reset(state.balance);
    cardDispenser.reset(state.cardRewards);
    wagerQueue.reset(phase === "betting" ? state.draftWager : 0);
    updateView();
  }

  function syncAudioControls() {
    ui.setAudioControls(audio.getSnapshot());
  }

  function handlePreviewChange() {
    syncAudioControls();
  }

  function toggleBackgroundMusic() {
    const next = !audio.getSnapshot().background.enabled;
    audio.setBackgroundEnabled(next);
    syncAudioControls();
  }

  function toggleMusicMaster() {
    const next = !audio.getSnapshot().music.enabled;
    audio.setMusicEnabled(next);
    syncAudioControls();
  }

  function toggleWinMusic() {
    const next = !audio.getSnapshot().win.enabled;
    audio.setWinEnabled(next);
    syncAudioControls();
  }

  function toggleVoice() {
    const next = !audio.getSnapshot().voice.enabled;
    audio.setVoiceEnabled(next);
    syncAudioControls();
  }

  function toggleBabyMode() {
    if (phase !== "betting") return;
    babyMode = !babyMode;
    updateView();
  }

  function setBackgroundVolume(percent) {
    audio.setBackgroundVolume(percent / 100);
    syncAudioControls();
  }

  function setBackgroundTrack(index) {
    audio.setBackgroundTrack(index);
    syncAudioControls();
  }

  function setWinTrack(index) {
    audio.setWinTrack(index);
    syncAudioControls();
  }

  function previewBackground() {
    audio.previewBackground();
    syncAudioControls();
  }

  function previewWin() {
    audio.previewWin();
    syncAudioControls();
  }

  function setWinVolume(percent) {
    audio.setWinVolume(percent / 100);
    syncAudioControls();
  }

  function setVoiceVolume(percent) {
    audio.setVoiceVolume(percent / 100);
    syncAudioControls();
  }

  function resetGame() {
    clearTimers();
    hideMultiplierAnnouncement();
    ui.hideCreditMenu();
    ui.hideSkinMenu();
    audio.stopWin();
    state = Rules.createGameState();
    phase = "betting";
    babyMode = false;
    winningSlots = [];
    activeSlot = null;
    displayMultiplier = null;
    power = C.POWER_MIN;
    physics.prepareBall();
    ui.hideResult();
    ui.hideWinCelebration();
    winCelebration = { visible: false, stage: "idle", payout: 0, cardsAwarded: 0 };
    ui.setPower(power);
    wagerQueue.reset(state.draftWager);
    rewardBank.reset(state.balance);
    cardDispenser.reset(state.cardRewards);
    updateView();
  }

  function frame(now) {
    const delta = Math.min(C.MAX_FRAME_DELTA, Math.max(0, (now - lastFrameAt) / 1000));
    lastFrameAt = now;
    if (phase === "charging") {
      power = calculatePower(now);
      ui.setPower(power);
    }
    if (phase === "flight") physics.advance(delta);
    if (phase === "flight" || playfieldDirty) {
      renderer.render({ winningSlots, activeSlot });
      playfieldDirty = false;
      syncMarbleVisualSize();
    }
    global.requestAnimationFrame(frame);
  }

  function handlePlayfieldResize() {
    renderer.invalidateSize();
    lastSyncedMarbleRadius = 0;
    playfieldDirty = true;
  }

  if (typeof ResizeObserver === "function") {
    const playfieldResizeObserver = new ResizeObserver(handlePlayfieldResize);
    playfieldResizeObserver.observe(renderer.canvas);
  } else {
    global.addEventListener("resize", handlePlayfieldResize, { passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    lastFrameAt = performance.now();
    if (document.hidden) hideMultiplierAnnouncement();
    if (document.hidden) ui.hideCreditMenu();
    if (document.hidden) ui.hideSkinMenu();
    if (document.hidden) audio.stopPreview();
    if (document.hidden) audio.cancelSpeech();
    if (document.hidden && phase === "charging") cancelCharge();
    if (document.hidden && phase === "rewarding") {
      rewardBank.reset(state.balance);
      cardDispenser.reset(state.cardRewards);
      winCelebration = { ...winCelebration, stage: "finale" };
      ui.finishWinCelebration(state.lastResult);
      handleRewardAnimationIdle(true);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.closest?.("#audio-panel, #sound-button, #skin-menu, #skin-button")) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      event.preventDefault();
      startRound();
    } else if (["Minus", "NumpadSubtract"].includes(event.code)) {
      event.preventDefault();
      changeWager(-1);
    } else if (["Equal", "NumpadAdd"].includes(event.code)) {
      event.preventDefault();
      changeWager(1);
    } else if (event.code === "Space" && phase === "ready") {
      event.preventDefault();
      beginCharge();
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.target.closest?.("#audio-panel, #sound-button, #skin-menu, #skin-button")) return;
    if (event.code === "Space" && phase === "charging") {
      event.preventDefault();
      releaseCharge();
    }
  });

  syncAudioControls();
  ui.setPower(power);
  wagerQueue.reset(state.draftWager);
  rewardBank.reset(state.balance);
  cardDispenser.reset(state.cardRewards);
  changeSkin(currentSkin, { persist: false });
  updateView();
  global.requestAnimationFrame(frame);

  Game.App = Object.freeze({
    getSnapshot: () => ({
      state,
      phase,
      winningSlots: [...winningSlots],
      activeSlot,
      displayMultiplier,
      babyMode,
      currentSkin,
      potentialPayout: state.activeRound
        ? state.activeRound.wager * state.activeRound.multiplier
        : 0,
      multiplierAnnouncement: { ...multiplierAnnouncement },
      winCelebration: { ...winCelebration },
      launcherExit: { ...Game.Geometry.launcherExit },
      launcherRescues: physics.ball?.launcherRescues || 0,
      power,
      wagerQueue: wagerQueue.getSnapshot(),
      rewardBank: rewardBank.getSnapshot(),
      cardRewards: { ...state.cardRewards },
      cardDispenser: cardDispenser.getSnapshot(),
      renderMetrics: renderer.getMetrics(),
      marbleVisualRadii: {
        main: renderer.getMetrics().ballRadiusCss,
        rewardBank: rewardBank.getSnapshot().visualRadiusCss,
        wagerQueue: wagerQueue.getSnapshot().visualRadiusCss,
      },
      audio: audio.getSnapshot(),
    }),
    reset: resetGame,
  });
})(window);
