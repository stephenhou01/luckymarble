import SpriteKit
import SwiftUI

struct ContentView: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var engine: GameEngine
    @ObservedObject private var settingsStore: SettingsStore
    @State private var activeHeaderSheet: HeaderSheet?
    @State private var chargingGestureActive = false
    @State private var showsCreditMenu = false
    @State private var layoutRevision = 0
    @State private var viewportSize = UIScreen.main.bounds.size
    @State private var sharedMarbleRadius = 8.0
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    init(model: AppModel) {
        self.model = model
        engine = model.engine
        settingsStore = model.settingsStore
    }

    var body: some View {
        GeometryReader { proxy in
            let activeSize = viewportSize.width > 0 && viewportSize.height > 0 ? viewportSize : proxy.size
            let cabinetWidth = min(activeSize.width, activeSize.height * 744 / 1133)
            let theme = settingsStore.selectedTheme
            ZStack {
                ThemeSideBackground(theme: theme)
                cabinet(theme: theme)
                    .frame(width: cabinetWidth, height: activeSize.height)
                    .frame(maxWidth: .infinity)
            }
            .frame(width: activeSize.width, height: activeSize.height)
            .position(x: activeSize.width / 2, y: activeSize.height / 2)
            .ignoresSafeArea()
        }
        .id(layoutRevision)
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(300))
                viewportSize = UIScreen.main.bounds.size
                layoutRevision &+= 1
            }
        }
        .sheet(item: $activeHeaderSheet) { sheet in
            switch sheet {
            case .music:
                MusicSelectionView(model: model)
            case .theme:
                ThemeSelectionView(model: model)
            case .settings:
                SettingsView(model: model)
            }
        }
        .alert("存档已恢复", isPresented: Binding(
            get: { engine.recoveryNotice != nil },
            set: { if !$0 { engine.dismissRecoveryNotice() } }
        )) {
            Button("知道了") { engine.dismissRecoveryNotice() }
        } message: {
            Text(engine.recoveryNotice ?? "")
        }
    }

    private func cabinet(theme: ThemePack) -> some View {
        ZStack {
            Image(bundlePNG: theme.backgroundAsset)
                .resizable()
                .scaledToFill()
                .accessibilityHidden(true)

            VStack(spacing: 8) {
                ScoreboardView(
                    engine: engine,
                    settingsStore: settingsStore,
                    theme: theme,
                    showsCreditMenu: $showsCreditMenu,
                    openMusic: { activeHeaderSheet = .music },
                    openTheme: { activeHeaderSheet = .theme },
                    openSettings: { activeHeaderSheet = .settings }
                )
                .padding(.top, 26)

                HStack(spacing: 8) {
                    CardOutletView(totalCards: engine.displayedTotalCards, activeCards: engine.visibleRewardCards, theme: theme)
                        .frame(width: 104)
                    MultiplierStrip(engine: engine, theme: theme)
                }

                GeometryReader { boardProxy in
                    let bankWidth = min(78.0, max(58.0, boardProxy.size.width * 0.14))
                    let boardWidth = min(boardProxy.size.width - bankWidth - 7, boardProxy.size.height * 560 / 720)
                    let boardHeight = boardWidth * 720 / 560
                    let marbleRadius = boardWidth / GameGeometry.worldWidth * GameGeometry.ballRadius
                    HStack(spacing: 7) {
                        ZStack {
                            SpriteView(scene: model.scene, options: [.allowsTransparency])
                                .background(theme.board.opacity(0.92), in: RoundedRectangle(cornerRadius: 22))
                                .overlay(RoundedRectangle(cornerRadius: 22).stroke(theme.accent, lineWidth: 3))
                                .accessibilityLabel("弹珠碰撞区域")

                            if engine.celebrationVisible, let result = engine.state.lastResult {
                                RewardPresentationView(
                                    result: result,
                                    displayedPayout: engine.rewardDisplayCount,
                                    visibleCards: engine.visibleRewardCards,
                                    theme: theme,
                                    reducedMotion: settingsStore.settings.reduceMotion || systemReduceMotion
                                )
                                .transition(.scale.combined(with: .opacity))
                                .zIndex(3)
                            } else if engine.phase == .settling, let result = engine.state.lastResult {
                                ResultBanner(result: result, theme: theme)
                            }
                        }
                        .frame(width: boardWidth, height: boardHeight)

                        RewardMarbleBankView(
                            balance: engine.displayedBalance,
                            incomingTotal: engine.phase == .rewarding ? engine.state.lastResult?.payout ?? 0 : 0,
                            incomingProcessed: engine.phase == .rewarding ? engine.rewardDisplayCount : 0,
                            visualRadius: marbleRadius,
                            theme: theme
                        )
                        .frame(width: bankWidth, height: boardHeight)
                    }
                    .frame(width: boardWidth + bankWidth + 7, height: boardHeight)
                    .position(x: boardProxy.size.width / 2, y: boardProxy.size.height / 2)
                    .background(
                        Color.clear.preference(
                            key: MarbleRadiusPreferenceKey.self,
                            value: marbleRadius
                        )
                    )
                }
                .frame(maxHeight: .infinity)

                ZStack {
                    StatusBar(engine: engine, theme: theme)
                        .opacity(engine.wagerTransferActive ? 0 : 1)
                    WagerMarbleQueueView(
                        total: engine.wagerTransferTotal,
                        processed: engine.wagerTransferProcessed,
                        active: engine.wagerTransferActive,
                        visualRadius: sharedMarbleRadius,
                        theme: theme
                    )
                    .opacity(engine.wagerTransferActive ? 1 : 0)
                }
                .frame(height: 104)
                ControlDeck(
                    engine: engine,
                    theme: theme,
                    babyMode: settingsStore.settings.babyMode,
                    chargingGestureActive: $chargingGestureActive
                )
                .padding(.bottom, 20)
            }
            .padding(.horizontal, 22)
            .onPreferenceChange(MarbleRadiusPreferenceKey.self) { radius in
                if radius > 0 { sharedMarbleRadius = radius }
            }
        }
        .clipShape(Rectangle())
        .animation(
            settingsStore.settings.reduceMotion || systemReduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.8),
            value: engine.celebrationVisible
        )
    }
}

