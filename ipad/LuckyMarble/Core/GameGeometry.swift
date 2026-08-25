import Foundation

struct CollisionCircle: Sendable {
    var x: Double
    var y: Double
    var radius: Double
    var restitution: Double
}

struct CollisionSegment: Sendable {
    var ax: Double
    var ay: Double
    var bx: Double
    var by: Double
    var thickness: Double
    var restitution: Double
    var kind: Kind

    enum Kind: Sendable {
        case outer
        case divider
        case funnel
        case launcherDivider
        case launcherCurve
    }
}

enum GameGeometry {
    static let worldWidth = 560.0
    static let worldHeight = 720.0
    static let ballRadius = 9.6
    static let playfieldLeft = 22.0
    static let playfieldRight = 488.0
    static let launcherDividerX = 506.0
    static let launcherX = 530.0
    static let dividerTop = 596.0
    static let dividerBottom = 704.0
    static let sensorY = 684.0
    static let slotWidth = (playfieldRight - playfieldLeft) / Double(GameRules.slotCount)
    static let launcherExit = (x: 468.0, y: 78.0, tangentX: -42.0, tangentY: -12.0)

    static let pegs: [CollisionCircle] = {
        let pegRadius = 7.0
        let safePegRight = launcherDividerX - 3.5 - ballRadius * 2 - pegRadius - 2
        let rows: [(Double, Int, Double)] = [
            (176, 8, 48), (254, 9, 30), (332, 8, 52), (410, 9, 30), (488, 8, 52),
        ]
        return rows.flatMap { y, count, start in
            let step = (safePegRight - start) / Double(count - 1)
            return (0..<count).map {
                CollisionCircle(x: start + Double($0) * step, y: y, radius: pegRadius, restitution: 0.42)
            }
        }
    }()

    static let launcherOuter = quadraticSegments(
        start: (552, 118), control: (552, 62), end: (486, 50), count: 8
    )
    static let launcherInner = quadraticSegments(
        start: (506, 132), control: (510, 90), end: (468, 78), count: 8
    )

    static let segments: [CollisionSegment] = {
        var values: [CollisionSegment] = [
            .init(ax: 8, ay: 12, bx: 8, by: 708, thickness: 12, restitution: 0.34, kind: .outer),
            .init(ax: 552, ay: 12, bx: 552, by: 708, thickness: 12, restitution: 0.34, kind: .outer),
            .init(ax: 8, ay: 8, bx: 552, by: 8, thickness: 12, restitution: 0.36, kind: .outer),
            .init(ax: 8, ay: 712, bx: 552, by: 712, thickness: 12, restitution: 0.12, kind: .outer),
            .init(ax: launcherDividerX, ay: 128, bx: launcherDividerX, by: 706, thickness: 7, restitution: 0.30, kind: .launcherDivider),
            .init(ax: 8, ay: 540, bx: playfieldLeft, by: dividerTop, thickness: 7, restitution: 0.24, kind: .funnel),
            .init(ax: launcherDividerX, ay: 540, bx: playfieldRight, by: dividerTop, thickness: 7, restitution: 0.24, kind: .funnel),
            .init(ax: playfieldLeft, ay: dividerTop, bx: playfieldLeft, by: dividerBottom, thickness: 6, restitution: 0.10, kind: .divider),
            .init(ax: playfieldRight, ay: dividerTop, bx: playfieldRight, by: dividerBottom, thickness: 6, restitution: 0.10, kind: .divider),
        ]
        values += launcherOuter + launcherInner
        for index in 1..<GameRules.slotCount {
            let x = playfieldLeft + slotWidth * Double(index)
            values.append(.init(ax: x, ay: dividerTop, bx: x, by: dividerBottom, thickness: 6, restitution: 0.10, kind: .divider))
        }
        return values
    }()

    static let slotCenters: [Double] = (0..<GameRules.slotCount).map {
        playfieldLeft + slotWidth * (Double($0) + 0.5)
    }

    private static func quadraticSegments(
        start: (Double, Double),
        control: (Double, Double),
        end: (Double, Double),
        count: Int
    ) -> [CollisionSegment] {
        let points = (0...count).map { index -> (Double, Double) in
            let t = Double(index) / Double(count)
            let inverse = 1 - t
            return (
                inverse * inverse * start.0 + 2 * inverse * t * control.0 + t * t * end.0,
                inverse * inverse * start.1 + 2 * inverse * t * control.1 + t * t * end.1
            )
        }
        return (0..<count).map { index in
            CollisionSegment(
                ax: points[index].0, ay: points[index].1,
                bx: points[index + 1].0, by: points[index + 1].1,
                thickness: 7, restitution: 0.2, kind: .launcherCurve
            )
        }
    }
}
