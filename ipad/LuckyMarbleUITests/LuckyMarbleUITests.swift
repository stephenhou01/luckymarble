import XCTest

@MainActor
final class LuckyMarbleUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testPrimaryControlsRemainPlayableInPortraitAndLandscape() {
        let app = XCUIApplication()
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        XCTAssertTrue(app.buttons["开始"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["增加弹珠"].exists)
        XCTAssertTrue(app.buttons["音乐总开关"].exists)
        XCTAssertTrue(app.buttons["选择音乐"].exists)
        XCTAssertTrue(app.buttons["选择场景"].exists)
        XCTAssertTrue(app.buttons["宝宝模式"].exists)
        XCTAssertTrue(app.buttons["打开设置"].exists)
        XCTAssertTrue(app.otherElements["弹珠碰撞区域"].exists)

        XCUIDevice.shared.orientation = .landscapeLeft
        let landscapeStart = app.buttons["开始"]
        XCTAssertTrue(landscapeStart.waitForExistence(timeout: 3))
        expectation(for: NSPredicate(format: "hittable == true"), evaluatedWith: landscapeStart)
        waitForExpectations(timeout: 3)
        XCTAssertTrue(app.buttons["增加弹珠"].isHittable)
        XCTAssertTrue(app.buttons["音乐总开关"].isHittable)
        XCTAssertTrue(app.buttons["选择音乐"].isHittable)
        XCTAssertTrue(app.buttons["选择场景"].isHittable)
        XCTAssertTrue(app.buttons["宝宝模式"].isHittable)
        XCTAssertTrue(app.buttons["打开设置"].isHittable)

        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "iPad-Air-Landscape"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testCreditMenuAddsBalanceRepeatedly() {
        let app = XCUIApplication()
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        let addButton = app.buttons["增加弹珠"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 5))
        let initialBalanceElement = app.descendants(matching: .any)["metric-弹珠"]
        XCTAssertTrue(initialBalanceElement.waitForExistence(timeout: 2))
        let balanceToken = String(initialBalanceElement.label.split(separator: " ").last ?? "")
            .replacingOccurrences(of: ",", with: "")
        let initialBalance = Int(balanceToken) ?? 0
        addButton.tap()
        XCTAssertTrue(app.buttons["加 100"].waitForExistence(timeout: 2))
        app.buttons["加 100"].tap()
        addButton.tap()
        XCTAssertTrue(app.buttons["加 500"].waitForExistence(timeout: 2))
        app.buttons["加 500"].tap()
        let expectedValue = initialBalance + 600
        let expectedText = NumberFormatter.localizedString(from: NSNumber(value: expectedValue), number: .decimal)
        expectation(
            for: NSPredicate(format: "label == %@", "弹珠 \(expectedText)"),
            evaluatedWith: initialBalanceElement
        )
        waitForExpectations(timeout: 2)
    }

    func testBabyModeButtonClearlyReportsOffAndOnStates() {
        let app = XCUIApplication()
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let babyMode = app.buttons["宝宝模式"]
        XCTAssertTrue(babyMode.waitForExistence(timeout: 5))
        if babyMode.value as? String == "开启" {
            babyMode.tap()
        }
        XCTAssertEqual(babyMode.value as? String, "关闭")

        let offAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        offAttachment.name = "Baby-Mode-Off"
        offAttachment.lifetime = .keepAlways
        add(offAttachment)

        babyMode.tap()
        XCTAssertEqual(babyMode.value as? String, "开启")

        let onAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        onAttachment.name = "Baby-Mode-On"
        onAttachment.lifetime = .keepAlways
        add(onAttachment)

        babyMode.tap()
        XCTAssertEqual(babyMode.value as? String, "关闭")
    }

    func testSettingsKeepsVoiceVisualAndGameControls() {
        let app = XCUIApplication()
        app.launchEnvironment["LUCKY_MARBLE_UI_SETTINGS_PREVIEW"] = "1"
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let settingsButton = app.buttons["打开设置"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 5))
        settingsButton.tap()