private enum HeaderSheet: String, Identifiable {
    case music
    case theme
    case settings

    var id: String { rawValue }
}

private struct MarbleRadiusPreferenceKey: PreferenceKey {
    static let defaultValue: Double = 8
    static func reduce(value: inout Double, nextValue: () -> Double) {
        value = nextValue()
    }
}

private struct ThemeSideBackground: View {
    let theme: ThemePack

    var body: some View {
        ZStack {
            theme.deep
            Image(bundlePNG: theme.backgroundAsset)
                .resizable()
                .scaledToFill()
                .blur(radius: 26)
                .opacity(0.48)
            LinearGradient(colors: [theme.deep.opacity(0.3), theme.deep.opacity(0.9)], startPoint: .top, endPoint: .bottom)
        }
        .accessibilityHidden(true)
    }
}

private struct ScoreboardView: View {
    @ObservedObject var engine: GameEngine
    @ObservedObject var settingsStore: SettingsStore
    let theme: ThemePack
    @Binding var showsCreditMenu: Bool
    let openMusic: () -> Void
    let openTheme: () -> Void
    let openSettings: () -> Void

    var body: some View {
        HStack(spacing: 7) {
            VStack(alignment: .leading, spacing: 1) {
                Text("MARBLE LUCK")
                    .font(.caption2.weight(.bold))
                    .tracking(1.6)
                    .foregroundStyle(theme.accent.opacity(0.8))
                Text("幸运弹珠")
                    .font(.system(size: 24, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            Spacer(minLength: 4)
            Metric(icon: "rectangle.stack.fill", value: engine.displayedTotalCards, label: "卡片包")
            Metric(icon: "circle.circle.fill", value: engine.displayedBalance, label: "弹珠")
            Menu {
                Button("加 100") { engine.addCredit(100) }
                Button("加 500") { engine.addCredit(500) }
                Button("加 1000") { engine.addCredit(1_000) }
            } label: {
                HeaderButton(icon: "plus", theme: theme)
            }
            .accessibilityLabel("增加弹珠")
            Button {
                settingsStore.settings.masterAudioEnabled.toggle()
            } label: {
                HeaderButton(
                    icon: settingsStore.settings.masterAudioEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill",
                    theme: theme,
                    active: settingsStore.settings.masterAudioEnabled
                )
            }
            .accessibilityLabel("音乐总开关")
            .accessibilityValue(settingsStore.settings.masterAudioEnabled ? "开启" : "关闭")
            Button(action: openMusic) {
                HeaderButton(icon: "music.note.list", theme: theme)
            }
            .accessibilityLabel("选择音乐")
            Button(action: openTheme) {
                HeaderButton(icon: "paintpalette.fill", theme: theme)
            }
            .accessibilityLabel("选择场景")
            Button {
                guard engine.canChangeBabyMode else { return }
                settingsStore.settings.babyMode.toggle()
            } label: {
                BabyModeHeaderButton(
                    active: settingsStore.settings.babyMode,
                    theme: theme
                )
            }
            .disabled(!engine.canChangeBabyMode)
            .accessibilityLabel("宝宝模式")
            .accessibilityValue(settingsStore.settings.babyMode ? "开启" : "关闭")
            Button(action: openSettings) {
                HeaderButton(icon: "gearshape.fill", theme: theme)
            }
            .accessibilityLabel("打开设置")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .background(.ultraThinMaterial.opacity(0.92), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(theme.accent, lineWidth: 2))
        .shadow(color: theme.deep.opacity(0.55), radius: 12, y: 6)
    }
}

private struct BabyModeHeaderButton: View {
    let active: Bool
    let theme: ThemePack

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "teddybear.fill")
                .font(.system(size: 15, weight: .black))
            ZStack(alignment: active ? .trailing : .leading) {
                Capsule()
                    .fill(active ? Color.green : Color.black.opacity(0.56))
                Circle()
                    .fill(.white)
                    .padding(2)
                    .shadow(color: .black.opacity(0.3), radius: 1, y: 1)
            }
            .frame(width: 24, height: 14)
            Text(active ? "开" : "关")
                .font(.system(size: 10, weight: .black, design: .rounded))
        }
        .foregroundStyle(active ? theme.deep : Color.white)
        .frame(width: 62, height: 42)
        .background(
            active ? AnyShapeStyle(theme.accent.gradient) : AnyShapeStyle(theme.panel.gradient),
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(active ? Color.white : theme.accent.opacity(0.8), lineWidth: active ? 3 : 1.5)
        )
        .shadow(color: active ? theme.accent.opacity(0.9) : .clear, radius: 10)
        .scaleEffect(active ? 1.04 : 1)
        .animation(.spring(response: 0.24, dampingFraction: 0.72), value: active)
    }
}

private struct Metric: View {
    let icon: String
    let value: Int
    let label: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon).foregroundStyle(.yellow)
            Text(value.formatted()).font(.title2.monospacedDigit().bold())
        }
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("metric-\(label)")
        .accessibilityLabel("\(label) \(value)")
    }
}

