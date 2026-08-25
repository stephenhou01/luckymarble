import SwiftUI
import UIKit

struct CardOutletView: View {
    let totalCards: Int
    let activeCards: Int
    let theme: ThemePack

    var body: some View {
        VStack(spacing: 3) {
            Capsule()
                .fill(Color.black.opacity(0.92))
                .frame(height: 12)
                .overlay(Capsule().stroke(theme.accent, lineWidth: 1.5))
                .shadow(color: activeCards > 0 ? theme.accent : .clear, radius: 7)
            HStack(spacing: 4) {
                Image(systemName: "rectangle.stack.fill")
                Text("\(totalCards)").monospacedDigit()
            }
            .font(.caption.bold())
            .foregroundStyle(.white)
        }
        .padding(7)
        .frame(minHeight: 58)
        .background(theme.deep.opacity(0.94), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.accent, lineWidth: 2))
        .scaleEffect(activeCards > 0 ? 1.035 : 1)
        .animation(.easeOut(duration: 0.18), value: activeCards)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("出卡口，卡片包 \(totalCards)")
    }
}

struct CardRewardShowcase: View {
    let awarded: Int
    let visibleCount: Int
    let theme: ThemePack
    let reducedMotion: Bool

    private var columnCount: Int {
        awarded == 1 ? 1 : awarded <= 4 ? 2 : 3
    }

    var body: some View {
        GeometryReader { proxy in
            let gap = min(14.0, proxy.size.width * 0.024)
            let availableWidth = min(proxy.size.width * 0.88, 430)
            let rowCount = max(1, Int(ceil(Double(max(1, awarded)) / Double(columnCount))))
            let widthLimit = (availableWidth - gap * Double(columnCount - 1)) / Double(columnCount)
            let heightLimit = max(64, (proxy.size.height - gap * Double(rowCount - 1)) / Double(rowCount) / 1.38)
            let preferredWidth = awarded == 1 ? 158.0 : awarded <= 4 ? 138.0 : 116.0
            let cardWidth = min(preferredWidth, widthLimit, heightLimit)
            let columns = Array(repeating: GridItem(.fixed(cardWidth), spacing: gap), count: columnCount)

            ZStack {
                LazyVGrid(columns: columns, spacing: gap) {
                    ForEach(0..<awarded, id: \.self) { index in
                        if index < visibleCount {
                            RewardCardView(
                                index: index,
                                width: cardWidth,
                                travel: CGSize(width: -proxy.size.width * 0.42, height: -proxy.size.height * 0.36),
                                theme: theme,
                                reducedMotion: reducedMotion
                            )
                        } else {
                            Color.clear
                                .frame(width: cardWidth, height: cardWidth * 1.4)
                                .accessibilityHidden(true)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("card-reward-showcase")
        .accessibilityLabel("本局获得 \(awarded) 张卡片")
    }
}

struct RewardPresentationView: View {
    let result: RoundResult
    let displayedPayout: Int
    let visibleCards: Int
    let theme: ThemePack
    let reducedMotion: Bool

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.opacity(0.16)
                VStack(spacing: 16) {
                    RewardSummaryBanner(
                        result: result,
                        displayedPayout: displayedPayout,
                        theme: theme
                    )
                    .frame(maxWidth: min(470, proxy.size.width * 0.9))

                    if result.cardsAwarded > 0 {
                        CardRewardShowcase(
                            awarded: result.cardsAwarded,
                            visibleCount: visibleCards,
                            theme: theme,
                            reducedMotion: reducedMotion
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        Spacer(minLength: 0)
                    }
                }
                .padding(.top, 20)
                .padding(.horizontal, 16)
                .padding(.bottom, 22)
            }
        }
        .allowsHitTesting(false)
        .accessibilityElement(children: .contain)
    }
}

private struct RewardSummaryBanner: View {
    let result: RoundResult
    let displayedPayout: Int
    let theme: ThemePack

    var body: some View {
        VStack(spacing: 5) {
            Text(result.payout >= 500 ? "超级大奖" : "恭喜中奖")
                .font(.system(size: 30, weight: .black, design: .rounded))
            HStack(spacing: 10) {
                Label("+\(displayedPayout) 颗弹珠", systemImage: "circle.circle.fill")
                if result.cardsAwarded > 0 {
                    Text("·")
                    Label("+\(result.cardsAwarded) 张卡片", systemImage: "rectangle.stack.fill")
                }
            }
            .font(.system(size: 22, weight: .black, design: .rounded).monospacedDigit())
            .minimumScaleFactor(0.72)
            Text("当前倍率 ×\(result.multiplier)")
                .font(.subheadline.bold())
                .foregroundStyle(theme.accent)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 22)
        .padding(.vertical, 13)
        .foregroundStyle(.white)
        .background(theme.deep.opacity(0.96), in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(theme.accent, lineWidth: 4))
        .shadow(color: theme.accent.opacity(0.7), radius: 20, y: 5)
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("win-summary-banner")
        .accessibilityLabel("恭喜中奖，赢得 \(result.payout) 颗弹珠，获得 \(result.cardsAwarded) 张卡片，当前倍率 \(result.multiplier) 倍")
    }
}

private struct RewardCardView: View {
    let index: Int
    let width: Double
    let travel: CGSize
    let theme: ThemePack
    let reducedMotion: Bool
    @State private var presented = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: width * 0.14)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: 0xA73CE0), theme.panel, Color(hex: 0x22043F)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            RoundedRectangle(cornerRadius: width * 0.11)
                .stroke(theme.accent.opacity(0.52), lineWidth: 1)
                .padding(width * 0.07)

            VStack(spacing: width * 0.035) {
                Image(bundleAsset: "mascot-win-v2", extension: "webp")
                    .resizable()
                    .scaledToFill()
                    .frame(width: width * 0.68, height: width * 0.68)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(theme.accent, lineWidth: 2))
                    .shadow(color: .black.opacity(0.42), radius: 4, y: 3)
                Text("幸运奖卡")
                    .font(.system(size: max(9, width * 0.13), weight: .black, design: .rounded))
                Text("MARBLE LUCK")
                    .font(.system(size: max(5, width * 0.065), weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Color(hex: 0xEACBFF))
            }
            .padding(.top, width * 0.06)

            Image(systemName: "diamond.fill")
                .font(.system(size: width * 0.2))
                .foregroundStyle(theme.accent)
                .shadow(color: theme.accent.opacity(0.8), radius: 5)
                .position(x: width * 0.18, y: width * 0.2)
        }
        .frame(width: width, height: width * 1.4)
        .foregroundStyle(.white)
        .overlay(RoundedRectangle(cornerRadius: width * 0.14).stroke(theme.accent, lineWidth: max(2, width * 0.04)))
        .shadow(color: Color.black.opacity(0.45), radius: 9, y: 6)
        .opacity(presented ? 1 : 0)
        .scaleEffect(presented ? 1 : 0.16)
        .rotationEffect(.degrees(presented ? 0 : -11))
        .offset(presented || reducedMotion ? .zero : travel)
        .onAppear {
            guard !reducedMotion else {
                presented = true
                return
            }
            withAnimation(.spring(response: 0.52, dampingFraction: 0.66)) {
                presented = true
            }
        }
        .accessibilityHidden(true)
    }
}

