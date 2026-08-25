import SwiftUI

@main
struct LuckyMarbleApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .onChange(of: scenePhase) { _, next in
                    model.handleScenePhase(next)
                }
        }
    }
}
