(function initPhysics(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;
  const geometry = Game.Geometry;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function closestPointOnSegment(px, py, segment) {
    const dx = segment.bx - segment.ax;
    const dy = segment.by - segment.ay;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = clamp(((px - segment.ax) * dx + (py - segment.ay) * dy) / lengthSquared, 0, 1);
    return { x: segment.ax + dx * t, y: segment.ay + dy * t };
  }

  class PhysicsWorld {
    constructor(callbacks = {}) {
      this.callbacks = callbacks;
      this.accumulator = 0;
      this.ball = null;
      this.lastCollisionAt = -Infinity;
      this.prepareBall();
    }

    prepareBall() {
      this.accumulator = 0;
      this.ball = {
        x: geometry.playfield.launcherX,
        y: 675,
        vx: 0,
        vy: 0,
        radius: C.BALL_RADIUS,
        active: false,
        landed: false,
        ejected: false,
        flightTime: 0,
        spin: 0,
        angle: 0,
        maxSubstepTravel: 0,
        nextNudgeAt: 3.5,
        nudgeCount: 0,
        rightPinTime: 0,
        maxRightPinDuration: 0,
        rightPinRescues: 0,
        launchPower: C.POWER_MIN,
        exitJitter: 0,
        exitAssistApplied: false,
        launcherRescues: 0,
      };
      return this.ball;
    }

    launch(power, rng = Math.random) {
      if (!this.ball || this.ball.active || this.ball.landed) return false;
      const normalized = clamp(Number(power) || C.POWER_MIN, C.POWER_MIN, C.POWER_MAX);
      const jitter = (rng() - 0.5) * 18;
      this.ball.x = geometry.playfield.launcherX + (rng() - 0.5) * 1.6;
      this.ball.y = 674;
      this.ball.vx = jitter * 0.16;
      this.ball.vy = -(1_535 + normalized * 70 + jitter);
      this.ball.spin = -2.1 - normalized * 2.2;
      this.ball.active = true;
      this.ball.landed = false;
      this.ball.ejected = false;
      this.ball.flightTime = 0;
      this.ball.launchPower = normalized;
      this.ball.exitJitter = (rng() - 0.5) * 28;
      this.ball.exitAssistApplied = false;
      this.ball.launcherRescues = 0;
      this.callbacks.onLaunch?.(normalized);
      return true;
    }

    advance(frameDelta) {
      if (!this.ball?.active || this.ball.landed) return;
      this.accumulator += Math.min(C.MAX_FRAME_DELTA, Math.max(0, frameDelta));
      let steps = 0;
      while (this.accumulator >= C.FIXED_TIME_STEP && steps < 16) {
        this.step(C.FIXED_TIME_STEP);
        this.accumulator -= C.FIXED_TIME_STEP;
        steps += 1;
      }
      if (steps === 16) this.accumulator = 0;
    }

    step(dt) {
      const ball = this.ball;
      if (!ball.active || ball.landed) return;

      const projectedSpeed = Math.hypot(ball.vx, ball.vy + 1_480 * dt);
      const maximumTravel = Math.max(1, ball.radius * C.MAX_SUBSTEP_TRAVEL_RATIO);
      const substeps = clamp(
        Math.ceil(projectedSpeed * dt / maximumTravel),
        1,
        C.MAX_PHYSICS_SUBSTEPS,
      );
      const substep = dt / substeps;
      for (let index = 0; index < substeps && ball.active && !ball.landed; index += 1) {
        this.integrate(substep);
      }
    }

    integrate(dt) {
      const ball = this.ball;
      if (!ball.active || ball.landed) return;

      if (ball.flightTime + dt >= 20) {
        ball.flightTime = 20;
        this.forceNearestSlot();
        return;
      }
      ball.flightTime += dt;

      ball.vy += 1_480 * dt;
      const drag = Math.pow(0.99915, dt * 240);
      ball.vx *= drag;
      ball.vy *= drag;
      const previousX = ball.x;
      const previousY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.maxSubstepTravel = Math.max(
        ball.maxSubstepTravel,
        Math.hypot(ball.x - previousX, ball.y - previousY),
      );
      ball.angle += ball.spin * dt;

      for (let iteration = 0; iteration < 2; iteration += 1) {
        geometry.segments.forEach((segment) => this.resolveSegment(segment));
        geometry.collisionCircles.forEach((circle) => this.resolveCircle(circle));
      }

      if (!ball.ejected) {
        const clearedLauncher = ball.x <= geometry.launcherExit.x + ball.radius
          && ball.y <= geometry.launcherExit.y + ball.radius * 2.4;
        if (clearedLauncher) {
          this.applyLauncherExitAssist(false);
        } else if (ball.flightTime >= C.LAUNCHER_RESCUE_SECONDS) {
          this.applyLauncherExitAssist(true);
        }
      }

      if (ball.ejected && ball.y > 126) {
        const dividerLimit = geometry.playfield.launcherDividerX - ball.radius - 4;
        if (ball.x > dividerLimit) {
          ball.x = dividerLimit;
          if (ball.vx > 0) ball.vx = -ball.vx * 0.55;
        }
        this.releaseRightPin(dt, dividerLimit);
      }

      const speed = Math.hypot(ball.vx, ball.vy);
      if (ball.flightTime >= ball.nextNudgeAt) {
        if (speed < 48) {
          const direction = ball.nudgeCount % 2 === 0 ? -1 : 1;
          ball.vx += direction * (32 + ball.nudgeCount % 3 * 5) * C.STALL_ASSIST_SCALE;
          ball.vy = Math.max(ball.vy, 34 * C.STALL_ASSIST_SCALE);
          ball.nudgeCount += 1;
        }
        ball.nextNudgeAt = ball.flightTime + 0.75;
      }
      if (ball.flightTime > 10 && speed < 70) {
        const centerPull = (C.WORLD_WIDTH * 0.45 - ball.x) * 0.055 * C.STALL_ASSIST_SCALE;
        ball.vx += centerPull * dt;
        ball.vy = Math.max(ball.vy, 120 * C.STALL_ASSIST_SCALE);
        if (ball.x > geometry.playfield.right - 18) {
          ball.vx = Math.min(ball.vx, -55 * C.STALL_ASSIST_SCALE);
        }
      }

      if (ball.y >= geometry.playfield.sensorY
        && ball.x >= geometry.playfield.left
        && ball.x < geometry.playfield.right) {
        const slot = clamp(
          Math.floor((ball.x - geometry.playfield.left) / geometry.slotWidth),
          0,
          C.SLOT_COUNT - 1,
        );
        this.finish(slot);
        return;
      }

      if (ball.y > C.WORLD_HEIGHT + 30 || !Number.isFinite(ball.x + ball.y + ball.vx + ball.vy)) {
        this.forceNearestSlot();
      }
    }

    applyLauncherExitAssist(rescue) {
      const ball = this.ball;
      if (ball.exitAssistApplied) return;
      const range = C.POWER_MAX - C.POWER_MIN || 1;
      const powerT = clamp((ball.launchPower - C.POWER_MIN) / range, 0, 1);
      const targetVx = -(180 + 280 * powerT) + ball.exitJitter;
      const physicalVx = Number.isFinite(ball.vx) ? ball.vx : targetVx;
      ball.vx = clamp(
        physicalVx * 0.5 + targetVx * 0.5,
        C.LAUNCHER_EXIT_MIN_VX,
        C.LAUNCHER_EXIT_MAX_VX,
      );
      if (rescue) {
        const tangentLength = Math.hypot(geometry.launcherExit.tangentX, geometry.launcherExit.tangentY) || 1;
        ball.x = Math.min(ball.x, geometry.launcherExit.x - ball.radius - 0.5);
        ball.y = Math.min(ball.y, geometry.launcherExit.y);
        ball.vy = Math.min(ball.vy, geometry.launcherExit.tangentY / tangentLength * 250);
        ball.launcherRescues += 1;
      }
      ball.ejected = true;
      ball.exitAssistApplied = true;
    }

    resolveCircle(circle) {
      const ball = this.ball;
      const dx = ball.x - circle.x;
      const dy = ball.y - circle.y;
      const minimumDistance = ball.radius + circle.radius;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= minimumDistance * minimumDistance) return;

      const distance = Math.sqrt(distanceSquared) || 0.0001;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minimumDistance - distance + 0.02;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const normalVelocity = ball.vx * nx + ball.vy * ny;
      if (normalVelocity < 0) {
        const impulse = (1 + circle.restitution) * normalVelocity;
        ball.vx -= impulse * nx;
        ball.vy -= impulse * ny;
        ball.vx *= 0.996;
        ball.vy *= 0.996;
        ball.spin += (ball.vx * -ny + ball.vy * nx) * 0.002;
        this.emitCollision(Math.min(1, Math.abs(normalVelocity) / 650));
      }
    }

    releaseRightPin(dt, dividerLimit) {
      const ball = this.ball;
      const rightPegs = geometry.pegs.filter((peg) => (
        peg.x >= geometry.safePegRight - 1
        && Math.abs(peg.y - ball.y) <= ball.radius + peg.radius + 2
      ));
      const nearest = rightPegs.reduce((best, peg) => {
        const distance = Math.hypot(ball.x - peg.x, ball.y - peg.y);
        return !best || distance < best.distance ? { peg, distance } : best;
      }, null);
      const touchingBoundary = ball.x >= dividerLimit - 1.25;
      const touchingPeg = nearest
        && nearest.distance <= ball.radius + nearest.peg.radius + 1.5;
      const slow = Math.hypot(ball.vx, ball.vy) < 52;

      if (!touchingBoundary || !touchingPeg || !slow) {
        ball.rightPinTime = 0;
        return;
      }

      ball.rightPinTime += dt;
      ball.maxRightPinDuration = Math.max(ball.maxRightPinDuration, ball.rightPinTime);
      if (ball.rightPinTime < C.RIGHT_PIN_RELEASE_SECONDS) return;

      ball.vx = Math.min(ball.vx, -32 * C.STALL_ASSIST_SCALE);
      ball.vy = Math.max(ball.vy, 34 * C.STALL_ASSIST_SCALE);
      ball.rightPinRescues += 1;
      ball.rightPinTime = 0;
    }

    resolveSegment(segment) {
      const ball = this.ball;
      const closest = closestPointOnSegment(ball.x, ball.y, segment);
      let dx = ball.x - closest.x;
      let dy = ball.y - closest.y;
      const minimumDistance = ball.radius + segment.thickness / 2;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= minimumDistance * minimumDistance) return;

      let distance = Math.sqrt(distanceSquared);
      if (distance < 0.0001) {
        const sx = segment.bx - segment.ax;
        const sy = segment.by - segment.ay;
        const length = Math.hypot(sx, sy) || 1;
        dx = -sy / length;
        dy = sx / length;
        distance = 1;
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minimumDistance - distance + 0.03;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const normalVelocity = ball.vx * nx + ball.vy * ny;
      if (normalVelocity < 0) {
        const impulse = (1 + segment.restitution) * normalVelocity;
        ball.vx -= impulse * nx;
        ball.vy -= impulse * ny;
        ball.vx *= segment.kind === "divider" ? 0.985 : 0.996;
        ball.vy *= segment.kind === "divider" ? 0.985 : 0.996;
        this.emitCollision(Math.min(1, Math.abs(normalVelocity) / 720));
      }
    }

    emitCollision(intensity) {
      const now = performance.now();
      if (now - this.lastCollisionAt < 44) return;
      this.lastCollisionAt = now;
      this.callbacks.onCollision?.(intensity);
    }

    forceNearestSlot() {
      const x = Number.isFinite(this.ball.x) ? this.ball.x : C.WORLD_WIDTH / 2;
      const slot = clamp(
        Math.floor((clamp(x, geometry.playfield.left, geometry.playfield.right - 0.001) - geometry.playfield.left) / geometry.slotWidth),
        0,
        C.SLOT_COUNT - 1,
      );
      this.finish(slot);
    }

    finish(slot) {
      const ball = this.ball;
      if (ball.landed) return;
      ball.landed = true;
      ball.active = false;
      ball.vx = 0;
      ball.vy = 0;
      ball.x = geometry.slotCenters[slot];
      ball.y = geometry.playfield.sensorY + 4;
      this.callbacks.onSlot?.(slot);
    }
  }

  function simulateLaunch(power, rng, maximumSeconds = 21) {
    let landing = null;
    const world = new PhysicsWorld({ onSlot: (slot) => { landing = slot; } });
    world.launch(power, rng);
    const maximumSteps = Math.ceil(maximumSeconds / C.FIXED_TIME_STEP);
    for (let index = 0; index < maximumSteps && landing === null; index += 1) {
      world.step(C.FIXED_TIME_STEP);
    }
    return {
      landing,
      ball: { ...world.ball },
      elapsed: world.ball.flightTime,
    };
  }

  Game.PhysicsWorld = PhysicsWorld;
  Game.simulateLaunch = simulateLaunch;
})(window);
