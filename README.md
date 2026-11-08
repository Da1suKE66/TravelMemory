# 拾途 / Shitu Journal

网页优先的旅行档案原型。默认展示独立的虚构示例；真实导入的数据只写入当前浏览器的 IndexedDB，没有上传接口或云数据库。

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

## 已实现

- 全球、大陆、日本、美国、其他五种范围；真实公开边界数据与 D3 地图。其他范围可再选国家。
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
