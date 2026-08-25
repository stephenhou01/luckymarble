import Foundation

@MainActor
final class GameEngine: ObservableObject {
    @Published private(set) var state: GameState
    @Published private(set) var displayMultiplier: Int?
    @Published private(set) var power = 0.08
    @Published private(set) var rewardDisplayCount = 0
    @Published private(set) var rewardCardDisplayCount = 0
    @Published private(set) var wagerTransferTotal = 0
    @Published private(set) var wagerTransferProcessed = 0
    @Published private(set) var wagerTransferActive = false
    @Published private(set) var celebrationVisible = false
    @Published private(set) var recoveryNotice: String?

    var onLaunchRequested: ((Double, UInt64) -> UInt64)?
    var onRoundStarted: (() -> Void)?
    var onWin: ((RoundResult) -> Void)?
    var onVisualStateChanged: (() -> Void)?

    private let persistence: PersistenceStore
    private var rng: SplitMix64
    private var revealTask: Task<Void, Never>?
    private var settleTask: Task<Void, Never>?
    private var chargeTask: Task<Void, Never>?
    private var wagerTransferTask: Task<Void, Never>?
    private var chargeStartedAt: ContinuousClock.Instant?

    init(persistence: PersistenceStore) {
        self.persistence = persistence
        switch persistence.loadGame() {
        case .restored(let restored):
            state = restored
            rng = SplitMix64(state: restored.rngState)
        case .empty:
            state = GameState()
            rng = SplitMix64(state: GameState().rngState)
        case .corrupted:
            state = GameState()
            rng = SplitMix64(state: GameState().rngState)
            recoveryNotice = "存档损坏，已恢复为 100 颗弹珠；设置保持不变。"
        }
#if DEBUG
        if ProcessInfo.processInfo.environment["LUCKY_MARBLE_UI_REWARD_PREVIEW"] == "1" {
            let result = RoundResult(
                wager: 30,
                multiplier: 10,
                landingHole: 3,
                won: true,
                payout: 300,
                cardPointsAdded: 300,
                cardsAwarded: 9,
                cardsDiscarded: 1
            )
            state = GameState(
                balance: 300,
                draftWager: 30,
                phase: .rewarding,
                lastResult: result,
                cardRewards: CardRewards(points: 300, progress: 0, totalCards: 9)
            )
            rng = SplitMix64(state: state.rngState)
        } else if ProcessInfo.processInfo.environment["LUCKY_MARBLE_UI_SETTINGS_PREVIEW"] == "1" {
            state = GameState()
            rng = SplitMix64(state: state.rngState)
        } else if ProcessInfo.processInfo.environment["LUCKY_MARBLE_UI_WAGER_PREVIEW"] == "1" {
            state = GameState(balance: 100, draftWager: 35)
            rng = SplitMix64(state: state.rngState)
        }
#endif
    }

    deinit {
        revealTask?.cancel()
        settleTask?.cancel()
        chargeTask?.cancel()
        wagerTransferTask?.cancel()
    }

    var phase: GamePhase { state.phase }
    var activeRound: ActiveRound? { state.activeRound }
    var canChangeBabyMode: Bool { state.phase == .betting }
    var canStart: Bool {
        state.phase == .betting
            && GameRules.validateWager(state.draftWager, balance: state.balance, limit: state.wagerLimit)
    }
    var canCharge: Bool { state.phase == .ready && !wagerTransferActive }
    var canIncreaseRoundWager: Bool {
        guard state.phase == .ready, let round = state.activeRound, !round.locked else { return false }
        return state.balance > 0
            && round.wager < min(state.wagerLimit, GameRules.maximumWager)
    }
    var potentialPayout: Int {
        guard let round = state.activeRound else { return 0 }
        return round.wager * round.multiplier
    }
    var visibleRewardCards: Int {
        guard state.phase == .rewarding else { return state.lastResult?.cardsAwarded ?? 0 }
        return rewardCardDisplayCount
    }
    var displayedBalance: Int {
        if state.phase == .rewarding, let result = state.lastResult {
            return state.balance - result.payout + rewardDisplayCount
        }
        if wagerTransferActive {
            return state.balance + max(0, wagerTransferTotal - wagerTransferProcessed)
        }
        return state.balance
    }
    var displayedTotalCards: Int {
        guard state.phase == .rewarding, let result = state.lastResult else { return state.cardRewards.totalCards }
        return state.cardRewards.totalCards - result.cardsAwarded + visibleRewardCards
    }

    func startRound(babyMode: Bool) {
        guard canStart else { return }
        revealTask?.cancel()
        settleTask?.cancel()
        chargeTask?.cancel()
        wagerTransferTask?.cancel()
        onRoundStarted?()
        do {
            try GameRules.startRound(state: &state, babyMode: babyMode, rng: &rng)
        } catch { return }
        displayMultiplier = nil
        rewardDisplayCount = 0
        rewardCardDisplayCount = 0
        startWagerTransfer(count: state.activeRound?.wager ?? 0)
        celebrationVisible = false
        save()
        onVisualStateChanged?()
        runRevealAnimation()
    }

