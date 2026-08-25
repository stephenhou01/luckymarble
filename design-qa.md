# 顶部出卡口、倍率揭晓与弧形发射轨道设计 QA

**Source visual truth**

- `/var/folders/6x/5n5xzp595qq6yg5b59ph39vw0000gp/T/codex-clipboard-e3d85d61-04b5-4af0-8e96-324c403c41e8.png`（`1386 × 708`）：顶部出卡口、倍率横排和奖珠仓标注。
- `/var/folders/6x/5n5xzp595qq6yg5b59ph39vw0000gp/T/codex-clipboard-a4a28942-20fa-472a-9c00-49e8f867a02f.png`（`1332 × 374`）：删除椭圆数据栏、简化卡片包计数的标注。

**Rendered implementation evidence**

- Desktop idle: `/tmp/marble-game-qa/desktop-1280x720.png`，`1280 × 720`，下注阶段。
- Desktop multiplier reveal: `/tmp/marble-game-qa/multiplier-popup-1280x720.png`，`1280 × 720`，倍率锁定弹框阶段。
- Tablet: `/tmp/marble-game-qa/harness-ipad-820x1180.png`，`820 × 1180` iframe 视口。
- Phone portrait: `/tmp/marble-game-qa/harness-iphone-390x844.png`，`390 × 844` iframe 视口。
- Phone landscape: `/tmp/marble-game-qa/harness-landscape-844x390.png`，`844 × 390` iframe 视口。

**Full-view comparison evidence**

- 原椭圆本局数据栏已完全移除；顶部空间收紧为记分板与“出卡口 + 倍率”组合横排，主弹珠区从其下方开始，没有遮挡碰撞区域。
- 卡片包区域与金币余额使用相同的信息密度：实体图标加数字，不再常驻显示卡片分与进度。
- 右侧奖珠仓的真实球堆从规则点阵改为独立银白弹珠；三处弹珠半径由主画布统一同步。
- 四个目标视口的 `scrollWidth == innerWidth`、`scrollHeight == innerHeight`；所有关键控件矩形均在视口内。

**Focused region comparison evidence**

- 顶部横排：出卡口在倍率左侧，桌面宽度约占组合行 18%；短横屏使用 `64px + 1fr`，并隐藏“倍率”文字保留靶心图标和五档数字。
- 倍率状态：非当前倍率为近黑背景和熄灭灯珠；锁定项使用金色凸起、三像素亮边、红灯及双层光晕，视觉优先级明显。
- 倍率弹框：实测锁定 `×4` 时中央弹框显示“命中可得 20 颗”，同时状态条显示“命中可得 20 颗 · 存量 5 颗”；弹框不阻塞续投。
- 发射轨道：两条金色弧轨可见，渲染和碰撞共同消费 16 条采样线段；无正常流程瞬移。

**Required fidelity surfaces**

- Fonts and typography: 延续现有 `STHupo / PingFang SC` 品牌字体和高权重中文；新增弹框主副文案比例清楚，无截断或异常换行。
- Spacing and layout rhythm: 组合横排与主游戏区边界紧密衔接；桌面、平板、竖屏手机和短横屏均无控件重叠。
- Colors and visual tokens: 延续紫金街机调色；倍率黑态和金色锁定态形成足够对比，弹框阴影和亮边与机柜层级一致。
- Image quality and asset fidelity: 继续使用项目现有机柜、图标表和松鼠素材，没有新增占位图、手绘 SVG 或低清替代物。
- Copy and content: 顶部仅显示卡片包总数；“命中可得”明确表示命中后的返还，不暗示必中奖。
- Accessibility: 弹框使用 `role=status` 与 `aria-live=assertive`；音乐、重置和宝宝模式保留至少 44px 热区；减少动态效果时弹框缩短并取消大幅动画。

**Findings**

- No remaining P0, P1, or P2 findings.
- [P3] 竖屏手机中的机柜纵向留白比参考桌面裁图更充足，这是为保留完整 12 洞、投珠槽与控制区的响应式取舍。

**Patches made since the previous QA pass**

- 移除 `.round-readout` DOM 和旧图标样式。
- 新增 `.status-row`、顶部纯数字卡片包、倍率弹框和短横屏双栏适配。
- 将 `BALL_RADIUS` 改为 `9.6`，奖珠仓改为 `2.08r / 1.82r` 无重叠错列堆积并暴露最小中心距。
- 新增两条二次弧轨、16 条共享碰撞线、力度相关出口助推和 1.4 秒防卡救援。
- 更新规则、物理、奖珠仓、投珠槽、卡槽及响应式验收测试。

