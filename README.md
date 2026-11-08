# 拾途 / Shitu Journal

网页优先的旅行档案原型，无需 ChatGPT 登录。默认展示独立的虚构示例；真实资料保存在当前浏览器，也可以直接写入用户选择的本地文件夹，没有上传接口或云数据库。

## 源码与后续更新

固定源码仓库：[Da1suKE66/TravelMemory](https://github.com/Da1suKE66/TravelMemory)。后续网页和 iPhone 版本的项目更新均保存到此仓库，`origin` 指向此地址。

提交源码与发布网页是两个独立步骤。私有站点链接和实际部署配置保留在本机，不写入公开仓库；仓库也不保存用户导入的照片、账单或本机档案备份。

部署配置的公开示例见 `.openai/hosting.example.json`，其中没有实际站点标识。

```sh
git clone https://github.com/Da1suKE66/TravelMemory.git
cd TravelMemory
```

## 运行与验证

```sh
npm start
npm test
```

本机地址为 http://127.0.0.1:4178 。站点入口在 `dist/index.html`，无需构建。

## 电脑与手机布局

电脑端保留侧栏与多列地图、旅行卡片；手机端提供带文字的五入口底部导航、至少 44px 的主要触控按钮、16px 表单输入、横竖屏布局和安全区间距。表格在自己的容器中横向滚动，页面保持贴合屏幕。编辑弹窗随可见视口调整，回忆播放器也支持较矮的横屏。

响应式回归覆盖桌面 1366 / 1440 / 1920、平板、320px 小屏，以及 iPhone 15 Pro Max 的 Safari 内容视口 430×739、横屏 814×380 和完整屏幕 430×932 / 932×430（3 倍像素密度）。使用 WebKit / Chrome 自动化模拟，不等同于真机验证。测试只使用虚构资料；安全区和键盘视口变化另有模拟检查。

```sh
npm ci
PLAYWRIGHT_BROWSERS_PATH="$PWD/.sites/browsers" npx playwright install webkit chromium
npm run test:layout
```

桌面测试默认使用已安装的 Google Chrome。若只安装 Playwright Chromium，可将配置中的 `channel: 'chrome'` 移除。截图、失败追踪和 HTML 报告保存在忽略的 `.sites/qa/` 中。

## 直接保存到本地

在「数据与备份」点击「选择本地保存文件夹」，授予浏览器写入权限后，导入、编辑和移除记录会自动更新其中的 `shitu-archive-*.json` 文件。文件包含旅行、记录与照片预览，原始照片和账单仍保留在原位置。首次连接会创建独立文件名，不覆盖已有档案。

浏览器会尝试记住文件夹，下次打开在已有授权范围内读取本地档案。权限失效时需要点击「重新授权并保存」。不支持文件夹选择的浏览器提供「下载到本地」作为替代。也可以使用 `npm start` 在本机运行，全程无需账户。

若要手动验证照片 GPS 导入，可以运行 `python3 scripts/create-gps-fixture.py`，从已核实的公开示例图生成本机测试样本。日期与 GPS 均为人工测试值；生成的 JPEG 不提交到仓库。示例图片来源和校验值见 `dist/assets/sample-images.json`。

## 已实现

- 全球、中国大陆、日本、美国、其他五种范围；真实公开边界数据与 D3 地图。其他范围可再选国家 / 地区，名称统一显示“中国大陆”“中国台湾”。
- 世界足迹默认显示可拖动的地球仪，可切换平面地图。鼠标滚轮、双指手势和按钮缩放；键盘方向键旋转，加减键缩放，Home 复位。背面地点不显示，也不可被点击；目的地按钮可直接转向对应一侧。
- 示例档案包含中国台湾的台北 / 九份行程、两张公开授权照片、示例交通与 TWD 花费；日期、坐标和消费均为虚构，不会加入“我的本机档案”。配图出处与校验值见 `dist/assets/sample-images.json`。
- 照片 EXIF 时间和 GPS、本机压缩预览、SHA-256 文件去重；没有拍摄时间时需手动补充。HEIC 预览取决于浏览器。
- CSV / TSV / XLS / XLSX 字段映射，微信、支付宝、个人账本和银行文件入口。保留原币，退款冲减，排除转账和未完成交易。
- 完全重复跳过；跨来源疑似重复默认不选。原交易带有退款状态但缺少明确退款明细时，标记核对，不猜净额。
- 文字型 PDF 本地提取，图片票据可选本机 OCR（首次联网下载中英文模型）。复杂 PDF 需要逐笔补录，推荐银行表格导出。
- 用户确认后新建或关联旅行；时间分组建议；跨国旅行保留单个旅行 ID。
- 时间线、照片、花费、珍藏与选片理由、可编辑回忆、幻灯播放、默认移除地点和日期的离线 HTML 相册导出。
- 本机 JSON 备份与合并恢复、记录软删除和恢复。

## 数据边界

`core.js` 是无 UI 依赖的归一化、货币、去重和选片规则；`schemaVersion: 1` 的档案包含 `trips` 与 `records`。每个记录独立保存来源、日期语义、地点依据、国家代码和旅行 ID。金额为币种最小单位整数。没有时区时保留原始当地时间，不进行 UTC 推断。

照片预览导入时重新编码，不保留原始 EXIF。原片、视频、原始账单文件不写入档案；请自行保管。应用不访问 iCloud 账号、不登录支付或银行账户、不请求持续定位。OCR 下载的是模型和运行组件，图片留在本机。浏览器清理和隐私模式可能清除数据，换设备前应导出备份。

## 后续 iPhone 版本

沿用旅行 / 记录 / 来源 / 回忆选择的模型；通过系统相册授权和 PhotoKit 获取已有照片信息。原生适配层新增 iCloud 照片下载、分享扩展、后台增量索引及原片引用。图像语义选片、配乐和视频导出、带用户身份的端到端加密云同步另行实现。银行自动读取必须按实际地区与账户权限接入，不能把 Apple Pay 视为通用位置记录接口。

## 外部资料

- Apple PhotoKit: https://developer.apple.com/documentation/photos/phasset
- Apple FinanceKit: https://developer.apple.com/financekit/
- Apple Pay history: https://support.apple.com/en-ca/104954
- World Atlas / Natural Earth: https://github.com/topojson/world-atlas
- US Atlas / Census: https://github.com/topojson/us-atlas
- 日本都道府县: https://github.com/dataofjapan/land
- 大陆省级边界: https://datav.aliyun.com/portal/school/atlas/area_selector

示例日期、消费、文字与照片为虚构组合，用于演示归档体验。
