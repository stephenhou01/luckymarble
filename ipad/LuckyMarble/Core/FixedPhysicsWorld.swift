import Foundation

final class FixedPhysicsWorld {
    static let fixedStep = 1.0 / 240.0
    private let maximumFrameDelta = 0.05
    private let maximumSubsteps = 8
    private let gravity = 1_480.0
    private(set) var snapshot: PhysicsSnapshot

    init(snapshot: PhysicsSnapshot = PhysicsSnapshot()) {
        self.snapshot = snapshot
    }

    var ball: BallState { snapshot.ball }

    func prepare() {
        snapshot = PhysicsSnapshot()
    }

    func restore(_ snapshot: PhysicsSnapshot) {
        self.snapshot = snapshot
    }

    func launch(power: Double, rng: inout SplitMix64) {
        let normalized = power.clamped(to: 0.08...1)
        let jitter = (rng.unit() - 0.5) * 18
        snapshot.accumulator = 0
        snapshot.ball = BallState(
            x: GameGeometry.launcherX + (rng.unit() - 0.5) * 1.6,
            y: 674,
            vx: jitter * 0.16,
            vy: -(1_535 + normalized * 70 + jitter),
            active: true,
            spin: -2.1 - normalized * 2.2,
            launchPower: normalized,
            exitJitter: (rng.unit() - 0.5) * 28
        )
    }

    func advance(frameDelta: Double) -> Int? {
        guard snapshot.ball.active, !snapshot.ball.landed else { return nil }
        snapshot.accumulator += min(maximumFrameDelta, max(0, frameDelta))
        var steps = 0
        while snapshot.accumulator >= Self.fixedStep && steps < 16 {
            if let hole = step(Self.fixedStep) { return hole }
            snapshot.accumulator -= Self.fixedStep
            steps += 1
        }
        if steps == 16 { snapshot.accumulator = 0 }
        return nil
    }

    private func step(_ dt: Double) -> Int? {
        let projectedSpeed = hypot(snapshot.ball.vx, snapshot.ball.vy + gravity * dt)
        let maximumTravel = max(1, snapshot.ball.radius * 0.42)
        let count = Int(ceil(projectedSpeed * dt / maximumTravel)).clamped(to: 1...maximumSubsteps)
        for _ in 0..<count where snapshot.ball.active && !snapshot.ball.landed {
            if let hole = integrate(dt / Double(count)) { return hole }
        }
        return nil
    }

    private func integrate(_ dt: Double) -> Int? {
        if snapshot.ball.flightTime + dt >= 20 { return finishNearestSlot() }
        snapshot.ball.flightTime += dt
        snapshot.ball.vy += gravity * dt
        let drag = pow(0.99915, dt * 240)
        snapshot.ball.vx *= drag
        snapshot.ball.vy *= drag
        snapshot.ball.x += snapshot.ball.vx * dt
        snapshot.ball.y += snapshot.ball.vy * dt
        snapshot.ball.angle += snapshot.ball.spin * dt

        for _ in 0..<2 {
            for segment in GameGeometry.segments { resolve(segment) }
            for peg in GameGeometry.pegs { resolve(peg) }
        }

        if !snapshot.ball.ejected {
            let clearedLauncher = snapshot.ball.x <= GameGeometry.launcherExit.x + snapshot.ball.radius
                && snapshot.ball.y <= GameGeometry.launcherExit.y + snapshot.ball.radius * 2.4
            if clearedLauncher { applyLauncherExitAssist(rescue: false) }
            else if snapshot.ball.flightTime >= 1.4 { applyLauncherExitAssist(rescue: true) }
        }

        if snapshot.ball.ejected && snapshot.ball.y > 126 {
            let dividerLimit = GameGeometry.launcherDividerX - snapshot.ball.radius - 4
            if snapshot.ball.x > dividerLimit {
                snapshot.ball.x = dividerLimit
                if snapshot.ball.vx > 0 { snapshot.ball.vx = -snapshot.ball.vx * 0.55 }
            }
        }

        let speed = hypot(snapshot.ball.vx, snapshot.ball.vy)
        if snapshot.ball.flightTime >= snapshot.ball.nextNudgeAt {
            if speed < 48 {
                let direction = snapshot.ball.nudgeCount.isMultiple(of: 2) ? -1.0 : 1.0
                snapshot.ball.vx += direction * (32 + Double(snapshot.ball.nudgeCount % 3) * 5) * 0.7
                snapshot.ball.vy = max(snapshot.ball.vy, 34 * 0.7)
                snapshot.ball.nudgeCount += 1
            }
            snapshot.ball.nextNudgeAt = snapshot.ball.flightTime + 0.75
        }
        if snapshot.ball.flightTime > 10, speed < 70 {
            snapshot.ball.vx += (GameGeometry.worldWidth * 0.45 - snapshot.ball.x) * 0.055 * 0.7 * dt
            snapshot.ball.vy = max(snapshot.ball.vy, 120 * 0.7)
        }

        if snapshot.ball.y >= GameGeometry.sensorY,
           snapshot.ball.x >= GameGeometry.playfieldLeft,
           snapshot.ball.x < GameGeometry.playfieldRight {
            let hole = Int(floor((snapshot.ball.x - GameGeometry.playfieldLeft) / GameGeometry.slotWidth))
                .clamped(to: 0...(GameRules.slotCount - 1))
            return finish(hole)
        }

        let sum = snapshot.ball.x + snapshot.ball.y + snapshot.ball.vx + snapshot.ball.vy
        if snapshot.ball.y > GameGeometry.worldHeight + 30 || !sum.isFinite {
            return finishNearestSlot()
        }
        return nil
    }

