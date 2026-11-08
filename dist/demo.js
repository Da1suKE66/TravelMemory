export const demoArchive = {
  schemaVersion: 1,
  trips: [
    { id:'taiwan', title:'台北与九份', subtitle:'从城市天际线，到山城的一盏灯。', start:'2026-09-18', end:'2026-09-22', regions:['other'], countryCodes:['TWN'], places:['台北','九份'], cover:'assets/taipei.jpg', memoryTitle:'中国台湾 · 山海之间的几天', demo:true },
    { id:'japan', title:'关西，慢一点', subtitle:'把京都的暮色，装进行李里。', start:'2026-05-01', end:'2026-05-07', regions:['japan'], countryCodes:['JPN'], places:['京都','大阪'], cover:'assets/kyoto.jpg', coverPosition:'50% 57%', demo:true },
    { id:'guilin', title:'山水之间的几天', subtitle:'沿着漓江，把日子过慢一点。', start:'2026-04-03', end:'2026-04-06', regions:['mainland'], countryCodes:['CHN'], places:['桂林','阳朔'], cover:'assets/guilin.jpg', demo:true },
    { id:'bangkok', title:'曼谷的热带日落', subtitle:'收藏河岸的金色时刻。', start:'2025-12-20', end:'2025-12-24', regions:['other'], countryCodes:['THA'], places:['曼谷'], cover:'assets/bangkok.jpg', demo:true },
    { id:'yosemite', title:'去山野里走走', subtitle:'在优胜美地，留下一次深呼吸。', start:'2025-10-01', end:'2025-10-08', regions:['usa'], countryCodes:['USA'], places:['旧金山','优胜美地'], cover:'assets/yosemite.jpg', demo:true }
  ],
  records: [
    {id:'tw1',tripId:'taiwan',kind:'photo',title:'台北的天际线',caption:'河流转过弯，城市在远处亮起来。',date:'2026-09-19',dateTime:'2026-09-19T17:30:00+08:00',zoneKnown:true,coords:[121.5645,25.0330],place:'中国台湾 · 台北',countryCode:'TWN',region:'other',subregion:'台北市',image:'assets/taipei.jpg',favorite:true,source:'photo',locationStatus:'manual',demo:true},
    {id:'tw2',tripId:'taiwan',kind:'photo',title:'九份的红灯笼',caption:'沿着石阶慢慢走，把山城的光留在这一页。',date:'2026-09-21',dateTime:'2026-09-21T18:10:00+08:00',zoneKnown:true,coords:[121.8452,25.1097],place:'中国台湾 · 九份老街',countryCode:'TWN',region:'other',subregion:'新北市',image:'assets/jiufen.jpg',source:'photo',locationStatus:'manual',demo:true},
    {id:'tw3',tripId:'taiwan',kind:'ticket',title:'台北 → 瑞芳 → 九份',caption:'示例交通记录；日期和票据信息均为虚构。',date:'2026-09-21',dateTime:'2026-09-21T09:20:00+08:00',zoneKnown:true,place:'中国台湾 · 台北 / 瑞芳',countryCode:'TWN',region:'other',source:'ticket',locationStatus:'ticket',confirmed:true,demo:true},
    {id:'tw4',tripId:'taiwan',kind:'expense',title:'山城茶点',date:'2026-09-21',dateTime:'2026-09-21T15:30:00+08:00',zoneKnown:true,amountMinor:48000,currency:'TWD',place:'中国台湾 · 九份',countryCode:'TWN',region:'other',source:'ledger',category:'餐饮',locationStatus:'unconfirmed',included:true,demo:true},
    {id:'jp1',tripId:'japan',kind:'photo',title:'京都的暮色',caption:'在八坂塔下，留住这一天。',date:'2026-05-02',dateTime:'2026-05-02T18:15:00+09:00',zoneKnown:true,coords:[135.7796,34.9985],place:'京都 · 八坂塔',countryCode:'JPN',region:'japan',subregion:'京都府',image:'assets/kyoto.jpg',favorite:true,source:'photo',locationStatus:'gps',demo:true},
    {id:'jp2',tripId:'japan',kind:'photo',title:'朱红色的长廊',caption:'走过一重又一重鸟居。',date:'2026-05-03',dateTime:'2026-05-03T08:45:00+09:00',zoneKnown:true,coords:[135.7727,34.9671],place:'京都 · 伏见稻荷',countryCode:'JPN',region:'japan',subregion:'京都府',image:'assets/torii.jpg',source:'photo',locationStatus:'gps',demo:true},
    {id:'jp3',tripId:'japan',kind:'photo',title:'岚山的绿色',caption:'这一刻，留给竹林。',date:'2026-05-04',dateTime:'2026-05-04T09:12:00+09:00',zoneKnown:true,coords:[135.6722,35.0170],place:'京都 · 岚山',countryCode:'JPN',region:'japan',subregion:'京都府',image:'assets/bamboo.jpg',source:'photo',locationStatus:'gps',demo:true},
    {id:'jp4',tripId:'japan',kind:'expense',title:'京都站 → 大阪站',date:'2026-05-05',dateTime:'2026-05-05T10:10:00+09:00',zoneKnown:true,amountMinor:580,currency:'JPY',place:'京都站',countryCode:'JPN',region:'japan',source:'ledger',category:'交通',locationStatus:'manual',included:true,demo:true},
    {id:'jp5',tripId:'japan',kind:'expense',title:'京都咖啡店',date:'2026-05-03',dateTime:'2026-05-03T11:20:00+09:00',zoneKnown:true,amountMinor:850,currency:'JPY',place:'京都 · 店铺待确认',countryCode:'JPN',region:'japan',source:'card',category:'餐饮',locationStatus:'unconfirmed',included:true,demo:true},
    {id:'jp6',tripId:'japan',kind:'ticket',title:'关西空港 → 京都',date:'2026-05-01',dateTime:'2026-05-01T12:16:00+09:00',place:'关西空港 → 京都',countryCode:'JPN',region:'japan',source:'ticket',locationStatus:'ticket',caption:'票面显示的出行计划，已手动确认乘坐。',confirmed:true,demo:true},
    {id:'cn1',tripId:'guilin',kind:'photo',title:'漓江的山水',caption:'把山和水，留在这一页。',date:'2026-04-04',dateTime:'2026-04-04T10:00:00+08:00',coords:[110.4825,24.9239],place:'桂林 · 漓江',countryCode:'CHN',region:'mainland',subregion:'广西壮族自治区',image:'assets/guilin.jpg',source:'photo',locationStatus:'gps',favorite:true,demo:true},
    {id:'cn2',tripId:'guilin',kind:'expense',title:'桂林米粉',date:'2026-04-04',amountMinor:1800,currency:'CNY',place:'桂林',countryCode:'CHN',region:'mainland',source:'wechat',category:'餐饮',locationStatus:'unconfirmed',included:true,demo:true},
    {id:'th1',tripId:'bangkok',kind:'photo',title:'金色的曼谷',caption:'在城市的河岸边，停一会儿。',date:'2025-12-22',dateTime:'2025-12-22T17:00:00+07:00',coords:[100.4883,13.7437],place:'曼谷',countryCode:'THA',region:'other',image:'assets/bangkok.jpg',source:'photo',locationStatus:'gps',demo:true},
    {id:'us1',tripId:'yosemite',kind:'photo',title:'山野的来信',caption:'山谷很大，我们慢慢走。',date:'2025-10-04',dateTime:'2025-10-04T16:00:00-07:00',coords:[-119.5885,37.7456],place:'优胜美地',countryCode:'USA',region:'usa',subregion:'California',image:'assets/yosemite.jpg',source:'photo',locationStatus:'gps',favorite:true,demo:true}
  ]
};
export const SOURCES = {
  photo: { label:'iCloud 照片', icon:'images', short:'照片', accept:'.jpg,.jpeg,.png,.webp,.heic,.heif', formats:'JPG / HEIC / PNG / WebP', note:'从 iCloud 或「照片」导出原始照片，再选择文件。读取已有拍摄时间与 GPS；网页不能直接遍历 iCloud 相册。HEIC 可以读取部分元数据，浏览器可能无法预览，建议同时导出 JPEG。' },
  ledger: { label:'自己的账本', icon:'notebook-pen', short:'手记', accept:'.csv,.tsv,.xlsx,.xls', formats:'CSV / Excel', note:'导入你已有的记账表格，确认日期、金额、币种和商家对应的列。不同币种分别汇总。' },
  wechat: { label:'微信账单', icon:'message-circle', short:'微信', accept:'.csv,.xlsx,.xls,.pdf', formats:'个人账单 CSV / Excel / PDF', note:'选择由你从微信导出的个人账单文件。文件需先自行解压；本页不登录微信。退款抵减消费，转账和还款默认排除。扫描 PDF 可通过票据入口补录。' },
  alipay: { label:'支付宝账单', icon:'wallet', short:'支付宝', accept:'.csv,.xlsx,.xls,.pdf', formats:'个人账单 CSV / Excel / PDF', note:'选择由你导出的个人账单文件。先预览字段再归档；同一笔消费出现在多个来源时，需要核对重复记录。' },
  ticket: { label:'车票与票据', icon:'ticket', short:'票据', accept:'.jpg,.jpeg,.png,.webp,.pdf', formats:'票据照片 / PDF / 手动文字', note:'文字型 PDF 可本地提取文本。票据照片可选本机 OCR，首次需联网下载识别模型；识别结果要先核对。票面行程不代表实际乘坐。' },
  card: { label:'信用卡 · Apple Pay', icon:'credit-card', short:'信用卡', accept:'.csv,.xlsx,.xls,.pdf', formats:'银行导出的账单文件', note:'导入银行或可用账户的导出文件。Apple Pay 不作为通用自动同步接口；商家地点与实际到访地点分别记录。只有入账日期时，保留该含义，不当作精确消费时间。' }
};
