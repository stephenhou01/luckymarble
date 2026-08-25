# 幸运弹珠（LuckyMarble）

“幸运弹珠”是一款中文单人实体街机风弹珠游戏。本仓库同时包含可直接在浏览器运行的网页版，以及使用 SwiftUI、SpriteKit 和自定义固定步进物理实现的 iPad 原生版。

## 在线体验

- 网页版：<https://stephenhou01.github.io/luckymarble/>
- 隐私政策：<https://stephenhou01.github.io/luckymarble/privacy.html>
- 技术支持：<https://stephenhou01.github.io/luckymarble/support.html>

## 网页版

根目录的 `index.html` 是入口文件，不需要构建工具。克隆仓库后，可以直接打开该文件，或使用任意静态文件服务器运行。

```sh
python3 -m http.server 8000
```

然后访问 <http://localhost:8000/>。

主要目录：

- `css/`：机柜、皮肤、响应式布局和视觉效果
- `js/`：玩法规则、固定步进物理、渲染、音频及回合编排
- `assets/`：皮肤、角色和游戏音频
- `tests/`：规则、物理和浏览器验收测试

## iPad 原生版

原生工程位于 `ipad/`，支持 iPadOS 18 或更高版本。详细构建和测试方法见 [`ipad/README.md`](ipad/README.md)。

```sh
cd ipad
open LuckyMarble.xcodeproj
```

原生版不使用 `WKWebView`，游戏规则和物理由 Swift 原生代码实现。

## 隐私

游戏不要求账号，不包含广告、用户追踪或 App 内购买。游戏进度和设置只保存在设备本地。详情见 [隐私政策](privacy.html)。

## 许可

源代码采用 [MIT License](LICENSE-CODE) 开源。图片、音乐、字体及其他媒体资源不包含在 MIT 授权范围内，详情见 [ASSET-LICENSE.md](ASSET-LICENSE.md)。