private struct HeaderButton: View {
    let icon: String
    let theme: ThemePack
    var active = false

    var body: some View {
        Image(systemName: icon)
            .font(.title3.bold())
            .foregroundStyle(active ? theme.deep : Color.white)
            .frame(width: 42, height: 42)
            .background(active ? AnyShapeStyle(theme.accent.gradient) : AnyShapeStyle(theme.panel.gradient), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Color.white : theme.accent, lineWidth: active ? 2.2 : 1.5))
            .shadow(color: active ? theme.accent.opacity(0.7) : .clear, radius: 8)
    }
}

private struct MultiplierStrip: View {
    @ObservedObject var engine: GameEngine
    let theme: ThemePack

    var body: some View {
        HStack(spacing: 7) {
            Label("倍率", systemImage: "target")
                .font(.caption.bold())
                .foregroundStyle(theme.accent)
            ForEach(GameRules.multipliers, id: \.self) { value in
                MultiplierCell(value: value, active: engine.displayMultiplier == value, theme: theme)
            }
        }
        .padding(8)
        .background(theme.deep.opacity(0.94), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(theme.accent, lineWidth: 2))
        .accessibilityElement(children: .combine)
    }
}

private struct MultiplierCell: View {
    let value: Int
    let active: Bool
    let theme: ThemePack

    var body: some View {
        VStack(spacing: 2) {
            Circle()
                .fill(active ? Color.red : Color.black.opacity(0.75))
                .frame(width: 7, height: 7)
            Text("\(value)")
                .font(.title3.monospacedDigit().weight(.black))
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .foregroundStyle(active ? theme.deep : Color.white.opacity(0.38))
        .background {
            RoundedRectangle(cornerRadius: 10)
                .fill(active ? AnyShapeStyle(theme.accent.gradient) : AnyShapeStyle(Color.black.opacity(0.9)))
        }
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? Color.white : theme.panel.opacity(0.6), lineWidth: active ? 2.5 : 1))
        .shadow(color: active ? theme.accent.opacity(0.7) : .clear, radius: 10)
        .scaleEffect(active ? 1.06 : 1)
    }
}