**Verification**

- Rules: `20/20`。
- Physics: `280/280`，7 档力度各 40 次；弱力度平均落点相对强力度至少向右 2 洞，覆盖至少 10 个洞，单洞占比不超过 35%。
- Reward bank: `10/10`，最小存量球中心距不小于 `2r`，真实余额和 `999+` 保持准确。
- Wager queue: `10/10`。
- Card dispenser: `8/8`，顶部总卡随逐张出卡递增。
- Browser: 本地页面、倍率弹框与四个目标尺寸均通过；浏览器控制台无错误。

**Follow-up polish**

- P3 可选：若后续更强调小屏信息密度，可再压缩竖屏碰撞区上方留白，但当前不影响完整可玩性。

---

# 大奖性能与中奖情绪反馈补充 QA

**Rendered evidence**

- iPad 声音面板：`.playwright-cli/page-2026-08-09T12-41-01-714Z.png`，三条独立声音控制完整可见。
- iPad 超级大奖：`.playwright-cli/page-2026-08-09T12-41-35-145Z.png`，`+990 颗弹珠 / +9 张卡片 / ×10 倍好运` 完整显示，未覆盖右侧奖珠仓。
- `1280×720`、`820×1180`、`390×844`、`844×390` 的大奖舞台和主体内容均位于游戏区内，页面宽高无溢出。

**Performance and behavior**

- 100 颗及以下保持逐颗动画；101、300、990、1000 颗均进入 24 球代表循环，完成时间保持在 5.8–6.2 秒。
- 连续运行 10 轮 300 颗和 10 轮 990 颗后，活动对象归零、单轮峰值不超过 24、静态仓层重绘不超过 90 次。
- 减少动态效果时直接写入准确余额，不保留活动代表球。
- 语音默认开启；有卡、无卡、关闭、接口失败和不支持五种路径均能正确降级，播报时中奖音乐降至 30%，结束后恢复。

**Verification**

- Reward bank: `15/15`。
- Voice/audio: `7/7`。
- Rules: `20/20`；Physics: `280/280`；Wager queue: `10/10`；Card dispenser: `8/8`。
- Browser acceptance: `13/13`，四个目标视口、大奖层、九卡阵列和奖珠仓溢出全部通过；主页面控制台 `0` 错误。
- 当前自动化使用本机 Chrome 与 iPad 视口；真实 iPad Safari 的远程性能采样仍需在目标设备上完成。

**Findings**

- No remaining P0, P1, or P2 findings.
- [P3] 系统中文语音音色由设备提供，不同 iPadOS 版本的音色会略有差异。

final result: passed

---

# iPad 顶部快捷按钮、主弹珠对比与长按加注 QA

**Rendered implementation evidence**

- 横屏主界面：`/tmp/lucky-marble-qa.IBlIZ2/attachments/B71B9864-08E4-4AFA-BCF4-B3F01F94514D.png`，顶部上分、音乐总开关、选歌、选场景和设置均完整可点。
- 选歌面板：`/tmp/lucky-marble-qa.IBlIZ2/attachments/0550A672-EB19-4733-BC67-6FE8E23C33AB.png`，背景音乐与中奖音乐分区选曲、音量和试听。
- 场景面板：`/tmp/lucky-marble-qa.IBlIZ2/attachments/298F4C1C-F87B-49C4-B938-F61B4ED34663.png`，四套场景缩略图与当前选中态完整显示。
- 下注转移与主弹珠：`/tmp/lucky-marble-qa.IBlIZ2/attachments/5B3CF6EF-F55A-4F0D-B31E-D239EAB21C45.png`，银白仓珠/投注珠与青色高亮发射主弹珠形成明显对比。

**Verification**

- 顶部三个新快捷入口在 iPad 竖屏和横屏均存在且可点；横屏截图无文字裁切、按钮重叠或机柜横向溢出。
- 音乐总开关为顶部即时操作；选歌、场景和齿轮设置分为三张独立面板，齿轮页不再常驻背景/中奖选曲或场景网格。
- 发射主弹珠仍使用 `9.6` 物理半径，但改为当前场景 `litLamp` 色、场景描边和 8pt 光晕；奖珠仓与底部投注珠继续使用银白材质。
- 长按“增加下注” 0.9 秒的 UI 测试确认一次手势至少增加 4 分，同时保留点按加 1 行为。
- iPad Air 11-inch (M4), iOS Simulator 26.5：规则/存档/物理 `14/14`，UI `7/7`，全部 0 失败。

