(function initMarbleVisual(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};

  function createMetalGradient(ctx, x, y, radius) {
    const gradient = ctx.createRadialGradient(
      x - radius * 0.36,
      y - radius * 0.42,
      radius * 0.08,
      x,
      y,
      radius,
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.26, "#f3f8ff");
    gradient.addColorStop(0.7, "#b1c0d6");
    gradient.addColorStop(1, "#61748f");
    return gradient;
  }

  function drawSilver(ctx, options = {}) {
    const { x, y, radius, angle = 0, alpha = 1, shadow = true } = options;
    if (![x, y, radius, angle, alpha].every(Number.isFinite) || radius <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (shadow) {
      ctx.shadowColor = "rgba(44, 55, 79, .42)";
      ctx.shadowBlur = radius * 0.68;
      ctx.shadowOffsetY = radius * 0.32;
    }
    ctx.fillStyle = createMetalGradient(ctx, x, y, radius);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(0.7, radius * 0.125);
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.stroke();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(100, 119, 151, .32)";
    ctx.lineWidth = Math.max(0.55, radius * 0.085);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, -0.7, 1.6);
    ctx.stroke();
    ctx.restore();
  }

  Game.MarbleVisual = Object.freeze({ createMetalGradient, drawSilver });
})(window);