struct RewardMarbleBankView: View {
    let balance: Int
    let incomingTotal: Int
    let incomingProcessed: Int
    let visualRadius: Double
    let theme: ThemePack

    private var incoming: Bool { incomingTotal > 0 && incomingProcessed < incomingTotal }

    var body: some View {
        GeometryReader { _ in
            VStack(spacing: 4) {
                Text("奖珠仓")
                    .font(.caption2.bold())
                    .foregroundStyle(theme.accent)
                    .padding(.top, 8)
                ZStack {
                    StoredMarblesCanvas(balance: balance, radius: visualRadius)
                    if incoming {
                        IncomingMarblesCanvas(total: incomingTotal, radius: visualRadius, theme: theme)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                Text(balance > 999 ? "999+" : "\(balance)")
                    .font(.caption.monospacedDigit().bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
                    .padding(5)
            }
        }
        .background(
            LinearGradient(colors: [theme.deep, Color.black.opacity(0.95)], startPoint: .top, endPoint: .bottom),
            in: RoundedRectangle(cornerRadius: 18)
        )
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.accent, lineWidth: incoming ? 3 : 2))
        .shadow(color: incoming ? theme.accent.opacity(0.55) : .clear, radius: 10)
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("reward-marble-bank")
        .accessibilityLabel(
            incoming
                ? "奖珠正在入仓，\(incomingProcessed)／\(incomingTotal)，当前存量 \(balance) 颗"
                : "奖珠仓，存量 \(balance) 颗"
        )
    }
}

struct WagerMarbleQueueView: View {
    let total: Int
    let processed: Int
    let active: Bool
    let visualRadius: Double
    let theme: ThemePack

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                RoundedRectangle(cornerRadius: 18)
                    .fill(
                        LinearGradient(
                            colors: [Color.black.opacity(0.88), theme.deep.opacity(0.94), Color.black.opacity(0.9)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                RoundedRectangle(cornerRadius: 15)
                    .fill(Color.black.opacity(0.48))
                    .frame(width: max(0, proxy.size.width - 18), height: proxy.size.height * 0.58)
                    .position(x: proxy.size.width / 2, y: proxy.size.height * 0.63)
                    .overlay {
                        RoundedRectangle(cornerRadius: 15)
                            .stroke(theme.accent.opacity(0.55), lineWidth: 2)
                            .frame(width: max(0, proxy.size.width - 18), height: proxy.size.height * 0.58)
                            .position(x: proxy.size.width / 2, y: proxy.size.height * 0.63)
                    }
                Capsule()
                    .fill(Color.black.opacity(0.96))
                    .frame(width: 64, height: 34)
                    .position(x: 41, y: proxy.size.height * 0.67)
                    .shadow(color: active ? theme.litLamp.opacity(0.5) : .clear, radius: 8)
                    .overlay {
                        Capsule()
                            .stroke(theme.accent.opacity(0.82), lineWidth: 2.5)
                            .frame(width: 64, height: 34)
                            .position(x: 41, y: proxy.size.height * 0.67)
                    }

                HStack(spacing: 4) {
                    Image(systemName: "arrow.left")
                    Text("投珠入口")
                }
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(theme.accent.opacity(0.9))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(theme.deep.opacity(0.88), in: Capsule())
                .position(x: proxy.size.width - 55, y: proxy.size.height * 0.35)

                if active {
                    WagerRollingMarblesCanvas(
                        total: total,
                        radius: visualRadius,
                        theme: theme
                    )
                }

                HStack {
                    Text("重力投珠槽")
                    Spacer()
                    Text("已投入 \(min(processed, total))/\(total)")
                        .monospacedDigit()
                }
                .font(.caption2.bold())
                .foregroundStyle(.white.opacity(0.92))
                .padding(.horizontal, 13)
                .padding(.top, 7)
                .frame(maxHeight: .infinity, alignment: .top)
                .allowsHitTesting(false)
            }
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.accent, lineWidth: 2))
            .shadow(color: theme.accent.opacity(0.4), radius: 8)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("wager-marble-queue")
        .accessibilityLabel(active ? "投珠中，已投入 \(processed)／\(total)" : "重力投珠槽")
    }
}