**Findings**

- No remaining P0, P1, or P2 findings.
- [P3] 顶部快捷按钮使用原生 SF Symbols，与机柜主题一致使用金色描边和紫色底；后续如需自定义图标可单独替换美术资源，不影响当前交互。

final result: passed

---

# iPad 原生版 3×3 奖卡、下注投珠与中奖灯恢复 QA

**Source visual truth**

- 用户当前状态截图：`/var/folders/6x/5n5xzp595qq6yg5b59ph39vw0000gp/T/codex-clipboard-ae75019c-7573-4f93-b916-33bb545a1b91.png`，`1080 × 1576`。
- 用户明确目标：顶部独立汇总本局弹珠和卡片；下方使用大卡面且单页最多 `3×3`；下注球从右仓进入底部槽并滚向左下洞；中奖灯具备明显反差。
- 网页版行为基准：根目录 `js/wager-marble-queue.js`、`js/card-dispenser.js`、`js/marble-visual.js` 与 `AGENTS.md` 的对应产品约定。

**Rendered implementation evidence**

- 9 张卡片与顶部汇总：`/tmp/lucky-marble-ipad-finalqa.MVhcvu/attachments/AD05D9EE-6D11-4EBC-82F8-7653CDB299D9.png`，`1640 × 2360`。
- 下注投珠槽与高反差中奖灯：`/tmp/lucky-marble-ipad-finalqa.MVhcvu/attachments/C235596C-03DF-47E9-AA5F-4BBBFFF7EF73.png`，`1640 × 2360`。
- 三联归一化对照：`/tmp/lucky-marble-ipad-finalqa.MVhcvu/design-qa-contact-sheet.png`，`2460 × 1180`；三格均按 1180px 高等比缩放并居中补边，未把模拟器边框计为产品差异。
- Viewport：iPad Air 11-inch (M4) 竖屏，应用内容为 `820 × 1180pt`，实现截图 deviceScaleFactor 为 2。

**Full-view comparison evidence**

- 旧状态把单张小卡压在中央中奖框内；新状态将汇总条固定在棋盘顶部，9 张实体卡在下方完整铺成 `3×3`，不遮挡顶部品牌、倍率和右侧奖珠仓。
- 新投珠状态中，右仓数字随逻辑进度由原余额逐颗下降，底部 48pt 重力槽显示同尺寸银白球从右向左滚动，左端黑洞清晰可见。
- 经典皮肤中奖灯由小尺寸浅色点改为高饱和青色核心、白色内圈和外层光晕；未中奖洞保持深紫黑，亮灭状态在全景截图中仍可辨。

**Focused region comparison evidence**

- 汇总条：单一紫金面板同时显示“恭喜中奖”“+N 颗弹珠”“+N 张卡片”和“当前倍率”，数字增长期间保持同一层级。
- 卡片：9 张卡片宽度约 116pt，松鼠素材、紫金边框、标题和英文副标完整；1–9 张分别按 1/2/3 列规则稳定排版。
- 投珠槽：标签和 `已投入 N/N` 位于上层，滚动球位于下层轨道，文字不再与球重叠；左端入口使用黑色椭圆并带主题描边。
- 灯光：主灯半径由 6 增至 7.6，另有 11.4 半径光晕环；四套皮肤继续消费各自 `litLamp` 颜色。

**Required fidelity surfaces**

- Fonts and typography: 沿用系统圆体粗字，汇总主标题、奖励数字和卡片标题层级清楚，无裁切。
- Spacing and layout rhythm: 顶部汇总与 3×3 卡阵分区明确；卡片间距 14pt，投珠槽占用既有状态栏区域，没有挤压或遮挡主要控制。
- Colors and visual tokens: 继续使用当前皮肤 `deep/panel/accent/litLamp/unlitLamp`；经典皮肤青色中奖灯与奶油棋盘形成明显色相和明度反差。
- Image quality and asset fidelity: 卡片继续复用现有 `mascot-win-v2.webp`，没有新增占位图或低清替代素材。
- Copy and content: 使用“恭喜中奖”“颗弹珠”“张卡片”“重力投珠槽”“已投入”等简短中文状态文案。
- Accessibility: 汇总条、卡片阵列、奖珠仓和投珠槽均提供独立 accessibility identifier 与动态语义。

**Comparison history**

