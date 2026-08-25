(function initWagerMarbleQueue(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function toCount(value, label = "下注弹珠数量") {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`${label}必须是非负安全整数`);
    }
    return count;
  }

  function closestPoint(px, py, segment) {
    const dx = segment.bx - segment.ax;
    const dy = segment.by - segment.ay;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = clamp(((px - segment.ax) * dx + (py - segment.ay) * dy) / lengthSquared, 0, 1);
    return { x: segment.ax + dx * t, y: segment.ay + dy * t };
  }

  class WagerMarbleQueue {
    constructor(container, options = {}) {
      if (!container) throw new TypeError("缺少下注弹珠轨道容器");
      this.container = container;
      this.canvas = options.canvas || container.querySelector("canvas");
      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.className = "wager-physics-canvas";
        this.canvas.setAttribute("aria-hidden", "true");
        container.prepend(this.canvas);
      }
      this.ctx = this.canvas.getContext("2d");
      this.inlet = options.inlet || container.querySelector(".stake-inlet");
      this.countElement = options.countElement || container.querySelector("[data-stake-count]");
      this.onIdleChange = options.onIdleChange || (() => {});
      this.onProgress = options.onProgress || (() => {});
      this.onEnter = options.onEnter || (() => {});
      this.autoStart = options.autoStart !== false;
      this.fixedStep = options.fixedStep ?? C.WAGER_PHYSICS_STEP;
      this.gateDelay = (options.gateDelay ?? C.WAGER_GATE_DELAY_MS) / 1000;
      this.worldWidth = C.WAGER_WORLD_WIDTH;
      this.worldHeight = C.WAGER_WORLD_HEIGHT;
      this.radius = 7.2;
      this.visualRadiusCss = 0;
      this.holeLeft = 31;
      this.holeRight = 75;
      this.gateX = this.holeRight + 8;
      this.holeCenterX = (this.holeLeft + this.holeRight) / 2;
      this.holeCenterY = 94;
      this.sinkDuration = 0.26;
      this.sourceOutlet = options.sourceOutlet || container.querySelector(".bank-outlet");
      this.floorSegments = this.createCurvedFloor();
      this.leftFloor = { ax: 6, ay: 92, bx: this.holeLeft, by: 92, restitution: 0.12 };
      this.leftWall = { ax: 6, ay: 4, bx: 6, by: 92, restitution: 0.22 };
      this.rightWall = { ax: 594, ay: 4, bx: 594, by: 73, restitution: 0.25 };
      this.gate = { ax: this.gateX, ay: 58, bx: this.gateX, by: 89, restitution: 0.12 };
      this.frameRequest = 0;
      this.lastFrameAt = 0;
      this.accumulator = 0;
      this.canvasMetrics = null;
      this.renderFrames = 0;
      this.layoutReads = 0;
      this.randomState = 0x4f1bbcdc;
      this.lastProgressKey = "";
      this.idleState = true;
      this.destroyed = false;
      this.reset(0);
    }

    createCurvedFloor() {
      const segments = [];
      const startX = this.holeRight + 6;
      const endX = 594;
      const segmentCount = 26;
      const floorY = (x) => {
        const progress = (x - startX) / (endX - startX);
        return 88 - 18 * progress * progress;
      };
      for (let index = 0; index < segmentCount; index += 1) {
        const ax = startX + (endX - startX) * (index / segmentCount);
        const bx = startX + (endX - startX) * ((index + 1) / segmentCount);
        segments.push({ ax, ay: floorY(ax), bx, by: floorY(bx), restitution: 0.16 });
      }
      return segments;
    }

    nextRandom() {
      this.randomState = (Math.imul(this.randomState, 1_664_525) + 1_013_904_223) >>> 0;
      return this.randomState / 4_294_967_296;
    }

    setDraft(value) {
      if (this.started) throw new Error("投珠开始后不能修改下注草稿");
      this.targetCount = toCount(value);
      this.syncState(true);
      return this.getSnapshot();
    }

    startCommit(value) {
      const count = toCount(value);
      this.cancelFrame();
      this.started = true;
      this.targetCount = count;
      this.pendingCount = count;
      this.enteredCount = 0;
      this.balls = [];
      this.sinkingBalls = [];
      this.holeGlow = 0;
      this.elapsed = 0;
      this.completedAt = null;
      this.accumulator = 0;
      this.renderFrames = 0;
      this.gateOpen = false;
      this.maxVisibleCount = 0;
      this.maxPileRows = 0;
      this.invalidRescues = 0;
      this.exitXMin = Infinity;
      this.exitXMax = -Infinity;
      this.sourceXMin = Infinity;
      this.sourceXMax = -Infinity;
      this.randomState = 0x4f1bbcdc ^ count;
      this.setIdleState(false);
      this.syncState(true);
      this.render();
      this.scheduleFrame();
      return this.getSnapshot();
    }

    feedFromBank(value = 1) {
      const additions = toCount(value, "积分仓放珠数量");
      if (!this.started) throw new Error("本轮尚未开始投珠");
      if (additions > this.pendingCount) throw new RangeError("放珠数量超过待投入存量");
      for (let index = 0; index < additions; index += 1) this.spawnBall();
      this.pulseSourceOutlet();
      this.setIdleState(false);
      this.syncState(true);
      this.scheduleFrame();
      return this.getSnapshot();
    }

    addStock(value) {
      const additions = toCount(value, "续投数量");
      if (!this.started) throw new Error("本轮尚未开始投珠");
      if (additions === 0) return this.getSnapshot();
      this.targetCount += additions;
      this.pendingCount += additions;
      this.completedAt = null;
      this.setIdleState(false);
      this.syncState(true);
      this.scheduleFrame();
      return this.getSnapshot();
    }

    reset(value) {
      const draft = toCount(value);
      this.cancelFrame();
      this.started = false;
      this.targetCount = draft;
      this.pendingCount = 0;
      this.enteredCount = 0;
      this.balls = [];
      this.sinkingBalls = [];
      this.holeGlow = 0;
      this.elapsed = 0;
      this.completedAt = null;
      this.accumulator = 0;
      this.renderFrames = 0;
      this.gateOpen = false;
      this.maxVisibleCount = 0;
      this.maxPileRows = 0;
      this.invalidRescues = 0;
      this.exitXMin = Infinity;
      this.exitXMax = -Infinity;
      this.sourceXMin = Infinity;
      this.sourceXMax = -Infinity;
      this.setIdleState(true);
      this.syncState(true);
      this.render();
      return this.getSnapshot();
    }

    isIdle() {
      return !this.started || (
        this.pendingCount === 0
        && this.balls.length === 0
        && this.sinkingBalls.length === 0
      );
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
      this.visualRadiusCss = nextCssRadius;
      this.container.dataset.visualRadiusCss = nextCssRadius.toFixed(3);
      this.radius = nextWorldRadius;
      [...this.balls, ...this.sinkingBalls].forEach((ball) => {
        ball.radius = nextWorldRadius;
      });
      this.render();
      return this.getSnapshot();
    }

    getSnapshot() {
      const stockCount = this.started ? Math.max(0, this.targetCount - this.enteredCount) : 0;
      return Object.freeze({
        targetCount: this.targetCount,
        stockCount,
        pendingCount: this.pendingCount,
        visibleCount: this.balls.length,
        sinkingCount: this.sinkingBalls.length,
        enteredCount: this.enteredCount,
        holeGlow: this.holeGlow,
        elapsed: this.elapsed,
        completedAt: this.completedAt,
        gateOpen: this.gateOpen,
        maxVisibleCount: this.maxVisibleCount,
        maxPileRows: this.maxPileRows,
        invalidRescues: this.invalidRescues,
        exitXMin: Number.isFinite(this.exitXMin) ? this.exitXMin : null,
        exitXMax: Number.isFinite(this.exitXMax) ? this.exitXMax : null,
        sourceXMin: Number.isFinite(this.sourceXMin) ? this.sourceXMin : null,
        sourceXMax: Number.isFinite(this.sourceXMax) ? this.sourceXMax : null,
        started: this.started,
        idle: this.isIdle(),
        visualRadiusCss: this.visualRadiusCss,
        visualRadiusWorld: this.radius,
        entrySpeedMultiplier: C.WAGER_ENTRY_SPEED_MULTIPLIER,
        renderFrames: this.renderFrames,
        layoutReads: this.layoutReads,
      });
    }

    advance(frameDelta) {
      if (!this.started || this.isIdle()) return this.getSnapshot();
      const delta = clamp(Number(frameDelta) || 0, 0, 0.1);
      this.accumulator += delta;
      let steps = 0;
      while (this.accumulator >= this.fixedStep && steps < 24) {
        this.step(this.fixedStep);
        this.accumulator -= this.fixedStep;
        steps += 1;
      }
      if (steps === 24) this.accumulator = 0;
      this.render();
      this.syncState();
      return this.getSnapshot();
    }

    step(dt) {
      this.elapsed += dt;
      this.gateOpen = this.elapsed >= this.gateDelay;

      this.balls.forEach((ball) => {
        ball.age += dt;
        ball.vy += 1_450 * dt;
        if (this.gateOpen) {
          ball.vx -= 300 * dt;
          if (ball.x < 145) ball.vy += 780 * dt;
        }
        if (ball.age > 2.3) ball.vx -= 460 * dt;
        const drag = Math.pow(0.997, dt * 120);
        ball.vx *= drag;
        ball.vy *= drag;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.angle += ball.vx * dt / Math.max(1, ball.radius);
      });

      for (let iteration = 0; iteration < 2; iteration += 1) {
        this.balls.forEach((ball) => this.resolveBoundaries(ball));
        this.resolveBallPairs();
      }

      const survivors = [];
      this.balls.forEach((ball) => {
        if (this.gateOpen && ball.age > 5) {
          ball.x = this.holeCenterX;
          ball.y = 90;
          ball.vx = 0;
          ball.vy = 24;
        }
        const enteredHole = this.gateOpen
          && ball.y > 89
          && ball.x > this.holeLeft - ball.radius
          && ball.x < this.holeRight + ball.radius;
        if (enteredHole) {
          this.exitXMin = Math.min(this.exitXMin, ball.x);
          this.exitXMax = Math.max(this.exitXMax, ball.x);
          this.sinkingBalls.push({
            id: ball.id,
            x: ball.x,
            y: ball.y,
            startX: ball.x,
            startY: ball.y,
            radius: ball.radius,
            angle: ball.angle,
            age: 0,
          });
          return;
        }
        const isInvalid = !Number.isFinite(ball.x + ball.y + ball.vx + ball.vy);
        if (isInvalid || ball.y > 145) {
          if (isInvalid) this.invalidRescues += 1;
          ball.x = this.gateX + ball.radius + 2;
          ball.y = 70;
          ball.vx = -190;
          ball.vy = 0;
        }
        survivors.push(ball);
      });
      this.balls = survivors;
      this.updateSinkingBalls(dt);
      this.maxVisibleCount = Math.max(this.maxVisibleCount, this.balls.length);
      this.measurePileRows();

      if (this.pendingCount === 0 && this.balls.length === 0 && this.sinkingBalls.length === 0) {
        if (this.completedAt === null) this.completedAt = this.elapsed;
        this.setIdleState(true);
      }
    }

    updateSinkingBalls(dt) {
      let glow = 0;
      const survivors = [];
      this.sinkingBalls.forEach((ball) => {
        ball.age += dt;
        const progress = clamp(ball.age / this.sinkDuration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const swirl = Math.sin(progress * Math.PI) * (ball.id % 2 === 0 ? -2.4 : 2.4);
        ball.x = ball.startX + (this.holeCenterX - ball.startX) * eased + swirl;
        ball.y = ball.startY + (this.holeCenterY + 7 - ball.startY) * Math.pow(progress, 1.35);
        ball.angle += dt * (7 + progress * 9);
        ball.scale = 1 - progress * 0.85;
        ball.alpha = 1 - Math.pow(progress, 1.55);
        glow = Math.max(glow, Math.sin(Math.min(1, progress * 1.18) * Math.PI));

        if (progress < 1) {
          survivors.push(ball);
          return;
        }
        this.enteredCount += 1;
        this.onEnter(this.enteredCount, this.getSnapshot());
      });
      this.sinkingBalls = survivors;
      this.holeGlow = Math.max(glow, this.nearHoleGlow());
      this.inlet?.classList.toggle("is-active", this.holeGlow > 0.04);
    }

    nearHoleGlow() {
      let proximity = 0;
      this.balls.forEach((ball) => {
        if (!this.gateOpen || ball.x > this.gateX + 24) return;
        const distance = Math.hypot(ball.x - this.holeCenterX, ball.y - this.holeCenterY);
        proximity = Math.max(proximity, clamp(1 - distance / 54, 0, 0.38));
      });
      return proximity;
    }

    spawnBall() {
      const id = this.targetCount - this.pendingCount + 1;
      const randomA = this.nextRandom();
      const randomB = this.nextRandom();
      const radius = this.radius;
      this.balls.push({
        id,
        x: 564 + randomA * 16,
        y: 26 + randomB * 7,
        vx: (-175 - randomB * 58) * C.WAGER_ENTRY_SPEED_MULTIPLIER,
        vy: (34 + randomA * 22) * C.WAGER_ENTRY_SPEED_MULTIPLIER,
        radius,
        age: 0,
        angle: randomA * Math.PI,
      });
      this.sourceXMin = Math.min(this.sourceXMin, 564 + randomA * 16);
      this.sourceXMax = Math.max(this.sourceXMax, 564 + randomA * 16);
      this.pendingCount -= 1;
    }

    resolveBoundaries(ball) {
      this.floorSegments.forEach((segment) => this.resolveSegment(ball, segment));
      this.resolveSegment(ball, this.leftFloor);
      this.resolveSegment(ball, this.leftWall);
      this.resolveSegment(ball, this.rightWall);
      if (!this.gateOpen) this.resolveSegment(ball, this.gate);

      if (ball.y < ball.radius) {
        ball.y = ball.radius;
        if (ball.vy < 0) ball.vy *= -0.2;
      }
      if (ball.x > this.worldWidth - ball.radius) {
        ball.x = this.worldWidth - ball.radius;
        if (ball.vx > 0) ball.vx *= -0.24;
      }
    }

    resolveSegment(ball, segment) {
      const point = closestPoint(ball.x, ball.y, segment);
      let dx = ball.x - point.x;
      let dy = ball.y - point.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= ball.radius * ball.radius) return;

      let distance = Math.sqrt(distanceSquared);
      if (distance < 0.0001) {
        const sx = segment.bx - segment.ax;
        const sy = segment.by - segment.ay;
        const length = Math.hypot(sx, sy) || 1;
        dx = sy / length;
        dy = -sx / length;
        distance = 1;
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = ball.radius - distance + 0.02;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const normalVelocity = ball.vx * nx + ball.vy * ny;
      if (normalVelocity < 0) {
        const impulse = (1 + segment.restitution) * normalVelocity;
        ball.vx -= impulse * nx;
        ball.vy -= impulse * ny;
        const tx = -ny;
        const ty = nx;
        const tangentVelocity = ball.vx * tx + ball.vy * ty;
        ball.vx -= tangentVelocity * tx * 0.018;
        ball.vy -= tangentVelocity * ty * 0.018;
      }
    }

    resolveBallPairs() {
      const cellSize = this.radius * 2.4;
      const grid = new Map();
      this.balls.forEach((ball, index) => {
        const cellX = Math.floor(ball.x / cellSize);
        const cellY = Math.floor(ball.y / cellSize);
        const key = `${cellX},${cellY}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      });

      this.balls.forEach((ball, index) => {
        const cellX = Math.floor(ball.x / cellSize);
        const cellY = Math.floor(ball.y / cellSize);
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const neighbors = grid.get(`${cellX + offsetX},${cellY + offsetY}`) || [];
            neighbors.forEach((otherIndex) => {
              if (otherIndex <= index) return;
              this.resolveBallPair(ball, this.balls[otherIndex]);
            });
          }
        }
      });
    }

    resolveBallPair(first, second) {
      let dx = second.x - first.x;
      let dy = second.y - first.y;
      const minimumDistance = first.radius + second.radius;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= minimumDistance * minimumDistance) return;
      let distance = Math.sqrt(distanceSquared);
      if (distance < 0.0001) {
        dx = first.id % 2 === 0 ? 1 : -1;
        dy = -0.15;
        distance = Math.hypot(dx, dy);
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = (minimumDistance - distance + 0.02) / 2;
      first.x -= nx * overlap;
      first.y -= ny * overlap;
      second.x += nx * overlap;
      second.y += ny * overlap;

      const relativeVelocityX = second.vx - first.vx;
      const relativeVelocityY = second.vy - first.vy;
      const normalVelocity = relativeVelocityX * nx + relativeVelocityY * ny;
      if (normalVelocity >= 0) return;
      const impulse = -(1.16 * normalVelocity) / 2;
      first.vx -= impulse * nx;
      first.vy -= impulse * ny;
      second.vx += impulse * nx;
      second.vy += impulse * ny;
      first.vx *= 0.997;
      second.vx *= 0.997;
    }

    measurePileRows() {
      const pile = this.balls.filter((ball) => ball.x < 230 && ball.y > 34);
      if (pile.length < 2) return;
      const minimumY = Math.min(...pile.map((ball) => ball.y));
      const maximumY = Math.max(...pile.map((ball) => ball.y));
      const rows = Math.max(1, Math.ceil((maximumY - minimumY) / (this.radius * 1.65)));
      this.maxPileRows = Math.max(this.maxPileRows, rows);
    }

    pulseSourceOutlet() {
      if (!this.sourceOutlet) return;
      if (typeof this.sourceOutlet.animate === "function") {
        this.sourceOutlet.animate(
          [
            { transform: "scale(1)", filter: "brightness(1)" },
            { transform: "scale(1.08)", filter: "brightness(1.65)" },
            { transform: "scale(1)", filter: "brightness(1)" },
          ],
          { duration: 180, easing: "ease-out" },
        );
        return;
      }
      this.sourceOutlet.classList.remove("is-releasing");
      global.requestAnimationFrame(() => this.sourceOutlet?.classList.add("is-releasing"));
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

    setIdleState(nextIdle) {
      this.container.setAttribute("aria-busy", String(!nextIdle));
      this.container.classList.toggle("is-feeding", !nextIdle);
      if (this.idleState === nextIdle) return;
      this.idleState = nextIdle;
      this.onIdleChange(nextIdle);
    }

    syncState(force = false) {
      const snapshot = this.getSnapshot();
      const key = [
        snapshot.targetCount,
        snapshot.stockCount,
        snapshot.pendingCount,
        snapshot.visibleCount,
        snapshot.sinkingCount,
        snapshot.enteredCount,
        snapshot.started,
        snapshot.idle,
      ].join("/");
      if (force || key !== this.lastProgressKey) {
        this.lastProgressKey = key;
        this.container.dataset.wagerCount = String(snapshot.targetCount);
        this.container.dataset.stockCount = String(snapshot.stockCount);
        this.container.dataset.enteredEvents = String(snapshot.enteredCount);
        if (this.countElement) {
          this.countElement.textContent = String(snapshot.started ? snapshot.stockCount : snapshot.targetCount);
        }
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
      const scaledRatio = metrics.pixelRatio * metrics.scale;
      ctx.setTransform(
        scaledRatio,
        0,
        0,
        scaledRatio,
        metrics.pixelRatio * metrics.offsetX,
        metrics.pixelRatio * metrics.offsetY,
      );

      this.drawBlackHole(ctx);

      ctx.save();
      if (!this.gateOpen && this.started) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(235, 79, 48, .72)";
        ctx.beginPath();
        ctx.moveTo(this.gate.ax, this.gate.ay);
        ctx.lineTo(this.gate.bx, this.gate.by);
        ctx.stroke();
      }
      ctx.restore();

      this.balls.forEach((ball) => this.drawMarble(ctx, ball, 1, 1));
      this.sinkingBalls.forEach((ball) => {
        this.drawMarble(ctx, ball, ball.scale ?? 1, ball.alpha ?? 1);
      });
      this.renderFrames += 1;
    }

    drawBlackHole(ctx) {
      const glow = this.holeGlow;
      ctx.save();
      if (glow > 0) {
        const halo = ctx.createRadialGradient(
          this.holeCenterX,
          this.holeCenterY,
          4,
          this.holeCenterX,
          this.holeCenterY,
          34 + glow * 8,
        );
        halo.addColorStop(0, `rgba(255, 225, 96, ${0.38 + glow * 0.34})`);
        halo.addColorStop(0.45, `rgba(255, 111, 34, ${glow * 0.27})`);
        halo.addColorStop(1, "rgba(255, 70, 24, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.ellipse(this.holeCenterX, this.holeCenterY, 39, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const rim = ctx.createLinearGradient(0, 84, 0, 101);
      rim.addColorStop(0, glow > 0.08 ? "#ffe276" : "#b46f16");
      rim.addColorStop(0.28, glow > 0.08 ? "#ff9a2f" : "#5e240d");
      rim.addColorStop(1, "#210107");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(this.holeCenterX, this.holeCenterY, 24, 9.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#070105";
      ctx.beginPath();
      ctx.ellipse(this.holeCenterX, this.holeCenterY + 1.5, 20.5, 6.6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (glow > 0.02) {
        ctx.strokeStyle = `rgba(255, 235, 132, ${0.48 + glow * 0.5})`;
        ctx.lineWidth = 1.1 + glow * 1.4;
        ctx.shadowColor = "#ff9b2f";
        ctx.shadowBlur = 7 + glow * 9;
        ctx.beginPath();
        ctx.ellipse(
          this.holeCenterX,
          this.holeCenterY,
          24.5 + glow * 2.4,
          9.7 + glow * 1.1,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    drawMarble(ctx, ball, scale = 1, alpha = 1) {
      const radius = ball.radius * scale;
      Game.MarbleVisual.drawSilver(ctx, {
        x: ball.x,
        y: ball.y,
        radius,
        angle: ball.angle || ball.age * 2.4,
        alpha,
      });
    }

    destroy() {
      this.destroyed = true;
      this.cancelFrame();
      this.balls.length = 0;
      this.sinkingBalls.length = 0;
    }
  }

  Game.WagerMarbleQueue = WagerMarbleQueue;
})(window);
