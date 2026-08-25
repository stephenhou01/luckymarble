import Foundation

final class PersistenceStore: @unchecked Sendable {
    enum LoadResult: Equatable {
        case restored(GameState)
        case empty
        case corrupted
    }

    private let rootURL: URL
    private let saveURL: URL
    private let settingsURL: URL
    private let encoder: JSONEncoder
    private let decoder = JSONDecoder()

    init(rootURL: URL? = nil) {
        let base = rootURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("LuckyMarble", isDirectory: true)
        self.rootURL = base
        saveURL = base.appendingPathComponent("game-save.json")
        settingsURL = base.appendingPathComponent("settings.json")
        encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    }

    func loadGame() -> LoadResult {
        guard FileManager.default.fileExists(atPath: saveURL.path) else { return .empty }
        do {
            let envelope = try decoder.decode(SaveEnvelope.self, from: Data(contentsOf: saveURL))
            guard envelope.version == SaveEnvelope.currentVersion else { return .corrupted }
            return .restored(envelope.state)
        } catch {
            return .corrupted
        }
    }

    func saveGame(_ state: GameState) {
        do {
            let data = try encoder.encode(SaveEnvelope(state: state))
            try data.write(to: saveURL, options: .atomic)
        } catch {
            assertionFailure("Unable to save game: \(error)")
        }
    }

    func resetGame() {
        try? FileManager.default.removeItem(at: saveURL)
    }

    func loadSettings() -> AppSettings? {
        guard let data = try? Data(contentsOf: settingsURL),
              let settings = try? decoder.decode(AppSettings.self, from: data),
              settings.version == AppSettings.currentVersion else { return nil }
        return settings
    }

    func saveSettings(_ settings: AppSettings) {
        do {
            let data = try encoder.encode(settings)
            try data.write(to: settingsURL, options: .atomic)
        } catch {
            assertionFailure("Unable to save settings: \(error)")
        }
    }
}
