import Foundation

enum GameRules {
    static let initialBalance = 100
    static let minimumWager = 5
    static let defaultWagerLimit = 100
    static let wagerLimitOptions = [100, 200, 300]
    static let maximumWager = 300
    static let slotCount = 12
    static let cardPointsPerCard = 30
    static let maximumCardsPerRound = 9
    static let multipliers = [2, 4, 6, 8, 10]
    static let multiplierWeights = [30, 30, 16, 14, 10]
    static let litCounts = [2: 4, 4: 3, 6: 2, 8: 1, 10: 1]

    static func validateWager(_ wager: Int, balance: Int, limit: Int = defaultWagerLimit) -> Bool {
        wagerLimitOptions.contains(limit)
            && wager >= minimumWager
            && wager <= min(maximumWager, limit)
            && wager <= balance
    }

    static func randomMultiplier(rng: inout SplitMix64) -> Int {
        let roll = rng.int(upperBound: multiplierWeights.reduce(0, +))
        var cursor = 0
        for (index, weight) in multiplierWeights.enumerated() {
            cursor += weight
            if roll < cursor { return multipliers[index] }
        }
        return multipliers[0]
    }

    static func pickLitHoles(multiplier: Int, babyMode: Bool, rng: inout SplitMix64) -> [Int] {
        let ordinaryCount = litCounts[multiplier] ?? 1
        let count = min(slotCount, ordinaryCount * (babyMode ? 2 : 1))
        var holes = Array(0..<slotCount)
        guard holes.count > 1 else { return holes }
        for index in stride(from: holes.count - 1, through: 1, by: -1) {
            holes.swapAt(index, rng.int(upperBound: index + 1))
        }
        return Array(holes.prefix(count)).sorted()
    }

    static func startRound(state: inout GameState, babyMode: Bool, rng: inout SplitMix64) throws {
        guard state.phase == .betting,
              validateWager(state.draftWager, balance: state.balance, limit: state.wagerLimit) else {
            throw GameRuleError.invalidWager
        }
        let multiplier = randomMultiplier(rng: &rng)
        let litHoles = pickLitHoles(multiplier: multiplier, babyMode: babyMode, rng: &rng)
        state.balance -= state.draftWager
        state.activeRound = ActiveRound(
            wager: state.draftWager,
            multiplier: multiplier,
            litHoles: litHoles,
            babyMode: babyMode
        )
        state.lastResult = nil
        state.phase = .revealing
        state.rngState = rng.state
    }

    static func increaseRoundWager(state: inout GameState, to target: Int) throws {
        guard state.phase == .ready, var round = state.activeRound, !round.locked else {
            throw GameRuleError.roundLocked
        }
        let difference = target - round.wager
        guard difference > 0,
              target <= min(maximumWager, state.wagerLimit),
              difference <= state.balance else {
            throw GameRuleError.invalidWager
        }
        state.balance -= difference
        round.wager = target
        state.activeRound = round
    }

    static func settle(state: inout GameState, landingHole: Int) throws -> RoundResult {
        guard landingHole >= 0 && landingHole < slotCount, let round = state.activeRound else {
            throw GameRuleError.invalidLandingHole
        }
        let won = round.litHoles.contains(landingHole)
        let payout = won ? round.wager * round.multiplier : 0
        let previousProgress = state.cardRewards.progress
        let eligiblePoints = previousProgress + payout
        let rawCards = eligiblePoints / cardPointsPerCard
        let cardsAwarded = min(maximumCardsPerRound, rawCards)
        let cardsDiscarded = max(0, rawCards - maximumCardsPerRound)
        if won { state.balance += payout }
        state.cardRewards.points += payout
        state.cardRewards.progress = eligiblePoints % cardPointsPerCard
        state.cardRewards.totalCards += cardsAwarded
        state.statistics.roundsPlayed += 1
        state.statistics.totalPayout += payout
        if won { state.statistics.totalHits += 1 }
        let result = RoundResult(
            wager: round.wager,
            multiplier: round.multiplier,
            landingHole: landingHole,
            won: won,
            payout: payout,
            cardPointsAdded: payout,
            cardsAwarded: cardsAwarded,
            cardsDiscarded: cardsDiscarded
        )
        state.lastResult = result
        state.phase = won ? .rewarding : .settling
        return result
    }

    static func prepareNextRound(state: inout GameState) {
        state.activeRound = nil
        state.rewardLogicalProgress = 0
        state.physics = PhysicsSnapshot()
        state.draftWager = min(state.wagerLimit, maximumWager, max(minimumWager, min(state.draftWager, state.balance)))
        state.phase = state.balance < minimumWager ? .gameOver : .betting
    }

    static func credit(state: inout GameState, amount: Int) throws {
        guard [100, 500, 1_000].contains(amount) else { throw GameRuleError.invalidCredit }
        state.balance = try state.balance.addingWithoutOverflow(amount)
        if state.phase == .gameOver {
            state.phase = .betting
            state.draftWager = minimumWager
        }
    }

    static func setWagerLimit(state: inout GameState, limit: Int) throws {
        guard state.phase == .betting,
              state.activeRound == nil,
              wagerLimitOptions.contains(limit) else { throw GameRuleError.invalidWagerLimit }
        state.wagerLimit = limit
        state.draftWager = min(state.draftWager, state.balance, limit)
        state.draftWager = max(minimumWager, state.draftWager)
    }
}

enum GameRuleError: Error, Equatable {
    case invalidWager
    case roundLocked
    case invalidLandingHole
    case invalidCredit
    case invalidWagerLimit
    case integerOverflow
}

private extension Int {
    func addingWithoutOverflow(_ other: Int) throws -> Int {
        let result = addingReportingOverflow(other)
        if result.overflow { throw GameRuleError.integerOverflow }
        return result.partialValue
    }
}