private struct WagerRollingMarblesCanvas: View {
    let total: Int
    let radius: Double
    let theme: ThemePack

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            Canvas { context, size in
                let safeRadius = min(radius, max(3.5, size.height * 0.14))
                let poolSize = min(12, max(1, total))
                let clock = timeline.date.timeIntervalSinceReferenceDate
                for index in 0..<poolSize {
                    let phase = (clock * 0.92 + Double(index) / Double(poolSize)).truncatingRemainder(dividingBy: 1)
                    let eased = phase * phase * (3 - 2 * phase)
                    let x = size.width - 24 - (size.width - 64) * eased
                    let y = size.height * 0.67 - sin(phase * .pi) * size.height * 0.15
                    ArcadeMarbleVisual.draw(
                        context: &context,
                        center: CGPoint(x: x, y: y),
                        radius: safeRadius,
                        role: .moving,
                        glow: theme.accent.opacity(0.34)
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct StoredMarblesCanvas: View {
    let balance: Int
    let radius: Double

    var body: some View {
        Canvas { context, size in
            let safeRadius = min(radius, max(2.5, (size.width - 10) / 2))
            let xPitch = safeRadius * 2.08
            let yPitch = safeRadius * 2.02
            let usableWidth = max(0, size.width - safeRadius * 2 - 8)
            let columns = max(1, Int(floor(usableWidth / xPitch)) + 1)
            let usableHeight = max(0, size.height - safeRadius * 2 - 8)
            let rows = max(1, Int(floor(usableHeight / yPitch)) + 1)
            let capacity = columns * rows
            let count = min(max(0, balance), capacity)

            for index in 0..<count {
                let row = index / columns
                let column = index % columns
                let itemsInRow = min(columns, count - row * columns)
                let rowWidth = Double(max(0, itemsInRow - 1)) * xPitch
                let x = size.width / 2 - rowWidth / 2 + Double(column) * xPitch
                let y = size.height - 5 - safeRadius - Double(row) * yPitch
                ArcadeMarbleVisual.draw(
                    context: &context,
                    center: CGPoint(x: x, y: y),
                    radius: safeRadius,
                    role: .stored
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(false)
    }
}

private struct IncomingMarblesCanvas: View {
    let total: Int
    let radius: Double
    let theme: ThemePack

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            Canvas { context, size in
                let poolSize = total > 100 ? 24 : min(12, max(1, total))
                let clock = timeline.date.timeIntervalSinceReferenceDate
                let safeRadius = min(radius, max(2.5, (size.width - 10) / 2))
                for index in 0..<poolSize {
                    let phase = (clock * 0.72 + Double(index) / Double(poolSize)).truncatingRemainder(dividingBy: 1)
                    let lane = Double((index * 7) % max(1, poolSize)) / Double(max(1, poolSize - 1))
                    let x = safeRadius + 5 + (size.width - safeRadius * 2 - 10) * lane
                    let eased = phase * phase * (3 - 2 * phase)
                    let y = -safeRadius + (size.height - safeRadius * 1.4) * eased
                    ArcadeMarbleVisual.draw(
                        context: &context,
                        center: CGPoint(x: x, y: y),
                        radius: safeRadius,
                        role: .moving,
                        glow: theme.accent.opacity(0.45)
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }
}

private extension Image {
    init(bundleAsset name: String, extension fileExtension: String) {
        if let path = Bundle.main.path(forResource: name, ofType: fileExtension),
           let image = UIImage(contentsOfFile: path) {
            self.init(uiImage: image)
        } else {
            self.init(systemName: "rectangle.stack.fill")
        }
    }
}