    func changeWager(by delta: Int) {
        if state.phase == .betting {
            state.draftWager = min(
                state.wagerLimit,
                GameRules.maximumWager,
                max(GameRules.minimumWager, min(state.balance, state.draftWager + delta))
            )
        } else if state.phase == .ready, delta > 0, let current = state.activeRound?.wager {
            let target = min(state.wagerLimit, GameRules.maximumWager, current + delta)
            try? GameRules.increaseRoundWager(
                state: &state,
                to: target
            )
            if state.activeRound?.wager == target { startWagerTransfer(count: target - current) }
        } else { return }
        save()
    }

    func setWager(_ target: Int) {
        if state.phase == .betting {
            guard GameRules.validateWager(target, balance: state.balance, limit: state.wagerLimit) else { return }
            state.draftWager = target
        } else { return }
        save()
    }

    func addWagerChip(_ amount: Int) {
        guard state.phase == .ready,
              [10, 35, 99].contains(amount),
              let current = state.activeRound?.wager,
              canIncreaseRoundWager else { return }
        let target = min(
            current + amount,
            current + state.balance,
            state.wagerLimit,
            GameRules.maximumWager
        )
        guard target > current else { return }
        try? GameRules.increaseRoundWager(state: &state, to: target)
        guard state.activeRound?.wager == target else { return }
        startWagerTransfer(count: target - current)
        save()
    }

    func addCredit(_ amount: Int) {
        try? GameRules.credit(state: &state, amount: amount)
        save()
    }

    func setWagerLimit(_ limit: Int) {
        try? GameRules.setWagerLimit(state: &state, limit: limit)
        save()
    }

    func beginCharging() {
        guard canCharge else { return }
        state.phase = .charging
        chargeStartedAt = .now
        power = 0.08
        chargeTask?.cancel()
        chargeTask = Task { @MainActor [weak self] in
            while !Task.isCancelled, self?.state.phase == .charging {
                self?.updateChargingPower()
                try? await Task.sleep(for: .milliseconds(33))
            }
        }
        save()
    }

    func updateChargingPower() {
        guard state.phase == .charging, let start = chargeStartedAt else { return }
        let elapsed = Double(start.duration(to: .now).components.attoseconds) / 1e18
            + Double(start.duration(to: .now).components.seconds)
        let progress = (elapsed / 1.2).truncatingRemainder(dividingBy: 2)
        let wave = progress <= 1 ? progress : 2 - progress
        power = 0.08 + 0.92 * wave
    }

    func releaseCharge() {
        guard state.phase == .charging else { return }
        updateChargingPower()
        chargeTask?.cancel()
        chargeTask = nil
        chargeStartedAt = nil
        state.phase = .flight
        state.activeRound?.locked = true
        if let updatedState = onLaunchRequested?(power, rng.state) {
            rng.state = updatedState
            state.rngState = updatedState
        }
        save()
        onVisualStateChanged?()
    }

    func cancelCharge() {
        guard state.phase == .charging else { return }
        chargeTask?.cancel()
        chargeTask = nil
        chargeStartedAt = nil
        power = 0.08
        state.phase = .ready
        save()
    }

