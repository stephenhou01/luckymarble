import XCTest
@testable import LuckyMarble

final class PhysicsTests: XCTestCase {
    func testMainAndStoredMarblesShareTheSamePhysicalRadiusContract() {
        XCTAssertEqual(GameGeometry.ballRadius, 9.6, accuracy: 0.0001)
        XCTAssertEqual(BallState().radius, GameGeometry.ballRadius, accuracy: 0.0001)
    }

    func testPlayfieldAndSlotGeometryUseLowBounceCollisions() {
        XCTAssertLessThanOrEqual(GameGeometry.pegs.map(\.restitution).max() ?? 1, 0.42)
        let slotSegments = GameGeometry.segments.filter { $0.kind == .divider || $0.kind == .funnel }
        XCTAssertFalse(slotSegments.isEmpty)
        XCTAssertLessThanOrEqual(slotSegments.map(\.restitution).max() ?? 1, 0.24)
    }

    func testSevenPowerLevelsAlwaysReachLegalHole() {
        let powers = stride(from: 0.08, through: 1.0, by: 0.1533333333)
        var reachedHoles = Set<Int>()
        for (powerIndex, power) in powers.enumerated() {
            for seedOffset in 0..<12 {
                var rng = SplitMix64(state: UInt64(1_000 + powerIndex * 100 + seedOffset))
                let world = FixedPhysicsWorld()
                world.launch(power: power, rng: &rng)
                var landing: Int?
                for _ in 0..<1_300 where landing == nil {
                    landing = world.advance(frameDelta: 1.0 / 60.0)
                }
                XCTAssertNotNil(landing, "力度 \(power) 未在安全时限内落洞")
                if let landing {
                    XCTAssertTrue((0..<GameRules.slotCount).contains(landing))
                    XCTAssertLessThan(world.ball.flightTime, 8, "低回弹轨迹不应在棋盘中长时间乱弹")
                    reachedHoles.insert(landing)
                }
            }
        }
        XCTAssertGreaterThanOrEqual(reachedHoles.count, 8, "力度和随机扰动应覆盖足够多的洞")
    }

    func testPhysicsSnapshotRoundTripsThroughJSON() throws {
        var rng = SplitMix64(state: 77)
        let world = FixedPhysicsWorld()
        world.launch(power: 0.66, rng: &rng)
        for _ in 0..<20 { _ = world.advance(frameDelta: 1.0 / 60.0) }
        let data = try JSONEncoder().encode(world.snapshot)
        let restored = try JSONDecoder().decode(PhysicsSnapshot.self, from: data)
        XCTAssertEqual(restored, world.snapshot)
    }
}