private struct StatusBar: View {
    @ObservedObject var engine: GameEngine
    let theme: ThemePack

    var message: String {
        switch engine.phase {
        case .betting: "选择下注，点击开始"
        case .revealing: "倍率正在滚动…"
        case .ready: "命中可得 \(engine.potentialPayout) 颗 · 请操作右侧拉杆"
        case .charging: "松开发射！"
        case .flight: "弹珠飞行中"
        case .settling: "本轮未命中"
        case .rewarding: "奖励入仓 \(engine.rewardDisplayCount)/\(engine.state.lastResult?.payout ?? 0)"
        case .gameOver: "弹珠不足，点击重置或上分"
        }
    }

    var body: some View {
        Text(message)
            .font(.subheadline.bold())
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(theme.deep.opacity(0.86), in: Capsule())
            .overlay(Capsule().stroke(theme.accent.opacity(0.7), lineWidth: 1))
            .accessibilityAddTraits(.updatesFrequently)
    }
}

private struct ControlDeck: View {
    @ObservedObject var engine: GameEngine
    let theme: ThemePack
    let babyMode: Bool
    @Binding var chargingGestureActive: Bool

    private var startTitle: String {
        if engine.wagerTransferActive { return "投珠中" }
        switch engine.phase {
        case .betting: return "开始"
        case .revealing: return "倍率中"
        case .ready: return "去拉杆"
        case .charging: return "蓄力中"
        case .flight: return "已发射"
        case .settling, .rewarding: return "结算中"
        case .gameOver: return "重新开始"
        }
    }

    private var startIsActionable: Bool {
        (engine.phase == .betting && engine.canStart) || engine.phase == .gameOver
    }

    var body: some View {
        HStack(spacing: 12) {
            Button {
                engine.phase == .gameOver ? engine.resetGame() : engine.startRound(babyMode: babyMode)
            } label: {
                VStack(spacing: 2) {
                    Image(systemName: startIsActionable ? "play.fill" : "arrow.right.circle.fill")
                        .font(.headline.bold())
                    Text(startTitle)
                        .font(.headline.weight(.black))
                }
                    .frame(width: 112, height: 76)
                    .background(
                        startIsActionable
                            ? AnyShapeStyle(Color.green.gradient)
                            : AnyShapeStyle(Color.gray.opacity(0.72).gradient),
                        in: Capsule()
                    )
                    .overlay(Capsule().stroke(theme.accent, lineWidth: 4))
            }
            .disabled(!startIsActionable)
            .opacity(1)
            .accessibilityLabel(startTitle)

            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    WagerActionButton(
                        symbol: "minus",
                        accessibilityLabel: "减少下注",
                        repeatsWhileHeld: false,
                        disabled: ![GamePhase.betting, .ready].contains(engine.phase),
                        theme: theme
                    ) { engine.changeWager(by: -1) }
                    VStack(spacing: 0) {
                        Text("下注").font(.caption.bold())
                        Text("\(engine.activeRound?.wager ?? engine.state.draftWager)")
                            .font(.largeTitle.monospacedDigit().weight(.black))
                            .accessibilityIdentifier("wager-value")
                    }
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .background(theme.panel.gradient, in: RoundedRectangle(cornerRadius: 15))
                    WagerActionButton(
                        symbol: "plus",
                        accessibilityLabel: "增加下注",
                        repeatsWhileHeld: true,
                        disabled: ![GamePhase.betting, .ready].contains(engine.phase),
                        theme: theme
                    ) { engine.changeWager(by: 1) }
                }
                HStack(spacing: 6) {
                    ForEach([35, 10, 99], id: \.self) { value in
                        Button("\(value)") {
                            if engine.phase == .ready {
                                engine.addWagerChip(value)
                            } else {
                                engine.setWager(value)
                            }
                        }
                            .font(.headline.bold())
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(theme.panel.gradient, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.accent, lineWidth: 1.5))
                            .disabled(![GamePhase.betting, .ready].contains(engine.phase))
                            .accessibilityIdentifier("wager-chip-\(value)")
                            .accessibilityLabel(engine.phase == .ready ? "追加 \(value) 颗" : "下注 \(value) 颗")
                    }
                    Menu {
                        ForEach(GameRules.wagerLimitOptions, id: \.self) { limit in
                            Button {
                                engine.setWagerLimit(limit)
                            } label: {
                                if engine.state.wagerLimit == limit {
                                    Label("\(limit)", systemImage: "checkmark")
                                } else {
                                    Text("\(limit)")
                                }
                            }
                        }
                    } label: {
                        VStack(spacing: 0) {
                            Text("上限").font(.caption2.bold())
                            Text("\(engine.state.wagerLimit)").font(.caption.monospacedDigit().bold())
                        }
                        .frame(minWidth: 48, minHeight: 44)
                        .background(theme.deep.gradient, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.accent, lineWidth: 1.5))
                    }
                    .disabled(engine.phase != .betting)
                    .accessibilityLabel("设置投注上限，当前\(engine.state.wagerLimit)分")
                }
            }

            LauncherLeverView(
                power: engine.power,
                charging: engine.phase == .charging,
                enabled: engine.canCharge || engine.phase == .charging,
                impact: engine.phase == .flight,
                theme: theme
            )
            .frame(width: 102, height: 104)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard !chargingGestureActive, engine.canCharge else { return }
                        chargingGestureActive = true
                        engine.beginCharging()
                    }
                    .onEnded { _ in
                        guard chargingGestureActive else { return }
                        chargingGestureActive = false
                        engine.releaseCharge()
                    }
            )
            .accessibilityLabel("按住蓄力，松开发射")
        }
        .foregroundStyle(.white)
    }

}

