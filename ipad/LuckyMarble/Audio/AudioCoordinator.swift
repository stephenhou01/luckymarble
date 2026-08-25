import AVFoundation
import Foundation

enum AudioCatalog {
    static let backgroundTracks = [
        "background-music", "background-music-2", "background-music-3", "background-music-4",
    ]
    static let winTracks = [
        "win-music", "win-music-2", "win-music-3", "win-music-4",
    ]

    static func title(for index: Int) -> String {
        ["第一首", "第二首", "第三首", "第四首"][index.clamped(to: 0...3)]
    }
}

@MainActor
final class AudioCoordinator: NSObject, ObservableObject {
    enum PreviewKind: String {
        case background
        case win
    }

    @Published private(set) var previewKind: PreviewKind?
    @Published private(set) var speechActive = false

    private var settings = AppSettings()
    private var backgroundPlayer: AVPlayer?
    private var winPlayer: AVPlayer?
    private var previewPlayer: AVPlayer?
    private var backgroundEndObserver: NSObjectProtocol?
    private var winEndObserver: NSObjectProtocol?
    private var previewEndObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var routeObserver: NSObjectProtocol?
    private let speech = AVSpeechSynthesizer()
    private var winModeActive = false
    private var resumeBackgroundAfterPreview = false
    private var fadeTask: Task<Void, Never>?

    override init() {
        super.init()
        speech.delegate = self
        configureSession()
        observeSystemAudio()
    }

    func apply(_ newSettings: AppSettings) {
        let old = settings
        settings = newSettings
        if old.backgroundTrackIndex != newSettings.backgroundTrackIndex {
            switchBackgroundTrack(to: newSettings.backgroundTrackIndex)
        }
        if old.masterAudioEnabled != newSettings.masterAudioEnabled,
           !newSettings.masterAudioEnabled {
            pauseAll()
        }
        updateVolumes()
        if newSettings.masterAudioEnabled,
           newSettings.backgroundMusicEnabled,
           !winModeActive,
           previewKind == nil {
            playBackground()
        } else if !newSettings.backgroundMusicEnabled {
            backgroundPlayer?.pause()
        }
        if !newSettings.winMusicEnabled { winPlayer?.pause() }
        if !newSettings.voiceEnabled { speech.stopSpeaking(at: .immediate) }
    }

    func playBackground(restart: Bool = false) {
        guard settings.masterAudioEnabled,
              settings.backgroundMusicEnabled,
              !winModeActive,
              previewKind == nil else { return }
        if backgroundPlayer == nil {
            backgroundPlayer = makePlayer(named: AudioCatalog.backgroundTracks[safeBackgroundIndex])
            observeBackgroundEnd()
        }
        if restart { backgroundPlayer?.seek(to: .zero) }
        backgroundPlayer?.play()
        updateVolumes()
    }

    func playWin(result: RoundResult) {
        stopPreview(resume: false)
        winModeActive = true
        backgroundPlayer?.pause()
        winPlayer?.pause()
        winPlayer = makePlayer(named: AudioCatalog.winTracks[safeWinIndex])
        observeWinEnd()
        if settings.masterAudioEnabled, settings.winMusicEnabled {
            winPlayer?.play()
        }
        announce(result)
        updateVolumes()
    }

    func stopWinForNextRound() {
        winModeActive = false
        winPlayer?.pause()
        winPlayer?.seek(to: .zero)
        speech.stopSpeaking(at: .immediate)
        speechActive = false
        playBackground()
    }

