(function initCardDispenser(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;

  function safeCount(value, fallback = 0) {
    return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  }

  function normalizeRewards(value = {}) {
    return {
      points: safeCount(value.points),
      progress: Math.min(C.CARD_POINTS_PER_CARD - 1, safeCount(value.progress)),
      totalCards: safeCount(value.totalCards),
    };
  }

  class CardDispenser {
    constructor(container, options = {}) {
      if (!container) throw new TypeError("缺少卡片槽容器");
      this.container = container;
      this.showcase = options.showcase || document.getElementById("card-showcase");
      this.mouth = options.mouth || container.querySelector(".card-slot-mouth");
      this.pointsElement = options.pointsElement || container.querySelector("[data-card-points]");
      this.totalElement = options.totalElement || container.querySelector("[data-card-total]");
      this.progressElement = options.progressElement || container.querySelector("[data-card-progress]");
      this.statusElement = options.statusElement || container.querySelector("[data-card-status]");
      this.countElement = options.countElement
        || container.querySelector("[data-card-count]")
        || this.totalElement;
      this.metricsContainer = options.metricsContainer
        || this.pointsElement?.closest(".card-wallet")
        || container;
      if (!this.showcase || !this.countElement) {
        throw new TypeError("卡片槽 DOM 不完整");
      }

      this.onIdleChange = options.onIdleChange || (() => {});
      this.onProgress = options.onProgress || (() => {});
      this.timings = {
        stagger: options.timings?.stagger ?? 160,
        move: options.timings?.move ?? 520,
        hold: options.timings?.hold ?? 3_000,
        dismiss: options.timings?.dismiss ?? 360,
        pointsPulse: options.timings?.pointsPulse ?? 640,
      };
      this.reducedMotion = options.reducedMotion
        ?? global.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ?? false;
      this.timers = new Set();
      this.frameRequests = new Set();
      this.destroyed = false;
      this.idleState = true;
      this.mode = "idle";
      this.activeCards = [];
      this.cardsAwarded = 0;
      this.cardsDiscarded = 0;
      this.pointsAdded = 0;
      this.visibleRewards = normalizeRewards();
      this.targetRewards = normalizeRewards();
      this.reset(this.targetRewards);
    }

    schedule(callback, delay) {
      const timer = global.setTimeout(() => {
        this.timers.delete(timer);
        if (!this.destroyed) callback();
      }, Math.max(0, delay));
      this.timers.add(timer);
      return timer;
    }

    nextFrame(callback) {
      const request = global.requestAnimationFrame((now) => {
        this.frameRequests.delete(request);
        if (!this.destroyed) callback(now);
      });
      this.frameRequests.add(request);
      return request;
    }

    cancelScheduled() {
      this.timers.forEach((timer) => global.clearTimeout(timer));
      this.frameRequests.forEach((request) => global.cancelAnimationFrame(request));
      this.timers.clear();
      this.frameRequests.clear();
    }

    reset(snapshot = {}) {
      this.cancelScheduled();
      this.removeCards();
      this.targetRewards = normalizeRewards(snapshot);
      this.visibleRewards = { ...this.targetRewards };
      this.cardsAwarded = 0;
      this.cardsDiscarded = 0;
      this.pointsAdded = 0;
      if (this.statusElement) this.statusElement.textContent = this.defaultStatus(this.visibleRewards);
      this.toggleStateClasses(false, false, false);
      this.showcase.classList.remove("is-dismissing");
      this.showcase.hidden = true;
      this.setMode("idle");
      this.syncMetrics(true);
      return this.getSnapshot();
    }

    dispense(result = {}) {
      if (!this.isIdle()) throw new Error("卡片槽忙碌时不能重复发卡");
      const cardsAwarded = Math.min(C.CARD_MAX_PER_ROUND, safeCount(result.cardsAwarded));
      const cardsDiscarded = safeCount(result.cardsDiscarded);
      const pointsAdded = safeCount(result.cardPointsAdded);
      const targetRewards = normalizeRewards(result.cardRewards || this.visibleRewards);
      this.cancelScheduled();
      this.removeCards();
      this.cardsAwarded = cardsAwarded;
      this.cardsDiscarded = cardsDiscarded;
      this.pointsAdded = pointsAdded;
      this.targetRewards = targetRewards;
      this.visibleRewards.progress = targetRewards.progress;
      this.visibleRewards.totalCards = Math.max(0, targetRewards.totalCards - cardsAwarded);
      this.syncMetrics();
      this.toggleStateClasses(cardsAwarded > 0, cardsDiscarded > 0, false);
      this.animatePoints(this.visibleRewards.points, targetRewards.points);

      if (cardsAwarded === 0) {
        if (this.statusElement) {
          this.statusElement.textContent = pointsAdded > 0
            ? `+${pointsAdded} 卡片分 · 进度 ${targetRewards.progress}/${C.CARD_POINTS_PER_CARD}`
            : `距下张 ${C.CARD_POINTS_PER_CARD - targetRewards.progress} 分`;
        }
        this.setMode("counting");
        this.schedule(() => this.finishDispense(), this.reducedMotion ? 80 : this.timings.pointsPulse);
        return this.getSnapshot();
      }

      if (this.statusElement) {
        this.statusElement.textContent = cardsDiscarded > 0
          ? `本局已满${C.CARD_MAX_PER_ROUND}张`
          : `本局 +${cardsAwarded}张`;
      }
      this.setMode("dispensing");
      this.container.classList.add("is-dispensing");
      this.metricsContainer.classList.add("is-dispensing");
      this.createCards(cardsAwarded);
      return this.getSnapshot();
    }

    animatePoints(from, to) {
      if (from === to || this.reducedMotion) {
        this.visibleRewards.points = to;
        this.syncMetrics();
        return;
      }
      const startedAt = performance.now();
      const duration = Math.min(900, Math.max(360, this.pointsAdded * 8));
      const tick = (now) => {
        const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
        const eased = 1 - ((1 - progress) ** 3);
        this.visibleRewards.points = Math.round(from + (to - from) * eased);
        this.syncMetrics();
        if (progress < 1 && !this.destroyed && this.mode !== "idle") this.nextFrame(tick);
      };
      this.nextFrame(tick);
    }

    createCards(count) {
      const columns = count === 1 ? 1 : count <= 4 ? 2 : 3;
      this.showcase.dataset.columns = String(columns);
      this.showcase.hidden = false;
      this.showcase.classList.remove("is-dismissing");
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < count; index += 1) {
        const card = document.createElement("article");
        card.className = "reward-card";
        card.setAttribute("aria-hidden", "true");
        card.innerHTML = `
          <span class="reward-card-gem game-icon game-icon--gem"></span>
          <img src="assets/mascot-win-v2.webp" alt="">
          <span class="reward-card-copy"><strong>幸运奖卡</strong><small>MARBLE LUCK</small></span>
          <i>★</i>
        `;
        fragment.appendChild(card);
        this.activeCards.push(card);
      }
      this.showcase.appendChild(fragment);

      this.nextFrame(() => {
        const mouthRect = this.mouth?.getBoundingClientRect() || this.container.getBoundingClientRect();
        this.activeCards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const fromX = mouthRect.left + mouthRect.width / 2 - (rect.left + rect.width / 2);
          const fromY = mouthRect.top + mouthRect.height / 2 - (rect.top + rect.height / 2);
          card.style.setProperty("--card-from-x", `${fromX}px`);
          card.style.setProperty("--card-from-y", `${fromY}px`);
          const delay = this.reducedMotion ? 0 : index * this.timings.stagger;
          this.schedule(() => {
            card.classList.add("is-presented");
            this.visibleRewards.totalCards = Math.min(
              this.targetRewards.totalCards,
              this.visibleRewards.totalCards + 1,
            );
            this.syncMetrics();
            this.pulseMouth();
            this.onProgress(this.getSnapshot());
          }, delay);
        });

        const arrivalDelay = this.reducedMotion
          ? 30
          : Math.max(0, count - 1) * this.timings.stagger + this.timings.move;
        this.schedule(() => {
          this.setMode("holding");
          this.schedule(() => this.dismissCards(), this.timings.hold);
        }, arrivalDelay);
      });
    }

    dismissCards() {
      this.setMode("dismissing");
      this.showcase.classList.add("is-dismissing");
      this.schedule(() => this.finishDispense(), this.reducedMotion ? 80 : this.timings.dismiss);
    }

    finishDispense() {
      this.cancelScheduled();
      this.removeCards();
      this.visibleRewards = { ...this.targetRewards };
      this.toggleStateClasses(false, false, false);
      if (this.statusElement) this.statusElement.textContent = this.defaultStatus(this.visibleRewards);
      this.setMode("idle");
      this.syncMetrics(true);
    }

    removeCards() {
      this.activeCards.forEach((card) => card.remove());
      this.activeCards = [];
      this.showcase?.classList.remove("is-dismissing");
      if (this.showcase) {
        this.showcase.hidden = true;
        delete this.showcase.dataset.columns;
      }
    }

    pulseMouth() {
      if (!this.mouth) return;
      this.mouth.classList.remove("is-ejecting");
      void this.mouth.offsetWidth;
      this.mouth.classList.add("is-ejecting");
    }

    defaultStatus(rewards) {
      return `总卡 ${rewards.totalCards} · 距下张 ${C.CARD_POINTS_PER_CARD - rewards.progress} 分`;
    }

    toggleStateClasses(counting, capped, dispensing) {
      [this.container, this.metricsContainer].forEach((element) => {
        element.classList.toggle("is-counting", counting);
        element.classList.toggle("is-capped", capped);
        element.classList.toggle("is-dispensing", dispensing);
      });
    }

    setMode(mode) {
      const nextIdle = mode === "idle";
      this.mode = mode;
      this.container.dataset.cardMode = mode;
      this.container.setAttribute("aria-busy", String(!nextIdle));
      if (this.idleState !== nextIdle) {
        this.idleState = nextIdle;
        this.onIdleChange(nextIdle, this.getSnapshot());
      }
      this.onProgress(this.getSnapshot());
    }

    syncMetrics(force = false) {
      if (this.pointsElement) this.pointsElement.textContent = String(this.visibleRewards.points);
      if (this.totalElement) this.totalElement.textContent = String(this.visibleRewards.totalCards);
      this.countElement.textContent = String(this.visibleRewards.totalCards);
      if (this.progressElement) {
        this.progressElement.textContent = `${this.targetRewards.progress}/${C.CARD_POINTS_PER_CARD}`;
      }
      if (force) this.onProgress(this.getSnapshot());
    }

    isIdle() {
      return this.mode === "idle" && this.activeCards.length === 0;
    }

    getSnapshot() {
      return Object.freeze({
        mode: this.mode,
        idle: this.isIdle(),
        activeCount: this.activeCards.length,
        cardsAwarded: this.cardsAwarded,
        cardsDiscarded: this.cardsDiscarded,
        pointsAdded: this.pointsAdded,
        visibleRewards: Object.freeze({ ...this.visibleRewards }),
        targetRewards: Object.freeze({ ...this.targetRewards }),
      });
    }

    destroy() {
      this.destroyed = true;
      this.cancelScheduled();
      this.removeCards();
    }
  }

  Game.CardDispenser = CardDispenser;
})(window);
