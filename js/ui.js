(function initUI(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;

  function createRepeater(button, callback) {
    let delayTimer = 0;
    let repeatTimer = 0;
    let activePointer = null;

    function stop() {
      global.clearTimeout(delayTimer);
      global.clearInterval(repeatTimer);
      delayTimer = 0;
      repeatTimer = 0;
      activePointer = null;
    }

    button.addEventListener("pointerdown", (event) => {
      if (button.disabled) return;
      event.preventDefault();
      activePointer = event.pointerId;
      button.setPointerCapture?.(event.pointerId);
      callback();
      delayTimer = global.setTimeout(() => {
        repeatTimer = global.setInterval(callback, 72);
      }, 350);
    });
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", () => {
      if (activePointer !== null) stop();
    });
  }

  function createUI(handlers) {
    const elements = {
      balance: document.getElementById("balance-value"),
      wallet: document.querySelector(".wallet"),
      creditControl: document.querySelector(".credit-control"),
      creditButton: document.getElementById("credit-button"),
      creditMenu: document.getElementById("credit-menu"),
      creditOptions: Array.from(document.querySelectorAll("[data-credit-amount]")),
      creditFeedback: document.getElementById("credit-feedback"),
      creditLive: document.getElementById("credit-live"),
      skinControl: document.querySelector(".skin-control"),
      skinButton: document.getElementById("skin-button"),
      skinMenu: document.getElementById("skin-menu"),
      skinOptions: Array.from(document.querySelectorAll("[data-skin-id]")),
      wager: document.getElementById("wager-value"),
      minus: document.getElementById("wager-minus"),
      plus: document.getElementById("wager-plus"),
      start: document.getElementById("start-button"),
      launch: document.getElementById("launch-button"),
      sound: document.getElementById("sound-button"),
      babyMode: document.getElementById("baby-mode-toggle"),
      audioPanel: document.getElementById("audio-panel"),
      musicMasterToggle: document.getElementById("music-master-toggle"),
      backgroundMusicToggle: document.getElementById("background-music-toggle"),
      backgroundVolume: document.getElementById("background-volume"),
      backgroundVolumeValue: document.getElementById("background-volume-value"),
      backgroundTrackSelect: document.getElementById("background-track-select"),
      backgroundPreview: document.getElementById("background-preview-button"),
      winMusicToggle: document.getElementById("win-music-toggle"),
      winVolume: document.getElementById("win-volume"),
      winVolumeValue: document.getElementById("win-volume-value"),
      winTrackSelect: document.getElementById("win-track-select"),
      winPreview: document.getElementById("win-preview-button"),
      voiceToggle: document.getElementById("voice-toggle"),
      voiceVolume: document.getElementById("voice-volume"),
      voiceVolumeValue: document.getElementById("voice-volume-value"),
      reset: document.getElementById("reset-button"),
      restart: document.getElementById("restart-button"),
      phase: document.getElementById("phase-banner"),
      powerFill: document.getElementById("power-fill"),
      powerValue: document.getElementById("power-value"),
      resultCard: document.getElementById("result-card"),
      resultImage: document.querySelector("#result-card img"),
      resultTitle: document.getElementById("result-title"),
      resultDetail: document.getElementById("result-detail"),
      gameOver: document.getElementById("game-over"),
      reelItems: Array.from(document.querySelectorAll("[data-multiplier]")),
      tray: document.getElementById("marble-tray"),
      wagerCanvas: document.getElementById("wager-physics-canvas"),
      stakeInlet: document.getElementById("stake-inlet"),
      stakeCounter: document.getElementById("stake-counter"),
      stakeStatusLabel: document.getElementById("stake-status-label"),
      stakeCount: document.getElementById("stake-marble-count"),
      stakeProgress: document.getElementById("stake-progress"),
      bankOutlet: document.getElementById("bank-outlet"),
      rewardBank: document.getElementById("reward-bank"),
      rewardBankCanvas: document.getElementById("reward-bank-canvas"),
      rewardBankMouth: document.getElementById("reward-bank-mouth"),
      rewardBankLabel: document.getElementById("reward-bank-label"),
      rewardBankCount: document.getElementById("reward-bank-count"),
      rewardBankProgress: document.getElementById("reward-bank-progress"),
      cardDispenser: document.getElementById("card-dispenser"),
      cardMetrics: document.getElementById("card-metrics"),
      cardShowcase: document.getElementById("card-showcase"),
      cardSlotMouth: document.getElementById("card-slot-mouth"),
      cardCount: document.getElementById("card-count"),
      multiplierAnnouncement: document.getElementById("multiplier-announcement"),
      announcementMultiplier: document.getElementById("announcement-multiplier"),
      announcementPayout: document.getElementById("announcement-payout"),
      winCelebration: document.getElementById("win-celebration"),
      winCelebrationTitle: document.getElementById("win-celebration-title"),
      winCelebrationPayout: document.getElementById("win-celebration-payout"),
      winCelebrationCards: document.getElementById("win-celebration-cards"),
      winCelebrationMultiplier: document.getElementById("win-celebration-multiplier"),
      winCelebrationLive: document.getElementById("win-celebration-live"),
      wagerPresets: Array.from(document.querySelectorAll("[data-wager-preset]")),
      wagerLimitControl: document.querySelector(".wager-limit-control"),
      wagerLimitButton: document.getElementById("wager-limit-button"),
      wagerLimitValue: document.getElementById("wager-limit-value"),
      wagerLimitMenu: document.getElementById("wager-limit-menu"),
      wagerLimitOptions: Array.from(document.querySelectorAll("[data-wager-limit]")),
    };

    createRepeater(elements.minus, () => handlers.onWagerChange(-1));
    createRepeater(elements.plus, () => handlers.onWagerChange(1));
    elements.wagerPresets.forEach((button) => {
      button.addEventListener("click", () => handlers.onWagerPreset(Number(button.dataset.wagerPreset)));
    });
    elements.start.addEventListener("click", handlers.onStart);
    elements.babyMode.addEventListener("click", handlers.onBabyModeToggle);
    function setAudioPanelOpen(open, focusButton = false) {
      const wasOpen = !elements.audioPanel.hidden;
      elements.audioPanel.hidden = !open;
      elements.sound.setAttribute("aria-expanded", String(open));
      elements.sound.setAttribute("aria-label", open ? "关闭声音设置" : "打开声音设置");
      if (wasOpen && !open) handlers.onAudioPanelClose();
      if (focusButton) elements.sound.focus();
    }
    function setCreditMenuOpen(open, focusButton = false) {
      elements.creditMenu.hidden = !open;
      elements.creditButton.setAttribute("aria-expanded", String(open));
      elements.creditControl.classList.toggle("is-open", open);
      if (focusButton) elements.creditButton.focus();
    }
    function setSkinMenuOpen(open, focusButton = false) {
      elements.skinMenu.hidden = !open;
      elements.skinButton.setAttribute("aria-expanded", String(open));
      elements.skinControl.classList.toggle("is-open", open);
      if (focusButton) elements.skinButton.focus();
    }
    function setWagerLimitMenuOpen(open, focusButton = false) {
      elements.wagerLimitMenu.hidden = !open;
      elements.wagerLimitButton.setAttribute("aria-expanded", String(open));
      if (focusButton) elements.wagerLimitButton.focus();
    }
    elements.creditButton.addEventListener("click", () => {
      const open = elements.creditMenu.hidden;
      setCreditMenuOpen(open);
      if (open) {
        setAudioPanelOpen(false);
        setSkinMenuOpen(false);
      }
    });
    elements.creditOptions.forEach((button) => {
      button.addEventListener("click", () => {
        const amount = Number(button.dataset.creditAmount);
        if (!C.MANUAL_CREDIT_AMOUNTS.includes(amount)) return;
        handlers.onCredit(amount);
      });
    });
    elements.skinButton.addEventListener("click", () => {
      const open = elements.skinMenu.hidden;
      setSkinMenuOpen(open);
      if (open) {
        setAudioPanelOpen(false);
        setCreditMenuOpen(false);
      }
    });
    elements.skinOptions.forEach((button) => {
      button.addEventListener("click", () => {
        const skinId = button.dataset.skinId;
        if (!C.SKINS.some((skin) => skin.id === skinId)) return;
        handlers.onSkinChange(skinId);
        setSkinMenuOpen(false, true);
      });
    });
    elements.sound.addEventListener("click", () => {
      const open = elements.audioPanel.hidden;
      setAudioPanelOpen(open);
      if (open) {
        setCreditMenuOpen(false);
        setSkinMenuOpen(false);
      }
      if (open) handlers.onAudioPanelOpen();
    });
    elements.musicMasterToggle.addEventListener("click", handlers.onMusicMasterToggle);
    elements.backgroundMusicToggle.addEventListener("click", handlers.onBackgroundMusicToggle);
    elements.winMusicToggle.addEventListener("click", handlers.onWinMusicToggle);
    elements.voiceToggle.addEventListener("click", handlers.onVoiceToggle);
    elements.backgroundTrackSelect.addEventListener("change", () => {
      handlers.onBackgroundTrackChange(Number(elements.backgroundTrackSelect.value));
    });
    elements.winTrackSelect.addEventListener("change", () => {
      handlers.onWinTrackChange(Number(elements.winTrackSelect.value));
    });
    elements.backgroundPreview.addEventListener("click", handlers.onBackgroundPreview);
    elements.winPreview.addEventListener("click", handlers.onWinPreview);
    elements.backgroundVolume.addEventListener("input", () => {
      handlers.onBackgroundVolumeChange(Number(elements.backgroundVolume.value));
    });
    elements.winVolume.addEventListener("input", () => {
      handlers.onWinVolumeChange(Number(elements.winVolume.value));
    });
    elements.voiceVolume.addEventListener("input", () => {
      handlers.onVoiceVolumeChange(Number(elements.voiceVolume.value));
    });
    elements.wagerLimitButton.addEventListener("click", () => {
      if (elements.wagerLimitButton.disabled) return;
      setWagerLimitMenuOpen(elements.wagerLimitMenu.hidden);
    });
    elements.wagerLimitOptions.forEach((button) => {
      button.addEventListener("click", () => {
        handlers.onWagerLimitChange(Number(button.dataset.wagerLimit));
        setWagerLimitMenuOpen(false, true);
      });
    });
    elements.reset.addEventListener("click", handlers.onReset);
    elements.restart.addEventListener("click", handlers.onReset);

    document.addEventListener("pointerdown", (event) => {
      if (!elements.audioPanel.hidden
        && !elements.audioPanel.contains(event.target)
        && !elements.sound.contains(event.target)) {
        setAudioPanelOpen(false);
      }
      if (!elements.creditMenu.hidden && !elements.creditControl.contains(event.target)) {
        setCreditMenuOpen(false);
      }
      if (!elements.skinMenu.hidden && !elements.skinControl.contains(event.target)) {
        setSkinMenuOpen(false);
      }
      if (!elements.wagerLimitMenu.hidden && !elements.wagerLimitControl.contains(event.target)) {
        setWagerLimitMenuOpen(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!elements.audioPanel.hidden) {
        setAudioPanelOpen(false, true);
      } else if (!elements.creditMenu.hidden) {
        setCreditMenuOpen(false, true);
      } else if (!elements.skinMenu.hidden) {
        setSkinMenuOpen(false, true);
      } else if (!elements.wagerLimitMenu.hidden) {
        setWagerLimitMenuOpen(false, true);
      }
    });

    let chargePointer = null;
    elements.launch.addEventListener("pointerdown", (event) => {
      if (elements.launch.disabled) return;
      event.preventDefault();
      chargePointer = event.pointerId;
      elements.launch.setPointerCapture?.(event.pointerId);
      handlers.onChargeStart();
    });
    elements.launch.addEventListener("pointerup", (event) => {
      if (chargePointer !== event.pointerId) return;
      chargePointer = null;
      handlers.onChargeRelease();
    });
    elements.launch.addEventListener("pointercancel", (event) => {
      if (chargePointer !== event.pointerId) return;
      chargePointer = null;
      handlers.onChargeCancel();
    });

    function setMultiplier(multiplier) {
      elements.reelItems.forEach((item) => {
        item.classList.toggle("is-active", Number(item.dataset.multiplier) === multiplier);
      });
    }

    function setPower(power) {
      const percent = Math.round(power * 100);
      elements.powerFill.style.height = `${percent}%`;
      elements.powerValue.textContent = `${percent}%`;
    }

    function setAudioControls(snapshot) {
      const backgroundPercent = Math.round(snapshot.background.volume * 100);
      const winPercent = Math.round(snapshot.win.volume * 100);
      const voicePercent = Math.round(snapshot.voice.volume * 100);
      elements.musicMasterToggle.setAttribute("aria-checked", String(snapshot.music.enabled));
      elements.backgroundMusicToggle.setAttribute("aria-checked", String(snapshot.background.enabled));
      elements.winMusicToggle.setAttribute("aria-checked", String(snapshot.win.enabled));
      elements.voiceToggle.setAttribute("aria-checked", String(snapshot.voice.enabled));
      elements.backgroundMusicToggle.closest(".audio-channel")
        .classList.toggle("is-muted", !snapshot.music.enabled || !snapshot.background.enabled);
      elements.winMusicToggle.closest(".audio-channel")
        .classList.toggle("is-muted", !snapshot.music.enabled || !snapshot.win.enabled);
      elements.voiceToggle.closest(".audio-control-row")
        .classList.toggle("is-muted", !snapshot.voice.enabled || !snapshot.voice.supported);
      elements.backgroundVolume.value = String(backgroundPercent);
      elements.winVolume.value = String(winPercent);
      elements.voiceVolume.value = String(voicePercent);
      elements.backgroundTrackSelect.value = String(snapshot.background.selectedIndex);
      elements.winTrackSelect.value = String(snapshot.win.selectedIndex);
      elements.backgroundMusicToggle.disabled = !snapshot.music.enabled;
      elements.winMusicToggle.disabled = !snapshot.music.enabled;
      elements.backgroundVolume.disabled = !snapshot.music.enabled || !snapshot.background.enabled;
      elements.winVolume.disabled = !snapshot.music.enabled || !snapshot.win.enabled;
      elements.backgroundTrackSelect.disabled = !snapshot.music.enabled || !snapshot.background.enabled;
      elements.winTrackSelect.disabled = !snapshot.music.enabled || !snapshot.win.enabled;
      elements.backgroundPreview.disabled = !snapshot.music.enabled || !snapshot.background.enabled;
      elements.winPreview.disabled = !snapshot.music.enabled || !snapshot.win.enabled;
      const previewKind = snapshot.preview.kind;
      elements.backgroundPreview.setAttribute("aria-pressed", String(previewKind === "background"));
      elements.winPreview.setAttribute("aria-pressed", String(previewKind === "win"));
      elements.backgroundPreview.textContent = previewKind === "background" ? "停止" : "试听";
      elements.winPreview.textContent = previewKind === "win" ? "停止" : "试听";
      elements.backgroundPreview.setAttribute(
        "aria-label",
        previewKind === "background" ? "停止试听背景音乐" : "试听所选背景音乐",
      );
      elements.winPreview.setAttribute(
        "aria-label",
        previewKind === "win" ? "停止试听中奖音乐" : "试听所选中奖音乐",
      );
      elements.voiceVolume.disabled = !snapshot.voice.supported;
      elements.voiceToggle.disabled = !snapshot.voice.supported;
      elements.backgroundVolumeValue.textContent = `${backgroundPercent}%`;
      elements.winVolumeValue.textContent = `${winPercent}%`;
      elements.voiceVolumeValue.textContent = snapshot.voice.supported ? `${voicePercent}%` : "不支持";
    }

    function showCreditFeedback(amount, balance) {
      elements.creditFeedback.textContent = `+${amount}`;
      elements.creditLive.textContent = `已增加${amount}颗弹珠，当前共有${balance}颗`;
      elements.creditFeedback.getAnimations?.().forEach((animation) => animation.cancel());
      elements.wallet.getAnimations?.().forEach((animation) => animation.cancel());
      elements.creditFeedback.animate?.(
        [
          { opacity: 0, transform: "translateY(6px) scale(.82)" },
          { opacity: 1, transform: "translateY(-4px) scale(1.08)", offset: .3 },
          { opacity: 0, transform: "translateY(-24px) scale(.96)" },
        ],
        { duration: 720, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      elements.wallet.animate?.(
        [
          { filter: "brightness(1)", transform: "scale(1)" },
          { filter: "brightness(1.8)", transform: "scale(1.08)" },
          { filter: "brightness(1)", transform: "scale(1)" },
        ],
        { duration: 360, easing: "ease-out" },
      );
    }

    function hideCreditMenu() {
      setCreditMenuOpen(false);
    }

    function hideSkinMenu() {
      setSkinMenuOpen(false);
    }

    function setSkin(skinId) {
      const selected = C.SKINS.find((skin) => skin.id === skinId) || C.SKINS[0];
      elements.skinOptions.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.skinId === selected.id));
      });
      elements.skinButton.setAttribute("aria-label", `切换皮肤，当前${selected.label}`);
    }

    function showResult(result) {
      elements.resultCard.hidden = result.won;
      elements.resultCard.classList.toggle("is-loss", !result.won);
      elements.resultImage.hidden = !result.won;
      elements.resultTitle.textContent = result.won ? "命中！" : "差一点";
      elements.resultDetail.textContent = result.won
        ? `${result.multiplier} 倍返还 ${result.payout} 分${result.cardsAwarded ? ` · 卡片 +${result.cardsAwarded}` : ""}`
        : `落入 ${result.landingHole + 1} 号洞，损失 ${result.wager} 分`;
    }

    function hideResult() {
      elements.resultCard.hidden = true;
    }

    function updateMultiplierAnnouncement(multiplier, potentialPayout) {
      if (!Number.isFinite(multiplier)) return;
      elements.announcementMultiplier.textContent = `×${multiplier}`;
      elements.announcementPayout.textContent = `命中可得 ${potentialPayout} 颗`;
    }

    function showMultiplierAnnouncement(multiplier, potentialPayout) {
      updateMultiplierAnnouncement(multiplier, potentialPayout);
      elements.multiplierAnnouncement.hidden = false;
      elements.multiplierAnnouncement.classList.remove("is-leaving");
      void elements.multiplierAnnouncement.offsetWidth;
      elements.multiplierAnnouncement.classList.add("is-visible");
    }

    function hideMultiplierAnnouncement() {
      elements.multiplierAnnouncement.classList.remove("is-visible");
      elements.multiplierAnnouncement.classList.add("is-leaving");
      elements.multiplierAnnouncement.hidden = true;
    }

    function showWinCelebration(result) {
      const isMega = result.payout >= 500;
      elements.winCelebration.hidden = false;
      elements.winCelebration.classList.remove("is-visible", "is-finale", "is-mega");
      elements.winCelebration.classList.toggle("is-mega", isMega);
      elements.winCelebrationTitle.textContent = isMega ? "超级大奖" : "恭喜中奖";
      elements.winCelebrationPayout.textContent = "+0 颗弹珠";
      elements.winCelebrationCards.hidden = !result.cardsAwarded;
      elements.winCelebrationCards.textContent = `+${result.cardsAwarded || 0} 张卡片`;
      elements.winCelebrationMultiplier.textContent = `×${result.multiplier} 倍好运`;
      elements.winCelebrationLive.textContent = result.cardsAwarded
        ? `恭喜中奖，赢得${result.payout}颗弹珠，还获得${result.cardsAwarded}张卡片`
        : `恭喜中奖，赢得${result.payout}颗弹珠`;
      void elements.winCelebration.offsetWidth;
      elements.winCelebration.classList.add("is-visible");
    }

    function updateWinCelebration(processedCount, result) {
      if (elements.winCelebration.hidden || !result) return;
      const processed = Math.max(0, Math.min(result.payout, Number(processedCount) || 0));
      elements.winCelebrationPayout.textContent = `+${processed} 颗弹珠`;
    }

    function finishWinCelebration(result) {
      if (elements.winCelebration.hidden || !result) return;
      updateWinCelebration(result.payout, result);
      elements.winCelebration.classList.add("is-finale");
    }

    function hideWinCelebration() {
      elements.winCelebration.classList.remove("is-visible", "is-finale", "is-mega");
      elements.winCelebration.hidden = true;
      elements.winCelebrationLive.textContent = "";
    }

    function render(state, view) {
      const round = state.activeRound;
      const wager = round ? round.wager : state.draftWager;
      const totalAvailable = round ? state.balance + round.wager : state.balance;
      const queue = view.wagerQueue;
      const bank = view.rewardBank;
      const cards = view.cardDispenser;
      elements.balance.textContent = bank?.storedCount ?? state.balance;
      elements.wager.textContent = wager;

      const canSetDraft = view.phase === "betting";
      const canIncreaseRound = view.phase === "ready";
      const canIncrease = canSetDraft || canIncreaseRound;
      const wagerQueueIdle = queue?.idle ?? true;
      elements.minus.disabled = !canSetDraft || wager <= C.MIN_WAGER;
      const wagerLimit = state.wagerLimit ?? C.DEFAULT_WAGER_LIMIT;
      elements.plus.disabled = !canIncrease || wager >= Math.min(totalAvailable, wagerLimit, C.MAX_WAGER);
      elements.start.disabled = view.phase !== "betting"
        || !Game.Rules.validateWager(wager, state.balance, wagerLimit);
      elements.babyMode.disabled = view.phase !== "betting";
      elements.babyMode.setAttribute("aria-checked", String(view.babyMode));
      elements.babyMode.setAttribute("aria-label", `宝宝模式，当前${view.babyMode ? "开启" : "关闭"}`);
      elements.launch.disabled = !["ready", "charging"].includes(view.phase) || !wagerQueueIdle;
      elements.launch.classList.toggle("is-charging", view.phase === "charging");
      elements.tray.classList.toggle("is-locked", !canIncrease);
      elements.gameOver.hidden = view.phase !== "gameover";
      elements.wagerPresets.forEach((button) => {
        const preset = Number(button.dataset.wagerPreset);
        button.classList.toggle("is-selected", preset === wager);
        button.disabled = !canIncrease
          || preset > Math.min(totalAvailable, wagerLimit, C.MAX_WAGER)
          || (canIncreaseRound && preset <= wager);
      });
      elements.wagerLimitValue.textContent = wagerLimit;
      elements.wagerLimitButton.disabled = !canSetDraft;
      elements.wagerLimitButton.setAttribute("aria-label", `设置投注上限，当前${wagerLimit}分`);
      elements.wagerLimitOptions.forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.wagerLimit) === wagerLimit));
      });
      if (!canSetDraft) setWagerLimitMenuOpen(false);

      if (!bank || bank.mode === "idle") {
        elements.rewardBankLabel.textContent = "仓内";
        elements.rewardBankCount.textContent = bank?.overflow
          ? "999+"
          : bank?.visibleStoredCount ?? state.balance;
        elements.rewardBankProgress.textContent = "";
      } else if (bank.mode === "deposit") {
        elements.rewardBankLabel.textContent = "入仓";
        elements.rewardBankCount.textContent = bank.overflow ? "999+" : bank.visibleStoredCount;
        elements.rewardBankProgress.textContent = `${bank.processedCount}/${bank.targetCount}`;
      } else {
        elements.rewardBankLabel.textContent = "仓内";
        elements.rewardBankCount.textContent = bank.overflow ? "999+" : bank.visibleStoredCount;
        elements.rewardBankProgress.textContent = `放出 ${bank.processedCount}/${bank.targetCount}`;
      }

      if (!queue?.started) {
        elements.stakeStatusLabel.textContent = "待投入";
        elements.stakeCount.textContent = wager;
        elements.stakeProgress.textContent = "";
      } else if (wagerQueueIdle) {
        elements.stakeStatusLabel.textContent = "已投入";
        elements.stakeCount.textContent = queue.targetCount;
        elements.stakeProgress.textContent = "";
      } else {
        elements.stakeStatusLabel.textContent = "存量";
        elements.stakeCount.textContent = queue.stockCount;
        elements.stakeProgress.textContent = `已入 ${queue.enteredCount}/${queue.targetCount}`;
      }

      const labels = {
        betting: "开始",
        revealing: "摇奖中",
        ready: "倍率锁定",
        charging: "蓄力中",
        flight: "飞行中",
        settling: "结算中",
        rewarding: "入仓中",
        gameover: "结束",
      };
      elements.start.textContent = labels[view.phase] || "开始";

      const phaseMessages = {
        betting: "选择下注，点击开始",
        revealing: "倍率正在滚动…",
        ready: `命中可得 ${view.potentialPayout || 0} 颗 · 存量 ${queue?.stockCount ?? wager} 颗`,
        charging: "松开发射！",
        flight: "弹珠飞行中",
        settling: state.lastResult?.won ? "中奖啦！" : "本轮未命中",
        rewarding: `奖珠 ${bank?.processedCount || 0}/${bank?.targetCount || state.lastResult?.payout || 0}${cards?.cardsAwarded ? ` · 卡片 +${cards.cardsAwarded}` : ""}`,
        gameover: "积分不足",
      };
      let phaseMessage = phaseMessages[view.phase] || "";
      if (!wagerQueueIdle && view.phase === "revealing") {
        phaseMessage = `倍率摇奖中 · 存量 ${queue.stockCount}`;
      } else if (!wagerQueueIdle && view.phase === "ready") {
        phaseMessage = `命中可得 ${view.potentialPayout || 0} 颗 · 存量 ${queue.stockCount} 颗`;
      }
      elements.phase.textContent = phaseMessage;
      elements.phase.classList.toggle(
        "is-pulse",
        !wagerQueueIdle || ["revealing", "charging", "rewarding"].includes(view.phase),
      );
      setMultiplier(view.displayMultiplier);
    }

    return Object.freeze({
      elements,
      hideCreditMenu,
      hideSkinMenu,
      hideMultiplierAnnouncement,
      hideResult,
      hideWinCelebration,
      finishWinCelebration,
      render,
      setAudioControls,
      setMultiplier,
      setPower,
      setSkin,
      showMultiplierAnnouncement,
      showCreditFeedback,
      showResult,
      showWinCelebration,
      updateMultiplierAnnouncement,
      updateWinCelebration,
    });
  }

  Game.UI = Object.freeze({ create: createUI });
})(window);