    func settle(landingHole: Int, physics: PhysicsSnapshot) {
        guard state.phase == .flight else { return }
        state.physics = physics
        guard let result = try? GameRules.settle(state: &state, landingHole: landingHole) else { return }
        save()
        onVisualStateChanged?()
        if result.won {
            celebrationVisible = true
            onWin?(result)
            runReward(result)
        } else {
            settleTask?.cancel()
            settleTask = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(1_500))
                guard !Task.isCancelled else { return }
                self?.prepareNextRound()
            }
        }
    }

    func checkpointPhysics(_ snapshot: PhysicsSnapshot) {
        guard state.phase == .flight else { return }
        state.physics = snapshot
        save()
    }

    func pauseForBackground(physics: PhysicsSnapshot?) {
        if state.phase == .charging { cancelCharge() }
        if let physics, state.phase == .flight { checkpointPhysics(physics) }
        revealTask?.cancel()
        settleTask?.cancel()
        chargeTask?.cancel()
        wagerTransferTask?.cancel()
        wagerTransferTask = nil
        wagerTransferProcessed = wagerTransferTotal
        wagerTransferActive = false
        chargeTask = nil
        save()
    }

    func resumePendingPhase() {
        switch state.phase {
        case .revealing:
            displayMultiplier = state.activeRound?.multiplier
            state.phase = .ready
            save()
        case .settling:
            settleTask = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(350))
                self?.prepareNextRound()
            }
        case .rewarding:
            if let result = state.lastResult { runReward(result, resuming: true) }
        default:
            break
        }
        onVisualStateChanged?()
    }

    func resetGame() {
        revealTask?.cancel()
        settleTask?.cancel()
        chargeTask?.cancel()
        wagerTransferTask?.cancel()
        wagerTransferTask = nil
        chargeTask = nil
        persistence.resetGame()
        state = GameState()
        rng = SplitMix64(state: state.rngState)
        displayMultiplier = nil
        power = 0.08
        rewardDisplayCount = 0
        rewardCardDisplayCount = 0
        wagerTransferTotal = 0
        wagerTransferProcessed = 0
        wagerTransferActive = false
        celebrationVisible = false
        save()
        onVisualStateChanged?()
    }

    func dismissRecoveryNotice() {
        recoveryNotice = nil
    }

    private func runRevealAnimation() {
        revealTask = Task { @MainActor [weak self] in
            guard let self else { return }
            let sequence = GameRules.multipliers
            for tick in 0..<13 {
                guard !Task.isCancelled else { return }
                displayMultiplier = sequence[tick % sequence.count]
                try? await Task.sleep(for: .milliseconds(82))
            }
            guard !Task.isCancelled else { return }
            displayMultiplier = state.activeRound?.multiplier
            while !Task.isCancelled, wagerTransferActive {
                try? await Task.sleep(for: .milliseconds(33))
            }
            guard !Task.isCancelled else { return }
            state.phase = .ready
            save()
            onVisualStateChanged?()
        }
    }

    private func runReward(_ result: RoundResult, resuming: Bool = false) {
        settleTask?.cancel()
        celebrationVisible = true
        let marbleDuration = result.payout > 100 ? 6.0 : min(4.0, max(1.2, Double(result.payout) * 0.035))
        let lastCardArrival = result.cardsAwarded > 0
            ? 0.52 + Double(result.cardsAwarded - 1) * 0.16
            : 0
        let cardDuration = result.cardsAwarded > 0 ? lastCardArrival + 3.0 : 0
        let duration = max(marbleDuration, cardDuration)
        let startingProgress = resuming ? state.rewardLogicalProgress : 0
        rewardDisplayCount = startingProgress
        rewardCardDisplayCount = resuming ? result.cardsAwarded : 0
        settleTask = Task { @MainActor [weak self] in
            guard let self else { return }
            let frames = max(1, Int(duration * 12))
            for frame in 0...frames {
                guard !Task.isCancelled else { return }
                let progress = Double(frame) / Double(frames)
                let elapsed = progress * duration
                let eased = 1 - pow(1 - progress, 3)
                rewardDisplayCount = min(result.payout, max(startingProgress, Int(Double(result.payout) * eased)))
                if result.cardsAwarded > 0, !resuming {
                    let arrived = elapsed < 0.52
                        ? 0
                        : 1 + Int((elapsed - 0.52) / 0.16)
                    rewardCardDisplayCount = min(result.cardsAwarded, max(0, arrived))
                }
                state.rewardLogicalProgress = rewardDisplayCount
                if frame.isMultiple(of: 6) { save() }
                try? await Task.sleep(for: .milliseconds(83))
            }
            rewardDisplayCount = result.payout
            rewardCardDisplayCount = result.cardsAwarded
            state.rewardLogicalProgress = result.payout
            save()
            celebrationVisible = false
            try? await Task.sleep(for: .milliseconds(360))
            guard !Task.isCancelled else { return }
            prepareNextRound()
        }
    }

    private func startWagerTransfer(count: Int) {
        guard count > 0 else { return }
        let remaining = wagerTransferActive
            ? max(0, wagerTransferTotal - wagerTransferProcessed)
            : 0
        let queuedCount = remaining + count
        wagerTransferTask?.cancel()
        wagerTransferTotal = queuedCount
        wagerTransferProcessed = 0
        wagerTransferActive = true
        wagerTransferTask = Task { @MainActor [weak self] in
            guard let self else { return }
            let duration = min(4.8, max(1.2, Double(queuedCount) * 0.035))
            let frames = max(1, Int(duration * 30))
            for frame in 0...frames {
                guard !Task.isCancelled else { return }
                let progress = Double(frame) / Double(frames)
                wagerTransferProcessed = min(queuedCount, Int(Double(queuedCount) * progress))
                try? await Task.sleep(for: .milliseconds(33))
            }
            wagerTransferProcessed = queuedCount
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            wagerTransferActive = false
        }
    }

    private func prepareNextRound() {
        GameRules.prepareNextRound(state: &state)
        displayMultiplier = nil
        power = 0.08
        rewardDisplayCount = 0
        rewardCardDisplayCount = 0
        wagerTransferTotal = 0
        wagerTransferProcessed = 0
        wagerTransferActive = false
        save()
        onVisualStateChanged?()
    }

    private func save() {
        state.rngState = rng.state
        persistence.saveGame(state)
    }
}
