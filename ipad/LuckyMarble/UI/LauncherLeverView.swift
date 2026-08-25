import SwiftUI

struct LauncherLeverView: View {
    let power: Double
    let charging: Bool
    let enabled: Bool
    let impact: Bool
    let theme: ThemePack

    private var pull: Double {
        charging ? min(1, max(0, power)) : 0
    }

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height
            let centerX = width * 0.5
            let knobY = height * (0.24 + pull * 0.36)
            let knobSize = min(44.0, max(32.0, width * 0.54))
            let shaftTop = height * 0.18
            let springTop = knobY + knobSize * 0.42
            let springBottom = height * 0.79

            ZStack {
                RoundedRectangle(cornerRadius: 22)
                    .fill(
                        LinearGradient(
                            colors: enabled
                                ? [Color(hex: 0x7119B8), theme.panel.opacity(0.97), theme.deep, Color.black.opacity(0.96)]
                                : [Color.gray.opacity(0.58), theme.deep.opacity(0.86), Color.black.opacity(0.9)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                RoundedRectangle(cornerRadius: 18)
                    .fill(Color.black.opacity(0.82))
                    .frame(width: min(50, width * 0.68), height: height * 0.7)
                    .position(x: centerX, y: height * 0.49)
                    .overlay {
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(
                                LinearGradient(
                                    colors: [Color(hex: 0xFFF3A7), theme.accent, Color(hex: 0xA85B00)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 3
                            )
                            .frame(width: min(50, width * 0.68), height: height * 0.7)
                    }

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: 0xFFF7B8), Color(hex: 0xF8B928), Color(hex: 0x9E4B00)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: min(46, width * 0.62), height: 9)
                    .position(x: centerX, y: springBottom + 7)
                    .shadow(color: impact ? Color.cyan.opacity(0.92) : theme.accent.opacity(0.28), radius: impact ? 15 : 5)

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: 0xFFF7B8), Color(hex: 0xF4A819), Color(hex: 0x7B2B00)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: 11, height: max(10, knobY - shaftTop))
                    .position(x: centerX, y: shaftTop + max(10, knobY - shaftTop) / 2)
                    .overlay {
                        Capsule()
                            .fill(Color.white.opacity(0.48))
                            .frame(width: 2.5, height: max(8, knobY - shaftTop - 5))
                            .position(x: centerX - 2.5, y: shaftTop + max(10, knobY - shaftTop) / 2)
                    }

                SpringCoilShape(turns: 6)
                    .stroke(
                        Color.black.opacity(0.88),
                        style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round)
                    )
                    .frame(width: 32, height: max(12, springBottom - springTop))
                    .position(x: centerX, y: springTop + max(12, springBottom - springTop) / 2)

                SpringCoilShape(turns: 6)
                    .stroke(
                        LinearGradient(
                            colors: enabled
                                ? [Color(hex: 0x64EFFF), .white, Color(hex: 0xB72CFF), Color(hex: 0x5B0A86)]
                                : [Color.white.opacity(0.5), Color.gray.opacity(0.45)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round)
                    )
                    .frame(width: 32, height: max(12, springBottom - springTop))
                    .position(x: centerX, y: springTop + max(12, springBottom - springTop) / 2)
                    .shadow(color: enabled ? Color(hex: 0xA727FF).opacity(0.72) : .clear, radius: 4)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: enabled
                                ? [.white, Color(hex: 0xD778FF), Color(hex: 0x7C10D5), Color(hex: 0x2C004C)]
                                : [.white.opacity(0.7), .gray, theme.deep],
                            center: UnitPoint(x: 0.32, y: 0.24),
                            startRadius: 1,
                            endRadius: knobSize * 0.55
                        )
                    )
                    .frame(width: knobSize, height: knobSize)
                    .overlay(Circle().stroke(Color(hex: 0xFFD56A), lineWidth: 3))
                    .overlay(alignment: .topLeading) {
                        Circle()
                            .fill(Color.white.opacity(0.72))
                            .frame(width: knobSize * 0.2, height: knobSize * 0.2)
                            .offset(x: knobSize * 0.23, y: knobSize * 0.16)
                    }
                    .shadow(color: enabled ? Color.cyan.opacity(impact ? 0.95 : 0.42) : .clear, radius: impact ? 15 : 7)
                    .position(x: centerX, y: knobY)
                    .scaleEffect(impact ? 1.12 : 1)

                if enabled {
                    Image(systemName: "chevron.down.2")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(Color(hex: 0x67EEFF))
                        .position(x: width * 0.82, y: height * 0.5)
                }

                Text(charging ? "蓄力 \(Int(power * 100))%" : enabled ? "按住拉杆" : "等待投珠")
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(.white.opacity(enabled ? 1 : 0.62))
                    .frame(maxWidth: width - 8)
                    .position(x: centerX, y: height * 0.93)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 22)
                    .stroke(
                        LinearGradient(
                            colors: [Color(hex: 0xFFF4A0), theme.accent, Color(hex: 0x8C3B00)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 3
                    )
            )
            .shadow(color: enabled ? Color(hex: 0xA727FF).opacity(0.5) : .clear, radius: 9)
            .animation(.linear(duration: 0.045), value: pull)
            .animation(.spring(response: 0.2, dampingFraction: 0.48), value: impact)
        }
        .accessibilityHidden(true)
    }
}

private struct SpringCoilShape: Shape {
    let turns: Int

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard turns > 0 else { return path }
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        let segments = turns * 2
        for segment in 1...segments {
            let progress = Double(segment) / Double(segments)
            let x = segment.isMultiple(of: 2) ? rect.maxX : rect.minX
            path.addLine(to: CGPoint(x: x, y: rect.minY + rect.height * progress))
        }
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        return path
    }
}
