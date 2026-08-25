import SwiftUI

struct SettingsView: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var store: SettingsStore
    @ObservedObject private var audio: AudioCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var confirmsGameReset = false
    @State private var confirmsSettingsReset = false

    init(model: AppModel) {
        self.model = model
        store = model.settingsStore
        audio = model.audio
    }

    var body: some View {
        let theme = store.selectedTheme
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [theme.deep, theme.panel.opacity(0.88), Color.black],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                Image(bundlePNG: theme.backgroundAsset)
                    .resizable()
                    .scaledToFill()
                    .opacity(0.18)
                    .blur(radius: 12)
                    .ignoresSafeArea()
                    .accessibilityHidden(true)

                ScrollView {
                    VStack(spacing: 18) {
                        settingsHeader(theme: theme)
                        SettingsPanel(title: "中奖语音", icon: "waveform", theme: theme) {
                            voiceControls(theme: theme)
                        }
                        SettingsPanel(title: "画面与性能", icon: "sparkles", theme: theme) {
                            visualControls(theme: theme)
                        }
                        resetControls(theme: theme)
                    }
                    .frame(maxWidth: 760)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 22)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("游戏设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(theme.deep.opacity(0.96), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") {
                        audio.stopPreview(resume: true)
                        dismiss()
                    }
                    .font(.headline.bold())
                    .foregroundStyle(theme.accent)
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(30)
        .presentationDragIndicator(.visible)
        .presentationBackground(store.selectedTheme.deep)
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(audio.previewKind != nil)
        .alert("重置游戏进度？", isPresented: $confirmsGameReset) {
            Button("取消", role: .cancel) {}
            Button("重置", role: .destructive) { model.resetGame() }
        } message: {
            Text("余额、下注、卡片和统计会恢复初始状态，声音与皮肤设置保留。")
        }
        .alert("恢复默认设置？", isPresented: $confirmsSettingsReset) {
            Button("取消", role: .cancel) {}
            Button("恢复", role: .destructive) { store.restoreDefaults() }
        } message: {
            Text("游戏进度不会被删除。")
        }
    }

    private func settingsHeader(theme: ThemePack) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "gearshape.2.fill")
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(theme.accent)
                .frame(width: 54, height: 54)
                .background(theme.panel.opacity(0.85), in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.accent, lineWidth: 2))
            VStack(alignment: .leading, spacing: 3) {
                Text("幸运弹珠设置")
                    .font(.title2.weight(.black))
                Text("语音、画面、性能和重置")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
            }
            Spacer()
        }
        .foregroundStyle(.white)
        .padding(18)
        .background(theme.deep.opacity(0.9), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(theme.accent, lineWidth: 2))
        .shadow(color: .black.opacity(0.32), radius: 12, y: 7)
    }

    @ViewBuilder
    private func voiceControls(theme: ThemePack) -> some View {
        VStack(spacing: 14) {
            Toggle("中奖语音", isOn: $store.settings.voiceEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "waveform"))
            volumeRow("语音音量", value: $store.settings.voiceVolume, theme: theme)
                .disabled(!store.settings.voiceEnabled)
        }
    }

    private var themeGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 132), spacing: 12)], spacing: 12) {
            ForEach(ThemePack.all) { theme in
                Button {
                    store.settings.themeID = theme.id.rawValue
                } label: {
                    VStack(spacing: 8) {
                        Image(bundlePNG: theme.thumbnailAsset)
                            .resizable()
                            .scaledToFill()
                            .frame(height: 112)
                            .clipShape(RoundedRectangle(cornerRadius: 13))
                        HStack {
                            Text(theme.displayName).font(.caption.bold())
                            Spacer()
                            Image(systemName: store.settings.themeID == theme.id.rawValue ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(store.settings.themeID == theme.id.rawValue ? theme.accent : .white.opacity(0.38))
                        }
                    }
                    .padding(8)
                    .background(Color.black.opacity(0.44), in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(.white)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(
                        store.settings.themeID == theme.id.rawValue ? theme.accent : Color.white.opacity(0.14),
                        lineWidth: store.settings.themeID == theme.id.rawValue ? 3 : 1
                    ))
                    .shadow(color: store.settings.themeID == theme.id.rawValue ? theme.accent.opacity(0.35) : .clear, radius: 9)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("切换到\(theme.displayName)皮肤")
            }
        }
    }

    @ViewBuilder
    private func audioControls(theme: ThemePack) -> some View {
        VStack(spacing: 14) {
            Toggle("音乐总开关", isOn: $store.settings.masterAudioEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "speaker.wave.2.fill"))
            Divider().overlay(theme.accent.opacity(0.25))
            Toggle("背景音乐", isOn: $store.settings.backgroundMusicEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "music.note"))
                .disabled(!store.settings.masterAudioEnabled)
            volumeRow("背景音量", value: $store.settings.backgroundVolume, theme: theme)
                .disabled(!store.settings.masterAudioEnabled || !store.settings.backgroundMusicEnabled)
            trackRow(
                title: "背景曲目",
                index: $store.settings.backgroundTrackIndex,
                tracks: AudioCatalog.backgroundTracks,
                previewKind: .background,
                theme: theme
            )
            .disabled(!store.settings.masterAudioEnabled || !store.settings.backgroundMusicEnabled)

            Divider().overlay(theme.accent.opacity(0.25))
            Toggle("中奖音乐", isOn: $store.settings.winMusicEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "trophy.fill"))
                .disabled(!store.settings.masterAudioEnabled)
            volumeRow("中奖音量", value: $store.settings.winVolume, theme: theme)
                .disabled(!store.settings.masterAudioEnabled || !store.settings.winMusicEnabled)
            trackRow(
                title: "中奖曲目",
                index: $store.settings.winTrackIndex,
                tracks: AudioCatalog.winTracks,
                previewKind: .win,
                theme: theme
            )
            .disabled(!store.settings.masterAudioEnabled || !store.settings.winMusicEnabled)

            Divider().overlay(theme.accent.opacity(0.25))
            Toggle("中奖语音", isOn: $store.settings.voiceEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "waveform"))
            volumeRow("语音音量", value: $store.settings.voiceVolume, theme: theme)
                .disabled(!store.settings.voiceEnabled)
        }
    }

    @ViewBuilder
    private func visualControls(theme: ThemePack) -> some View {
        VStack(spacing: 14) {
            Toggle("粒子效果", isOn: $store.settings.particlesEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "sparkles"))
                .disabled(store.settings.reduceMotion)
            Toggle("中奖闪光", isOn: $store.settings.winFlashEnabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "sun.max.fill"))
                .disabled(store.settings.reduceMotion)
            Toggle("减少动态", isOn: $store.settings.reduceMotion)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "figure.walk.motion"))
            VStack(alignment: .leading, spacing: 8) {
                Label("性能档", systemImage: "gauge.with.dots.needle.50percent")
                    .font(.headline)
                Picker("性能档", selection: $store.settings.performanceMode) {
                    ForEach(PerformanceMode.allCases) { mode in Text(mode.title).tag(mode) }
                }
                .pickerStyle(.segmented)
            }
            Toggle("屏幕常亮", isOn: $store.settings.screenAwake)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: "sun.horizon.fill"))
        }
    }

    private func resetControls(theme: ThemePack) -> some View {
        HStack(spacing: 12) {
            Button { confirmsGameReset = true } label: {
                Label("重置游戏进度", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            Button { confirmsSettingsReset = true } label: {
                Label("恢复默认设置", systemImage: "slider.horizontal.3")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
        }
        .font(.headline.bold())
        .foregroundStyle(.white)
        .buttonStyle(.borderedProminent)
        .tint(Color.red.opacity(0.72))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.accent.opacity(0.35), lineWidth: 1))
    }

    private func volumeRow(_ title: String, value: Binding<Double>, theme: ThemePack) -> some View {
        HStack(spacing: 12) {
            Text(title).font(.subheadline.bold())
            Slider(value: value, in: 0...1, step: 0.05)
                .tint(theme.accent)
            Text(value.wrappedValue, format: .percent.precision(.fractionLength(0)))
                .font(.caption.monospacedDigit().bold())
                .foregroundStyle(theme.accent)
                .frame(width: 42, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color.black.opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
    }

    private func trackRow(
        title: String,
        index: Binding<Int>,
        tracks: [String],
        previewKind: AudioCoordinator.PreviewKind,
        theme: ThemePack
    ) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(title).font(.subheadline.bold())
            HStack(spacing: 8) {
                ForEach(tracks.indices, id: \.self) { trackIndex in
                    Button {
                        index.wrappedValue = trackIndex
                    } label: {
                        Text("第\(trackIndex + 1)首")
                            .font(.caption.bold())
                            .frame(maxWidth: .infinity, minHeight: 40)
                            .background(
                                index.wrappedValue == trackIndex ? theme.accent : Color.black.opacity(0.5),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .foregroundStyle(index.wrappedValue == trackIndex ? theme.deep : .white.opacity(0.78))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                                index.wrappedValue == trackIndex ? Color.white : theme.accent.opacity(0.28),
                                lineWidth: index.wrappedValue == trackIndex ? 2 : 1
                            ))
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    audio.togglePreview(previewKind)
                } label: {
                    Label(audio.previewKind == previewKind ? "停止" : "试听", systemImage: audio.previewKind == previewKind ? "stop.fill" : "play.fill")
                        .font(.caption.bold())
                        .frame(minWidth: 70, minHeight: 40)
                }
                .buttonStyle(.borderedProminent)
                .tint(audio.previewKind == previewKind ? .orange : theme.panel)
            }
        }
        .padding(12)
        .background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct SettingsPanel<Content: View>: View {
    let title: String
    let icon: String
    let theme: ThemePack
    let content: Content

    init(title: String, icon: String, theme: ThemePack, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.theme = theme
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: icon)
                .font(.title3.weight(.black))
                .foregroundStyle(theme.accent)
            content
        }
        .foregroundStyle(.white)
        .padding(18)
        .background(theme.deep.opacity(0.9), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(theme.accent.opacity(0.72), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.28), radius: 10, y: 6)
    }
}

struct ArcadeToggleStyle: ToggleStyle {
    let theme: ThemePack
    let icon: String

    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.headline.bold())
                    .foregroundStyle(configuration.isOn ? theme.deep : .white.opacity(0.58))
                    .frame(width: 38, height: 38)
                    .background(configuration.isOn ? theme.accent : Color.black.opacity(0.42), in: RoundedRectangle(cornerRadius: 11))
                configuration.label
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Capsule()
                    .fill(configuration.isOn ? theme.accent : Color.black.opacity(0.68))
                    .frame(width: 54, height: 30)
                    .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                        Circle()
                            .fill(configuration.isOn ? Color.white : Color.white.opacity(0.58))
                            .frame(width: 24, height: 24)
                            .padding(3)
                            .shadow(color: configuration.isOn ? theme.accent.opacity(0.75) : .clear, radius: 6)
                    }
                    .overlay(Capsule().stroke(configuration.isOn ? Color.white.opacity(0.7) : theme.accent.opacity(0.24), lineWidth: 1))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(configuration.isOn ? "开启" : "关闭")
    }
}
