(function initAudio(global) {
  "use strict";

  const Game = global.MarbleGame = global.MarbleGame || {};

  const DEFAULT_BACKGROUND_VOLUME = 0.2;
  const DEFAULT_WIN_VOLUME = 0.8;
  const DEFAULT_VOICE_VOLUME = 0.95;
  const SPEECH_DUCKING_RATIO = 0.3;
  const MUSIC_LIBRARY = Object.freeze({
    background: Object.freeze([
      "assets/audio/background-music.mp3",
      "assets/audio/background-music-2.mp3",
      "assets/audio/background-music-3.mp3",
      "assets/audio/background-music-4.mp3",
    ]),
    win: Object.freeze([
      "assets/audio/win-music.mp3",
      "assets/audio/win-music-2.mp3",
      "assets/audio/win-music-3.mp3",
      "assets/audio/win-music-4.mp3",
    ]),
  });

  function clampVolume(value) {
    const volume = Number(value);
    if (!Number.isFinite(volume)) return 0;
    return Math.max(0, Math.min(1, volume));
  }

  function createMusicTrack(source, { loop = false, volume = 1 } = {}) {
    if (typeof global.Audio !== "function") return null;
    const track = new global.Audio(source);
    track.preload = "auto";
    track.loop = loop;
    track.volume = volume;
    return track;
  }

  function createAudioController(options = {}) {
    let musicEnabled = true;
    let backgroundEnabled = true;
    let winEnabled = true;
    let voiceEnabled = true;
    let backgroundVolume = DEFAULT_BACKGROUND_VOLUME;
    let winVolume = DEFAULT_WIN_VOLUME;
    let voiceVolume = DEFAULT_VOICE_VOLUME;
    let backgroundTrackIndex = 0;
    let winTrackIndex = 0;
    let winMusicPlaying = false;
    let winModeActive = false;
    let speechActive = false;
    let speechText = "";
    let activeUtterance = null;
    const speechEngine = global.speechSynthesis || null;
    const Utterance = global.SpeechSynthesisUtterance;
    const speechSupported = Boolean(speechEngine && typeof Utterance === "function");
    const onSpeechIdleChange = options.onSpeechIdleChange || (() => {});
    const onPreviewChange = options.onPreviewChange || (() => {});
    const backgroundMusic = createMusicTrack(MUSIC_LIBRARY.background[backgroundTrackIndex], {
      loop: true,
      volume: backgroundVolume,
    });
    const winMusic = createMusicTrack(MUSIC_LIBRARY.win[winTrackIndex], {
      volume: winVolume,
    });
    let previewMusic = null;
    let previewKind = null;
    let previewResumeTrack = null;

    function applyWinVolume() {
      if (!winMusic) return;
      winMusic.volume = winVolume * (speechActive ? SPEECH_DUCKING_RATIO : 1);
    }

    function setSpeechActive(active, text = "") {
      const wasActive = speechActive;
      speechActive = Boolean(active);
      speechText = speechActive ? text : "";
      applyWinVolume();
      if (wasActive !== speechActive) onSpeechIdleChange(!speechActive);
    }

    function cancelSpeech() {
      activeUtterance = null;
      if (speechSupported) speechEngine.cancel();
      setSpeechActive(false);
    }

    function preferredMandarinVoice() {
      if (!speechSupported || typeof speechEngine.getVoices !== "function") return null;
      const voices = speechEngine.getVoices();
      return voices.find((voice) => /^zh-CN$/i.test(voice.lang) && voice.localService)
        || voices.find((voice) => /^zh-CN$/i.test(voice.lang))
        || voices.find((voice) => /^zh/i.test(voice.lang) && voice.localService)
        || voices.find((voice) => /^zh/i.test(voice.lang))
        || null;
    }

    function playBackgroundMusic({ restart = false } = {}) {
      if (previewMusic || winModeActive || !musicEnabled || !backgroundEnabled || !backgroundMusic) return;
      if (restart) backgroundMusic.currentTime = 0;
      backgroundMusic.play().catch(() => {});
    }

    function finishWinMusic({ reset = false } = {}) {
      winMusicPlaying = false;
      if (winMusic && reset) {
        winMusic.pause();
        winMusic.currentTime = 0;
      }
    }

    function stopPreview({ resume = true, notify = true } = {}) {
      if (!previewMusic) return false;
      const trackToResume = previewResumeTrack;
      previewMusic.pause();
      previewMusic.currentTime = 0;
      previewMusic = null;
      previewKind = null;
      previewResumeTrack = null;
      if (resume) {
        if (trackToResume === "win" && winModeActive && winEnabled && winMusic) {
          winMusicPlaying = true;
          applyWinVolume();
          winMusic.play().catch(() => finishWinMusic());
        } else if (trackToResume === "background" && !winModeActive) {
          playBackgroundMusic({ restart: false });
        }
      }
      if (notify) onPreviewChange(null);
      return true;
    }

    function preview(kind) {
      if (!MUSIC_LIBRARY[kind]) throw new RangeError("试听的音乐类型无效");
      const enabled = musicEnabled && (kind === "background" ? backgroundEnabled : winEnabled);
      if (!enabled) return false;
      if (previewMusic && previewKind === kind) return stopPreview();

      const resumeTrack = previewMusic
        ? previewResumeTrack
        : (winModeActive && winMusicPlaying && winMusic && !winMusic.paused
          ? "win"
          : (!winModeActive && backgroundMusic && !backgroundMusic.paused ? "background" : null));
      stopPreview({ resume: false, notify: false });
      previewResumeTrack = resumeTrack;
      backgroundMusic?.pause();
      winMusic?.pause();

      const selectedIndex = kind === "background" ? backgroundTrackIndex : winTrackIndex;
      const volume = kind === "background" ? backgroundVolume : winVolume;
      previewMusic = createMusicTrack(MUSIC_LIBRARY[kind][selectedIndex], { volume });
      previewKind = previewMusic ? kind : null;
      if (!previewMusic) {
        previewResumeTrack = null;
        return false;
      }
      previewMusic.addEventListener("ended", () => stopPreview());
      previewMusic.play().catch(() => stopPreview());
      onPreviewChange(previewKind);
      return true;
    }

    function setTrack(kind, index) {
      const library = MUSIC_LIBRARY[kind];
      if (!library || !Number.isInteger(index) || index < 0 || index >= library.length) {
        throw new RangeError("音乐曲目编号无效");
      }
      const track = kind === "background" ? backgroundMusic : winMusic;
      if (previewMusic) stopPreview();
      const wasPlaying = Boolean(track && !track.paused);
      if (kind === "background") backgroundTrackIndex = index;
      else winTrackIndex = index;
      if (!track) return;
      track.pause();
      track.currentTime = 0;
      track.src = library[index];
      track.load?.();
      if (wasPlaying) {
        if (kind === "background") playBackgroundMusic({ restart: true });
        else if (winModeActive && winEnabled) {
          winMusicPlaying = true;
          applyWinVolume();
          track.play().catch(() => finishWinMusic());
        }
      }
    }

    winMusic?.addEventListener("ended", () => finishWinMusic());

    return {
      unlock() {
        playBackgroundMusic({ restart: false });
      },
      setMusicEnabled(value) {
        musicEnabled = Boolean(value);
        if (!musicEnabled) {
          stopPreview({ resume: false });
          backgroundMusic?.pause();
          finishWinMusic({ reset: true });
        } else if (!winModeActive) {
          playBackgroundMusic({ restart: false });
        } else if (winEnabled && winMusic) {
          winMusicPlaying = true;
          applyWinVolume();
          winMusic.play().catch(() => finishWinMusic());
        }
      },
      setBackgroundEnabled(value) {
        backgroundEnabled = Boolean(value);
        if (!backgroundEnabled && previewKind === "background") {
          stopPreview({ resume: false });
        }
        if (backgroundEnabled) playBackgroundMusic({ restart: false });
        else backgroundMusic?.pause();
      },
      setWinEnabled(value) {
        winEnabled = Boolean(value);
        if (!winEnabled && previewKind === "win") stopPreview({ resume: false });
        if (!winEnabled) finishWinMusic({ reset: true });
      },
      setBackgroundTrack(index) {
        setTrack("background", index);
      },
      setWinTrack(index) {
        setTrack("win", index);
      },
      previewBackground() {
        return preview("background");
      },
      previewWin() {
        return preview("win");
      },
      stopPreview,
      setBackgroundVolume(value) {
        backgroundVolume = clampVolume(value);
        if (backgroundMusic) backgroundMusic.volume = backgroundVolume;
      },
      setWinVolume(value) {
        winVolume = clampVolume(value);
        applyWinVolume();
      },
      setVoiceEnabled(value) {
        voiceEnabled = Boolean(value);
        if (!voiceEnabled) cancelSpeech();
      },
      setVoiceVolume(value) {
        voiceVolume = clampVolume(value);
        if (activeUtterance) activeUtterance.volume = voiceVolume;
      },
      playBackgroundMusic,
      playWin() {
        stopPreview({ resume: false });
        winModeActive = true;
        backgroundMusic?.pause();
        finishWinMusic({ reset: true });
        if (!musicEnabled || !winEnabled || !winMusic) return;
        winMusicPlaying = true;
        applyWinVolume();
        winMusic.play().catch(() => finishWinMusic());
      },
      stopWin() {
        stopPreview({ resume: false });
        winModeActive = false;
        finishWinMusic({ reset: true });
        cancelSpeech();
      },
      announceWin(result = {}) {
        const payout = Number(result.payout);
        const cardsAwarded = Number(result.cardsAwarded || 0);
        if (!Number.isSafeInteger(payout) || payout < 0) {
          throw new RangeError("语音播报的弹珠数量无效");
        }
        if (!Number.isSafeInteger(cardsAwarded) || cardsAwarded < 0) {
          throw new RangeError("语音播报的卡片数量无效");
        }
        cancelSpeech();
        const text = cardsAwarded > 0
          ? `恭喜你，赢得 ${payout} 颗弹珠，还获得 ${cardsAwarded} 张卡片！`
          : `恭喜你，赢得 ${payout} 颗弹珠！`;
        if (!speechSupported || !voiceEnabled) return { spoken: false, text };

        const utterance = new Utterance(text);
        activeUtterance = utterance;
        utterance.lang = "zh-CN";
        utterance.rate = 1.05;
        utterance.pitch = 1.08;
        utterance.volume = voiceVolume;
        const voice = preferredMandarinVoice();
        if (voice) utterance.voice = voice;
        const finish = () => {
          if (activeUtterance !== utterance) return;
          activeUtterance = null;
          setSpeechActive(false);
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        setSpeechActive(true, text);
        try {
          speechEngine.speak(utterance);
          return { spoken: true, text };
        } catch {
          finish();
          return { spoken: false, text };
        }
      },
      cancelSpeech,
      isSpeechIdle() {
        return !speechActive;
      },
      getSnapshot() {
        return {
          music: { enabled: musicEnabled },
          activeTrack: previewKind
            ? `preview-${previewKind}`
            : (winModeActive
              ? (winMusicPlaying ? "win" : "silent")
              : (backgroundMusic && !backgroundMusic.paused ? "background" : "silent")),
          winModeActive,
          preview: {
            kind: previewKind,
            playing: Boolean(previewMusic && !previewMusic.paused),
          },
          background: backgroundMusic ? {
            enabled: backgroundEnabled,
            paused: backgroundMusic.paused,
            currentTime: backgroundMusic.currentTime,
            duration: backgroundMusic.duration,
            volume: backgroundVolume,
            effectiveVolume: backgroundMusic.volume,
            readyState: backgroundMusic.readyState,
            selectedIndex: backgroundTrackIndex,
            selectedSource: MUSIC_LIBRARY.background[backgroundTrackIndex],
            trackCount: MUSIC_LIBRARY.background.length,
          } : null,
          win: winMusic ? {
            enabled: winEnabled,
            paused: winMusic.paused,
            currentTime: winMusic.currentTime,
            duration: winMusic.duration,
            volume: winVolume,
            effectiveVolume: winMusic.volume,
            readyState: winMusic.readyState,
            selectedIndex: winTrackIndex,
            selectedSource: MUSIC_LIBRARY.win[winTrackIndex],
            trackCount: MUSIC_LIBRARY.win.length,
          } : null,
          voice: {
            supported: speechSupported,
            enabled: voiceEnabled,
            speaking: speechActive,
            volume: voiceVolume,
            text: speechText,
          },
        };
      },
    };
  }

  Game.Audio = Object.freeze({ create: createAudioController });
})(window);
