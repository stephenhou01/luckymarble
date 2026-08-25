(function initRendering(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};
  const C = Game.CONFIG;
  const geometry = Game.Geometry;
  const LAMP_PALETTES = Object.freeze({
    classic: Object.freeze({ lit: "#00cfff", glow: "#00a8ff", rim: "#d9fbff", off: "#42131a", offRim: "#21070a" }),
    ocean: Object.freeze({ lit: "#ff3b9d", glow: "#ff167f", rim: "#ffe0f0", off: "#123449", offRim: "#061b27" }),
    cosmic: Object.freeze({ lit: "#fff33d", glow: "#ffc400", rim: "#fffbd0", off: "#24163e", offRim: "#0b0615" }),
    candy: Object.freeze({ lit: "#00d8ff", glow: "#009fe8", rim: "#e1fbff", off: "#5c1937", offRim: "#2a0717" }),
  });

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function radialMetal(ctx, x, y, radius, warm = false) {
    const gradient = ctx.createRadialGradient(
      x - radius * 0.36,
      y - radius * 0.42,
      radius * 0.08,
      x,
      y,
      radius,
    );
    if (warm) {
      gradient.addColorStop(0, "#fffbd0");
      gradient.addColorStop(0.28, "#ffeb60");
      gradient.addColorStop(0.68, "#efaa00");
      gradient.addColorStop(1, "#a85c00");
    } else return Game.MarbleVisual.createMetalGradient(ctx, x, y, radius);
    return gradient;
  }

  class CanvasRenderer {
    constructor(canvas, physics) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.staticCanvas = document.createElement("canvas");
      this.staticCtx = this.staticCanvas.getContext("2d");
      this.physics = physics;
      this.cssWidth = 0;
      this.cssHeight = 0;
      this.pixelRatio = 1;
      this.scale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.sizeDirty = true;
      this.staticKey = "";
      this.frameCount = 0;
      this.staticBuilds = 0;
      this.layoutReads = 0;
      this.skin = "classic";
    }

    resize() {
      if (!this.sizeDirty && this.cssWidth > 0 && this.cssHeight > 0) return false;
      const rect = this.canvas.getBoundingClientRect();
      this.layoutReads += 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const ratio = Math.min(global.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(width * ratio);
      const targetHeight = Math.round(height * ratio);
      if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
      }
      if (this.staticCanvas.width !== targetWidth || this.staticCanvas.height !== targetHeight) {
        this.staticCanvas.width = targetWidth;
        this.staticCanvas.height = targetHeight;
        this.staticKey = "";
      }
      this.cssWidth = width;
      this.cssHeight = height;
      this.pixelRatio = ratio;
      this.scale = Math.min(width / C.WORLD_WIDTH, height / C.WORLD_HEIGHT);
      this.offsetX = (width - C.WORLD_WIDTH * this.scale) / 2;
      this.offsetY = (height - C.WORLD_HEIGHT * this.scale) / 2;
      this.sizeDirty = false;
      return true;
    }

    invalidateSize() {
      this.sizeDirty = true;
      this.staticKey = "";
    }

    setSkin(skinId) {
      const nextSkin = C.SKINS.some((skin) => skin.id === skinId) ? skinId : "classic";
      if (this.skin === nextSkin) return;
      this.skin = nextSkin;
      this.staticKey = "";
    }

    applyWorldTransform(ctx = this.ctx) {
      const scaledRatio = this.pixelRatio * this.scale;
      ctx.setTransform(
        scaledRatio,
        0,
        0,
        scaledRatio,
        this.pixelRatio * this.offsetX,
        this.pixelRatio * this.offsetY,
      );
    }

    drawStageGutters(ctx) {
      ctx.save();
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      const gradient = ctx.createLinearGradient(0, 0, this.cssWidth, 0);
      gradient.addColorStop(0, "#d88a0b");
      gradient.addColorStop(0.18, "#ffd94e");
      gradient.addColorStop(0.5, "#f5b928");
      gradient.addColorStop(0.82, "#ffd94e");
      gradient.addColorStop(1, "#d88a0b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#fff7be";
      for (let y = 10; y < this.cssHeight; y += 28) {
        ctx.beginPath();
        ctx.arc(10, y, 3, 0, Math.PI * 2);
        ctx.arc(this.cssWidth - 10, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    worldToScreen(x, y) {
      return {
        x: this.offsetX + x * this.scale,
        y: this.offsetY + y * this.scale,
      };
    }

    getMetrics() {
      return Object.freeze({
        cssWidth: this.cssWidth,
        cssHeight: this.cssHeight,
        pixelRatio: this.pixelRatio,
        scale: this.scale,
        ballRadiusCss: C.BALL_RADIUS * this.scale,
        scaleX: this.scale,
        scaleY: this.scale,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        worldScreenWidth: C.WORLD_WIDTH * this.scale,
        worldScreenHeight: C.WORLD_HEIGHT * this.scale,
        frameCount: this.frameCount,
        staticBuilds: this.staticBuilds,
        layoutReads: this.layoutReads,
        skin: this.skin,
        lampPalette: LAMP_PALETTES[this.skin] || LAMP_PALETTES.classic,
      });
    }

    drawBackdrop(ctx) {
      const background = ctx.createLinearGradient(0, 0, 0, C.WORLD_HEIGHT);
      background.addColorStop(0, "#fff9df");
      background.addColorStop(0.72, "#ffedc6");
      background.addColorStop(1, "#f3b73b");
      ctx.fillStyle = background;
      roundedRect(ctx, 0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT, 20);
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = "rgba(230, 165, 23, 0.16)";
      ctx.lineWidth = 1;
      for (let y = 140; y < 550; y += 78) {
        ctx.beginPath();
        ctx.moveTo(18, y);
        ctx.lineTo(500, y);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(104, 34, 139, 0.08)";
      roundedRect(ctx, 510, 14, 44, 692, 18);
      ctx.fill();
      ctx.restore();
    }

    drawRails(ctx) {
      ctx.save();
      ctx.lineCap = "round";
      geometry.segments.forEach((segment) => {
        if (!["launcher-divider", "launcher-curve", "funnel", "divider"].includes(segment.kind)) return;
        ctx.lineWidth = segment.thickness + 4;
        ctx.strokeStyle = "#ac6500";
        ctx.beginPath();
        ctx.moveTo(segment.ax, segment.ay);
        ctx.lineTo(segment.bx, segment.by);
        ctx.stroke();
        ctx.lineWidth = Math.max(2, segment.thickness - 1);
        ctx.strokeStyle = "#ffd52f";
        ctx.beginPath();
        ctx.moveTo(segment.ax, segment.ay);
        ctx.lineTo(segment.bx, segment.by);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawBumpersAndPegs(ctx) {
      geometry.pegs.forEach((peg) => {
        ctx.save();
        ctx.shadowColor = "rgba(122, 70, 0, .26)";
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = radialMetal(ctx, peg.x, peg.y, peg.radius, true);
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    drawSlots(ctx, winningSlots, activeSlot) {
      const palette = LAMP_PALETTES[this.skin] || LAMP_PALETTES.classic;
      geometry.slotCenters.forEach((x, index) => {
        const isWinning = winningSlots.includes(index);
        const isActive = activeSlot === index;

        ctx.save();
        ctx.fillStyle = "rgba(68, 22, 21, .84)";
        ctx.beginPath();
        ctx.ellipse(x, 698, geometry.slotWidth * 0.34, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        if (isWinning) {
          ctx.shadowColor = palette.glow;
          ctx.shadowBlur = isActive ? 26 : 15;
        }
        ctx.fillStyle = isWinning ? palette.lit : palette.off;
        ctx.beginPath();
        ctx.arc(x, geometry.playfield.lampY, isActive ? 8.3 : 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isWinning ? palette.rim : palette.offRim;
        ctx.stroke();
        if (isWinning) {
          ctx.fillStyle = "rgba(255,255,255,.82)";
          ctx.beginPath();
          ctx.arc(x - 2, geometry.playfield.lampY - 2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    drawLauncherDetails(ctx) {
      ctx.save();
      ctx.strokeStyle = "#9b5200";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(527, 650);
      ctx.lineTo(527, 690);
      ctx.stroke();
      ctx.strokeStyle = "#ffe357";
      ctx.lineWidth = 2;
      for (let y = 650; y < 689; y += 7) {
        ctx.beginPath();
        ctx.moveTo(520, y);
        ctx.lineTo(535, y + 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBall(ctx) {
      const ball = this.physics.ball;
      if (!ball) return;
      Game.MarbleVisual.drawSilver(ctx, ball);
    }

    buildStaticLayer(winningSlots, activeSlot) {
      const nextKey = [
        this.staticCanvas.width,
        this.staticCanvas.height,
        winningSlots.join(","),
        activeSlot ?? "",
        this.skin,
      ].join("|");
      if (nextKey === this.staticKey) return;

      const ctx = this.staticCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);
      const skinFilters = {
        classic: "none",
        ocean: "hue-rotate(142deg) saturate(1.12) brightness(.98)",
        cosmic: "hue-rotate(226deg) saturate(1.42) brightness(.76)",
        candy: "hue-rotate(318deg) saturate(.92) brightness(1.06)",
      };
      ctx.filter = skinFilters[this.skin] || "none";
      this.drawStageGutters(ctx);
      this.applyWorldTransform(ctx);
      this.drawBackdrop(ctx);
      this.drawRails(ctx);
      this.drawBumpersAndPegs(ctx);
      ctx.filter = "none";
      this.drawSlots(ctx, winningSlots, activeSlot);
      this.drawLauncherDetails(ctx);
      ctx.filter = "none";
      this.staticKey = nextKey;
      this.staticBuilds += 1;
    }

    render({ winningSlots = [], activeSlot = null } = {}) {
      this.resize();
      this.buildStaticLayer(winningSlots, activeSlot);
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.staticCanvas, 0, 0);
      this.applyWorldTransform(ctx);
      this.drawBall(ctx);
      this.frameCount += 1;
    }
  }

  Game.CanvasRenderer = CanvasRenderer;
})(window);