        XCTAssertTrue(app.staticTexts["幸运弹珠设置"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["中奖语音"].exists)
        XCTAssertTrue(app.staticTexts["画面与性能"].exists)
        XCTAssertFalse(app.staticTexts["玩法"].exists)
        XCTAssertFalse(app.switches["宝宝模式"].exists)
        XCTAssertFalse(app.staticTexts["背景音乐"].exists)

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "iPad-Arcade-Settings"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testMusicAndThemeUseSeparateHeaderSheets() {
        let app = XCUIApplication()
        app.launchEnvironment["LUCKY_MARBLE_UI_SETTINGS_PREVIEW"] = "1"
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let musicButton = app.buttons["选择音乐"]
        XCTAssertTrue(musicButton.waitForExistence(timeout: 5))
        musicButton.tap()

        XCTAssertTrue(app.staticTexts["选歌"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["背景音乐"].exists)
        XCTAssertTrue(app.staticTexts["中奖音乐"].exists)
        XCTAssertTrue(app.buttons["第1首"].exists)
        XCTAssertTrue(app.buttons["试听"].exists)

        let musicAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        musicAttachment.name = "iPad-Music-Selection"
        musicAttachment.lifetime = .keepAlways
        add(musicAttachment)

        app.buttons["完成"].tap()
        let themeButton = app.buttons["选择场景"]
        XCTAssertTrue(themeButton.waitForExistence(timeout: 3))
        themeButton.tap()

        XCTAssertTrue(app.staticTexts["选择场景"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["选择经典紫金场景"].exists)
        XCTAssertTrue(app.buttons["选择海洋水晶场景"].exists)
        XCTAssertTrue(app.buttons["选择宇宙霓虹场景"].exists)
        XCTAssertTrue(app.buttons["选择糖果乐园场景"].exists)

        let themeAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        themeAttachment.name = "iPad-Theme-Selection"
        themeAttachment.lifetime = .keepAlways
        add(themeAttachment)
    }

    func testHoldingWagerPlusRapidlyIncreases() {
        let app = XCUIApplication()
        app.launchEnvironment["LUCKY_MARBLE_UI_WAGER_PREVIEW"] = "1"
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let wagerValue = app.descendants(matching: .any)["wager-value"]
        XCTAssertTrue(wagerValue.waitForExistence(timeout: 5))
        let initialValue = Int(wagerValue.label) ?? 0

        let plus = app.buttons["增加下注"]
        XCTAssertTrue(plus.isHittable)
        plus.press(forDuration: 0.9)

        let updatedValue = Int(wagerValue.label) ?? 0
        XCTAssertGreaterThanOrEqual(updatedValue, initialValue + 4)
    }

    func testRewardShowsCardPopupAndMarblesEnteringBank() {
        let app = XCUIApplication()
        app.launchEnvironment["LUCKY_MARBLE_UI_REWARD_PREVIEW"] = "1"
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let cards = app.otherElements["card-reward-showcase"]
        XCTAssertTrue(cards.waitForExistence(timeout: 3))
        XCTAssertEqual(cards.label, "本局获得 9 张卡片")

        let summary = app.descendants(matching: .any)["win-summary-banner"]
        XCTAssertTrue(summary.waitForExistence(timeout: 2))
        XCTAssertTrue(summary.label.contains("300 颗弹珠"))
        XCTAssertTrue(summary.label.contains("9 张卡片"))

        let bank = app.otherElements["reward-marble-bank"]
        XCTAssertTrue(bank.waitForExistence(timeout: 2))
        XCTAssertTrue(bank.label.contains("奖珠正在入仓"))

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "iPad-Card-And-Marble-Reward"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testWagerMarblesRollFromBankIntoBottomQueue() {
        let app = XCUIApplication()
        app.launchEnvironment["LUCKY_MARBLE_UI_WAGER_PREVIEW"] = "1"
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let start = app.buttons["开始"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        start.tap()

        let queue = app.otherElements["wager-marble-queue"]
        XCTAssertTrue(queue.waitForExistence(timeout: 2))
        XCTAssertTrue(queue.label.contains("投珠中"))
        let disabledStart = app.buttons["投珠中"]
        XCTAssertTrue(disabledStart.exists)
        XCTAssertFalse(disabledStart.isEnabled)

        let bank = app.otherElements["reward-marble-bank"]
        XCTAssertTrue(bank.exists)

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "iPad-Wager-Marble-Transfer"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testReadyWagerChipAddsAndRollsWithoutSecondStart() {
        let app = XCUIApplication()
        app.launchEnvironment["LUCKY_MARBLE_UI_WAGER_PREVIEW"] = "1"
        XCUIDevice.shared.orientation = .portrait
        app.launch()

        let start = app.buttons["开始"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        start.tap()

        let leverPrompt = app.buttons["去拉杆"]
        XCTAssertTrue(leverPrompt.waitForExistence(timeout: 4))
        XCTAssertFalse(leverPrompt.isEnabled)

        let readyAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        readyAttachment.name = "iPad-Ready-Launcher-Lever"
        readyAttachment.lifetime = .keepAlways
        add(readyAttachment)

        let wagerValue = app.descendants(matching: .any)["wager-value"]
        XCTAssertEqual(Int(wagerValue.label), 35)
        let chip = app.buttons["wager-chip-10"]
        XCTAssertTrue(chip.isHittable)
        chip.tap()

        expectation(for: NSPredicate(format: "label == %@", "45"), evaluatedWith: wagerValue)
        waitForExpectations(timeout: 2)
        let queue = app.otherElements["wager-marble-queue"]
        XCTAssertTrue(queue.label.contains("投珠中"))
        XCTAssertTrue(app.buttons["投珠中"].exists)
    }
}
