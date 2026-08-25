import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    let persistence: PersistenceStore
    let settingsStore: SettingsStore
    let audio: AudioCoordinator
    let engine: GameEngine
    let scene: MarbleScene

    init(persistence: PersistenceStore = PersistenceStore()) {
        self.persistence = persistence
        settingsStore = SettingsStore(persistence: persistence)
        audio = AudioCoordinator()
        engine = GameEngine(persistence: persistence)
        scene = MarbleScene(snapshot: engine.state.physics)

        engine.onRoundStarted = { [weak audio] in audio?.stopWinForNextRound() }
        engine.onWin = { [weak audio] result in audio?.playWin(result: result) }
        engine.onLaunchRequested = { [weak scene] power, seed in
            scene?.launch(power: power, seed: seed) ?? seed
        }
        engine.onVisualStateChanged = { [weak self] in self?.syncScene() }
        scene.onLanding = { [weak engine] hole, snapshot in
            engine?.settle(landingHole: hole, physics: snapshot)
        }
        scene.onCheckpoint = { [weak engine] snapshot in engine?.checkpointPhysics(snapshot) }
        settingsStore.onChange = { [weak self] settings in self?.apply(settings) }

        apply(settingsStore.settings)
        syncScene()
        if engine.phase == .flight { scene.restore(engine.state.physics) }
        engine.resumePendingPhase()
    }

    func apply(_ settings: AppSettings) {
        audio.apply(settings)
        scene.setPerformanceMode(settings.performanceMode)
        syncScene()
        UIApplication.shared.isIdleTimerDisabled = settings.screenAwake
    }

    func syncScene() {
        scene.apply(
            theme: settingsStore.selectedTheme,
            winningHoles: engine.activeRound?.litHoles ?? [],
            activeHole: engine.state.lastResult?.landingHole
        )
        if engine.phase == .betting || engine.phase == .ready { scene.prepare() }
    }

    func handleScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .background:
            engine.pauseForBackground(physics: engine.phase == .flight ? scene.pauseAndCheckpoint() : nil)
            audio.pauseForBackground()
            UIApplication.shared.isIdleTimerDisabled = false
        case .active:
            if engine.phase == .flight { scene.restore(engine.state.physics) }
            engine.resumePendingPhase()
            audio.resumeFromBackground()
            UIApplication.shared.isIdleTimerDisabled = settingsStore.settings.screenAwake
        case .inactive:
            break
        @unknown default:
            break
        }
    }

    func resetGame() {
        audio.stopWinForNextRound()
        scene.prepare()
        engine.resetGame()
    }
}
