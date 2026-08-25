# 幸运弹珠 iPad 原生版

这是根目录网页版对应的 iPad 原生实现，使用 SwiftUI、SpriteKit 和自定义固定步进物理，不包含 `WKWebView`，也不会修改网页版交付文件。

## 环境

- Xcode 26 或更新版本
- iPadOS 18.0 或更新版本
- iPad Air 11/13 英寸 M2、M3、M4 为重点适配设备
- XcodeGen（仅在需要重新生成工程时使用）

## 打开与运行

工程已经生成，可直接打开：

```sh
open LuckyMarble.xcodeproj
```

如果修改了 `project.yml`：

```sh
xcodegen generate --spec project.yml
```

选择 `LuckyMarble` Scheme 和任意 iPad 模拟器或真机后运行。首次真机运行需要在 Xcode 的 Signing & Capabilities 中选择自己的开发团队。

## 自动化测试

```sh
xcodebuild \
  -project LuckyMarble.xcodeproj \
  -scheme LuckyMarble \
  -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' \
  CODE_SIGNING_ALLOWED=NO \
  test
```

测试覆盖规则、概率、卡片、存档、100/200/300 投注上限、固定步进物理、上分菜单，以及 iPad 横竖屏关键按钮可点击性。

## 当前控制细节

- 快捷下注依次为 `35、10、99`。
- “上限”菜单可在下注阶段选择 `100、200、300`，旧存档缺少该字段时安全使用默认值 100。
- “音乐总开关”只统一控制背景音乐和中奖音乐，中奖语音继续使用独立开关。
- 四套皮肤各自配置高反差中奖灯颜色，切换皮肤不会改变中奖洞或物理状态。

## 目录

- `LuckyMarble/Core/`：状态、规则、共享几何、固定步进物理和回合编排
- `LuckyMarble/Scene/`：SpriteKit 原生绘制
- `LuckyMarble/Audio/`：4+4 音乐、试听、互斥、语音和音量压低
- `LuckyMarble/UI/`：设置、奖珠仓和出卡口
- `LuckyMarble/Persistence/`：版本化原子 JSON 存档
- `LuckyMarble/Resources/`：iPad 原生皮肤缩略图、完整背景和音乐
- `LuckyMarbleTests/`：规则、物理、存档测试
- `LuckyMarbleUITests/`：横竖屏与上分交互测试

## 性能约束

- 主弹珠物理固定为 1/240 秒步进。
- 空闲时 SpriteKit 场景暂停；省电模式降至 30 FPS，其余模式为 60 FPS。
- 101 颗以上奖励固定约 6 秒完成，最多同时绘制 24 颗代表球；真实余额和卡片数量始终按结算值准确保存。
- 皮肤缩略图与完整背景分开，设置列表不会同时解码四张完整机柜图。
