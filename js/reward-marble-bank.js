(function initRewardMarbleBank(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function toCount(value, label = "弹珠数量") {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`${label}必须是非负安全整数`);
    }
    return count;
  }

  function depositDuration(count) {
    if (count <= 50) return 3;
    if (count <= C.REWARD_LOOP_THRESHOLD) {
      return 3 + ((count - 50) / (C.REWARD_LOOP_THRESHOLD - 50));
    }
    return C.REWARD_LOOP_DURATION_MS / 1000;
  }

  class RewardMarbleBank {
    constructor(container, options = {}) {
      if (!container) throw new TypeError("缺少中奖弹珠仓容器");
      this.container = container;
      this.canvas = options.canvas || container.querySelector("canvas");
      if (!this.canvas) throw new TypeError("缺少中奖弹珠仓 Canvas");
      this.ctx = this.canvas.getContext("2d");
      this.mouth = options.mouth || container.querySelector(".reward-bank-mouth");
      this.onWithdrawMarble = options.onWithdrawMarble || (() => {});
      this.onDepositMarble = options.onDepositMarble || (() => {});
      this.onProgress = options.onProgress || (() => {});
      this.onIdleChange = options.onIdleChange || (() => {});
      this.autoStart = options.autoStart !== false;
      this.reducedMotion = options.reducedMotion
        ?? Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      this.fixedStep = options.fixedStep ?? C.REWARD_BANK_PHYSICS_STEP;
      this.worldWidth = C.REWARD_BANK_WORLD_WIDTH;
      this.worldHeight = C.REWARD_BANK_WORLD_HEIGHT;
      this.withdrawInterval = (options.withdrawCadence ?? C.REWARD_WITHDRAW_CADENCE_MS) / 1000;
      this.radius = 4.8;
      this.storageRadius = this.radius;
      this.visualRadiusCss = 0;
      this.visualCapacity = 0;
      this.minimumStoredDistance = null;
      this.storagePositions = [];
      this.storageLayerScale = 2;
      this.storageLayer = document.createElement("canvas");
      this.storageLayer.width = Math.ceil(this.worldWidth * this.storageLayerScale);
      this.storageLayer.height = Math.ceil(this.worldHeight * this.storageLayerScale);
      this.storageLayerContext = this.storageLayer.getContext("2d");
      this.storageLayerCount = 0;
      this.frameRequest = 0;
      this.lastFrameAt = 0;
      this.accumulator = 0;
      this.renderClock = 0;
      this.canvasMetrics = null;
      this.renderFrames = 0;
      this.layoutReads = 0;
      this.storedMarblesDrawn = 0;
      this.randomState = 0x34b19a27;
      this.lastProgressKey = "";
      this.lastProgressNotifyAt = -Infinity;
      this.idleState = true;
      this.destroyed = false;
      this.rebuildStoragePositions();
      this.reset(0);
    }

    nextRandom() {
      this.randomState = (Math.imul(this.randomState, 1_664_525) + 1_013_904_223) >>> 0;
      return this.randomState / 4_294_967_296;
    }

    reset(balance) {
      const stored = toCount(balance, "仓内积分");
      this.cancelFrame();
      this.mode = "idle";
      this.storedCount = stored;
      this.visibleStoredCount = stored;
      this.targetCount = 0;
      this.pendingCount = 0;
      this.processedCount = 0;
      this.logicalProcessedCount = 0;
      this.balls = [];
      this.animationMode = "idle";
      this.initialStoredCount = stored;
      this.targetFinalStoredCount = stored;
      this.elapsed = 0;
      this.targetDuration = 0;
      this.completedAt = null;
      this.spawnClock = 0;
      this.emissionInterval = 0;
      this.invalidRescues = 0;
      this.storageRedraws = 0;
      this.lastStorageSyncAt = -Infinity;
      this.lastMouthPulseAt = -Infinity;
      this.randomState = 0x34b19a27 ^ stored;
      this.accumulator = 0;
      this.renderClock = 0;
      this.renderFrames = 0;
      this.layoutReads = 0;
      this.storedMarblesDrawn = 0;
      this.rebuildStorageLayer(true);
      this.setIdleState(true);
      this.syncState(true);
      this.render();
      return this.getSnapshot();
    }

    deposit(value) {
      const count = toCount(value, "中奖返还");
      if (count === 0) return this.getSnapshot();
      if (!this.isIdle()) throw new Error("弹珠仓忙碌时不能开始入仓");
      this.cancelFrame();
      this.mode = "deposit";
      this.targetCount = count;
      this.pendingCount = count;
      this.processedCount = 0;
      this.logicalProcessedCount = 0;
      this.balls = [];
      this.animationMode = count > C.REWARD_LOOP_THRESHOLD ? "loop" : "exact";
      this.initialStoredCount = this.storedCount;
      this.targetFinalStoredCount = this.storedCount + count;
      this.elapsed = 0;
      this.targetDuration = depositDuration(count);
      this.completedAt = null;
      const fallingTail = 0.88;
      this.emissionInterval = this.animationMode === "exact" && count > 1
        ? Math.max(0.012, (this.targetDuration - fallingTail) / (count - 1))
        : 0;
      this.spawnClock = this.emissionInterval;
      this.invalidRescues = 0;
      this.storageRedraws = 0;
      this.lastStorageSyncAt = -Infinity;
      this.lastMouthPulseAt = -Infinity;
      this.randomState = 0x7a2d135f ^ count ^ this.storedCount;
      this.accumulator = 0;
      this.renderClock = 0;
      this.renderFrames = 0;
      this.storedMarblesDrawn = 0;
      if (this.animationMode === "loop") this.createLoopPool();
      this.setIdleState(false);
      this.syncState(true);
      this.render();
      if (this.reducedMotion) {
        this.finishOperation();
        this.render();
        return this.getSnapshot();
      }
      this.scheduleFrame();
      return this.getSnapshot();
    }

    withdraw(value) {
      const count = toCount(value, "取出积分");
      if (count === 0) return this.getSnapshot();
      if (this.mode === "deposit") throw new Error("中奖入仓时不能取出弹珠");
      if (count > this.storedCount) throw new RangeError("弹珠仓余额不足");

      this.storedCount -= count;
      if (this.mode === "idle") {
        this.cancelFrame();
        this.mode = "withdraw";
        this.animationMode = "exact";
        this.targetCount = 0;
        this.pendingCount = 0;
        this.processedCount = 0;
        this.elapsed = 0;
        this.completedAt = null;
        this.spawnClock = this.withdrawInterval;
        this.accumulator = 0;
        this.renderClock = 0;
        this.renderFrames = 0;
        this.storedMarblesDrawn = 0;
      }
      this.targetCount += count;
      this.pendingCount += count;
      this.setIdleState(false);
      this.syncState(true);
      this.scheduleFrame();
      return this.getSnapshot();
    }

    isIdle() {
      return this.mode === "idle" && this.pendingCount === 0 && this.balls.length === 0;
    }

    credit(value) {
      const count = toCount(value, "上分数量");
      if (count === 0) return this.getSnapshot();
      const nextStoredCount = this.storedCount + count;
      const nextVisibleCount = this.visibleStoredCount + count;
      if (!Number.isSafeInteger(nextStoredCount) || !Number.isSafeInteger(nextVisibleCount)) {
        throw new RangeError("上分后弹珠数量超出安全范围");
      }

      this.storedCount = nextStoredCount;
      this.visibleStoredCount = nextVisibleCount;
      if (this.mode === "deposit") {
        this.initialStoredCount += count;
        this.targetFinalStoredCount += count;
      } else {
        this.targetFinalStoredCount = this.storedCount;
      }
      this.syncStorageLayer();
      this.render();
      this.syncState(true);
      return this.getSnapshot();
    }

    setVisualRadius(cssPixels) {
      const nextCssRadius = Number(cssPixels);
      if (!Number.isFinite(nextCssRadius) || nextCssRadius <= 0) {
        throw new RangeError("弹珠屏幕半径必须是正数");
      }
      const metrics = this.resizeCanvas(true);
      const nextWorldRadius = nextCssRadius / metrics.scale;
      if (
        Math.abs(nextCssRadius - this.visualRadiusCss) < 0.02
        && Math.abs(nextWorldRadius - this.radius) < 0.02
      ) return this.getSnapshot();

      const ratio = nextWorldRadius / this.radius;
      this.visualRadiusCss = nextCssRadius;
      this.container.dataset.visualRadiusCss = nextCssRadius.toFixed(3);
      this.radius = nextWorldRadius;
      this.storageRadius = nextWorldRadius;
      this.rebuildStoragePositions();
      this.balls.forEach((ball) => {
        ball.radius = nextWorldRadius;
        if (this.animationMode === "loop") {
          ball.targetX = clamp(ball.targetX, 12, this.worldWidth - 12);
          ball.targetY = 590;
        } else if (Number.isFinite(ball.targetX)) {
          const target = this.storagePosition(this.visibleStoredCount + Math.max(0, ball.id - 1));
          ball.targetX = target.x;
          ball.targetY = target.y;
        }
        ball.vx *= Number.isFinite(ratio) ? ratio : 1;
      });
      this.rebuildStorageLayer(true);
      this.render();
      this.syncState(true);
      return this.getSnapshot();
    }

    getSnapshot() {
      const renderedStoredCount = Math.min(this.visibleStoredCount, this.visualCapacity);
      return Object.freeze({
        storedCount: this.storedCount,
        visibleStoredCount: this.visibleStoredCount,
        renderedStoredCount,
        overflow: this.visibleStoredCount > 999,
        visuallyTruncated: this.visibleStoredCount > this.visualCapacity,
        visualCapacity: this.visualCapacity,
        visualRadiusCss: this.visualRadiusCss,
        visualRadiusWorld: this.radius,
        minimumStoredDistance: this.minimumStoredDistance,
        mode: this.mode,
        targetCount: this.targetCount,
        pendingCount: this.pendingCount,
        activeCount: this.balls.length,
        activeVisualCount: this.balls.length,
        poolSize: this.animationMode === "loop" ? C.REWARD_LOOP_POOL_SIZE : 0,
        animationMode: this.animationMode,
        processedCount: this.processedCount,
        logicalProcessedCount: this.logicalProcessedCount,
        elapsed: this.elapsed,
        targetDuration: this.targetDuration,
        completedAt: this.completedAt,
        invalidRescues: this.invalidRescues,
        storageRedraws: this.storageRedraws,
        renderFrames: this.renderFrames,
        layoutReads: this.layoutReads,
        storedMarblesDrawn: this.storedMarblesDrawn,
        idle: this.isIdle(),
      });
    }

    advance(frameDelta) {
      if (this.isIdle()) return this.getSnapshot();
      const delta = clamp(Number(frameDelta) || 0, 0, 0.1);
      this.accumulator += delta;
      const activeStep = this.mode === "deposit" && this.animationMode === "loop"
        ? C.REWARD_LOOP_PHYSICS_STEP
        : this.fixedStep;
      let steps = 0;
      while (this.accumulator >= activeStep && steps < 12) {
        this.step(activeStep);
        this.accumulator -= activeStep;
        steps += 1;
      }
      if (steps === 12) this.accumulator = 0;
      this.renderClock += delta;
      const renderInterval = 1 / C.REWARD_LOOP_RENDER_FPS;
      const shouldRender = this.animationMode !== "loop"
        || this.renderClock >= renderInterval
        || this.isIdle();
      if (shouldRender) {
        this.render();
        this.renderClock = this.animationMode === "loop"
          ? this.renderClock % renderInterval
          : 0;
      }
      this.syncState();
      return this.getSnapshot();
    }

    step(dt) {
      this.elapsed += dt;
      if (this.mode === "withdraw") {
        this.stepWithdraw(dt);
      } else if (this.mode === "deposit") {
        if (this.animationMode === "loop") this.stepLoopDeposit(dt);
        else this.stepDeposit(dt);
      }
    }

    stepWithdraw(dt) {
      this.spawnClock += dt;
      while (this.pendingCount > 0 && this.spawnClock >= this.withdrawInterval) {
        this.spawnClock -= this.withdrawInterval;
        this.pendingCount -= 1;
        this.visibleStoredCount = Math.max(0, this.visibleStoredCount - 1);
        this.syncStorageLayer();
        this.spawnWithdrawBall();
      }

      this.balls.forEach((ball) => {
        ball.age += dt;
        ball.vy += 1_150 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.alpha = clamp(1 - Math.max(0, ball.y - 650) / 34, 0.15, 1);
      });

      const survivors = [];
      this.balls.forEach((ball) => {
        if (ball.y >= this.worldHeight - 5) {
          this.processedCount += 1;
          this.logicalProcessedCount = this.processedCount;
          this.pulseMouth("release");
          this.onWithdrawMarble(this.processedCount, this.getSnapshot());
          return;
        }
        survivors.push(ball);
      });
      this.balls = survivors;
      if (this.pendingCount === 0 && this.balls.length === 0) this.finishOperation();
    }

    stepDeposit(dt) {
      this.spawnClock += dt;
      while (this.pendingCount > 0 && this.spawnClock >= this.emissionInterval) {
        if (this.emissionInterval > 0) this.spawnClock -= this.emissionInterval;
        else this.spawnClock = 0;
        this.spawnDepositBall();
      }

      this.balls.forEach((ball) => {
        ball.age += dt;
        ball.vy += 1_820 * dt;
        ball.vx += (ball.targetX - ball.x) * 17 * dt;
        const drag = Math.pow(ball.y > ball.targetY - 70 ? 0.973 : 0.995, dt * 120);
        ball.vx *= drag;
        ball.vy *= drag;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
      });

      for (let iteration = 0; iteration < 2; iteration += 1) {
        this.balls.forEach((ball) => this.resolveWalls(ball));
        this.resolveBallPairs();
      }

      const survivors = [];
      this.balls.forEach((ball) => {
        if (!Number.isFinite(ball.x + ball.y + ball.vx + ball.vy)) {
          this.invalidRescues += 1;
          ball.x = this.worldWidth / 2;
          ball.y = this.worldHeight - 48;
          ball.vx = 0;
          ball.vy = 260;
        }
        if (ball.y >= ball.targetY || ball.age > 1.4) {
          this.processedCount += 1;
          this.logicalProcessedCount = this.processedCount;
          this.storedCount += 1;
          this.visibleStoredCount += 1;
          this.syncStorageLayer();
          this.pulseMouth("deposit");
          this.onDepositMarble(this.processedCount, this.getSnapshot());
          return;
        }
        survivors.push(ball);
      });
      this.balls = survivors;

      if (this.pendingCount === 0 && this.balls.length === 0) this.finishOperation();
    }

    stepLoopDeposit(dt) {
      const progress = clamp(this.elapsed / this.targetDuration, 0, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextProcessed = progress >= 1
        ? this.targetCount
        : Math.min(this.targetCount, Math.floor(this.targetCount * easedProgress));
      const added = Math.max(0, nextProcessed - this.processedCount);

      this.processedCount = nextProcessed;
      this.logicalProcessedCount = nextProcessed;
      this.pendingCount = this.targetCount - nextProcessed;
      this.storedCount = this.initialStoredCount + nextProcessed;
      this.visibleStoredCount = this.storedCount;

      this.balls.forEach((ball) => {
        ball.age += dt;
        ball.vy += 1_250 * dt;
        ball.vx += (ball.targetX - ball.x) * 8 * dt;
        ball.vx *= Math.pow(0.992, dt * 60);
        ball.vy *= Math.pow(0.996, dt * 60);
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        this.resolveWalls(ball);
        if (ball.y >= 590 || ball.age > 1.35) this.recycleLoopBall(ball);
      });
      this.resolveBallPairs();

      const refreshInterval = 1 / C.REWARD_PROGRESS_FPS;
      if (this.elapsed - this.lastStorageSyncAt >= refreshInterval || progress >= 1) {
        this.lastStorageSyncAt = this.elapsed;
        this.syncStorageLayer();
        if (added > 0) this.onDepositMarble(this.processedCount, this.getSnapshot(), added);
      }
      if (added > 0 && this.elapsed - this.lastMouthPulseAt >= 0.125) {
        this.lastMouthPulseAt = this.elapsed;
        this.pulseMouth("deposit");
      }

      if (progress >= 1) {
        this.balls = [];
        this.finishOperation();
      }
    }

    createLoopPool() {
      this.balls = Array.from({ length: C.REWARD_LOOP_POOL_SIZE }, (_, index) => {
        const ball = { id: index + 1, radius: this.radius, age: 0 };
        this.recycleLoopBall(ball, index);
        return ball;
      });
    }

    recycleLoopBall(ball, staggerIndex = 0) {
      const randomA = this.nextRandom();
      const randomB = this.nextRandom();
      ball.x = 12 + randomA * (this.worldWidth - 24);
      ball.y = 7 - staggerIndex * 25 - randomB * 36;
      ball.vx = (randomA - 0.5) * 62;
      ball.vy = 92 + randomB * 58;
      ball.targetX = 12 + this.nextRandom() * (this.worldWidth - 24);
      ball.targetY = 590;
      ball.radius = this.radius;
      ball.age = 0;
      ball.alpha = 1;
    }

    spawnDepositBall() {
      const randomA = this.nextRandom();
      const randomB = this.nextRandom();
      const plannedIndex = this.visibleStoredCount + this.balls.length;
      const overflowTarget = plannedIndex >= this.visualCapacity;
      const target = overflowTarget
        ? { x: this.worldWidth / 2, y: this.worldHeight - 14 }
        : this.storagePosition(plannedIndex);
      this.balls.push({
        id: this.targetCount - this.pendingCount + 1,
        x: 12 + randomA * (this.worldWidth - 24),
        y: 7 + randomB * 3,
        vx: (randomA - 0.5) * 76,
        vy: 18 + randomB * 28,
        radius: this.radius,
        targetX: target.x,
        targetY: target.y,
        overflowTarget,
        age: 0,
      });
      this.pendingCount -= 1;
    }

    spawnWithdrawBall() {
      const random = this.nextRandom();
      this.balls.push({
        id: this.targetCount - this.pendingCount,
        kind: "withdraw",
        x: this.worldWidth / 2 + (random - 0.5) * 12,
        y: this.worldHeight - 78 - random * 8,
        vx: (random - 0.5) * 22,
        vy: 190 + random * 42,
        radius: this.radius,
        alpha: 1,
        age: 0,
      });
    }

    resolveWalls(ball) {
      const left = 7 + ball.radius;
      const right = this.worldWidth - 7 - ball.radius;
      if (ball.x < left) {
        ball.x = left;
        if (ball.vx < 0) ball.vx *= -0.58;
      } else if (ball.x > right) {
        ball.x = right;
        if (ball.vx > 0) ball.vx *= -0.58;
      }
      if (ball.y < ball.radius) {
        ball.y = ball.radius;
        if (ball.vy < 0) ball.vy *= -0.2;
      }
    }

    resolveBallPairs() {
      for (let firstIndex = 0; firstIndex < this.balls.length; firstIndex += 1) {
        const first = this.balls[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < this.balls.length; secondIndex += 1) {
          const second = this.balls[secondIndex];
          let dx = second.x - first.x;
          let dy = second.y - first.y;
          const minimumDistance = first.radius + second.radius;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared >= minimumDistance * minimumDistance) continue;
          let distance = Math.sqrt(distanceSquared);
          if (distance < 0.0001) {
            dx = first.id % 2 === 0 ? 1 : -1;
            dy = 0.2;
            distance = Math.hypot(dx, dy);
          }
          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = (minimumDistance - distance + 0.02) / 2;
          first.x -= nx * overlap;
          first.y -= ny * overlap;
          second.x += nx * overlap;
          second.y += ny * overlap;
          const relativeVelocity = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
          if (relativeVelocity >= 0) continue;
          const impulse = -(1.12 * relativeVelocity) / 2;
          first.vx -= impulse * nx;
          first.vy -= impulse * ny;
          second.vx += impulse * nx;
          second.vy += impulse * ny;
        }
      }
    }

    finishOperation() {
      if (this.mode === "deposit") {
        this.processedCount = this.targetCount;
        this.logicalProcessedCount = this.targetCount;
        this.pendingCount = 0;
        this.storedCount = this.targetFinalStoredCount;
        this.balls = [];
      }
      this.visibleStoredCount = this.storedCount;
      this.syncStorageLayer();
      this.completedAt = this.elapsed;
      this.mode = "idle";
      this.setIdleState(true);
      this.syncState(true);
    }

    pulseMouth(kind) {
      if (!this.mouth) return;
      const className = kind === "deposit" ? "is-depositing" : "is-releasing";
      if (typeof this.mouth.animate === "function") {
        this.mouth.animate(
          [
            { transform: "scale(1)", filter: "brightness(1)" },
            { transform: "scale(1.06)", filter: "brightness(1.75)" },
            { transform: "scale(1)", filter: "brightness(1)" },
          ],
          { duration: 180, easing: "ease-out" },
        );
        return;
      }
      this.mouth.classList.remove("is-depositing", "is-releasing");
      global.requestAnimationFrame(() => this.mouth?.classList.add(className));
    }

    setIdleState(nextIdle) {
      this.container.setAttribute("aria-busy", String(!nextIdle));
      this.container.classList.toggle("is-active", !nextIdle);
      this.container.classList.toggle("is-depositing", this.mode === "deposit");
      this.container.classList.toggle("is-withdrawing", this.mode === "withdraw");
      if (this.idleState === nextIdle) return;
      this.idleState = nextIdle;
      this.onIdleChange(nextIdle, this.getSnapshot());
    }

    syncState(force = false) {
      const snapshot = this.getSnapshot();
      const key = [
        snapshot.storedCount,
        snapshot.visibleStoredCount,
        snapshot.renderedStoredCount,
        snapshot.overflow,
        snapshot.visuallyTruncated,
        snapshot.visualCapacity,
        snapshot.mode,
        snapshot.targetCount,
        snapshot.pendingCount,
        snapshot.activeCount,
        snapshot.processedCount,
      ].join("/");
      const notifyInterval = 1 / C.REWARD_PROGRESS_FPS;
      const canNotify = this.mode !== "deposit"
        || this.elapsed - this.lastProgressNotifyAt >= notifyInterval;
      if (force || (key !== this.lastProgressKey && canNotify)) {
        this.lastProgressKey = key;
        this.lastProgressNotifyAt = this.elapsed;
        this.container.dataset.storedCount = String(snapshot.storedCount);
        this.container.dataset.visibleStoredCount = String(snapshot.visibleStoredCount);
        this.container.dataset.renderedStoredCount = String(snapshot.renderedStoredCount);
        this.container.dataset.overflow = String(snapshot.overflow);
        this.container.dataset.visuallyTruncated = String(snapshot.visuallyTruncated);
        this.container.dataset.visualCapacity = String(snapshot.visualCapacity);
        this.container.dataset.bankMode = snapshot.mode;
        this.onProgress(snapshot);
      }
    }

    resizeCanvas(force = false) {
      if (!force && this.canvasMetrics) return this.canvasMetrics;
      const rect = this.canvas.getBoundingClientRect();
      this.layoutReads += 1;
      const cssWidth = Math.max(1, rect.width || this.container.clientWidth || this.worldWidth);
      const cssHeight = Math.max(1, rect.height || this.container.clientHeight || this.worldHeight);
      const pixelRatio = Math.min(global.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(cssWidth * pixelRatio);
      const targetHeight = Math.round(cssHeight * pixelRatio);
      if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
      }
      const scale = Math.min(cssWidth / this.worldWidth, cssHeight / this.worldHeight);
      this.canvasMetrics = {
        cssWidth,
        cssHeight,
        pixelRatio,
        scale,
        offsetX: (cssWidth - this.worldWidth * scale) / 2,
        offsetY: (cssHeight - this.worldHeight * scale) / 2,
      };
      return this.canvasMetrics;
    }

    render() {
      if (!this.ctx) return;
      const metrics = this.resizeCanvas();
      const ctx = this.ctx;
      ctx.setTransform(metrics.pixelRatio, 0, 0, metrics.pixelRatio, 0, 0);
      ctx.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight);
      const ratio = metrics.pixelRatio * metrics.scale;
      ctx.setTransform(
        ratio,
        0,
        0,
        ratio,
        metrics.pixelRatio * metrics.offsetX,
        metrics.pixelRatio * metrics.offsetY,
      );

      ctx.drawImage(this.storageLayer, 0, 0, this.worldWidth, this.worldHeight);

      this.balls.forEach((ball) => Game.MarbleVisual.drawSilver(ctx, {
        ...ball,
        angle: ball.age * 2.4 + ball.id * 0.31,
        alpha: ball.alpha ?? 1,
      }));
      this.renderFrames += 1;
    }

    storagePosition(index) {
      if (this.storagePositions.length === 0) {
        return { x: this.worldWidth / 2, y: 590 };
      }
      return this.storagePositions[Math.min(index, this.storagePositions.length - 1)];
    }

    rebuildStoragePositions() {
      const positions = [];
      const radius = this.storageRadius;
      const xPitch = radius * 2.08;
      const yPitch = radius * 1.82;
      const left = 7 + radius;
      const right = this.worldWidth - 7 - radius;
      let row = 0;
      for (let y = 590; y >= 90; y -= yPitch) {
        const offset = row % 2 ? radius * 1.04 : 0;
        for (let x = left + offset; x <= right + 0.001; x += xPitch) {
          positions.push({ x, y });
        }
        row += 1;
      }
      this.storagePositions = positions;
      this.visualCapacity = positions.length;
      let minimumDistance = Infinity;
      for (let first = 0; first < positions.length; first += 1) {
        for (let second = first + 1; second < positions.length; second += 1) {
          minimumDistance = Math.min(
            minimumDistance,
            Math.hypot(
              positions[first].x - positions[second].x,
              positions[first].y - positions[second].y,
            ),
          );
        }
      }
      this.minimumStoredDistance = Number.isFinite(minimumDistance) ? minimumDistance : null;
    }

    rebuildStorageLayer(force = false) {
      const ctx = this.storageLayerContext;
      if (!ctx) return;
      const count = Math.min(this.visibleStoredCount, this.visualCapacity);
      if (!force && count === this.storageLayerCount) return;
      const requiresFullRebuild = force || count < this.storageLayerCount;
      if (requiresFullRebuild) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.storageLayer.width, this.storageLayer.height);
      }
      ctx.setTransform(this.storageLayerScale, 0, 0, this.storageLayerScale, 0, 0);
      const startIndex = requiresFullRebuild ? 0 : this.storageLayerCount;
      for (let index = startIndex; index < count; index += 1) this.drawStoredMarble(ctx, index);
      this.storedMarblesDrawn += count - startIndex;
      this.storageLayerCount = count;
      this.storageRedraws += 1;
    }

    syncStorageLayer() {
      this.rebuildStorageLayer();
    }

    drawStoredMarble(ctx, index) {
      const position = this.storagePosition(index);
      Game.MarbleVisual.drawSilver(ctx, {
        x: position.x,
        y: position.y,
        radius: this.storageRadius,
        angle: index * 0.47,
        shadow: true,
      });
    }

    scheduleFrame() {
      if (!this.autoStart || this.destroyed || this.frameRequest || this.isIdle()) return;
      this.frameRequest = global.requestAnimationFrame((now) => {
        this.frameRequest = 0;
        const delta = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : this.fixedStep;
        this.lastFrameAt = now;
        this.advance(delta);
        this.scheduleFrame();
      });
    }

    cancelFrame() {
      if (this.frameRequest) global.cancelAnimationFrame(this.frameRequest);
      this.frameRequest = 0;
      this.lastFrameAt = 0;
    }

    destroy() {
      this.destroyed = true;
      this.cancelFrame();
    }
  }

  Game.RewardMarbleBank = RewardMarbleBank;
  Game.getRewardDepositDuration = depositDuration;
})(window);
