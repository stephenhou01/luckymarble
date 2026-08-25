import SpriteKit
import SwiftUI
import UIKit

enum ArcadeMarbleRole {
    case main
    case moving
    case stored
}

enum ArcadeMarbleVisual {
    static func draw(
        context: inout GraphicsContext,
        center: CGPoint,
        radius: Double,
        role: ArcadeMarbleRole = .main,
        glow: Color? = nil
    ) {
        let rect = CGRect(
            x: center.x - radius,
            y: center.y - radius,
            width: radius * 2,
            height: radius * 2
        )
        let intensity = role == .stored ? 0.52 : role == .moving ? 0.78 : 1
        let aura = glow ?? (role == .main ? Color.cyan.opacity(0.86) : nil)
        if let aura {
            context.drawLayer { layer in
                layer.addFilter(.shadow(color: aura, radius: radius * (role == .main ? 0.95 : 0.58)))
                layer.fill(Path(ellipseIn: rect), with: .color(Color.cyan.opacity(0.54 * intensity)))
            }
        }

        context.fill(
            Path(ellipseIn: rect),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: .white, location: 0),
                    .init(color: Color(hex: 0xC8FAFF), location: 0.16),
                    .init(color: Color(hex: 0x42D6FF).opacity(0.96 * intensity + 0.04), location: 0.42),
                    .init(color: Color(hex: 0x177BD5).opacity(0.9 * intensity + 0.1), location: 0.7),
                    .init(color: Color(hex: 0x40107D), location: 1),
                ]),
                center: CGPoint(x: center.x - radius * 0.36, y: center.y - radius * 0.38),
                startRadius: radius * 0.03,
                endRadius: radius * 1.08
            )
        )
        context.stroke(
            Path(ellipseIn: rect),
            with: .linearGradient(
                Gradient(colors: [Color.white, Color(hex: 0x61F4FF), Color(hex: 0xA939FF), Color(hex: 0xFFD56A)]),
                startPoint: CGPoint(x: rect.minX, y: rect.minY),
                endPoint: CGPoint(x: rect.maxX, y: rect.maxY)
            ),
            lineWidth: max(1, radius * 0.13)
        )

        let highlightRadius = radius * 0.2
        let highlight = CGRect(
            x: center.x - radius * 0.53,
            y: center.y - radius * 0.55,
            width: highlightRadius * 2,
            height: highlightRadius * 2
        )
        context.fill(Path(ellipseIn: highlight), with: .color(.white.opacity(role == .stored ? 0.64 : 0.94)))

        let warmGlint = CGRect(
            x: center.x + radius * 0.28,
            y: center.y + radius * 0.2,
            width: radius * 0.22,
            height: radius * 0.22
        )
        context.fill(Path(ellipseIn: warmGlint), with: .color(Color(hex: 0xFFD56A).opacity(0.82 * intensity)))
    }

    @MainActor
    static func spriteTexture() -> SKTexture {
        let side = 128.0
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        let image = renderer.image { output in
            let cg = output.cgContext
            let core = CGRect(x: 18, y: 18, width: 92, height: 92)

            cg.saveGState()
            cg.setShadow(offset: .zero, blur: 15, color: UIColor.cyan.withAlphaComponent(0.86).cgColor)
            cg.setFillColor(UIColor.cyan.withAlphaComponent(0.58).cgColor)
            cg.fillEllipse(in: core)
            cg.restoreGState()

            cg.saveGState()
            cg.addEllipse(in: core)
            cg.clip()
            let colors = [
                UIColor.white.cgColor,
                UIColor(red: 0.65, green: 0.97, blue: 1, alpha: 1).cgColor,
                UIColor(red: 0.08, green: 0.65, blue: 1, alpha: 1).cgColor,
                UIColor(red: 0.10, green: 0.24, blue: 0.68, alpha: 1).cgColor,
                UIColor(red: 0.26, green: 0.03, blue: 0.49, alpha: 1).cgColor,
            ] as CFArray
            let locations: [CGFloat] = [0, 0.15, 0.43, 0.72, 1]
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations) {
                cg.drawRadialGradient(
                    gradient,
                    startCenter: CGPoint(x: 46, y: 43),
                    startRadius: 1,
                    endCenter: CGPoint(x: 64, y: 64),
                    endRadius: 58,
                    options: [.drawsAfterEndLocation]
                )
            }
            cg.restoreGState()

            cg.setLineWidth(5)
            cg.setStrokeColor(UIColor(red: 0.36, green: 0.95, blue: 1, alpha: 0.95).cgColor)
            cg.strokeEllipse(in: core.insetBy(dx: 2.5, dy: 2.5))

            cg.setFillColor(UIColor.white.withAlphaComponent(0.94).cgColor)
            cg.fillEllipse(in: CGRect(x: 35, y: 32, width: 21, height: 17))
            cg.setFillColor(UIColor(red: 1, green: 0.79, blue: 0.25, alpha: 0.9).cgColor)
            cg.fillEllipse(in: CGRect(x: 84, y: 80, width: 10, height: 10))
        }
        let texture = SKTexture(image: image)
        texture.filteringMode = .linear
        return texture
    }
}
