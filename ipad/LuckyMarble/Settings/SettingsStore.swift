import Foundation

@MainActor
final class SettingsStore: ObservableObject {
    @Published var settings: AppSettings {
        didSet {
            persistence.saveSettings(settings)
            onChange?(settings)
        }
    }

    var onChange: ((AppSettings) -> Void)?
    private let persistence: PersistenceStore

    init(persistence: PersistenceStore) {
        self.persistence = persistence
        settings = persistence.loadSettings() ?? AppSettings()
#if DEBUG
        let previewEnvironment = ProcessInfo.processInfo.environment
        if previewEnvironment["LUCKY_MARBLE_UI_REWARD_PREVIEW"] == "1"
            || previewEnvironment["LUCKY_MARBLE_UI_WAGER_PREVIEW"] == "1" {
            settings.themeID = ThemeID.classic.rawValue
        }
#endif
    }

    var selectedTheme: ThemePack {
        ThemePack.pack(for: settings.themeID)
    }

    func restoreDefaults() {
        settings = AppSettings()
    }
}