- [P1] 小卡片嵌在中奖框内，无法展示多卡。修复：拆成顶部汇总与下方独立卡阵，并用 9 张测试状态确认 `3×3` 完整显示。
- [P1] 下注只扣数字，没有右仓到左下槽的运动。修复：增加独立下注进度、余额逐颗下降和 30fps 有限球池轨道动画；连续追加下注会合并剩余队列。
- [P1] 中奖洞灯与棋盘反差不足。修复：扩大主灯、增加白色描边和独立高饱和光晕环；经典皮肤最终截图可清晰识别 4 个中奖洞。
- [P2] 第一轮投珠截图中文字与滚动球重叠。修复：投珠槽从 36pt 增至 48pt，文字固定上层、球轨固定下层；最终截图无重叠。

**Verification**

- Build：iPad Air 11-inch (M4), iOS Simulator 26.5，`BUILD SUCCEEDED`。
- Unit：`14/14` 通过，含卡片封顶、半径契约、倍率、存档和物理合法落洞。
- UI：`5/5` 通过，含纵横屏关键按钮、上分、设置、9 张卡片汇总/入仓、下注投珠动画。
- 奖励和下注 UI 测试均保存了最终模拟器截图；无测试失败。

**Findings**

- No remaining P0, P1, or P2 findings.
- [P3] 截图只能固定一个投珠时间点；实际滚动连续性由 30fps TimelineView 和动态进度 UI 测试共同覆盖，真实 iPad 触感仍建议发布前再做一次手感确认。

final result: passed

---

# iPad 原生版卡片、设置与奖珠动画恢复 QA

**Source visual truth**

- `/var/folders/6x/5n5xzp595qq6yg5b59ph39vw0000gp/T/codex-clipboard-92d4046c-2a85-4e3b-a3e3-6a4248e45db2.png`，`1230 × 1558`：用户在 iPad 模拟器中标出的原生版缺失状态。
- 网页版的 `css/card-dispenser.css`、`js/card-dispenser.js`、`js/reward-marble-bank.js` 和 `js/marble-visual.js`：卡片逐张弹出、统一银白弹珠和有限代表球入仓的行为基准。

**Rendered implementation evidence**

- Idle/main: `/tmp/lucky-marble-ipad-qa/main-after.png`，`1640 × 2360`，iPad Air 11-inch (M4) 竖屏。
- Arcade settings: `/tmp/lucky-marble-ipad-qa/settings-final/DED56E4B-1DB7-4F64-9FBE-52056512124D.png`，`1640 × 2360`，设置面板打开。
- Card and reward deposit: `/tmp/lucky-marble-ipad-qa/attachments-final6/85DC09A5-7813-4545-9728-89E0434F2810.png`，`1640 × 2360`，2 张卡片已弹出、60 颗奖励接近入仓完成。
- Combined comparison: `/tmp/lucky-marble-ipad-qa/design-qa-contact-sheet.png`，四格归一化比较；每格按 `820 × 1180` 归一，旧截图因包含模拟器边框采用等比缩放和黑边，没有把边框差异计为产品视觉问题。

**Full-view comparison evidence**

- 原生主机柜框架、倍率、12 洞和控制区保持不变；修复没有移动物理几何或改变玩法状态。
- 卡片奖励从原来的几个小系统图标升级为与网页版一致的紫金实体奖励卡，复用现有松鼠素材，1/2/3 列规则覆盖 1–9 张。
- 奖珠仓从固定小圆点改为和 SpriteKit 主弹珠同屏幕半径的银白球，并保持无重叠堆积。
- 奖励阶段可见球从奖珠仓顶部向下运动，逻辑数字同步增长；大额奖励仍限制为最多 24 颗代表球，不随奖励数量线性创建视图。

**Focused region comparison evidence**

- 卡片：截图中 2 张卡片完整显示松鼠、紫金边框、标题和英文副标；卡片由出卡口方向弹入并保留 3 秒展示时间。
- 设置：系统默认 `Form` 已替换为紫金机柜式面板；皮肤卡、总开关、独立音乐、编号曲目、试听和音量控制使用统一圆角、描边与高亮。
- 弹珠：主弹珠真实半径仍为 `9.6`；SwiftUI 奖珠仓从棋盘 `boardWidth / 560 × 9.6` 接收同一屏幕半径，静态球和入仓球共用同一银白材质绘制函数。
- 入仓：奖励测试截图在仓内显示下落中的独立高光球和底部无重叠存量球，状态文本为 `奖励入仓 59/60`。

**Required fidelity surfaces**

