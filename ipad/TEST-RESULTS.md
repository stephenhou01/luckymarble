# 幸运弹珠 iPad 原生版验收记录

验收日期：2026-08-25

## 结论

- 网页版 Playwright 验收：15 项全部通过。
- iPad 原生单元测试：13 项全部通过。
- iPad 原生 UI 测试：2 项全部通过。
- iPad 模拟器完整测试：`TEST SUCCEEDED`。
- iOS 通用真机构建（不签名）：`BUILD SUCCEEDED`。
- `Info.plist`：格式校验通过。

## 主要覆盖

- 下注边界、倍率权重、宝宝模式、命中结算与手动上分。
- 卡片跨局进度、单局最多 9 张及超额作废。
- 共享几何、固定时间步进与 7 档力度合法落洞。
- 设置、原子存档、损坏存档回退与四套音乐目录。
- 竖屏及横屏界面；横屏下开始、上分和设置按钮可见且可点击。
- 100/200/300 投注上限、旧存档默认上限兼容和四套皮肤独立亮灯色。
- 大奖代表球上限与奖励数字准确结算。

## 证据

- 完整 XCTest 结果：`~/Library/Developer/Xcode/DerivedData/LuckyMarble-gnzfvycyweexetcuxprlwjtwxypc/Logs/Test/Test-LuckyMarble-2026.08.25_10-30-12-+0800.xcresult`
- 本次细节调整测试日志：`/tmp/lucky-marble-detail-update-tests.log`
- 本次通用真机构建日志：`/tmp/lucky-marble-detail-device-build.log`
- 横屏截图：`output/ipad-air-11-landscape-final.png`
- 竖屏截图：`output/ipad-air-11-portrait.png`

## 真机交付说明

当前已通过面向通用 iOS 设备的编译验证，但没有冒充已在实体 iPad 上完成性能测量。安装到实体 iPad 前，需要在 Xcode 中选择开发团队并完成签名；建议随后在目标 iPad Air 上跑一轮 1000 颗大奖并使用 Instruments 检查帧率和内存。