private struct WagerActionButton: View {
    let symbol: String
    let accessibilityLabel: String
    let repeatsWhileHeld: Bool
    let disabled: Bool
    let theme: ThemePack
    let action: () -> Void
    @State private var repeatTask: Task<Void, Never>?

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.title2.bold())
                .frame(width: 48, height: 56)
                .background(theme.panel.gradient, in: Circle())
                .overlay(Circle().stroke(theme.accent, lineWidth: 2))
        }
        .disabled(disabled)
        .accessibilityLabel(accessibilityLabel)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in beginRepeatingIfNeeded() }
                .onEnded { _ in stopRepeating() }
        )
        .onDisappear { stopRepeating() }
    }

    private func beginRepeatingIfNeeded() {
        guard repeatsWhileHeld, !disabled, repeatTask == nil else { return }
        repeatTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(360))
            while !Task.isCancelled {
                action()
                try? await Task.sleep(for: .milliseconds(72))
            }
        }
    }

    private func stopRepeating() {
        repeatTask?.cancel()
        repeatTask = nil
    }
}

private struct ResultBanner: View {
    let result: RoundResult
    let theme: ThemePack

    var body: some View {
        VStack(spacing: 5) {
            Text(result.won ? "命中！" : "差一点")
                .font(.largeTitle.weight(.black))
            Text(result.won ? "返还 \(result.payout) 颗" : "落入 \(result.landingHole + 1) 号洞")
                .font(.headline)
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 18)
        .foregroundStyle(.white)
        .background(theme.deep.opacity(0.94), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(theme.accent, lineWidth: 3))
    }
}

private struct CelebrationView: View {
    let result: RoundResult
    let displayedPayout: Int
    let visibleCards: Int
    let theme: ThemePack

    var body: some View {
        ZStack {
            VStack(spacing: 8) {
                Text(result.payout >= 500 ? "超级大奖" : "恭喜中奖")
                    .font(.system(size: 36, weight: .black, design: .rounded))
                Text("+\(displayedPayout) 颗弹珠")
                    .font(.system(size: 42, weight: .black, design: .rounded).monospacedDigit())
                if result.cardsAwarded > 0 {
                    Text("+\(result.cardsAwarded) 张卡片")
                        .font(.title2.bold())
                    HStack(spacing: 4) {
                        ForEach(0..<result.cardsAwarded, id: \.self) { index in
                            Image(systemName: "rectangle.stack.fill")
                                .foregroundStyle(index < visibleCards ? theme.accent : Color.white.opacity(0.18))
                                .scaleEffect(index < visibleCards ? 1 : 0.72)
                        }
                    }
                }
                Text("当前倍率 ×\(result.multiplier)")
                    .font(.headline)
            }
            .padding(.horizontal, 38)
            .padding(.vertical, 24)
            .foregroundStyle(.white)
            .background(theme.deep.opacity(0.94), in: RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(theme.accent, lineWidth: 4))
            .shadow(color: theme.accent.opacity(0.65), radius: 24)
        }
        .padding(20)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("恭喜中奖，赢得 \(result.payout) 颗弹珠，获得 \(result.cardsAwarded) 张卡片")
    }
}
