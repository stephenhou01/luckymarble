import SwiftUI
import UIKit

enum ThemeID: String, Codable, CaseIterable, Identifiable, Sendable {
    case classic
    case ocean
    case cosmic
    case candy

    var id: String { rawValue }
}

struct ThemePack: Identifiable, Sendable {
    let id: ThemeID
    let displayName: String
    let backgroundAsset: String
    let thumbnailAsset: String
    let deepHex: UInt32
    let panelHex: UInt32
    let accentHex: UInt32
    let boardHex: UInt32
    let litLampHex: UInt32
    let unlitLampHex: UInt32

    var deep: Color { Color(hex: deepHex) }
    var panel: Color { Color(hex: panelHex) }
    var accent: Color { Color(hex: accentHex) }
    var board: Color { Color(hex: boardHex) }
    var litLamp: Color { Color(hex: litLampHex) }
    var unlitLamp: Color { Color(hex: unlitLampHex) }

    static let all: [ThemePack] = [
        ThemePack(id: .classic, displayName: "经典紫金", backgroundAsset: "theme-classic", thumbnailAsset: "theme-classic-thumb", deepHex: 0x250B45, panelHex: 0x67208E, accentHex: 0xFFD94A, boardHex: 0xFFF3CF, litLampHex: 0x00CFFF, unlitLampHex: 0x42131A),
        ThemePack(id: .ocean, displayName: "海洋水晶", backgroundAsset: "theme-ocean", thumbnailAsset: "theme-ocean-thumb", deepHex: 0x032B43, panelHex: 0x087482, accentHex: 0x75F5E6, boardHex: 0xE7FFFB, litLampHex: 0xFF3B9D, unlitLampHex: 0x123449),
        ThemePack(id: .cosmic, displayName: "宇宙霓虹", backgroundAsset: "theme-cosmic", thumbnailAsset: "theme-cosmic-thumb", deepHex: 0x080719, panelHex: 0x42127D, accentHex: 0x4CF7FF, boardHex: 0xEDE7FF, litLampHex: 0xFFF33D, unlitLampHex: 0x24163E),
        ThemePack(id: .candy, displayName: "糖果乐园", backgroundAsset: "theme-candy", thumbnailAsset: "theme-candy-thumb", deepHex: 0x72123B, panelHex: 0xE34D81, accentHex: 0xFFF36F, boardHex: 0xFFF8E9, litLampHex: 0x00D8FF, unlitLampHex: 0x5C1937),
    ]

    static func pack(for rawID: String) -> ThemePack {
        all.first(where: { $0.id.rawValue == rawID }) ?? all[0]
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

extension Image {
    init(bundlePNG name: String) {
        if let image = UIImage(named: "\(name).png") {
            self.init(uiImage: image)
        } else {
            self.init(systemName: "photo")
        }
    }
}
