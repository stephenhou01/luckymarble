import XCTest
@testable import LuckyMarble

final class PersistenceAndCatalogTests: XCTestCase {
    func testAtomicGameAndSettingsRoundTrip() {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("LuckyMarbleTests-\(UUID().uuidString)", isDirectory: true)
        let store = PersistenceStore(rootURL: root)
        var game = GameState()
        game.balance = 12_345
        game.wagerLimit = 300
        game.cardRewards = CardRewards(points: 9_999, progress: 7, totalCards: 321)
        store.saveGame(game)
        XCTAssertEqual(store.loadGame(), .restored(game))

        var settings = AppSettings()
        settings.themeID = ThemeID.cosmic.rawValue
        settings.backgroundTrackIndex = 3
        settings.winTrackIndex = 2
        settings.performanceMode = .powerSaving
        store.saveSettings(settings)
        XCTAssertEqual(store.loadSettings(), settings)
    }

    func testLegacySaveWithoutWagerLimitDefaultsTo100() throws {
        let json = """
        {"balance":500,"draftWager":35,"phase":"betting"}
        """
        let decoded = try JSONDecoder().decode(GameState.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.wagerLimit, 100)
        XCTAssertEqual(decoded.draftWager, 35)
    }

    func testCorruptSaveDoesNotAffectSettings() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("LuckyMarbleCorrupt-\(UUID().uuidString)", isDirectory: true)
        let store = PersistenceStore(rootURL: root)
        var settings = AppSettings()
        settings.themeID = ThemeID.ocean.rawValue
        store.saveSettings(settings)
        try Data("not-json".utf8).write(to: root.appendingPathComponent("game-save.json"), options: .atomic)
        XCTAssertEqual(store.loadGame(), .corrupted)
        XCTAssertEqual(store.loadSettings(), settings)
    }

    func testFourThemesAndFourTracksPerMusicType() {
        XCTAssertEqual(ThemePack.all.count, 4)
        XCTAssertEqual(Set(ThemePack.all.map(\.id)).count, 4)
        XCTAssertEqual(AudioCatalog.backgroundTracks.count, 4)
        XCTAssertEqual(AudioCatalog.winTracks.count, 4)
        XCTAssertEqual(GameRules.wagerLimitOptions, [100, 200, 300])
        XCTAssertEqual(Set(ThemePack.all.map(\.litLampHex)).count, 4)
    }
}
