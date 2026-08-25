const { test, expect } = require("@playwright/test");

const baseURL = "http://127.0.0.1:4173";
test.use({ channel: "chrome" });
const unitPages = [
  "rules.test.html",
  "physics-smoke.html",
  "reward-bank.test.html",
  "audio.test.html",
  "wager-queue.test.html",
  "card-dispenser.test.html",
];

test.describe("browser unit pages", () => {
  for (const pageName of unitPages) {
    test(`${pageName} passes`, async ({ page }) => {
      await page.goto(`${baseURL}/tests/${pageName}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => ["passed", "failed"].includes(document.documentElement.dataset.testStatus), null, {
        timeout: 30_000,
      });
      expect(await page.locator("html").getAttribute("data-test-status")).toBe("passed");
    });
  }
});

const viewports = [
  { name: "desktop-1280x720", width: 1280, height: 720 },
  { name: "ipad-820x1180", width: 820, height: 1180 },
  { name: "iphone-390x844", width: 390, height: 844 },
  { name: "landscape-844x390", width: 844, height: 390 },
];

test.describe("responsive game shell", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} is complete and interactive`, async ({ page }) => {
      const browserErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => Boolean(window.MarbleGame?.App));

      const snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot());
      expect(snapshot.state.cardRewards).toEqual({ points: 0, progress: 0, totalCards: 0 });
      expect(snapshot.cardDispenser.idle).toBe(true);
      expect(snapshot.rewardBank.renderedStoredCount).toBe(Math.min(100, snapshot.rewardBank.visualCapacity));
      expect(snapshot.rewardBank.visualCapacity).toBeGreaterThan(0);
      expect(snapshot.rewardBank.minimumStoredDistance).toBeGreaterThanOrEqual(
        snapshot.rewardBank.visualRadiusWorld * 2,
      );
      expect(snapshot.rewardBank.animationMode).toBe("idle");
      expect(snapshot.rewardBank.activeVisualCount).toBe(0);
      expect(snapshot.audio.voice.enabled).toBe(true);
      expect(snapshot.audio.music.enabled).toBe(true);
      expect(snapshot.state.wagerLimit).toBe(100);
      expect(snapshot.renderMetrics.ballRadiusCss).toBeGreaterThan(0);
      expect(snapshot.marbleVisualRadii.rewardBank).toBeCloseTo(snapshot.marbleVisualRadii.main, 1);
      expect(snapshot.marbleVisualRadii.wagerQueue).toBeCloseTo(snapshot.marbleVisualRadii.main, 1);

      await page.waitForTimeout(150);
      const idleFrameCount = await page.evaluate(() => window.MarbleGame.App.getSnapshot().renderMetrics.frameCount);
      await page.waitForTimeout(350);
      const settledFrameCount = await page.evaluate(() => window.MarbleGame.App.getSnapshot().renderMetrics.frameCount);
      expect(settledFrameCount - idleFrameCount).toBeLessThanOrEqual(1);

      const layout = await page.evaluate(() => {
        const ids = [
          ".scoreboard",
          "#card-metrics",
          "#credit-button",
          "#skin-button",
          "#baby-mode-toggle",
          ".status-row",
          ".playfield-wrap",
          ".control-deck",
          "#card-dispenser",
          "#reward-bank",
          "#start-button",
          "#launch-button",
        ];
        const boxes = Object.fromEntries(ids.map((selector) => {
          const element = document.querySelector(selector);
          const rect = element.getBoundingClientRect();
          return [selector, {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            visible: getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none",
          }];
        }));
        return {
          boxes,
          viewport: { width: innerWidth, height: innerHeight },
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        };
      });

      expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width);
      expect(layout.scrollHeight).toBeLessThanOrEqual(viewport.height);
      for (const [selector, box] of Object.entries(layout.boxes)) {
        expect(box.visible, `${selector} should be visible`).toBe(true);
        expect(box.width, `${selector} should have width`).toBeGreaterThan(0);
        expect(box.height, `${selector} should have height`).toBeGreaterThan(0);
        expect(box.left, `${selector} left edge`).toBeGreaterThanOrEqual(-1);
        expect(box.top, `${selector} top edge`).toBeGreaterThanOrEqual(-1);
        expect(box.right, `${selector} right edge`).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.bottom, `${selector} bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
      }

      await expect(page.locator("#card-count")).toHaveText("0");
      await expect(page.locator("#reward-bank-count")).toHaveText("100");
      await expect(page.locator("#baby-mode-toggle")).toHaveAttribute("aria-checked", "false");
      await page.locator("#credit-button").click();
      await expect(page.locator("#credit-menu")).toBeVisible();
      await expect(page.locator("[data-credit-amount]")).toHaveCount(3);
      await page.locator('[data-credit-amount="100"]').click();
      await page.locator('[data-credit-amount="100"]').click();
      await page.locator('[data-credit-amount="500"]').click();
      await expect(page.locator("#balance-value")).toHaveText("800");
      await expect(page.locator("#reward-bank-count")).toHaveText("800");
      await expect(page.locator("#credit-menu")).toBeVisible();
      const credited = await page.evaluate(() => window.MarbleGame.App.getSnapshot());
      expect(credited.state.balance).toBe(800);
      expect(credited.rewardBank.storedCount).toBe(800);
      expect(credited.state.cardRewards.points).toBe(0);
      await page.locator("#reset-button").click();
      await expect(page.locator("#balance-value")).toHaveText("100");
      await page.locator("#baby-mode-toggle").click();
      await expect(page.locator("#baby-mode-toggle")).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("Enter");
      await expect(page.locator("#start-button")).toBeDisabled();
      await expect.poll(() => page.evaluate(() => window.MarbleGame.App.getSnapshot().phase), {
        timeout: 3_000,
      }).toBe("ready");
      const locked = await page.evaluate(() => window.MarbleGame.App.getSnapshot());
      expect(locked.potentialPayout).toBe(locked.state.activeRound.wager * locked.displayMultiplier);
      await expect(page.locator("#multiplier-announcement")).toBeVisible();
      await expect(page.locator("#announcement-payout")).toHaveText(`命中可得 ${locked.potentialPayout} 颗`);
      const babyRound = await page.evaluate(() => window.MarbleGame.App.getSnapshot());
      expect(babyRound.state.activeRound.babyMode).toBe(true);
      expect(babyRound.winningSlots.length).toBe(
        Math.min(12, ({ 2: 4, 4: 3, 6: 2, 8: 1, 10: 1 })[babyRound.displayMultiplier] * 2),
      );
      await page.locator("#reset-button").click();
      await expect.poll(() => page.evaluate(() => window.MarbleGame.App.getSnapshot().phase)).toBe("betting");
      await expect(page.locator("#baby-mode-toggle")).toHaveAttribute("aria-checked", "false");
      await page.keyboard.press("NumpadEnter");
      await expect.poll(() => page.evaluate(() => window.MarbleGame.App.getSnapshot().phase), {
        timeout: 3_000,
      }).toBe("ready");
      await page.locator("#reset-button").click();

      await page.screenshot({
        path: `/tmp/marble-game-qa/${viewport.name}.png`,
        fullPage: false,
      });
      expect(browserErrors).toEqual([]);
    });
  }
});

test("four cabinet skins switch without changing gameplay state", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.MarbleGame?.App));
  const before = await page.evaluate(() => {
    const snapshot = window.MarbleGame.App.getSnapshot();
    return {
      balance: snapshot.state.balance,
      draftWager: snapshot.state.draftWager,
      phase: snapshot.phase,
      cardRewards: snapshot.cardRewards,
    };
  });
  const skins = [
    { id: "classic", asset: "cabinet-background-v2.webp", label: "经典乐园" },
    { id: "ocean", asset: "skin-ocean-crystal-v1.png", label: "深海水晶" },
    { id: "cosmic", asset: "skin-cosmic-neon-v1.png", label: "星际霓虹" },
    { id: "candy", asset: "skin-candy-wonderland-v1.png", label: "糖果乐园" },
  ];

  await expect(page.locator("[data-skin-id]")).toHaveCount(4);
  for (const skin of skins) {
    await page.locator("#skin-button").click();
    await expect(page.locator("#skin-menu")).toBeVisible();
    await page.locator(`[data-skin-id="${skin.id}"]`).click();
    await expect(page.locator("#skin-menu")).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-skin", skin.id);
    await expect(page.locator("#machine")).toHaveAttribute("data-skin", skin.id);
    await expect(page.locator("#skin-button")).toHaveAttribute("aria-label", `切换皮肤，当前${skin.label}`);
    await expect(page.locator(`[data-skin-id="${skin.id}"]`)).toHaveAttribute("aria-pressed", "true");
    const current = await page.evaluate(() => {
      const snapshot = window.MarbleGame.App.getSnapshot();
      return {
        balance: snapshot.state.balance,
        draftWager: snapshot.state.draftWager,
        phase: snapshot.phase,
        cardRewards: snapshot.cardRewards,
        currentSkin: snapshot.currentSkin,
        renderSkin: snapshot.renderMetrics.skin,
        backgroundImage: getComputedStyle(document.querySelector(".machine-art")).backgroundImage,
      };
    });
    expect(current).toMatchObject({ ...before, currentSkin: skin.id, renderSkin: skin.id });
    expect(current.backgroundImage).toContain(skin.asset);
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.MarbleGame?.App));
  await expect(page.locator("#machine")).toHaveAttribute("data-skin", "candy");
  await expect(page.locator("#skin-button")).toHaveAttribute("aria-label", "切换皮肤，当前糖果乐园");
});

test("background and win music can be selected and previewed independently", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.MarbleGame?.App));

  await page.locator("#sound-button").click();
  await expect(page.locator("#audio-panel")).toBeVisible();
  await expect(page.locator("#background-track-select option")).toHaveCount(4);
  await expect(page.locator("#win-track-select option")).toHaveCount(4);
  await expect(page.locator("#music-master-toggle")).toHaveAttribute("aria-checked", "true");

  await page.locator("#music-master-toggle").click();
  await expect(page.locator("#music-master-toggle")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#background-track-select")).toBeDisabled();
  await expect(page.locator("#win-track-select")).toBeDisabled();
  let snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot().audio);
  expect(snapshot.music.enabled).toBe(false);
  expect(snapshot.voice.enabled).toBe(true);
  await page.locator("#music-master-toggle").click();

  await page.locator("#background-track-select").selectOption("2");
  snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot().audio);
  expect(snapshot.background.selectedIndex).toBe(2);
  expect(snapshot.background.selectedSource).toBe("assets/audio/background-music-3.mp3");
  await page.locator("#background-preview-button").click();
  await expect(page.locator("#background-preview-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#background-preview-button")).toHaveText("停止");
  snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot().audio);
  expect(snapshot.preview.kind).toBe("background");
  expect(snapshot.activeTrack).toBe("preview-background");
  await page.locator("#background-preview-button").click();
  await expect(page.locator("#background-preview-button")).toHaveAttribute("aria-pressed", "false");

  await page.locator("#win-track-select").selectOption("3");
  snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot().audio);
  expect(snapshot.win.selectedIndex).toBe(3);
  expect(snapshot.win.selectedSource).toBe("assets/audio/win-music-4.mp3");
  await page.locator("#win-preview-button").click();
  await expect(page.locator("#win-preview-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#win-preview-button")).toHaveText("停止");
  snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot().audio);
  expect(snapshot.preview.kind).toBe("win");
  expect(snapshot.activeTrack).toBe("preview-win");

  await page.locator("#sound-button").click();
  await expect(page.locator("#audio-panel")).toBeHidden();
  snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot().audio);
  expect(snapshot.preview.kind).toBe(null);
  expect(snapshot.preview.playing).toBe(false);
});

test("quick wagers and selectable wager limit work", async ({ page }) => {
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.MarbleGame?.App));
  await page.locator("#credit-button").click();
  await page.locator('[data-credit-amount="500"]').click();
  await expect(page.locator("[data-wager-preset]")).toHaveText(["35", "10", "99"]);
  await page.locator("#wager-limit-button").click();
  await expect(page.locator("#wager-limit-menu")).toBeVisible();
  await page.locator('[data-wager-limit="300"]').click();
  await expect(page.locator("#wager-limit-value")).toHaveText("300");
  await page.locator('[data-wager-preset="99"]').click();
  await expect(page.locator("#wager-value")).toHaveText("99");
  const snapshot = await page.evaluate(() => window.MarbleGame.App.getSnapshot());
  expect(snapshot.state.wagerLimit).toBe(300);
  expect(snapshot.state.draftWager).toBe(99);
});

test("nine-card showcase stays inside the playfield", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.MarbleGame?.App));
  await page.evaluate(() => {
    const ui = {
      container: document.getElementById("card-dispenser"),
      showcase: document.getElementById("card-showcase"),
      mouth: document.getElementById("card-slot-mouth"),
      countElement: document.getElementById("card-count"),
      metricsContainer: document.getElementById("card-metrics"),
    };
    window.__cardPreview = new window.MarbleGame.CardDispenser(ui.container, {
      ...ui,
      timings: { hold: 8_000 },
      reducedMotion: false,
    });
    window.__cardPreview.dispense({
      cardPointsAdded: 300,
      cardsAwarded: 9,
      cardsDiscarded: 1,
      cardRewards: { points: 300, progress: 0, totalCards: 9 },
    });
  });
  await expect(page.locator(".reward-card")).toHaveCount(9);
  await expect.poll(() => page.locator(".reward-card.is-presented").count(), { timeout: 3_000 }).toBe(9);
  const containment = await page.evaluate(() => {
    const playfield = document.querySelector(".playfield-wrap").getBoundingClientRect();
    return Array.from(document.querySelectorAll(".reward-card")).every((card) => {
      const rect = card.getBoundingClientRect();
      return rect.left >= playfield.left
        && rect.right <= playfield.right
        && rect.top >= playfield.top
        && rect.bottom <= playfield.bottom;
    });
  });
  expect(containment).toBe(true);
  await page.screenshot({ path: "/tmp/marble-game-qa/cards-3x3.png", fullPage: false });
  await page.evaluate(() => window.__cardPreview.destroy());
});

test("super prize celebration stays inside the playable area", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    const containment = await page.evaluate(() => {
      const overlay = document.getElementById("win-celebration");
      overlay.hidden = false;
      overlay.className = "win-celebration is-visible is-mega is-finale";
      document.getElementById("win-celebration-title").textContent = "超级大奖";
      document.getElementById("win-celebration-payout").textContent = "+990 颗弹珠";
      document.getElementById("win-celebration-cards").hidden = false;
      document.getElementById("win-celebration-cards").textContent = "+9 张卡片";
      const playfield = document.querySelector(".playfield-wrap").getBoundingClientRect();
      const stage = document.querySelector(".win-celebration-stage").getBoundingClientRect();
      return {
        inside: stage.left >= playfield.left
          && stage.right <= playfield.right
          && stage.top >= playfield.top
          && stage.bottom <= playfield.bottom,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
    expect(containment.inside, `${viewport.name} celebration containment`).toBe(true);
    expect(containment.scrollWidth).toBeLessThanOrEqual(viewport.width);
    expect(containment.scrollHeight).toBeLessThanOrEqual(viewport.height);
  }
});

test("physical reward bank uses dynamic visual capacity and preserves overflow", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.MarbleGame?.App));
  const exact = await page.evaluate(() => {
    const container = document.getElementById("reward-bank");
    window.__bankPreview = new window.MarbleGame.RewardMarbleBank(container, {
      canvas: document.getElementById("reward-bank-canvas"),
      mouth: document.getElementById("reward-bank-mouth"),
      autoStart: false,
    });
    window.__bankPreview.setVisualRadius(window.MarbleGame.App.getSnapshot().marbleVisualRadii.main);
    const snapshot = window.__bankPreview.reset(999);
    document.getElementById("reward-bank-count").textContent = "999";
    return snapshot;
  });
  expect(exact.visualCapacity).toBeGreaterThan(100);
  expect(exact.minimumStoredDistance).toBeGreaterThanOrEqual(exact.visualRadiusWorld * 2);
  expect(exact.renderedStoredCount).toBe(exact.visualCapacity);
  expect(exact.visuallyTruncated).toBe(true);
  expect(exact.overflow).toBe(false);
  await page.screenshot({ path: "/tmp/marble-game-qa/bank-999.png", fullPage: false });
  const overflow = await page.evaluate(() => window.__bankPreview.reset(1_000));
  expect(overflow.storedCount).toBe(1_000);
  expect(overflow.renderedStoredCount).toBe(overflow.visualCapacity);
  expect(overflow.visuallyTruncated).toBe(true);
  expect(overflow.overflow).toBe(true);
  await page.evaluate(() => window.__bankPreview.destroy());
});