- Fonts and typography: 中文继续使用系统圆体高权重层级；卡片标题、英文副标、设置分组和开关文字无截断。
- Spacing and layout rhythm: 设置页最大宽度 760pt，分组间距 18pt；卡片 1–9 张按 1/2/3 列居中，未遮挡顶部计分或底部控制区。
- Colors and visual tokens: 继续使用当前皮肤的 `deep/panel/accent` 令牌；经典皮肤恢复紫金、近黑和金色亮边的网页视觉关系。
- Image quality and asset fidelity: 卡片直接复用 `mascot-win-v2.webp`，皮肤继续使用现有高清主题图；没有新增占位图或低清替代物。
- Copy and content: 保留“卡片包”“奖珠仓”“奖励入仓”“音乐总开关”“第1首/试听”等现有中文产品文案。
- Accessibility: 卡片阵列和奖珠仓提供可访问标识及动态文本；设置主要控制保持可识别标签和至少 44pt 的操作区域。

**Comparison history**

- [P1] 卡片中奖只有小图标，没有实体卡片弹窗。修复：增加逐张卡片阵列、松鼠卡面、出卡方向弹入和 3 秒停留；UI 测试确认卡片阵列可见。
- [P1] 设置页使用系统默认表单，与机柜风格脱节。修复：改成主题背景、紫金分组面板、自定义开关、编号曲目和试听控件；设置 UI 测试通过。
- [P1] 仓内球使用固定约 4.8pt 半径，和主弹珠尺寸明显不一致。修复：由棋盘实时计算主弹珠屏幕半径并传给仓库；三种奖励球共用相同半径和材质。
- [P1] 中奖只增长数字，没有球进入仓库。修复：增加 30fps 有限球池的顶部入仓动画，小奖最多 12 个同时活动、大于 100 颗最多 24 个，数字最终校准准确。
- 复查中发现棋盘庆祝层和奖珠仓会各自创建 24 颗球。修复：删除重复的棋盘球雨，仅保留奖珠仓代表球，满足原生版最多 24 颗代表球的性能约束。

**Verification**

- Build: iPad Air 11-inch (M4), iOS Simulator 26.5，`BUILD SUCCEEDED`。
- Unit: `14/14`，含倍率、卡片、存档、主题音乐、物理落洞和 `9.6` 半径契约。
- UI full run: `4/4`；纵横屏关键按钮、重复上分、设置面板、卡片弹窗和奖珠入仓均通过。
- Final targeted reruns: 奖励卡片/入仓 `1/1`，设置面板 `1/1`。

**Findings**

- No remaining P0, P1, or P2 findings.
- [P3] iPad 原生版使用系统 SF Symbols 表现设置类通用图标，和网页版精灵图不完全相同，但触控清晰度与无障碍语义更适合原生界面。

final result: passed

---

# iPad 宝宝模式、自动投珠与拉杆细节 QA

**Rendered implementation evidence**

- 竖屏投珠：`/tmp/lucky-marble-detail-qa.dBGloA/attachments/0C47B759-C8EB-4869-AC5A-D9A2D217B727.png`，可见加粗的右向左投珠槽、左侧黑洞、右侧入口、投入进度、灰色“投珠中”和待机拉杆。
- 横屏主界面：`/tmp/lucky-marble-detail-qa.dBGloA/attachments/82BB43F5-16D8-41C0-A790-A3AC715F1882.png`，顶部泰迪熊+星光的宝宝模式按钮与上分、音乐、选歌、场景、设置并列且均可点。
- 简化设置：`/tmp/lucky-marble-detail-qa.dBGloA/attachments/A02BE446-31DA-4A20-A9FB-AD37D769C4D6.png`，齿轮页只保留中奖语音、画面性能和重置操作。

**Verification**

- 开始后引擎立即扣除当前下注并开启投珠队列；投珠未完成前不能蓄力。
- 倍率揭晓后按钮显示灰色“去拉杆”；点击 `10` 筹码键可将本局下注从 35 直接增至 45，并立即再次出现投珠动画，无需第二次点击开始。
- 拉杆组件包含球头、金属杆、螺旋弹簧、撞击片与下拉箭头；蓄力时球头下移、弹簧压缩，发射时以弹性动画快速回位。
- iPad Air 11-inch (M4), iOS Simulator 26.5：Build 通过；规则/存档/物理 `14/14`，UI `8/8`，全部 0 失败。

**Findings**

- No remaining P0, P1, or P2 findings.

final result: passed
