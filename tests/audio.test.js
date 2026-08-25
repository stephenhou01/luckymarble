(function runAudioTests(global) {
  "use strict";

  const results = [];
  const spoken = [];

  class FakeAudio {
    constructor(source) {
      this.source = source;
      this.paused = true;
      this.currentTime = 0;
      this.duration = 30;
      this.readyState = 4;
      this.volume = 1;
      this.listeners = {};
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
  }

  class FakeUtterance {
    constructor(text) { this.text = text; }
  }

  const speechEngine = {
    current: null,
    cancelCount: 0,
    cancel() { this.cancelCount += 1; this.current = null; },
    getVoices() { return [{ lang: "zh-CN", localService: true, name: "测试普通话" }]; },
    speak(utterance) { this.current = utterance; spoken.push(utterance); },
  };

  global.Audio = FakeAudio;
  global.SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(global, "speechSynthesis", { configurable: true, value: speechEngine });

  function test(name, callback) {
    try {
      callback();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error });
    }
  }

  function assert(condition, message = "断言失败") {
    if (!condition) throw new Error(message);
  }

  function equal(actual, expected, message = "数值不一致") {
    if (actual !== expected) throw new Error(`${message}：得到 ${actual}，预期 ${expected}`);
  }

  const controller = global.MarbleGame.Audio.create();

  test("音乐总开关默认开启且不替代独立音乐开关", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.music.enabled, true);
    equal(snapshot.background.enabled, true);
    equal(snapshot.win.enabled, true);
  });

  test("背景和中奖音乐默认各有四首并选中第一首", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.background.trackCount, 4);
    equal(snapshot.win.trackCount, 4);
    equal(snapshot.background.selectedIndex, 0);
    equal(snapshot.win.selectedIndex, 0);
    equal(snapshot.background.selectedSource, "assets/audio/background-music.mp3");
    equal(snapshot.win.selectedSource, "assets/audio/win-music.mp3");
  });

  controller.setBackgroundTrack(2);
  controller.setWinTrack(3);
  test("可切换背景和中奖曲目", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.background.selectedIndex, 2);
    equal(snapshot.background.selectedSource, "assets/audio/background-music-3.mp3");
    equal(snapshot.win.selectedIndex, 3);
    equal(snapshot.win.selectedSource, "assets/audio/win-music-4.mp3");
  });

  controller.unlock();
  controller.previewWin();
  test("试听中奖音乐时暂停正常背景音乐", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.preview.kind, "win");
    equal(snapshot.preview.playing, true);
    equal(snapshot.activeTrack, "preview-win");
    equal(snapshot.background.paused, true);
  });

  controller.previewWin();
  test("再次点击停止试听并恢复原播放状态", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.preview.kind, null);
    equal(snapshot.preview.playing, false);
    equal(snapshot.activeTrack, "background");
    equal(snapshot.background.paused, false);
  });

  controller.setMusicEnabled(false);
  test("关闭音乐总开关会停止两条音乐但保留语音开关", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.music.enabled, false);
    equal(snapshot.activeTrack, "silent");
    equal(snapshot.background.paused, true);
    equal(snapshot.win.paused, true);
    equal(snapshot.voice.enabled, true);
  });
  controller.setMusicEnabled(true);

  test("拒绝超出四首范围的曲目编号", () => {
    let error = null;
    try {
      controller.setBackgroundTrack(4);
    } catch (caught) {
      error = caught;
    }
    assert(error instanceof RangeError, "无效曲目编号没有被拒绝");
  });

  test("支持设备默认开启中奖语音", () => {
    const snapshot = controller.getSnapshot();
    equal(snapshot.voice.supported, true);
    equal(snapshot.voice.enabled, true);
    equal(snapshot.voice.speaking, false);
  });

  controller.playWin();
  const withCards = controller.announceWin({ payout: 300, cardsAwarded: 9 });
  test("播报本局弹珠和新增卡片", () => {
    equal(withCards.spoken, true);
    equal(withCards.text, "恭喜你，赢得 300 颗弹珠，还获得 9 张卡片！");
    equal(spoken.at(-1).lang, "zh-CN");
    equal(spoken.at(-1).rate, 1.05);
    equal(spoken.at(-1).pitch, 1.08);
    assert(Math.abs(controller.getSnapshot().win.effectiveVolume - 0.24) < 0.001,
      "播报时中奖音乐没有压低到30%音量");
  });

  spoken.at(-1).onend();
  test("播报结束后恢复中奖音乐音量", () => {
    equal(controller.isSpeechIdle(), true);
    assert(Math.abs(controller.getSnapshot().win.effectiveVolume - 0.8) < 0.001,
      "中奖音乐音量没有恢复");
  });

  const withoutCards = controller.announceWin({ payout: 60, cardsAwarded: 0 });
  test("没有新卡片时省略卡片句", () => {
    equal(withoutCards.text, "恭喜你，赢得 60 颗弹珠！");
  });

  controller.cancelSpeech();
  controller.setVoiceEnabled(false);
  const disabled = controller.announceWin({ payout: 20, cardsAwarded: 0 });
  test("关闭语音后保留文字但不调用播报", () => {
    equal(disabled.spoken, false);
    equal(controller.getSnapshot().voice.enabled, false);
    equal(controller.isSpeechIdle(), true);
  });

  controller.setVoiceEnabled(true);
  const originalSpeak = speechEngine.speak;
  speechEngine.speak = () => { throw new Error("模拟语音失败"); };
  const failed = controller.announceWin({ payout: 40, cardsAwarded: 1 });
  test("语音接口异常时立即恢复且不阻塞", () => {
    equal(failed.spoken, false);
    equal(controller.isSpeechIdle(), true);
    assert(Math.abs(controller.getSnapshot().win.effectiveVolume - 0.8) < 0.001,
      "语音异常后中奖音乐音量没有恢复");
  });
  speechEngine.speak = originalSpeak;

  Object.defineProperty(global, "speechSynthesis", { configurable: true, value: null });
  global.SpeechSynthesisUtterance = undefined;
  const unsupportedController = global.MarbleGame.Audio.create();
  const unsupported = unsupportedController.announceWin({ payout: 20, cardsAwarded: 0 });
  test("不支持语音合成时保留可见文案", () => {
    equal(unsupportedController.getSnapshot().voice.supported, false);
    equal(unsupported.spoken, false);
    equal(unsupported.text, "恭喜你，赢得 20 颗弹珠！");
  });

  const passed = results.filter((result) => result.passed).length;
  document.getElementById("summary").textContent = `${passed}/${results.length} 项通过`;
  document.getElementById("summary").className = passed === results.length ? "pass" : "fail";
  document.getElementById("results").textContent = results.map((result) => (
    result.passed ? `✓ ${result.name}` : `✗ ${result.name}\n  ${result.error?.stack || result.error}`
  )).join("\n");
  document.documentElement.dataset.testStatus = passed === results.length ? "passed" : "failed";
})(window);
