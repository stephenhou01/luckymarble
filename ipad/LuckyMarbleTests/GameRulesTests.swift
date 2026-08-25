import XCTest
@testable import LuckyMarble

final class GameRulesTests: XCTestCase {
    func testWagerBoundaries() {
        XCTAssertFalse(GameRules.validateWager(4, balance: 100))
        XCTAssertTrue(GameRules.validateWager(5, balance: 5))
        XCTAssertTrue(GameRules.validateWager(99, balance: 200))
        XCTAssertTrue(GameRules.validateWager(100, balance: 200))
        XCTAssertFalse(GameRules.validateWager(101, balance: 200))
        XCTAssertTrue(GameRules.validateWager(200, balance: 300, limit: 200))
        XCTAssertTrue(GameRules.validateWager(300, balance: 300, limit: 300))
        XCTAssertFalse(GameRules.validateWager(301, balance: 500, limit: 300))
        XCTAssertFalse(GameRules.validateWager(30, balance: 29))
    }

    func testWagerLimitCanSwitchAndClampsDraft() throws {
        var state = GameState()
        state.balance = 500
        try GameRules.setWagerLimit(state: &state, limit: 300)
        state.draftWager = 300
        try GameRules.setWagerLimit(state: &state, limit: 100)
        XCTAssertEqual(state.wagerLimit, 100)
        XCTAssertEqual(state.draftWager, 100)
        XCTAssertThrowsError(try GameRules.setWagerLimit(state: &state, limit: 250))
    }

    func testMultiplierDistributionMatchesConfiguredWeights() {
        var rng = SplitMix64(state: 0xCAFE_BABE)
        var counts: [Int: Int] = [:]
        let samples = 100_000
        for _ in 0..<samples {
            counts[GameRules.randomMultiplier(rng: &rng), default: 0] += 1
        }
        let expected = [2: 0.30, 4: 0.30, 6: 0.16, 8: 0.14, 10: 0.10]
        for (multiplier, probability) in expected {
            let actual = Double(counts[multiplier, default: 0]) / Double(samples)
            XCTAssertEqual(actual, probability, accuracy: 0.008, "倍率 \(multiplier) 分布偏差过大")
        }
    }

    func testBabyModeDoublesWinningHoles() {
        var ordinaryRNG = SplitMix64(state: 10)
        var babyRNG = SplitMix64(state: 10)
        for multiplier in GameRules.multipliers {
            let ordinary = GameRules.pickLitHoles(multiplier: multiplier, babyMode: false, rng: &ordinaryRNG)
            let baby = GameRules.pickLitHoles(multiplier: multiplier, babyMode: true, rng: &babyRNG)
            XCTAssertEqual(baby.count, min(GameRules.slotCount, ordinary.count * 2))
            XCTAssertEqual(Set(baby).count, baby.count)
        }
    }

    func testCardProgressCarriesAcrossRounds() throws {
        var state = winningState(wager: 10, multiplier: 2, progress: 0)
        let first = try GameRules.settle(state: &state, landingHole: 0)
        XCTAssertEqual(first.cardsAwarded, 0)
        XCTAssertEqual(state.cardRewards.progress, 20)

        state.activeRound = ActiveRound(wager: 5, multiplier: 2, litHoles: [0], babyMode: false)
        state.phase = .flight
        let second = try GameRules.settle(state: &state, landingHole: 0)
        XCTAssertEqual(second.cardsAwarded, 1)
        XCTAssertEqual(state.cardRewards.progress, 0)
        XCTAssertEqual(state.cardRewards.points, 30)
        XCTAssertEqual(state.cardRewards.totalCards, 1)
    }

    func testSingleRoundCardCapAndDiscard() throws {
        var exactlyNine = winningState(wager: 27, multiplier: 10, progress: 0)
        let nine = try GameRules.settle(state: &exactlyNine, landingHole: 0)
        XCTAssertEqual(nine.cardsAwarded, 9)
        XCTAssertEqual(nine.cardsDiscarded, 0)
        XCTAssertEqual(exactlyNine.cardRewards.progress, 0)

        var overCap = winningState(wager: 30, multiplier: 10, progress: 0)
        let capped = try GameRules.settle(state: &overCap, landingHole: 0)
        XCTAssertEqual(capped.cardsAwarded, 9)
        XCTAssertEqual(capped.cardsDiscarded, 1)
        XCTAssertEqual(overCap.cardRewards.totalCards, 9)
        XCTAssertEqual(overCap.cardRewards.points, 300)
        XCTAssertEqual(overCap.cardRewards.progress, 0)
    }

    func testCreditOnlyAcceptsSupportedAmounts() throws {
        var state = GameState(balance: 0, draftWager: 5, phase: .gameOver)
        try GameRules.credit(state: &state, amount: 500)
        XCTAssertEqual(state.balance, 500)
        XCTAssertEqual(state.phase, .betting)
        XCTAssertThrowsError(try GameRules.credit(state: &state, amount: 250))
    }

    private func winningState(wager: Int, multiplier: Int, progress: Int) -> GameState {
        var state = GameState()
        state.phase = .flight
        state.activeRound = ActiveRound(wager: wager, multiplier: multiplier, litHoles: [0], babyMode: false, locked: true)
        state.cardRewards.progress = progress
        return state
    }
}
