import SwiftUI

struct MusicSelectionView: View {
    @ObservedObject private var store: SettingsStore
    @ObservedObject private var audio: AudioCoordinator
    @Environment(\.dismiss) private var dismiss

    init(model: AppModel) {
        store = model.settingsStore
        audio = model.audio
    }

    var body: some View {
        let theme = store.selectedTheme
        NavigationStack {
            quickSheetBackground(theme: theme) {
                ScrollView {
                    VStack(spacing: 18) {
                        sheetHeader(
                            title: "选歌",
                            subtitle: "分别选择背景音乐和中奖音乐",
                            icon: "music.note.list",
                            theme: theme
                        )

                        if !store.settings.masterAudioEnabled {
                            Label("音乐总开关已关闭，可返回游戏顶部开启", systemImage: "speaker.slash.fill")
                                .font(.subheadline.bold())
                                .foregroundStyle(theme.deep)
                                .frame(maxWidth: .infinity)
                                .padding(13)
                                .background(theme.accent, in: RoundedRectangle(cornerRadius: 14))
                        }

                        SettingsPanel(title: "背景音乐", icon: "music.note", theme: theme) {
                            musicSection(
                                enabled: $store.settings.backgroundMusicEnabled,
                                volume: $store.settings.backgroundVolume,
                                index: $store.settings.backgroundTrackIndex,
                                tracks: AudioCatalog.backgroundTracks,
                                previewKind: .background,
                                icon: "music.note",
                                theme: theme
                            )
                        }

                        SettingsPanel(title: "中奖音乐", icon: "trophy.fill", theme: theme) {
                            musicSection(
                                enabled: $store.settings.winMusicEnabled,
                                volume: $store.settings.winVolume,
                                index: $store.settings.winTrackIndex,
                                tracks: AudioCatalog.winTracks,
                                previewKind: .win,
                                icon: "trophy.fill",
                                theme: theme
                            )
                        }
                    }
                    .frame(maxWidth: 760)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 22)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("音乐选择")
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
        .presentationBackground(theme.deep)
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(audio.previewKind != nil)
    }

    private func musicSection(
        enabled: Binding<Bool>,
        volume: Binding<Double>,
        index: Binding<Int>,
        tracks: [String],
        previewKind: AudioCoordinator.PreviewKind,
        icon: String,
        theme: ThemePack
    ) -> some View {
        VStack(spacing: 14) {
            Toggle(previewKind == .background ? "播放背景音乐" : "播放中奖音乐", isOn: enabled)
                .toggleStyle(ArcadeToggleStyle(theme: theme, icon: icon))
                .disabled(!store.settings.masterAudioEnabled)

            HStack(spacing: 12) {
                Text("音量").font(.subheadline.bold())
                Slider(value: volume, in: 0...1, step: 0.05)
                    .tint(theme.accent)
                Text(volume.wrappedValue, format: .percent.precision(.fractionLength(0)))
                    .font(.caption.monospacedDigit().bold())
                    .foregroundStyle(theme.accent)
                    .frame(width: 42, alignment: .trailing)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(Color.black.opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
            .disabled(!store.settings.masterAudioEnabled || !enabled.wrappedValue)

            VStack(alignment: .leading, spacing: 10) {
                Text("选择曲目").font(.subheadline.bold())
                HStack(spacing: 8) {
                    ForEach(tracks.indices, id: \.self) { trackIndex in
                        Button {
                            index.wrappedValue = trackIndex
                        } label: {
                            Text("第\(trackIndex + 1)首")
                                .font(.caption.bold())
                                .frame(maxWidth: .infinity, minHeight: 42)
                                .background(
                                    index.wrappedValue == trackIndex ? theme.accent : Color.black.opacity(0.52),
                                    in: RoundedRectangle(cornerRadius: 10)
                                )
                                .foregroundStyle(index.wrappedValue == trackIndex ? theme.deep : .white.opacity(0.8))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                                    index.wrappedValue == trackIndex ? Color.white : theme.accent.opacity(0.3),
                                    lineWidth: index.wrappedValue == trackIndex ? 2 : 1
                                ))
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        audio.togglePreview(previewKind)
                    } label: {
                        Label(
                            audio.previewKind == previewKind ? "停止" : "试听",
                            systemImage: audio.previewKind == previewKind ? "stop.fill" : "play.fill"
                        )
                        .font(.caption.bold())
                        .frame(minWidth: 72, minHeight: 42)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(audio.previewKind == previewKind ? .orange : theme.panel)
                }
            }
            .padding(12)
            .background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 14))
            .disabled(!store.settings.masterAudioEnabled || !enabled.wrappedValue)
        }
    }
}

struct ThemeSelectionView: View {
    @ObservedObject private var store: SettingsStore
    @Environment(\.dismiss) private var dismiss

    init(model: AppModel) {
        store = model.settingsStore
    }

    var body: some View {
        let theme = store.selectedTheme
        NavigationStack {
            quickSheetBackground(theme: theme) {
                ScrollView {
                    VStack(spacing: 18) {
                        sheetHeader(
                            title: "选择场景",
                            subtitle: "只改变机柜皮肤，不改变玩法和物理",
                            icon: "paintpalette.fill",
                            theme: theme
                        )
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 16)], spacing: 16) {
                            ForEach(ThemePack.all) { pack in
                                Button {
                                    store.settings.themeID = pack.id.rawValue
                                } label: {
                                    VStack(spacing: 10) {
                                        Image(bundlePNG: pack.thumbnailAsset)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(height: 170)
                                            .clipShape(RoundedRectangle(cornerRadius: 16))
                                        HStack {
                                            Text(pack.displayName).font(.headline.bold())
                                            Spacer()
                                            Image(systemName: store.settings.themeID == pack.id.rawValue ? "checkmark.circle.fill" : "circle")
                                                .font(.title3)
                                                .foregroundStyle(store.settings.themeID == pack.id.rawValue ? pack.accent : .white.opacity(0.4))
                                        }
                                    }
                                    .padding(10)
                                    .background(Color.black.opacity(0.46), in: RoundedRectangle(cornerRadius: 20))
                                    .foregroundStyle(.white)
                                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(
                                        store.settings.themeID == pack.id.rawValue ? pack.accent : Color.white.opacity(0.16),
                                        lineWidth: store.settings.themeID == pack.id.rawValue ? 3 : 1
                                    ))
                                    .shadow(color: store.settings.themeID == pack.id.rawValue ? pack.accent.opacity(0.45) : .clear, radius: 12)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("选择\(pack.displayName)场景")
                            }
                        }
                    }
                    .frame(maxWidth: 760)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 22)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("场景选择")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(theme.deep.opacity(0.96), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                        .font(.headline.bold())
                        .foregroundStyle(theme.accent)
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(30)
        .presentationDragIndicator(.visible)
        .presentationBackground(theme.deep)
        .preferredColorScheme(.dark)
    }
}

@ViewBuilder
private func quickSheetBackground<Content: View>(
    theme: ThemePack,
    @ViewBuilder content: () -> Content
) -> some View {
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
        content()
    }
}

private func sheetHeader(
    title: String,
    subtitle: String,
    icon: String,
    theme: ThemePack
) -> some View {
    HStack(spacing: 14) {
        Image(systemName: icon)
            .font(.system(size: 28, weight: .black))
            .foregroundStyle(theme.accent)
            .frame(width: 54, height: 54)
            .background(theme.panel.opacity(0.85), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.accent, lineWidth: 2))
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.title2.weight(.black))
            Text(subtitle)
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