    private func applyLauncherExitAssist(rescue: Bool) {
        guard !snapshot.ball.exitAssistApplied else { return }
        let t = ((snapshot.ball.launchPower - 0.08) / 0.92).clamped(to: 0...1)
        let targetVX = -(180 + 280 * t) + snapshot.ball.exitJitter
        snapshot.ball.vx = (snapshot.ball.vx * 0.5 + targetVX * 0.5).clamped(to: -520 ... -150)
        if rescue {
            let length = hypot(GameGeometry.launcherExit.tangentX, GameGeometry.launcherExit.tangentY)
            snapshot.ball.x = min(snapshot.ball.x, GameGeometry.launcherExit.x - snapshot.ball.radius - 0.5)
            snapshot.ball.y = min(snapshot.ball.y, GameGeometry.launcherExit.y)
            snapshot.ball.vy = min(snapshot.ball.vy, GameGeometry.launcherExit.tangentY / length * 250)
            snapshot.ball.launcherRescues += 1
        }
        snapshot.ball.ejected = true
        snapshot.ball.exitAssistApplied = true
    }

    private func resolve(_ circle: CollisionCircle) {
        let dx = snapshot.ball.x - circle.x
        let dy = snapshot.ball.y - circle.y
        let minimum = snapshot.ball.radius + circle.radius
        let squared = dx * dx + dy * dy
        guard squared < minimum * minimum else { return }
        let distance = max(0.0001, sqrt(squared))
        let nx = dx / distance
        let ny = dy / distance
        let overlap = minimum - distance + 0.02
        snapshot.ball.x += nx * overlap
        snapshot.ball.y += ny * overlap
        let normalVelocity = snapshot.ball.vx * nx + snapshot.ball.vy * ny
        if normalVelocity < 0 {
            let impulse = (1 + circle.restitution) * normalVelocity
            snapshot.ball.vx = (snapshot.ball.vx - impulse * nx) * 0.996
            snapshot.ball.vy = (snapshot.ball.vy - impulse * ny) * 0.996
            snapshot.ball.spin += (snapshot.ball.vx * -ny + snapshot.ball.vy * nx) * 0.002
        }
    }

    private func resolve(_ segment: CollisionSegment) {
        let dx = segment.bx - segment.ax
        let dy = segment.by - segment.ay
        let lengthSquared = max(1, dx * dx + dy * dy)
        let t = (((snapshot.ball.x - segment.ax) * dx + (snapshot.ball.y - segment.ay) * dy) / lengthSquared)
            .clamped(to: 0...1)
        let closestX = segment.ax + dx * t
        let closestY = segment.ay + dy * t
        var normalX = snapshot.ball.x - closestX
        var normalY = snapshot.ball.y - closestY
        let minimum = snapshot.ball.radius + segment.thickness / 2
        let squared = normalX * normalX + normalY * normalY
        guard squared < minimum * minimum else { return }
        var distance = sqrt(squared)
        if distance < 0.0001 {
            let length = max(1, hypot(dx, dy))
            normalX = -dy / length
            normalY = dx / length
            distance = 1
        }
        let nx = normalX / distance
        let ny = normalY / distance
        let overlap = minimum - distance + 0.03
        snapshot.ball.x += nx * overlap
        snapshot.ball.y += ny * overlap
        let normalVelocity = snapshot.ball.vx * nx + snapshot.ball.vy * ny
        if normalVelocity < 0 {
            let impulse = (1 + segment.restitution) * normalVelocity
            let friction: Double = switch segment.kind {
            case .divider: 0.94
            case .funnel: 0.97
            default: 0.992
            }
            snapshot.ball.vx = (snapshot.ball.vx - impulse * nx) * friction
            snapshot.ball.vy = (snapshot.ball.vy - impulse * ny) * friction
        }
    }

    private func finishNearestSlot() -> Int {
        let finiteX = snapshot.ball.x.isFinite ? snapshot.ball.x : GameGeometry.worldWidth / 2
        let bounded = finiteX.clamped(to: GameGeometry.playfieldLeft...(GameGeometry.playfieldRight - 0.001))
        let hole = Int(floor((bounded - GameGeometry.playfieldLeft) / GameGeometry.slotWidth))
            .clamped(to: 0...(GameRules.slotCount - 1))
        return finish(hole)
    }

    private func finish(_ hole: Int) -> Int {
        snapshot.ball.active = false
        snapshot.ball.landed = true
        snapshot.ball.x = GameGeometry.slotCenters[hole]
        snapshot.ball.y = GameGeometry.sensorY
        return hole
    }
}

private extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