    func togglePreview(_ kind: PreviewKind) {
        if previewKind == kind {
            stopPreview(resume: true)
            return
        }
        let enabled = kind == .background ? settings.backgroundMusicEnabled : settings.winMusicEnabled
        guard settings.masterAudioEnabled, enabled else { return }
        resumeBackgroundAfterPreview = !winModeActive && backgroundPlayer?.timeControlStatus == .playing
        stopPreview(resume: false)
        backgroundPlayer?.pause()
        winPlayer?.pause()
        let index = kind == .background ? safeBackgroundIndex : safeWinIndex
        let name = kind == .background ? AudioCatalog.backgroundTracks[index] : AudioCatalog.winTracks[index]
        previewPlayer = makePlayer(named: name)
        previewKind = kind
        if let item = previewPlayer?.currentItem {
            previewEndObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in self?.stopPreview(resume: true) }
            }
        }
        previewPlayer?.play()
        updateVolumes()
    }

    func stopPreview(resume: Bool = true) {
        previewPlayer?.pause()
        previewPlayer = nil
        previewKind = nil
        if let observer = previewEndObserver { NotificationCenter.default.removeObserver(observer) }
        previewEndObserver = nil
        if resume {
            if winModeActive, settings.winMusicEnabled { winPlayer?.play() }
            else if resumeBackgroundAfterPreview { playBackground() }
        }
        resumeBackgroundAfterPreview = false
    }

    func pauseForBackground() {
        fadeTask?.cancel()
        pauseAll()
        speech.stopSpeaking(at: .immediate)
        speechActive = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func resumeFromBackground() {
        configureSession()
        if !winModeActive { playBackground() }
    }

    private var safeBackgroundIndex: Int {
        settings.backgroundTrackIndex.clamped(to: 0...(AudioCatalog.backgroundTracks.count - 1))
    }

    private var safeWinIndex: Int {
        settings.winTrackIndex.clamped(to: 0...(AudioCatalog.winTracks.count - 1))
    }

    private func switchBackgroundTrack(to index: Int) {
        guard !winModeActive else {
            backgroundPlayer = makePlayer(named: AudioCatalog.backgroundTracks[index.clamped(to: 0...3)])
            observeBackgroundEnd()
            return
        }
        let wasPlaying = backgroundPlayer?.timeControlStatus == .playing
        let oldPlayer = backgroundPlayer
        let newPlayer = makePlayer(named: AudioCatalog.backgroundTracks[index.clamped(to: 0...3)])
        backgroundPlayer = newPlayer
        observeBackgroundEnd()
        updateVolumes()
        guard wasPlaying, settings.masterAudioEnabled, settings.backgroundMusicEnabled else { return }
        newPlayer?.volume = 0
        newPlayer?.play()
        fadeTask?.cancel()
        fadeTask = Task { @MainActor [weak self, weak oldPlayer, weak newPlayer] in
            for step in 1...14 {
                guard !Task.isCancelled, let self else { return }
                let progress = Float(step) / 14
                oldPlayer?.volume = self.backgroundEffectiveVolume * (1 - progress)
                newPlayer?.volume = self.backgroundEffectiveVolume * progress
                try? await Task.sleep(for: .milliseconds(25))
            }
            oldPlayer?.pause()
            self?.updateVolumes()
        }
    }

    private var backgroundEffectiveVolume: Float {
        settings.masterAudioEnabled && settings.backgroundMusicEnabled ? Float(settings.backgroundVolume) : 0
    }

    private var winEffectiveVolume: Float {
        guard settings.masterAudioEnabled, settings.winMusicEnabled else { return 0 }
        return Float(settings.winVolume * (speechActive ? 0.3 : 1))
    }

    private func updateVolumes() {
        backgroundPlayer?.volume = backgroundEffectiveVolume
        winPlayer?.volume = winEffectiveVolume
        switch previewKind {
        case .background: previewPlayer?.volume = backgroundEffectiveVolume
        case .win: previewPlayer?.volume = Float(settings.winVolume)
        case nil: break
        }
    }

    private func announce(_ result: RoundResult) {
        guard settings.voiceEnabled else { return }
        let text = result.cardsAwarded > 0
            ? "恭喜你，赢得 \(result.payout) 颗弹珠，还获得 \(result.cardsAwarded) 张卡片！"
            : "恭喜你，赢得 \(result.payout) 颗弹珠！"
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "zh-CN")
        utterance.rate = 0.52
        utterance.pitchMultiplier = 1.08
        utterance.volume = Float(settings.voiceVolume)
        speech.stopSpeaking(at: .immediate)
        speechActive = true
        updateVolumes()
        speech.speak(utterance)
    }

    private func makePlayer(named resource: String) -> AVPlayer? {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "mp3")
            ?? Bundle.main.url(forResource: resource, withExtension: "mp3", subdirectory: "Audio") else { return nil }
        let player = AVPlayer(url: url)
        player.actionAtItemEnd = .pause
        return player
    }

    private func observeBackgroundEnd() {
        if let observer = backgroundEndObserver { NotificationCenter.default.removeObserver(observer) }
        guard let item = backgroundPlayer?.currentItem else { return }
        backgroundEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.winModeActive else { return }
                self.backgroundPlayer?.seek(to: .zero)
                self.playBackground()
            }
        }
    }

    private func observeWinEnd() {
        if let observer = winEndObserver { NotificationCenter.default.removeObserver(observer) }
        guard let item = winPlayer?.currentItem else { return }
        winEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.winPlayer?.pause() }
        }
    }

    private func pauseAll() {
        backgroundPlayer?.pause()
        winPlayer?.pause()
        previewPlayer?.pause()
    }

    private func configureSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            assertionFailure("Unable to configure audio session: \(error)")
        }
    }

    private func observeSystemAudio() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            let rawType = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            Task { @MainActor in
                guard let self,
                      let rawType,
                      let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
                if type == .began { self.pauseAll() }
                else if !self.winModeActive { self.playBackground() }
            }
        }
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.updateVolumes() }
        }
    }
}

extension AudioCoordinator: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.speechActive = false
            self?.updateVolumes()
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.speechActive = false
            self?.updateVolumes()
        }
    }
}

private extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
