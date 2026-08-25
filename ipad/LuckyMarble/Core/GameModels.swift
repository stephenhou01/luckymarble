import Foundation
import CoreGraphics

enum GamePhase: String, Codable, CaseIterable, Sendable {
    case betting
    case revealing
    case ready
    case charging
    case flight
    case settling
    case rewarding
    case gameOver
}

struct CardRewards: Codable, Equatable, Sendable {
    var points = 0
    var progress = 0
    var totalCards = 0
}

struct ActiveRound: Codable, Equatable, Sendable {
    var wager: Int
    var multiplier: Int
    var litHoles: [Int]
    var babyMode: Bool
    var locked = false
}

struct RoundResult: Codable, Equatable, Sendable {
    var wager: Int
    var multiplier: Int
    var landingHole: Int
    var won: Bool
    var payout: Int
    var cardPointsAdded: Int
    var cardsAwarded: Int
    var cardsDiscarded: Int
}

struct GameStatistics: Codable, Equatable, Sendable {
    var totalHits = 0
    var roundsPlayed = 0
    var totalPayout = 0
}

struct BallState: Codable, Equatable, Sendable {
    var x: Double = 530
    var y: Double = 675
    var vx: Double = 0
    var vy: Double = 0
    var radius: Double = 9.6
    var active = false
    var landed = false
    var ejected = false
    var flightTime: Double = 0
    var angle: Double = 0
    var spin: Double = 0
    var launchPower: Double = 0.08
    var exitJitter: Double = 0
    var exitAssistApplied = false
    var launcherRescues = 0
    var nudgeCount = 0
    var nextNudgeAt: Double = 3.5
}

struct PhysicsSnapshot: Codable, Equatable, Sendable {
    var ball = BallState()
    var accumulator: Double = 0
}

struct GameState: Codable, Equatable, Sendable {
    var balance = 100
    var draftWager = 5
    var wagerLimit = 100
    var phase: GamePhase = .betting
    var activeRound: ActiveRound?
    var lastResult: RoundResult?
    var cardRewards = CardRewards()
    var statistics = GameStatistics()
    var physics = PhysicsSnapshot()
    var rewardLogicalProgress = 0
    var rngState: UInt64 = 0x9E37_79B9_7F4A_7C15
}

extension GameState {
    private enum CodingKeys: String, CodingKey {
        case balance, draftWager, wagerLimit, phase, activeRound, lastResult, cardRewards
        case statistics, physics, rewardLogicalProgress, rngState
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init()
        balance = try container.decodeIfPresent(Int.self, forKey: .balance) ?? balance
        draftWager = try container.decodeIfPresent(Int.self, forKey: .draftWager) ?? draftWager
        wagerLimit = try container.decodeIfPresent(Int.self, forKey: .wagerLimit) ?? wagerLimit
        phase = try container.decodeIfPresent(GamePhase.self, forKey: .phase) ?? phase
        activeRound = try container.decodeIfPresent(ActiveRound.self, forKey: .activeRound)
        lastResult = try container.decodeIfPresent(RoundResult.self, forKey: .lastResult)
        cardRewards = try container.decodeIfPresent(CardRewards.self, forKey: .cardRewards) ?? cardRewards
        statistics = try container.decodeIfPresent(GameStatistics.self, forKey: .statistics) ?? statistics
        physics = try container.decodeIfPresent(PhysicsSnapshot.self, forKey: .physics) ?? physics
        rewardLogicalProgress = try container.decodeIfPresent(Int.self, forKey: .rewardLogicalProgress) ?? rewardLogicalProgress
        rngState = try container.decodeIfPresent(UInt64.self, forKey: .rngState) ?? rngState
    }
}

struct SaveEnvelope: Codable, Equatable, Sendable {
    static let currentVersion = 1
    var version = currentVersion
    var savedAt = Date()
    var state: GameState
}

enum PerformanceMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case automatic
    case highQuality
    case powerSaving

    var id: String { rawValue }
    var title: String {
        switch self {
        case .automatic: "自动"
        case .highQuality: "高画质"
        case .powerSaving: "省电"
        }
    }
}

struct AppSettings: Codable, Equatable, Sendable {
    static let currentVersion = 1
    var version = currentVersion
    var masterAudioEnabled = true
    var backgroundMusicEnabled = true
    var winMusicEnabled = true
    var voiceEnabled = true
    var backgroundVolume = 0.2
    var winVolume = 0.8
    var voiceVolume = 0.95
    var backgroundTrackIndex = 0
    var winTrackIndex = 0
    var themeID = ThemeID.classic.rawValue
    var particlesEnabled = true
    var winFlashEnabled = true
    var reduceMotion = false
    var performanceMode = PerformanceMode.automatic
    var screenAwake = false
    var babyMode = false
}

struct SplitMix64: Codable, Equatable, Sendable {
    var state: UInt64

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var value = state
        value = (value ^ (value >> 30)) &* 0xBF58_476D_1CE4_E5B9
        value = (value ^ (value >> 27)) &* 0x94D0_49BB_1331_11EB
        return value ^ (value >> 31)
    }

    mutating func unit() -> Double {
        Double(next() >> 11) / Double(1 << 53)
    }

    mutating func int(upperBound: Int) -> Int {
        guard upperBound > 0 else { return 0 }
        return Int(next() % UInt64(upperBound))
    }
}
