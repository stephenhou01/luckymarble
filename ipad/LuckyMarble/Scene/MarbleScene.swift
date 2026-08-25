import SpriteKit

@MainActor
final class MarbleScene: SKScene {
    var onLanding: ((Int, PhysicsSnapshot) -> Void)?
    var onCheckpoint: ((PhysicsSnapshot) -> Void)?

    private let physicsWorldModel: FixedPhysicsWorld
    private let boardNode = SKShapeNode()
    private let ballNode = SKSpriteNode(texture: ArcadeMarbleVisual.spriteTexture())
    private var pegNodes: [SKShapeNode] = []
    private var railNodes: [SKShapeNode] = []
    private var lampNodes: [SKShapeNode] = []
    private var lampHaloNodes: [SKShapeNode] = []
    private var lastUpdateTime: TimeInterval?
    private var lastCheckpointTime: TimeInterval = 0
    private var theme = ThemePack.all[0]

    init(snapshot: PhysicsSnapshot = PhysicsSnapshot()) {
        physicsWorldModel = FixedPhysicsWorld(snapshot: snapshot)
        super.init(size: CGSize(width: GameGeometry.worldWidth, height: GameGeometry.worldHeight))
        scaleMode = .aspectFit
        backgroundColor = .clear
        anchorPoint = .zero
    }

    required init?(coder: NSCoder) { nil }

    override func didMove(to view: SKView) {
        view.ignoresSiblingOrder = true
        buildBoard()
        syncBall()
    }

    func apply(theme: ThemePack, winningHoles: [Int], activeHole: Int? = nil) {
        self.theme = theme
        boardNode.fillColor = SKColor(theme.board)
        boardNode.strokeColor = SKColor(theme.accent)
        pegNodes.forEach {
            $0.fillColor = SKColor(theme.accent)
            $0.strokeColor = SKColor(theme.panel)
        }
        railNodes.forEach { $0.strokeColor = SKColor(theme.accent) }
        for (index, lamp) in lampNodes.enumerated() {
            let lit = winningHoles.contains(index)
            lamp.fillColor = SKColor(lit ? theme.litLamp : theme.unlitLamp)
            lamp.strokeColor = lit ? .white : SKColor(theme.panel)
            lamp.lineWidth = lit ? 2.8 : 1.8
            lamp.glowWidth = lit ? 5 : 0
            lamp.alpha = activeHole == index ? 0.55 : 1
            if lampHaloNodes.indices.contains(index) {
                let halo = lampHaloNodes[index]
                halo.isHidden = !lit
                halo.strokeColor = SKColor(theme.litLamp)
                halo.glowWidth = 13
                halo.alpha = activeHole == index ? 0.45 : 0.94
            }
        }
    }

    func setPerformanceMode(_ mode: PerformanceMode) {
        view?.preferredFramesPerSecond = mode == .powerSaving ? 30 : 60
    }

    @discardableResult
    func launch(power: Double, seed: UInt64) -> UInt64 {
        var rng = SplitMix64(state: seed)
        physicsWorldModel.prepare()
        physicsWorldModel.launch(power: power, rng: &rng)
        lastUpdateTime = nil
        isPaused = false
        syncBall()
        return rng.state
    }

    func restore(_ snapshot: PhysicsSnapshot) {
        physicsWorldModel.restore(snapshot)
        syncBall()
        isPaused = !snapshot.ball.active
    }

    func pauseAndCheckpoint() -> PhysicsSnapshot {
        isPaused = true
        return physicsWorldModel.snapshot
    }

    func prepare() {
        physicsWorldModel.prepare()
        syncBall()
        isPaused = true
    }

    override func update(_ currentTime: TimeInterval) {
        guard physicsWorldModel.ball.active else {
            isPaused = true
            return
        }
        let delta = lastUpdateTime.map { min(0.05, max(0, currentTime - $0)) } ?? 0
        lastUpdateTime = currentTime
        if let hole = physicsWorldModel.advance(frameDelta: delta) {
            syncBall()
            isPaused = true
            onLanding?(hole, physicsWorldModel.snapshot)
            return
        }
        syncBall()
        if currentTime - lastCheckpointTime >= 0.5 {
            lastCheckpointTime = currentTime
            onCheckpoint?(physicsWorldModel.snapshot)
        }
    }

    private func buildBoard() {
        removeAllChildren()
        pegNodes.removeAll(keepingCapacity: true)
        railNodes.removeAll(keepingCapacity: true)
        lampNodes.removeAll(keepingCapacity: true)
        lampHaloNodes.removeAll(keepingCapacity: true)

        boardNode.path = CGPath(roundedRect: CGRect(x: 4, y: 4, width: 552, height: 712), cornerWidth: 18, cornerHeight: 18, transform: nil)
        boardNode.lineWidth = 5
        boardNode.zPosition = -10
        addChild(boardNode)

        for peg in GameGeometry.pegs {
            let node = SKShapeNode(circleOfRadius: peg.radius)
            node.position = point(x: peg.x, y: peg.y)
            node.lineWidth = 2
            node.zPosition = 2
            addChild(node)
            pegNodes.append(node)
        }

        for segment in GameGeometry.segments where segment.kind != .outer {
            let path = CGMutablePath()
            path.move(to: point(x: segment.ax, y: segment.ay))
            path.addLine(to: point(x: segment.bx, y: segment.by))
            let node = SKShapeNode(path: path)
            node.lineWidth = segment.thickness
            node.lineCap = .round
            node.zPosition = 1
            addChild(node)
            railNodes.append(node)
        }

        for (index, center) in GameGeometry.slotCenters.enumerated() {
            let lamp = SKShapeNode(circleOfRadius: 7.6)
            lamp.position = point(x: center, y: 574)
            lamp.name = "lamp-\(index)"
            lamp.lineWidth = 1.8
            lamp.strokeColor = .white.withAlphaComponent(0.4)
            lamp.zPosition = 3
            addChild(lamp)
            lampNodes.append(lamp)

            let halo = SKShapeNode(circleOfRadius: 11.4)
            halo.position = lamp.position
            halo.fillColor = .clear
            halo.strokeColor = .clear
            halo.lineWidth = 3.2
            halo.zPosition = 2.8
            halo.isHidden = true
            addChild(halo)
            lampHaloNodes.append(halo)
        }

        ballNode.size = CGSize(width: GameGeometry.ballRadius * 2.72, height: GameGeometry.ballRadius * 2.72)
        ballNode.colorBlendFactor = 0
        ballNode.zPosition = 10
        addChild(ballNode)
        apply(theme: theme, winningHoles: [])
    }

    private func syncBall() {
        let ball = physicsWorldModel.ball
        ballNode.position = point(x: ball.x, y: ball.y)
        ballNode.zRotation = ball.angle
        ballNode.isHidden = false
    }

    private func point(x: Double, y: Double) -> CGPoint {
        CGPoint(x: x, y: GameGeometry.worldHeight - y)
    }
}
