import { SCHEMA_VERSION, REGION_LABELS, escapeHTML as e, uid, regionForCountry, parseDate, normaliseExpense, duplicateStatus, sumsByCurrency, formatMoney, suggestGroups, selectMemories, tripInRegion, validateArchive } from './core.js';
import { demoArchive as seed, SOURCES } from './demo.js';

const app = document.getElementById('app'), modalRoot = document.getElementById('modal-root');
let archive = { schemaVersion: SCHEMA_VERSION, trips: [], records: [] }, demo = structuredClone(seed);
const state = { mode: localStorage.getItem('shitu-mode') || 'demo', region: 'world', otherCountry: '', source: 'photo', pending: [], billRows: null, billHeaders: [], mapping: {}, defaultCurrency: 'CNY', files: [], importMessage: '', importError: '', busy: false, tab: 'timeline' };
let db, geo = {}, countryList = [], modalCleanup, toastTimer, lastFocus, mapZoom, mapSvg;
const countryNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
const data = () => state.mode === 'demo' ? demo : archive;
const activeRecords = () => data().records.filter(r => !r.deletedAt);
const tripRecords = id => activeRecords().filter(r => r.tripId === id);
const liveTrips = () => data().trips.filter(t => !t.deletedAt);
const visibleTrips = () => liveTrips().filter(t => tripInRegion(t, state.region) && (state.region !== 'other' || !state.otherCountry || t.countryCodes?.includes(state.otherCountry))).toSorted((a,b) => b.start.localeCompare(a.start));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const sourceTag = r => `<span class="tag">${icon(SOURCES[r.source]?.icon || 'file-text')}${e(SOURCES[r.source]?.short || r.source || '手动')}</span>`;
const locationTag = r => ({gps:'照片 GPS',manual:'手动确认',ticket:'票面地点',unconfirmed:'地点待确认',none:'没有定位'}[r.locationStatus] || '地点待确认');
const safeImage = url => typeof url === 'string' && (/^assets\/[a-z0-9-]+\.jpg$/.test(url) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) ? url : '';
const tripCover = t => safeImage(t.cover) || safeImage(tripRecords(t.id).find(r => r.kind === 'photo' && r.image)?.image);
const displayDate = date => e(String(date || '').replaceAll('-', '.'));
const range = t => `${displayDate(t.start)} — ${t.start?.slice(0,4) === t.end?.slice(0,4) ? displayDate(t.end?.slice(5)) : displayDate(t.end)}`;
const countryName = code => { const c = countryList.find(c => c.code === code); try { return c ? countryNames.of(c.iso2) : ({CHN:'中国',JPN:'日本',USA:'美国',THA:'泰国',HKG:'中国香港',TWN:'中国台湾',MAC:'中国澳门'}[code] || code || '未指定'); } catch { return code; } };
const empty = (title, subtitle, action = 'import', label = '导入第一份资料') => `<div class="empty">${icon('map-pinned')}<h2>${e(title)}</h2><p>${e(subtitle)}</p><button class="btn primary" data-action="${action}">${icon('plus')}${e(label)}</button></div>`;
const uiIcons = () => window.lucide?.createIcons({ attrs: { 'stroke-width': 1.6 } });
function toast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4200); }

async function openDB() {
  db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('shitu-archive', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archive');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const saved = await new Promise((resolve, reject) => { const r = db.transaction('archive').objectStore('archive').get('main'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  if (saved) archive = validateArchive(saved);
}
async function persist() {
  if (state.mode === 'demo') return;
  if (!db) throw new Error('浏览器存储不可用，请先导出备份，并检查隐私浏览设置。');
  await new Promise((resolve, reject) => { const tx = db.transaction('archive','readwrite'); tx.objectStore('archive').put(archive,'main'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('存储空间不足')); });
}

function route() {
  const [view = 'map', id = '', tab = 'timeline'] = location.hash.slice(1).split('/');
  state.view = ['map','trips','memories','import','settings','trip'].includes(view) ? view : 'map';
  state.tripId = decodeURIComponent(id); state.tab = ['timeline','photos','expenses','selection'].includes(tab) ? tab : 'timeline';
  closeModal(); render(); window.scrollTo({top:0,behavior:'instant'});
}
function go(path) { if (location.hash === '#' + path) { route(); } else location.hash = path; }
const navName = () => ({map:'足迹地图',trips:'我的旅行',memories:'旅行回忆',import:'导入中心',settings:'数据与备份',trip:'旅行档案'}[state.view]);

function render() {
  const page = ({ map:renderMapPage, trips:renderTripsPage, memories:renderMemoriesPage, import:renderImportPage, settings:renderSettingsPage, trip:renderTripPage }[state.view] || renderMapPage)();
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#map" aria-label="拾途首页"><span class="brand-mark">${icon('scan-line')}</span><span class="brand-copy"><span class="brand-cn">拾途</span><span class="brand-en">SHITU JOURNAL</span></span></a><div class="sidebar-caption">YOUR LITTLE WORLD</div><nav class="nav" aria-label="主要导航">${[['map','globe-2','足迹地图'],['trips','luggage','我的旅行'],['memories','clapperboard','旅行回忆'],['import','folder-down','导入中心']].map(([id,i,label])=>`<a class="nav-link ${state.view === id || id === 'trips' && state.view === 'trip' ? 'active' : ''}" href="#${id}" aria-label="${label}" ${state.view === id ? 'aria-current="page"' : ''}>${icon(i)}<span class="nav-text">${label}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="local-note">${icon('shield-check')}<span>属于你的故事<br>资料在本机慢慢整理</span></div><a class="nav-link ${state.view === 'settings' ? 'active' : ''}" href="#settings">${icon('settings-2')}<span class="nav-text">数据与备份</span></a><div class="side-footer"><span>KEEP THE JOURNEY</span><span>v0.1</span></div></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumb"><span>我的拾途</span><span>/</span><strong>${navName()}</strong></div><div class="top-actions"><select class="archive-select" id="archive-mode" aria-label="选择档案"><option value="demo" ${state.mode === 'demo' ? 'selected' : ''}>示例档案</option><option value="mine" ${state.mode === 'mine' ? 'selected' : ''}>我的本机档案</option></select><button class="btn primary" data-action="import">${icon('plus')}导入资料</button></div></header><main id="main" class="page">${page}</main></div></div>`;
  uiIcons();
  if (state.view === 'map') drawMap();
  if (state.view === 'import') bindImport();
}

function modes() {
  return `<div class="mode-bar" role="group" aria-label="地图范围">${Object.entries(REGION_LABELS).map(([key,label]) => `<button class="mode ${state.region === key ? 'active' : ''}" data-action="region" data-value="${key}" aria-pressed="${state.region === key}">${key === 'world' ? icon('globe-2') : ''}${label}</button>`).join('')}</div>${state.region === 'other' ? `<label class="other-picker">国家 / 地区<select id="other-country"><option value="">全部其他国家 / 地区</option>${[...new Set(liveTrips().flatMap(t=>t.countryCodes || []).filter(c=>!['CHN','JPN','USA'].includes(c)))].map(c=>`<option value="${e(c)}" ${state.otherCountry === c ? 'selected' : ''}>${e(countryName(c))}</option>`).join('')}</select></label>` : ''}`;
}
function heading(eyebrow, title, subtitle) {
  return `<div class="heading-row"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${state.mode === 'demo' ? '<span class="demo-tag">示例数据 · 概念体验</span>' : '<span class="demo-tag">本机档案</span>'}</div>`;
}
function tripCard(t) {
  const records = tripRecords(t.id), image = tripCover(t);
  return `<a class="trip-card" href="#trip/${encodeURIComponent(t.id)}"><div class="trip-image">${image ? `<img src="${e(image)}" alt="${e(t.title)}旅行封面" loading="lazy" style="object-position:${e(t.coverPosition || 'center')}">` : `<div class="empty-cover">${icon('image')}</div>`}<span class="region-chip">${e(t.countryCodes?.map(countryName).join(' · ') || '尚未指定目的地')}</span></div><div class="trip-card-content"><h3>${e(t.title)}</h3><div class="card-places">${e(t.places?.join(' · ') || '地点等你补充')}</div><div class="card-meta"><span>${range(t)}</span><span>${icon('images')}${records.filter(r=>r.kind === 'photo').length} 张</span></div></div></a>`;
}
function renderMapPage() {
  const trips = visibleTrips(), latest = trips[0], codes = [...new Set(trips.flatMap(t=>t.countryCodes || []))], regions = [...new Set(trips.flatMap(t => tripRecords(t.id).map(r=>r.subregion).filter(Boolean)))];
  const stats = ['world','other'].includes(state.region) ? `${codes.length} 个国家 / 地区` : `${regions.length} 个${state.region === 'japan' ? '都道府县' : state.region === 'usa' ? '州' : '省级地区'}`;
  return heading('A LITTLE FURTHER, A LITTLE CLOSER','走过的路，都有迹可循。','把散落的照片和票据，慢慢收藏成你的旅行。') + modes() + (trips.length ? `<div class="map-layout"><section class="map-panel" aria-label="${REGION_LABELS[state.region]}足迹地图"><div class="map-heading"><div><h2>${state.region === 'world' ? '我的世界足迹' : state.region === 'mainland' ? '在大陆，走过的地方' : state.region === 'japan' ? '日本的旅行片段' : state.region === 'usa' ? '美国的旅行片段' : '世界的其他角落'}</h2><p>${stats} &nbsp;·&nbsp; ${trips.length} 次旅行</p></div><span class="map-range">${trips.at(-1).start.slice(0,4)} — ${trips[0].end.slice(0,4)}</span></div><div class="map-container" id="travel-map"><div class="loading" style="min-height:150px;font-size:11px;color:#96a08b">正在展开地图…</div></div><div class="map-legend"><div class="legend"><span><i class="swatch"></i>有定位的足迹</span><span><i class="swatch dot"></i>旅行片段</span></div><div class="map-zoom"><button class="icon-btn" data-action="zoom-in" aria-label="放大地图">${icon('plus')}</button><button class="icon-btn" data-action="zoom-out" aria-label="缩小地图">${icon('minus')}</button><button class="icon-btn" data-action="zoom-reset" aria-label="还原地图">${icon('maximize')}</button></div></div><div class="map-attribution"><a href="#settings">地图来源与说明</a> · 仅展示已关联地点，不推断完整移动轨迹</div></section><article class="featured"><div class="featured-image">${tripCover(latest) ? `<img src="${e(tripCover(latest))}" alt="${e(latest.title)}旅行照片" style="object-position:${e(latest.coverPosition || 'center')}">` : `<div class="empty-cover">${icon('image')}</div>`}<span class="image-flag">最近一次出发</span></div><div class="featured-content"><div class="date">${range(latest)}</div><h2>${e(latest.title)}</h2><p class="place-line">${icon('map-pin')}${e(latest.places?.join(' · ') || '地点待补充')}</p><div class="feature-actions"><a class="btn" href="#trip/${encodeURIComponent(latest.id)}">打开旅行${icon('arrow-up-right')}</a><button class="btn ghost" data-action="play" data-id="${e(latest.id)}">${icon('play')}播放回忆</button></div></div></article></div><div class="section-head"><h2 class="section-title">收藏的旅行<small>${trips.length} 段故事</small></h2><a class="btn ghost" href="#trips">查看全部 ${icon('arrow-right')}</a></div><div class="trip-grid">${trips.slice(0,3).map(tripCard).join('')}</div>` : empty(state.mode === 'demo' ? '这个范围还没有旅行' : '从一张照片，开始你的旅行档案','导入照片、账单或票据，确认之后就会出现在这里。')) + `<div class="archive-bottom">${icon('sprout')}世界很大，值得慢慢收藏。</div>`;
}

function renderTripsPage() {
  const trips = visibleTrips();
  return heading('COLLECT MOMENTS, NOT JUST MILES','每次出发，都有一页故事。','照片、交通与花费，收进同一本旅行档案。') + modes() + (trips.length ? `<div class="trip-grid all">${trips.map(tripCard).join('')}</div>` : empty('这一页，等你的下一次出发','先导入资料，再确认或新建一次旅行。'));
}

function renderMemoriesPage() {
  const trips = visibleTrips().filter(t=>selectMemories(tripRecords(t.id)).length);
  return heading('SOME DAYS DESERVE A REPLAY','有些瞬间，想再走过一遍。','按日期、地点与珍藏标记，挑出每次旅行的几个片段。') + modes() + (trips.length ? `<div class="memory-grid">${trips.map(t => { const photos = selectMemories(tripRecords(t.id)); return `<button class="memory-cover" data-action="play" data-id="${e(t.id)}" aria-label="播放${e(t.title)}回忆"><img src="${e(tripCover(t))}" alt="${e(t.title)}回忆封面"><span class="play-round">${icon('play')}</span><span class="memory-cover-content"><span class="date">${range(t)}</span><h2>${e(t.memoryTitle || t.title)}</h2><p>${photos.length} 张精选 · ${photos.length * 5} 秒的旅行片段</p></span></button>`; }).join('')}</div><p class="page-note">选片理由可以查看，也可以自己珍藏、移除或修改照片文字。票据与消费金额默认不进入回忆。</p>` : empty('你的第一段回忆，还在路上','导入带照片的旅行，就能生成可以修改的回忆相册。'));
}

function renderTripPage() {
  const t = liveTrips().find(t=>t.id === state.tripId);
  if (!t) return empty('没有找到这次旅行','可以切换「示例档案 / 我的本机档案」查看对应的记录。','trips','查看我的旅行');
  const records = tripRecords(t.id), photos = records.filter(r=>r.kind === 'photo'), totals = sumsByCurrency(records), image = tripCover(t);
  const tabHTML = ({ timeline:renderTimeline, photos:renderPhotos, expenses:renderExpenses, selection:renderSelection }[state.tab])(t, records);
  return `<a class="back" href="#trips">${icon('arrow-left')}回到我的旅行</a><div class="detail-hero">${image ? `<img src="${e(image)}" alt="${e(t.title)}封面" style="object-position:${e(t.coverPosition || 'center')}">` : `<div class="empty-cover">${icon('map')}</div>`}<div class="detail-hero-content"><div><span class="date">${range(t)}${t.demo ? ' · 示例旅行' : ''}</span><h1>${e(t.title)}</h1><p>${e(t.subtitle || t.places?.join(' · ') || '把这次出发，慢慢收藏。')}</p></div><button class="btn" data-action="play" data-id="${e(t.id)}">${icon('play')}播放旅行回忆</button></div></div><div class="detail-info"><span>${icon('map-pin')}${e(t.places?.join(' · ') || '地点待补充')}</span><span>${icon('images')}${photos.length} 张照片</span><span>${icon('receipt-text')}${totals.map(([c,v])=>e(formatMoney(v,c))).join(' + ') || '还没有消费记录'}</span><button class="btn ghost detail-edit" data-action="edit-trip" data-id="${e(t.id)}">${icon('pencil')}编辑旅行</button></div><nav class="detail-tabs" aria-label="旅行内容">${[['timeline','时间线'],['photos','照片'],['expenses','花费'],['selection','回忆选片']].map(([key,label])=>`<a class="detail-tab ${state.tab === key ? 'active' : ''}" href="#trip/${encodeURIComponent(t.id)}/${key}" ${state.tab === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>${tabHTML}`;
}
function renderTimeline(t, records) {
  const sorted = records.toSorted((a,b)=>(a.dateTime || a.date || '').localeCompare(b.dateTime || b.date || ''));
  const days = [...new Set(sorted.map(r=>r.date || '日期待补充'))];
  return days.length ? `<div class="timeline">${days.map((day,i)=>`<section class="timeline-day"><h2 class="day-label">${day === '日期待补充' ? day : day.slice(5).replace('-','月')+'日'}<small>CHAPTER ${String(i+1).padStart(2,'0')}</small></h2><div class="timeline-events">${sorted.filter(r=>r.date === day || !r.date && day === '日期待补充').map(r=>`<article class="timeline-item">${safeImage(r.image) ? `<img class="timeline-thumb" src="${e(r.image)}" alt="${e(r.title)}" loading="lazy">` : ''}<div class="timeline-main"><div class="time">${e(r.dateTime?.includes('T') ? r.dateTime.slice(11,16) : '仅有日期')}${r.dateSemantics === 'posting' ? ' · 入账日期' : ''}</div><h3>${e(r.title)}${r.kind === 'expense' ? ' · '+e(formatMoney(r.amountMinor,r.currency)) : ''}</h3><p>${e(r.place || '地点等你补充')}</p><div class="tags">${sourceTag(r)}<span class="tag ${['unconfirmed','none'].includes(r.locationStatus) ? 'warn' : ''}">${locationTag(r)}</span>${r.kind === 'ticket' && !r.confirmed ? '<span class="tag warn">是否实际出行待确认</span>' : ''}</div></div><div class="record-actions"><button class="btn ghost small" data-action="edit-record" data-id="${e(r.id)}">查看来源${icon('arrow-up-right')}</button></div></article>`).join('')}</div></section>`).join('')}</div>` : empty('时间线里还没有记录','导入更多资料，继续补全这次旅行。');
}
function renderPhotos(t, records) {
  const photos = records.filter(r=>r.kind === 'photo');
  return photos.length ? `<div class="photo-grid">${photos.map(photoCard).join('')}</div><p class="page-note">珍藏标记会优先用于回忆。这里保留的是本机预览副本，原始照片仍由你自己的相册保管。</p>` : empty('还没有照片','加入照片，让这次旅行有画面。');
}
function photoCard(r) {
  return `<article class="photo-item">${safeImage(r.image) ? `<img src="${e(r.image)}" alt="${e(r.title)}" loading="lazy">` : `<div class="empty-cover" style="height:180px">${icon('image-off')}</div>`}<div class="photo-info"><h3>${e(r.title)}</h3><p>${displayDate(r.date)} · ${e(r.place || '地点待补')}</p>${r.selectionReason ? `<p>${e(r.selectionReason)}</p>` : ''}<div class="photo-tools"><div class="inline-actions"><button class="icon-btn" data-action="favorite" data-id="${e(r.id)}" aria-label="${r.favorite ? '取消珍藏' : '珍藏'}${e(r.title)}" aria-pressed="${Boolean(r.favorite)}">${icon('heart')}</button><button class="icon-btn" data-action="edit-record" data-id="${e(r.id)}" aria-label="编辑${e(r.title)}">${icon('pencil')}</button></div><label><input type="checkbox" data-action="memory-include" data-id="${e(r.id)}" ${!r.excludeMemory ? 'checked' : ''}>用于回忆</label></div></div></article>`;
}
function renderExpenses(t, records) {
  const bills = records.filter(r=>r.kind === 'expense'), totals = sumsByCurrency(bills);
  if (!bills.length) return empty('花费这一页，等你补全','导入个人账本或账单，也可以先只收藏照片。');
  return `<div class="expense-totals">${totals.map(([c,v])=>`<div><strong>${e(formatMoney(v,c))}</strong><small>含退款净额</small></div>`).join('')}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>日期 / 商家</th><th>来源</th><th>地点</th><th class="amount">金额</th><th>操作</th></tr></thead><tbody>${bills.toSorted((a,b)=>a.date.localeCompare(b.date)).map(r=>`<tr><td>${e(r.title)}<small>${displayDate(r.date)}${r.dateSemantics === 'posting' ? ' · 入账日期' : ''}</small></td><td>${sourceTag(r)}</td><td>${e(r.place || '未定位')}<small>${locationTag(r)}</small></td><td class="amount">${e(formatMoney(r.amountMinor,r.currency))}${r.included === false ? '<small>已从统计中排除</small>' : ''}</td><td><button class="btn ghost small" data-action="edit-record" data-id="${e(r.id)}">核对</button></td></tr>`).join('')}</tbody></table></div><p class="page-note">不同币种分别保留原币金额，当前没有自动换汇。同一消费的不同来源需要人工确认是否重复。</p>`;
}
function renderSelection(t, records) {
  const photos = selectMemories(records), all = records.filter(r=>r.kind === 'photo');
  return `<div class="memory-banner"><div><div class="eyebrow">YOUR TRIP, YOUR EDIT</div><h2>${e(t.memoryTitle || t.title)}</h2><p>${photos.length} 张精选 · 约 ${photos.length*5} 秒 · 按时间串起不同日期与地点</p></div><div class="buttons"><button class="btn primary" data-action="play" data-id="${e(t.id)}">${icon('play')}播放回忆</button><button class="btn" data-action="export-memory" data-id="${e(t.id)}">${icon('download')}导出相册</button></div></div>${all.length ? `<div class="photo-grid">${all.map(r=>photoCard({...r,selectionReason:photos.find(p=>p.id===r.id)?.selectionReason || (r.excludeMemory ? '已从这段回忆中移除' : '保留在旅行中，可标记为珍藏')})).join('')}</div>` : '<p class="subtle">先加入照片，再开始制作回忆。</p>'}<p class="page-note">当前使用日期、地点、珍藏标记和文件去重选片；尚未接入图像语义理解。收据、车票与消费金额默认不进入回忆。</p>`;
}

function orientGeo(feature) {
  const copy = structuredClone(feature), g = copy.geometry;
  // D3 uses clockwise exterior rings; normalize every island independently.
  const orient = rings => rings.forEach((ring,index)=>{
    let area=0;for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];
    if(index===0 && area>0 || index>0 && area<0)ring.reverse();
  });
  if (g.type === 'Polygon') orient(g.coordinates);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(orient);
  return copy;
}
async function loadGeo() {
  const read = name => fetch(`assets/${name}.json`).then(r=>{if(!r.ok)throw new Error(name);return r.json();});
  const result = await Promise.allSettled([read('world'),read('china'),read('japan'),read('us'),read('country-codes')]);
  if (result[0].status === 'fulfilled') geo.world = topojson.feature(result[0].value,result[0].value.objects.countries).features.filter(f=>f.id !== '010');
  if (result[1].status === 'fulfilled') geo.mainland = result[1].value.features.filter(f=>!['710000','810000','820000','100000_JD'].includes(String(f.properties.adcode))).map(orientGeo);
  if (result[2].status === 'fulfilled') geo.japan = result[2].value.features.map(orientGeo);
  if (result[3].status === 'fulfilled') geo.usa = topojson.feature(result[3].value,result[3].value.objects.states).features;
  if (result[4].status === 'fulfilled') countryList = result[4].value.map(([iso2,code,num])=>({iso2,code,num}));
  if (state.view === 'map') drawMap();
}
function drawMap() {
  const container = document.getElementById('travel-map'); if (!container) return;
  const { width, height } = container.getBoundingClientRect(); if (!width) return;
  const region = state.region, trips = visibleTrips(), records = trips.flatMap(t=>tripRecords(t.id)), points = records.filter(r=>r.coords && (r.locationStatus === 'gps' || r.locationStatus === 'manual') && (!state.otherCountry || region !== 'other' || r.countryCode === state.otherCountry));
  let features = geo[region === 'other' ? 'world' : region];
  if (!features?.length) { container.innerHTML = `<div class="loading" style="min-height:160px;font-size:11px;color:#899c7c">地图正在载入，旅行记录可在列表中查看。</div>`; return; }
  if (region === 'other' && state.otherCountry) {
    const numeric = countryList.find(c=>c.code === state.otherCountry)?.num;
    const filtered = geo.world.filter(f=>String(f.id).padStart(3,'0') === numeric); if (filtered.length) features = filtered;
  }
  const collection = {type:'FeatureCollection',features};
  const focus = region === 'japan' ? {type:'FeatureCollection',features:features.map(f=>f.geometry.type==='MultiPolygon'?{...f,geometry:{type:'Polygon',coordinates:f.geometry.coordinates.toSorted((a,b)=>d3.geoArea({type:'Polygon',coordinates:b})-d3.geoArea({type:'Polygon',coordinates:a}))[0]}}:f)} : collection;
  const projection = region === 'world' || region === 'other' && !state.otherCountry ? d3.geoNaturalEarth1().fitExtent([[15,16],[width-15,height-10]],collection) : region === 'usa' ? d3.geoAlbersUsa().fitExtent([[18,15],[width-18,height-12]],collection) : d3.geoMercator().fitExtent([[30,15],[width-30,height-15]],focus);
  const path = d3.geoPath(projection);
  container.replaceChildren(); mapSvg = d3.select(container).append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label',`${REGION_LABELS[region]}地图，${points.length}条已定位照片或记录；可通过下方旅行列表访问所有内容`);
  const g = mapSvg.append('g');
  if (region === 'world' || region === 'other' && !state.otherCountry) g.append('path').datum(d3.geoGraticule10()).attr('d',path).attr('class','map-graticule');
  g.selectAll('.map-land').data(features).join('path').attr('d',path).attr('class',f=>'map-land'+(points.some(r=>d3.geoContains(f,r.coords)) ? ' visited' : '')).append('title').text(f=>f.properties.nam_ja || f.properties.name || '地区');
  const grouped = new Map();
  for (const r of points) {const t=trips.find(t=>t.id===r.tripId); if (!t) continue; const key = region === 'world' || region === 'other' && !state.otherCountry ? r.countryCode : r.tripId; if(!grouped.has(key))grouped.set(key,{r,t});}
  for (const {r,t} of grouped.values()) {
    const pos = projection(r.coords); if(!pos || !pos.every(Number.isFinite))continue;
    const label = region === 'world' || region === 'other' && !state.otherCountry ? countryName(r.countryCode) : t.places?.[0] || r.place || '旅行';
    const a = g.append('a').attr('href',`#trip/${encodeURIComponent(t.id)}`).attr('aria-label',`查看${t.title}`);
    a.append('circle').attr('cx',pos[0]).attr('cy',pos[1]).attr('r',5.5).attr('class','map-dot');
    const japanGlobal = r.countryCode === 'JPN' && (region === 'world' || region === 'other');
    const x = pos[0] + (japanGlobal ? 10 : -9), y = pos[1] + (r.countryCode === 'THA' ? 23 : -11);
    a.append('text').attr('x',Math.max(35,Math.min(width-35,x))).attr('y',Math.max(17,Math.min(height-6,y))).attr('text-anchor',japanGlobal ? 'start' : 'middle').attr('class','map-point-text').text(label);
    a.append('title').text(`${t.title} · ${r.place}`);
  }
  mapZoom = d3.zoom().scaleExtent([1,5]).translateExtent([[0,0],[width,height]]).on('zoom', event => g.attr('transform',event.transform));
  mapSvg.call(mapZoom).on('dblclick.zoom',null);
}
const mapObserver = new ResizeObserver(() => { if (state.view === 'map') drawMap(); });
mapObserver.observe(app);

function countryOptions(selected = '') {
  const list = countryList.length ? countryList.toSorted((a,b)=>countryName(a.code).localeCompare(countryName(b.code),'zh-CN')) : ['CHN','JPN','USA','THA','GBR','FRA','HKG','TWN','MAC'].map(code=>({code}));
  return `<option value="">尚未确定</option>${list.map(c=>`<option value="${e(c.code)}" ${selected===c.code ? 'selected' : ''}>${e(countryName(c.code))}</option>`).join('')}`;
}
function renderImportPage() {
  const source = SOURCES[state.source];
  return heading('EVERY LITTLE TRACE COUNTS','把散落的旅行，找回来。','选择资料，预览核对，再收进一次旅行。') + `<div class="import-layout"><nav class="source-list" aria-label="导入来源">${Object.entries(SOURCES).map(([key,s])=>`<button class="source-btn ${state.source===key?'active':''}" data-action="source" data-value="${key}" aria-pressed="${state.source===key}">${icon(s.icon)}${s.label}</button>`).join('')}</nav><section class="import-content"><div class="import-step">${state.pending.length ? '02 / 核对与归档' : '01 / 选择来源'}</div><h2>${e(source.label)}</h2><p class="source-note">${e(source.note)}</p>${state.busy ? `<div class="import-progress" role="status"><span class="busy-indicator"></span>${e(state.importMessage || '正在本机解析资料…')}</div>` : ''}${state.importError ? `<div class="form-error" role="alert">${e(state.importError)}</div>` : ''}${state.doc ? renderDocumentImport() : state.pending.length || state.billRows ? renderImportPreview() : `<div class="dropzone" id="dropzone">${icon(source.icon)}<h3>把旅行资料拖到这里</h3><p>${e(source.formats)} · 照片每批最多 250 张</p><button class="btn primary" id="pick-files" ${state.busy ? 'disabled' : ''}>${icon('folder-open')}选择本机文件</button><input type="file" id="file-input" accept="${source.accept}" ${state.source==='photo' ? 'multiple' : ''} hidden></div><div class="import-local">${icon('shield-check')}文件在浏览器本地解析，资料不会上传到服务器</div><div class="import-links">${['ledger','wechat','alipay','card'].includes(state.source) ? '<button class="btn ghost" data-action="sample-csv">下载示例账单</button>' : ''}${state.source === 'ticket' ? '<button class="btn ghost" data-action="manual-ticket">手动录入一张票据</button>' : ''}<button class="btn ghost" data-action="demo-flow">${icon('sparkles')}先体验一份示例归档</button></div><div class="import-tip">${icon('lightbulb')}<span>${state.source==='photo' ? '建议导出「未修改的原片」。转发或截图可能丢失原始拍摄时间与 GPS；没有定位的照片仍可手动加入旅行。导入后只在本机保存压缩预览，原片仍由你保管。' : state.source==='card' ? '账单上的商家地址不等于你当时的位置。只有明确定位或你手动确认的地点，才会点亮足迹地图。' : '第一次导入时可以调整字段对应关系。文件里没有的地点、币种或时间精度，会保留为待补充信息。'}</span></div>`}</section></div><div class="archive-bottom">${icon('lock-keyhole')}你决定，哪些片段值得留下。</div>`;
}

const mappingLabels = {date:'日期 / 时间 *',title:'商家 / 说明 *',amount:'金额 *',currency:'币种',direction:'收 / 支',externalId:'交易单号',place:'地点',status:'交易状态',category:'分类'};
const aliases = {date:['交易时间','交易创建时间','付款时间','交易日期','消费日期','入账日期','记账日期','日期','transactiondate','posteddate','date','time'],title:['交易对方','商家名称','商家','交易描述','摘要','商品名称','商品','备注','description','merchant','payee','title'],amount:['金额(元)','金额（元）','交易金额','消费金额','支出金额','金额','amount','debit'],currency:['币种','货币','原币币种','currency'],direction:['收/支','收支','收支类型','方向','direction'],externalId:['交易单号','交易号','订单号','transactionid','id'],place:['地点','位置','城市','地址','location','place'],status:['当前状态','交易状态','状态','status'],category:['分类','类别','交易类型','category']};
const headerKey = v => String(v || '').trim().toLowerCase().replace(/[\s_\-/()（）]/g,'');
function guessMapping(headers) {
  const mapping = {};
  for (const [key, values] of Object.entries(aliases)) {
    const index = values.map(value=>headers.findIndex(h=>headerKey(h)===headerKey(value))).find(i=>i>=0);
    mapping[key] = index === undefined ? '' : String(index);
  }
  return mapping;
}
function mappingHTML() {
  return `<div class="mapping-box"><h3>确认列的对应关系</h3><div class="field-grid cols3">${Object.entries(mappingLabels).map(([key,label])=>`<label class="field">${label}<select data-map-field="${key}"><option value="">${['date','title','amount'].includes(key) ? '请选择一列' : '文件中没有'}</option>${state.billHeaders.map((h,i)=>`<option value="${i}" ${String(state.mapping[key])===String(i) ? 'selected' : ''}>${e(h || '未命名列 '+(i+1))}</option>`).join('')}</select></label>`).join('')}<label class="field">没有币种列时使用<select id="default-currency">${['CNY','JPY','USD','EUR','GBP','HKD','TWD','THB','KRW','CAD','AUD','SGD'].map(c=>`<option ${state.defaultCurrency===c?'selected':''}>${c}</option>`).join('')}</select></label></div></div>`;
}
function rebuildBills() {
  state.pending = []; let ignored=0, errors=0, exact=0, possible=0;
  const baseline = archive.records.filter(r=>!r.deletedAt);
  for (const row of state.billRows) {
    if (row.every(x=>!String(x??'').trim())) continue;
    const record = normaliseExpense(row,state.mapping,state.source,state.defaultCurrency);
    if (record.skip) { ignored++; continue; }
    if (record.error) {errors++; continue;}
    const dateHeader = state.billHeaders[Number(state.mapping.date)] || '';
    record.dateSemantics = /入账|记账|posted/i.test(dateHeader) ? 'posting' : 'transaction';
    record.originalName = state.files[0]?.name || '';
    const duplicate = duplicateStatus(record,[...baseline,...state.pending]);
    if (duplicate === 'exact') {exact++;continue;}
    if (duplicate === 'possible') {record.possibleDuplicate=true;record.included=false;possible++;}
    state.pending.push(record);
  }
  state.importStats={ignored,errors,exact,possible};
}
function renderImportPreview() {
  const rows=state.pending, stats=state.importStats || {}, groups=suggestGroups(rows);
  return `${state.billRows ? mappingHTML() : ''}<div class="preview-result"><span>${rows.length} 条可核对记录</span>${stats.exact ? `<span>${stats.exact} 条完全重复，已跳过</span>` : ''}${stats.possible ? `<span>${stats.possible} 条疑似重复，默认不选</span>` : ''}${stats.ignored ? `<span>${stats.ignored} 条转账 / 未完成交易等已排除</span>` : ''}${stats.errors ? `<span>${stats.errors} 行无法解析，请核对表头与格式</span>` : ''}</div>${rows.length ? `<div class="preview-table table-wrap"><table class="data-table"><thead><tr><th>加入</th><th>日期 / 内容</th><th>金额 / 地点</th><th>核对事项</th></tr></thead><tbody>${rows.slice(0,250).map(r=>`<tr><td><input type="checkbox" data-pending-id="${e(r.id)}" aria-label="加入${e(r.title)}" ${r.included !== false?'checked':''}></td><td>${e(r.title)}<small>${r.date ? displayDate(r.date) : '拍摄日期缺失'}${r.dateSemantics==='posting'?' · 入账日期':''}</small></td><td>${r.kind==='expense'?e(formatMoney(r.amountMinor,r.currency)):e(r.place || '地点未确定')}<small>${r.coords ? '已有 GPS 坐标' : '没有精确定位'}</small></td><td>${r.possibleDuplicate ? '<span class="tag warn">疑似重复，请核对</span>' : r.refundReview ? '<span class="tag warn">退款金额需核对，默认不计入</span>' : !r.date ? '<span class="tag warn">需补日期</span>' : '<span class="tag">待确认归档</span>'}</td></tr>`).join('')}</tbody></table></div>${rows.length>250 ? `<p class="subtle">预览前 250 条，确认后将归档所有勾选记录（共 ${rows.length} 条）。</p>` : ''}<form id="archive-form"><div class="field-grid"><label class="field full">收进哪次旅行？<select name="target" id="target-trip"><option value="new">新建一次旅行</option>${archive.trips.filter(t=>!t.deletedAt).map(t=>`<option value="${e(t.id)}">${e(t.title)} · ${t.start}</option>`).join('')}</select></label>${groups.length>1 ? `<label class="field full">检测到 ${groups.length} 个时间段，可分批归档<select id="import-group"><option value="all">保留全部勾选记录，稍后自行拆分</option>${groups.map((g,i)=>`<option value="${i}">${g.start} — ${g.end} · ${g.records.length} 条</option>`).join('')}</select><small>相邻资料间隔超过 3 天时提出分组，仅作建议。</small></label>` : ''}<label class="field full">新旅行名称<input name="title" placeholder="例如：京都与大阪的七天" value="${e(state.source==='photo' ? '从照片找回的旅行' : '从账单找回的旅行')}" maxlength="100"></label><label class="field">补充国家 / 地区<select name="country">${countryOptions()}</select><small>只用于没有国家信息的记录，不覆盖照片 GPS。</small></label><label class="field">旅行地点<input name="place" placeholder="例如：京都 · 大阪" maxlength="150"><small>手填地名不代表精确坐标。</small></label>${rows.some(r=>!r.date) ? '<label class="field full">没有拍摄日期的照片，使用此日期<input type="date" name="fallbackDate"><small>不会把文件修改时间当作拍摄时间。</small></label>' : ''}<label class="check-label full"><input type="checkbox" name="confirmed" required>我已核对选中记录、旅行归属与疑似重复项。</label></div><div id="archive-error" class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="btn" data-action="reset-import">重新选择</button><button class="btn primary" type="submit">${icon('check')}确认加入我的档案</button></div></form>` : `<p class="page-note">还没有可归档记录。请检查日期、金额列，或重新选择文件。</p><div class="form-actions"><button class="btn" data-action="reset-import">重新选择文件</button></div>`}`;
}

function renderDocumentImport() {
  const doc=state.doc, isTicket=state.source==='ticket';
  return `<p class="file-label">${e(doc.name || '手动录入')}</p>${doc.image ? `<div class="upload-preview"><img src="${e(doc.image)}" alt="待核对票据预览"></div>` : ''}${doc.image && !state.busy ? `<button class="btn" data-action="ocr">${icon('scan-text')}在本机识别票面文字</button><p class="page-note">首次下载中英文识别模型，可能较慢；图片不上传。无法识别时可直接填写下方表单。</p>` : ''}${doc.text ? `<pre class="source-preview-text">${e(doc.text.slice(0,18000))}</pre>` : ''}<div class="info-box">${isTicket ? '核对票面日期、起终点和是否实际乘坐。保存后进入时间线，不会自动点亮足迹。' : '此 PDF 的版式需要核对。请从上方提取的文字逐笔填写，也可改用 CSV / Excel 导出文件。'}</div><form id="document-form"><div class="field-grid"><label class="field full">${isTicket?'票据名称 / 线路':'消费商家 / 说明'}<input name="title" required value="${e(doc.suggestedTitle || '')}" placeholder="${isTicket?'例如：上海虹桥 → 杭州东':'例如：京都咖啡店'}" maxlength="200"></label><label class="field">${isTicket?'票面出行日期':'账单日期'}<input type="date" name="date" required value="${e(doc.suggestedDate || '')}"></label><label class="field">地点文字<input name="place" maxlength="150" placeholder="需由你核对确认"></label>${!isTicket ? `<label class="field">支出金额（退款填负数）<input type="number" step="any" name="amount" required></label><label class="field">币种<select name="currency">${['CNY','JPY','USD','EUR','GBP','HKD','TWD','THB'].map(c=>`<option>${c}</option>`).join('')}</select></label>` : '<label class="check-label full"><input type="checkbox" name="travelled">我已确认这张票实际乘坐 / 使用</label>'}<label class="field full">补充说明<textarea name="caption" maxlength="500" placeholder="记录这张票据背后的旅行片段"></textarea></label></div><div id="document-error" class="form-error" role="alert"></div><div class="form-actions"><button class="btn" type="button" data-action="reset-import">重新选择</button><button class="btn primary" type="submit">${icon('check')}加入待归档记录</button></div></form>`;
}

function renderSettingsPage() {
  const trash=data().records.filter(r=>r.deletedAt);
  return heading('A HOME FOR YOUR LITTLE WORLD','让回忆，握在自己手里。','当前版本把档案保存在这个浏览器。更换设备前，请先导出备份。') + `<div class="backup-layout"><section class="settings-panel"><h2>我的档案与备份</h2><p>备份包含旅行、记录与照片预览，不含原始照片文件。重新导入时合并已有内容，不覆盖现有记录。</p><div class="inline-actions"><button class="btn primary" data-action="backup">${icon('download')}导出我的档案</button><button class="btn" data-action="restore">${icon('folder-up')}恢复备份</button><input type="file" id="restore-input" accept=".json" hidden></div><p class="page-note">我的本机档案：${archive.trips.filter(t=>!t.deletedAt).length} 次旅行 · ${archive.records.filter(r=>!r.deletedAt).length} 条记录。示例档案单独展示。</p></section><section class="settings-panel"><h2>资料怎样被使用</h2><ul class="privacy-list"><li>${icon('shield-check')}照片、账单与 OCR 识别在浏览器中处理，当前版本没有上传接口。</li><li>${icon('hard-drive')}浏览器清理、隐私模式或空间不足可能影响本机保存；请保留备份和原始文件。</li><li>${icon('eye-off')}不请求 iCloud、微信、支付宝或银行的密码；地理编码不发送照片坐标。</li><li>${icon('clapperboard')}导出回忆时默认去掉精确地点、消费和票据。</li></ul></section><section class="settings-panel"><h2>地点与时间的依据</h2><p>照片 GPS 只说明照片携带的位置；票据是计划线索，账单是消费线索。商家地址和本人位置不等同。当前只把照片 GPS 或手动核对坐标画到地图。</p><p>没有时区的时间保留为原始当地时间，不擅自跨时区换算；入账日期单独标记。地图范围只是视角，同一次旅行可以包含多个国家。</p></section><section class="settings-panel"><h2>网页现在能做什么</h2><p>地图切换、照片元数据读取、CSV / Excel 账单预览、PDF 文字提取、可选图片 OCR、确认归档、编辑与回忆相册导出。</p><p>iCloud 相册直接读取、银行自动同步、图像语义选片、配乐视频渲染与跨设备云同步属于后续版本。iPhone 版可沿用当前档案模型，新增系统相册授权。</p></section></div><div class="section-head"><h2 class="section-title">最近移除<small>可以恢复</small></h2></div>${trash.length ? `<div class="trash-list">${trash.map(r=>`<div class="trash-item"><span>${e(r.title)}<small class="subtle"> · ${displayDate(r.date)}</small></span><button class="btn small" data-action="undelete" data-id="${e(r.id)}">恢复记录</button></div>`).join('')}</div>` : '<p class="subtle">这里还没有移除的记录。</p>'}<div class="section-head"><h2 class="section-title">来源与说明</h2></div><p class="page-note">世界地图：<a href="https://github.com/topojson/world-atlas" target="_blank" rel="noreferrer">Natural Earth / world-atlas</a>；美国州界：<a href="https://github.com/topojson/us-atlas" target="_blank" rel="noreferrer">U.S. Census / us-atlas</a>；日本都道府县：<a href="https://github.com/dataofjapan/land" target="_blank" rel="noreferrer">dataofjapan</a>；大陆省界：<a href="https://datav.aliyun.com/portal/school/atlas/area_selector" target="_blank" rel="noreferrer">DataV</a>。边界为旅行展示参考。</p><p class="page-note">示例旅行为虚构资料；配图来自 Unsplash：京都、伏见稻荷、<a href="https://unsplash.com/photos/yiEXZCGy63M" target="_blank" rel="noreferrer">Andrea De Santis（岚山）</a>、<a href="https://unsplash.com/photos/pBg2i0aUOec" target="_blank" rel="noreferrer">Zhimai Zhang（桂林）</a>及优胜美地、曼谷。示例日期、账单与照片无真实关联。</p>`;
}

function resetImport() {state.pending=[];state.billRows=null;state.billHeaders=[];state.mapping={};state.files=[];state.doc=null;state.importStats={};state.importError='';state.importMessage='';}
function bindImport() {
  document.getElementById('pick-files')?.addEventListener('click',()=>document.getElementById('file-input').click());
  document.getElementById('file-input')?.addEventListener('change',event=>readFiles([...event.target.files]));
  const drop=document.getElementById('dropzone');
  if(drop){drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('drag');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));drop.addEventListener('drop',event=>{event.preventDefault();readFiles([...event.dataTransfer.files]);});}
  document.getElementById('archive-form')?.addEventListener('submit',commitImport);
  document.getElementById('document-form')?.addEventListener('submit',documentToPending);
}

async function digest(file) { const buffer = await crypto.subtle.digest('SHA-256',await file.arrayBuffer()); return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function thumbnail(file) {
  const url=URL.createObjectURL(file);
  try {
    const img=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('浏览器无法预览这张照片'));img.src=url;});
    const canvas=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);
  } finally { URL.revokeObjectURL(url); }
}
function identifyLocation(coords) {
  const f=geo.world?.find(f=>d3.geoContains(f,coords));
  if(!f)return {};
  const code=countryList.find(c=>c.num===String(f.id).padStart(3,'0'))?.code || ({156:'CHN',392:'JPN',840:'USA',764:'THA'}[Number(f.id)] || '');
  const region=regionForCountry(code), sub=geo[region]?.find?.(f=>d3.geoContains(f,coords));
  return {countryCode:code,region,place:countryName(code),subregion:sub?.properties.nam_ja || sub?.properties.name || ''};
}
async function readFiles(files) {
  if(state.busy || !files.length)return;
  state.busy=true;state.importError='';state.importMessage='正在本机解析资料…';state.files=files;render();
  try {
    if(state.source==='photo') {
      if(files.length>250)throw new Error('每批最多导入 250 张照片，请分批选择。');
      const records=[];let exact=0;
      for(let i=0;i<files.length;i++) {
        const file=files[i];
        if(!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))throw new Error('请选择原始照片文件，暂不支持视频或文件夹。');
        if(file.size>45*1024*1024)throw new Error(`${file.name} 超过 45 MB，请先导出较小的照片。`);
        const fileHash=await digest(file);
        if([...archive.records,...records].some(r=>!r.deletedAt && r.fileHash===fileHash)){exact++;continue;}
        let meta={};try{meta=await exifr.parse(file,{reviveValues:false}) || {};}catch{}
        let image='';try{image=await thumbnail(file);}catch{}
        const original=meta.DateTimeOriginal || meta.CreateDate;
        let date='',dateTime='';
        if(original instanceof Date && Number.isFinite(original.getTime())) {date=`${original.getFullYear()}-${String(original.getMonth()+1).padStart(2,'0')}-${String(original.getDate()).padStart(2,'0')}`;dateTime=`${date}T${String(original.getHours()).padStart(2,'0')}:${String(original.getMinutes()).padStart(2,'0')}:${String(original.getSeconds()).padStart(2,'0')}`;}
        else {const parsed=parseDate(original);if(parsed){date=parsed.date;dateTime=parsed.dateTime;}}
        const offset=String(meta.OffsetTimeOriginal || '');if(dateTime && /^[+-]\d{2}:\d{2}$/.test(offset))dateTime+=offset;
        const coords=Number.isFinite(meta.longitude) && Number.isFinite(meta.latitude) ? [meta.longitude,meta.latitude] : null;
        records.push({id:uid(),kind:'photo',source:'photo',title:file.name.replace(/\.[^.]+$/,''),date,dateTime,zoneKnown:Boolean(offset),timeStatus:date?'metadata':'missing',coords,...(coords?identifyLocation(coords):{}),locationStatus:coords?'gps':'none',image,fileHash,originalName:file.name,caption:'',included:true});
        state.importMessage=`正在读取照片 ${i+1} / ${files.length}`;
      }
      state.pending=records;state.importStats={exact};
      if(!records.length)state.importError=exact ? '所选照片已全部存在于你的档案中。' : '没有找到可导入的照片。';
    } else {
      if(files.length!==1)throw new Error('账单和票据请一次选择一个文件。');
      const file=files[0];if(file.size>35*1024*1024)throw new Error('文件超过 35 MB，请缩小日期范围或分批导出。');
      if(state.source==='ticket' || /\.pdf$/i.test(file.name)) {
        let text='',image='';
        if(/\.pdf$/i.test(file.name)) {
          const pdfjs=await import('./assets/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/pdf.worker.min.mjs',import.meta.url).href;
          const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
          if(pdf.numPages>100)throw new Error('PDF 页数超过 100 页，请先拆分文件。');
          for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();text+=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('')+'\n';}
          await pdf.destroy();
          if(!text.trim())state.importError='这份 PDF 没有可提取的文字。可手动填写，或导出页面图片后在票据入口使用 OCR。';
        } else {image=await thumbnail(file);}
        state.doc={name:file.name,text,image,file,kind:state.source==='ticket'?'ticket':'expense',suggestedDate:parseDate(text.match(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/)?.[0])?.date || ''};
      } else {
        let rows;
        if(/\.xlsx?$/i.test(file.name)) {const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,raw:true,defval:''});}
        else if(/\.(csv|tsv)$/i.test(file.name)) {const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('\ufffd'))text=new TextDecoder('gb18030').decode(buffer);rows=Papa.parse(text,{skipEmptyLines:'greedy'}).data;}
        else throw new Error('请选择 CSV、Excel 或 PDF 文件；压缩包请先在本机解压。');
        if(rows.length>30000)throw new Error('这份账单超过 30,000 行，请缩小导出范围。');
        const header=rows.slice(0,100).findIndex(row=>{const m=guessMapping(row);return m.date!=='' && m.amount!=='';});
        if(header<0)throw new Error('没有识别到日期和金额表头。请下载示例账单查看格式，或将列名改为「日期、商家、金额、币种」。');
        state.billHeaders=rows[header].map(h=>String(h).trim());state.billRows=rows.slice(header+1);state.mapping=guessMapping(state.billHeaders);rebuildBills();
      }
    }
  } catch(error) {state.importError=error.message || '解析失败，请检查文件格式。';}
  finally {state.busy=false;render();}
}

function documentToPending(event) {
  event.preventDefault();const f=new FormData(event.target),isTicket=state.source==='ticket',date=parseDate(f.get('date'));
  if(!date)return;
  const record={id:uid(),kind:isTicket?'ticket':'expense',source:state.source,...date,title:String(f.get('title')).trim(),place:String(f.get('place') || '').trim(),caption:String(f.get('caption') || ''),confirmed:f.get('travelled')==='on',locationStatus:isTicket?'ticket':'unconfirmed',originalName:state.doc.name || '',image:isTicket?state.doc.image || '':'',extractedText:isTicket?(state.doc.text || '').slice(0,20000):'',included:true};
  if(!isTicket){const bill=normaliseExpense([date.date,record.title,f.get('amount'),f.get('currency')],{date:'0',title:'1',amount:'2',currency:'3'},state.source);if(bill.error){document.getElementById('document-error').textContent=bill.error;return;}record.currency=bill.currency;record.amountMinor=bill.amountMinor;record.dateSemantics='unconfirmed';}
  state.pending=[...state.pending,record];state.doc=null;render();
}
async function commitImport(event) {
  event.preventDefault();const form=event.target, f=new FormData(form), error=document.getElementById('archive-error');
  const records=state.pending.filter(r=>r.included!==false).map(r=>({...r}));
  if(!records.length){error.textContent='请至少选择一条记录。';return;}
  const fallback=parseDate(f.get('fallbackDate'));
  if(records.some(r=>!r.date) && !fallback){error.textContent='请为缺少拍摄时间的照片补充日期，或先取消勾选。';return;}
  for(const r of records){if(!r.date){r.date=fallback.date;r.dateTime=fallback.date;r.timeStatus='manual';}if(!r.countryCode && f.get('country')){r.countryCode=f.get('country');r.region=regionForCountry(r.countryCode);}if(!r.place && f.get('place'))r.place=String(f.get('place')).trim();}
  const dates=records.map(r=>r.date).sort(), target=f.get('target'), existing=archive.trips.find(t=>t.id===target), title=String(f.get('title')||'').trim();
  if(target==='new' && !title){error.textContent='请给这次旅行起一个名字。';return;}
  const trip=existing ? {...existing} : {id:uid(),title,start:dates[0],end:dates.at(-1),places:[],countryCodes:[],regions:[]};
  trip.start=[trip.start,...dates].filter(Boolean).sort()[0];trip.end=[trip.end,...dates].filter(Boolean).sort().at(-1);
  trip.countryCodes=[...new Set([...(trip.countryCodes||[]),...records.map(r=>r.countryCode).filter(Boolean)])];trip.regions=[...new Set(trip.countryCodes.map(regionForCountry))];
  trip.places=[...new Set([...(trip.places||[]),...String(f.get('place')||'').split(/[·、,，]/).map(s=>s.trim()).filter(Boolean),...records.map(r=>r.place).filter(Boolean)])].slice(0,12);
  records.forEach(r=>{r.tripId=trip.id;delete r.included;});
  const oldArchive=archive,oldMode=state.mode;
  archive={...archive,trips:existing?archive.trips.map(t=>t.id===trip.id?trip:t):[...archive.trips,trip],records:[...archive.records,...records]};state.mode='mine';
  const button=form.querySelector('[type="submit"]');button.disabled=true;
  try {await persist();localStorage.setItem('shitu-mode','mine');resetImport();go(`trip/${encodeURIComponent(trip.id)}`);toast(`已把 ${records.length} 条资料收进「${trip.title}」`);}
  catch(err){archive=oldArchive;state.mode=oldMode;button.disabled=false;error.textContent=err.message || '本机存储失败，请先导出备份。';}
}

function showModal(content, options = {}) {
  closeModal();lastFocus=document.activeElement;
  modalRoot.innerHTML=`<div class="modal-backdrop" data-backdrop><div class="${options.player?'memory-player':'modal'+(options.wide?' wide':'')}" role="dialog" aria-modal="true" aria-label="${e(options.label || '编辑旅行记录')}">${content}</div></div>`;
  document.body.style.overflow='hidden';uiIcons();
  requestAnimationFrame(()=>modalRoot.querySelector('input,select,textarea,button,a[href]')?.focus());
}
function closeModal() {
  modalCleanup?.();modalCleanup=null;
  if(!modalRoot.firstChild)return;
  modalRoot.replaceChildren();document.body.style.overflow='';lastFocus?.isConnected && lastFocus.focus();
}
const modalHead = title => `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('x')}</button></div>`;
function editTrip(id) {
  const t=data().trips.find(t=>t.id===id);if(!t)return;
  showModal(modalHead('编辑这次旅行')+`<form id="edit-trip-form"><div class="field-grid"><label class="field full">旅行名称<input name="title" value="${e(t.title)}" maxlength="100" required></label><label class="field full">一句旅行记忆<input name="subtitle" value="${e(t.subtitle || '')}" maxlength="200"></label><label class="field">开始日期<input type="date" name="start" value="${e(t.start)}" required></label><label class="field">结束日期<input type="date" name="end" value="${e(t.end)}" required></label><label class="field full">城市 / 地点（用顿号分隔）<input name="places" value="${e((t.places || []).join('、'))}" maxlength="250"></label><label class="field full">回忆相册标题<input name="memoryTitle" value="${e(t.memoryTitle || t.title)}" maxlength="100"></label></div><p class="page-note">这次旅行包含的记录可以跨越多个国家，地图模式会引用同一份旅行档案。</p><div class="form-error" id="edit-trip-error" role="alert"></div><div class="form-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="submit">保存旅行</button></div></form>`,{label:'编辑这次旅行'});
  document.getElementById('edit-trip-form').addEventListener('submit',async event=>{
    event.preventDefault();const f=new FormData(event.target),error=document.getElementById('edit-trip-error');
    if(!String(f.get('title')).trim()){error.textContent='请填写旅行名称。';return;}
    if(f.get('start')>f.get('end')){error.textContent='结束日期需要在开始日期之后。';return;}
    const records=tripRecords(t.id);if(records.some(r=>r.date && (r.date<f.get('start') || r.date>f.get('end')))){error.textContent='有记录落在这个日期范围之外，请先调整记录或扩大日期范围。';return;}
    const old={...t};Object.assign(t,{title:String(f.get('title')).trim(),subtitle:String(f.get('subtitle')),start:String(f.get('start')),end:String(f.get('end')),memoryTitle:String(f.get('memoryTitle')).trim(),places:String(f.get('places')).split(/[、,，·]/).map(s=>s.trim()).filter(Boolean)});
    try{await persist();closeModal();render();toast('旅行档案已更新');}catch(err){Object.assign(t,old);error.textContent=err.message;}
  });
}

function editRecord(id) {
  const r=data().records.find(r=>r.id===id && !r.deletedAt);if(!r)return;
  showModal(modalHead(r.kind==='photo'?'留住这一刻':'核对这条记录')+`${safeImage(r.image)?`<img class="record-image" src="${e(r.image)}" alt="${e(r.title)}">`:''}<form id="edit-record-form"><div class="field-grid"><label class="field full">标题 / 说明<input name="title" value="${e(r.title)}" maxlength="200" required></label><label class="field">日期<input type="date" name="date" value="${e(r.date || '')}" required></label><label class="field">地点文字<input name="place" value="${e(r.place || '')}" maxlength="150"></label>${r.kind==='expense' ? `<label class="field">金额（退款使用负数）<input name="amount" type="number" step="any" value="${r.amountMinor / 10**({JPY:0,KRW:0,VND:0,KWD:3,BHD:3,OMR:3}[r.currency]??2)}" required></label><label class="field">币种<input name="currency" value="${e(r.currency)}" pattern="[A-Za-z]{3}" required maxlength="3"></label><label class="check-label full"><input name="included" type="checkbox" ${r.included!==false?'checked':''}>计入这次旅行的花费</label>` : ''}<label class="field">经度（可选）<input name="lng" type="number" step="any" min="-180" max="180" value="${e(r.coords?.[0] ?? '')}" placeholder="如 135.7796"></label><label class="field">纬度（可选）<input name="lat" type="number" step="any" min="-90" max="90" value="${e(r.coords?.[1] ?? '')}" placeholder="如 34.9985"></label><label class="field full">这张照片 / 记录的文字<textarea name="caption" maxlength="500">${e(r.caption || '')}</textarea></label>${r.kind==='ticket'?`<label class="check-label full"><input name="confirmed" type="checkbox" ${r.confirmed?'checked':''}>我确认实际乘坐 / 使用了这张票</label>`:''}</div><div class="source-details"><strong>资料来源</strong><br>${e(SOURCES[r.source]?.label || r.source)}${r.originalName?' · '+e(r.originalName):''}<br>地点依据：${locationTag(r)}${r.dateSemantics==='posting'?'；此日期是入账日期':''}${!r.zoneKnown?'<br>没有明确时区；保留原始当地日期与时间。':''}${r.demo?'<br>这是示例记录，日期与来源用于演示。':''}</div><p class="page-note">修改坐标会标记为手动确认，保留原始坐标以供追溯。只填地点文字不会生成精确足迹。</p><div class="form-error" id="edit-record-error" role="alert"></div><div class="form-actions"><button class="btn ghost" type="button" data-action="remove-record" data-id="${e(r.id)}">${icon('archive-x')}移入最近移除</button><button class="btn primary" type="submit">保存记录</button></div></form>`,{label:'核对旅行记录'});
  document.getElementById('edit-record-form').addEventListener('submit',async event=>{
    event.preventDefault();const f=new FormData(event.target),error=document.getElementById('edit-record-error'),old=structuredClone(r),date=String(f.get('date'));
    if(!String(f.get('title')).trim()){error.textContent='请填写标题。';return;}
    const lng=String(f.get('lng')).trim(),lat=String(f.get('lat')).trim();
    if(Boolean(lng)!==Boolean(lat)){error.textContent='经度和纬度需要同时填写，或同时留空。';return;}
    const update={title:String(f.get('title')).trim(),date,place:String(f.get('place')).trim(),caption:String(f.get('caption')),confirmed:f.get('confirmed')==='on'};
    if(r.kind==='expense'){
      const bill=normaliseExpense([date,update.title,f.get('amount'),String(f.get('currency')).toUpperCase()],{date:'0',title:'1',amount:'2',currency:'3'},r.source);
      if(bill.error||bill.skip){error.textContent=bill.error||'资金转移请从花费统计中排除。';return;}
      Object.assign(update,{amountMinor:bill.amountMinor,currency:bill.currency,included:f.get('included')==='on'});
    }
    if(r.date!==date){update.originalDate=r.originalDate||r.date;update.dateTime=date;update.timeStatus='manual';}
    if(lng && lat){const coords=[Number(lng),Number(lat)];if(!r.coords || coords.some((v,i)=>v!==r.coords[i]))Object.assign(update,{originalCoords:r.originalCoords||r.coords||null,coords,locationStatus:'manual',...identifyLocation(coords),place:update.place || identifyLocation(coords).place || ''});}
    else if(r.coords){Object.assign(update,{originalCoords:r.originalCoords||r.coords,coords:null,locationStatus:'none'});}
    Object.assign(r,update);
    const trip=data().trips.find(t=>t.id===r.tripId),oldTrip=trip?structuredClone(trip):null;
    if(trip){const all=tripRecords(trip.id);trip.start=[trip.start,...all.map(r=>r.date)].filter(Boolean).sort()[0];trip.end=[trip.end,...all.map(r=>r.date)].filter(Boolean).sort().at(-1);trip.countryCodes=[...new Set(all.map(r=>r.countryCode).filter(Boolean))];trip.regions=[...new Set(trip.countryCodes.map(regionForCountry))];}
    try{await persist();closeModal();render();toast('记录已更新');}catch(err){Object.keys(r).forEach(k=>delete r[k]);Object.assign(r,old);if(trip)Object.assign(trip,oldTrip);error.textContent=err.message;}
  });
}

function playMemory(id) {
  const t=data().trips.find(t=>t.id===id),photos=selectMemories(tripRecords(id));
  if(!t || !photos.length){toast('先加入可以预览的照片，再生成旅行回忆。');return;}
  let index=0,playing=false,timer;
  showModal(`<div class="player-header"><div><span class="date">${range(t)}${t.demo?' · 示例':''}</span><h2>${e(t.memoryTitle || t.title)}</h2></div><button class="icon-btn" data-action="close-modal" aria-label="关闭回忆">${icon('x')}</button></div><div id="player-frame"></div><div class="player-controls"><span id="player-count"></span><div class="player-transport"><button class="icon-btn" id="player-prev" aria-label="上一张">${icon('skip-back')}</button><button class="icon-btn" id="player-toggle" aria-label="自动播放">${icon('play')}</button><button class="icon-btn" id="player-next" aria-label="下一张">${icon('skip-forward')}</button></div><button class="btn small" id="player-edit">${icon('pencil')}编辑选片</button></div><div class="player-progress" id="player-progress"></div><div class="player-privacy">${icon('lock-keyhole')} 只播放照片与旅行文字，票据和消费金额不进入回忆。</div>`,{player:true,label:`${t.memoryTitle || t.title}旅行回忆`});
  const draw=()=>{const r=photos[index];document.getElementById('player-frame').innerHTML=`<div class="player-image-wrap"><img src="${e(r.image)}" alt="${e(r.title)}"><div class="player-overlay-caption" aria-live="polite"><h3>${e(r.title)}</h3><p>${e(r.caption || r.date || '')}</p></div></div>`;document.getElementById('player-count').textContent=`${index+1} / ${photos.length}`;document.getElementById('player-progress').innerHTML=photos.map((_,i)=>`<span class="${i<=index?'active':''}"></span>`).join('');};
  const stop=()=>{playing=false;clearInterval(timer);const b=document.getElementById('player-toggle');if(b){b.innerHTML=icon('play');b.setAttribute('aria-label','自动播放');uiIcons();}};
  document.getElementById('player-prev').onclick=()=>{stop();index=(index-1+photos.length)%photos.length;draw();};
  document.getElementById('player-next').onclick=()=>{stop();index=(index+1)%photos.length;draw();};
  document.getElementById('player-toggle').onclick=()=>{if(playing){stop();return;}playing=true;const b=document.getElementById('player-toggle');b.innerHTML=icon('pause');b.setAttribute('aria-label','暂停播放');uiIcons();timer=setInterval(()=>{if(index>=photos.length-1){stop();return;}index++;draw();},5000);};
  document.getElementById('player-edit').onclick=()=>{closeModal();go(`trip/${encodeURIComponent(id)}/selection`);};
  modalCleanup=()=>clearInterval(timer);draw();
}

function download(blob,name) {const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function dataURL(src) {const blob=await fetch(src).then(r=>{if(!r.ok)throw new Error('照片读取失败');return r.blob();});return thumbnail(new File([blob],'memory.jpg',{type:blob.type}));}
function exportMemory(id) {
  const t=data().trips.find(t=>t.id===id),photos=selectMemories(tripRecords(id));if(!t || !photos.length){toast('这次旅行还没有可导出的照片。');return;}
  showModal(modalHead('导出一份旅行回忆')+`<p class="modal-description">生成可以离线打开的 HTML 照片相册。包含 ${photos.length} 张精选与文字，适合自己保存或自行分享。</p><form id="export-memory-form"><div class="field-grid"><label class="field full">相册标题<input name="title" required value="${e(t.memoryTitle || t.title)}" maxlength="100"></label><label class="check-label full"><input type="checkbox" name="locations">包含地点文字（默认不包含）</label><label class="check-label full"><input type="checkbox" name="dates">包含照片日期（默认不包含）</label></div><div class="info-box">导出文件不会加入原始 EXIF、精确坐标、账单、票据或交易金额。照片画面和你填写的文字仍会保留。</div><div class="form-error" id="memory-export-error" role="alert"></div><div class="form-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="submit">${icon('download')}下载回忆相册</button></div></form>`,{label:'导出旅行回忆'});
  document.getElementById('export-memory-form').onsubmit=async event=>{
    event.preventDefault();const f=new FormData(event.target),button=event.target.querySelector('[type="submit"]');button.disabled=true;button.textContent='正在整理相册…';
    try{
      const title=String(f.get('title')).trim(), images=await Promise.all(photos.map(async r=>({image:await dataURL(r.image),title:r.title,caption:r.caption || '',meta:[f.get('dates')?r.date:'',f.get('locations')?r.place:''].filter(Boolean).join(' · ')})));
      const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · 拾途回忆</title><style>*{box-sizing:border-box}body{margin:0;background:#17231c;color:#fffaf0;font:15px/1.8 system-ui}main{max-width:1050px;margin:auto;padding:40px 24px}h1{text-align:center;font:32px/1.6 serif;letter-spacing:3px;margin:0 0 12px}header p,footer{text-align:center;color:#a3b29b;font-size:12px}figure{margin:40px 0 60px}img{width:100%;max-height:78vh;object-fit:contain;border-radius:8px}figcaption{text-align:center;margin:20px auto 0;max-width:700px}h2{font:24px/1.6 serif}p{white-space:pre-wrap}small{color:#acbca3}</style><main><header><h1>${e(title)}</h1><p>${images.length} 个旅行片段</p></header>${images.map(r=>`<figure><img src="${r.image}" alt="${e(r.title)}"><figcaption><h2>${e(r.title)}</h2><p>${e(r.caption)}</p><small>${e(r.meta)}</small></figcaption></figure>`).join('')}<footer>拾途 · 把旅行慢慢收藏</footer></main></html>`;
      download(new Blob([html],{type:'text/html;charset=utf-8'}),`${title.replace(/[\\/:*?"<>|]/g,'-')}-回忆.html`);closeModal();toast('旅行回忆相册已导出');
    }catch(err){document.getElementById('memory-export-error').textContent=err.message;button.disabled=false;button.textContent='重新导出';}
  };
}

async function backupArchive() {
  try {download(new Blob([JSON.stringify(archive)],{type:'application/json'}),`shitu-backup-${new Date().toISOString().slice(0,10)}.json`);toast('我的档案已导出，请保留原始照片文件。');}catch(err){toast(err.message);}
}
async function restoreArchive(file) {
  if(!file)return;
  try{
    if(file.size>200*1024*1024)throw new Error('备份超过 200 MB，请分批处理。');
    const incoming=validateArchive(JSON.parse(await file.text())),trips=incoming.trips.filter(t=>!archive.trips.some(a=>a.id===t.id)),records=incoming.records.filter(r=>!archive.records.some(a=>a.id===r.id));
    showModal(modalHead('恢复并合并备份')+`<p class="modal-description">检测到 ${trips.length} 次新旅行、${records.length} 条新记录。相同 ID 的现有资料保持不变。</p><p class="subtle">备份文件：${e(file.name)}</p><div class="form-actions"><button class="btn" data-action="close-modal">取消</button><button class="btn primary" id="confirm-restore">确认合并到本机档案</button></div>`,{label:'恢复旅行档案'});
    document.getElementById('confirm-restore').onclick=async()=>{const previous=archive,oldMode=state.mode;archive={schemaVersion:SCHEMA_VERSION,trips:[...archive.trips,...trips],records:[...archive.records,...records]};state.mode='mine';try{await persist();localStorage.setItem('shitu-mode','mine');closeModal();render();toast('备份已合并到我的本机档案');}catch(err){archive=previous;state.mode=oldMode;toast(err.message);}};
  }catch(err){toast(err.message || '备份文件无法读取。');}
}

async function runOCR() {
  if(state.busy || !state.doc?.file)return;
  state.busy=true;state.importError='';state.importMessage='正在下载本机 OCR 识别模型…';render();let worker;
  try{
    if(!window.Tesseract)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('OCR 组件下载失败，可直接手动填写。'));document.head.appendChild(script);});
    worker=await Tesseract.createWorker('chi_sim+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',langPath:'https://tessdata.projectnaptha.com/4.0.0',logger:message=>{state.importMessage=message.status==='recognizing text'?`正在本机识别文字 ${Math.round((message.progress || 0)*100)}%`:'正在准备本机识别模型…';const el=document.querySelector('.import-progress');if(el)el.textContent=state.importMessage;}});
    const result=await worker.recognize(state.doc.file);state.doc.text=result.data.text;state.doc.suggestedDate=parseDate(result.data.text.match(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/)?.[0])?.date || '';toast('文字已识别，请核对日期、线路和实际乘坐情况。');
  }catch(err){state.importError=err.message || '识别失败，请手动填写票据信息。';}
  finally{await worker?.terminate();state.busy=false;render();}
}

app.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;
  const {action,id,value}=el.dataset;
  if(state.busy && ['source','reset-import'].includes(action)){toast('当前资料仍在本机解析，请稍候。');return;}
  switch(action){
    case 'import':go('import');break;
    case 'trips':go('trips');break;
    case 'region':state.region=value;state.otherCountry='';render();break;
    case 'source':resetImport();state.source=value;render();break;
    case 'reset-import':resetImport();render();break;
    case 'play':playMemory(id);break;
    case 'edit-trip':editTrip(id);break;
    case 'edit-record':editRecord(id);break;
    case 'export-memory':exportMemory(id);break;
    case 'favorite':{const r=data().records.find(r=>r.id===id);if(!r)break;const old=r.favorite;r.favorite=!r.favorite;try{await persist();render();toast(r.favorite?'已珍藏，制作回忆时会优先选择':'已取消珍藏');}catch(err){r.favorite=old;toast(err.message);}break;}
    case 'undelete':{const r=data().records.find(r=>r.id===id);if(r){const old=r.deletedAt;delete r.deletedAt;try{await persist();render();toast('记录已恢复');}catch(err){r.deletedAt=old;toast(err.message);}}break;}
    case 'zoom-in':if(mapSvg && mapZoom)mapSvg.transition().duration(200).call(mapZoom.scaleBy,1.5);break;
    case 'zoom-out':if(mapSvg && mapZoom)mapSvg.transition().duration(200).call(mapZoom.scaleBy,1/1.5);break;
    case 'zoom-reset':if(mapSvg && mapZoom)mapSvg.transition().duration(200).call(mapZoom.transform,d3.zoomIdentity);break;
    case 'manual-ticket':state.doc={name:'手动录入的票据',text:''};render();break;
    case 'ocr':runOCR();break;
    case 'demo-flow':state.mode='demo';localStorage.setItem('shitu-mode','demo');go('trip/japan/timeline');toast('已打开示例：照片、车票和账单归入同一次旅行');break;
    case 'sample-csv':download(new Blob(['\ufeff日期,商家,金额,币种,收/支,交易单号,地点,分类\r\n2026-05-03 11:20:00,京都咖啡店,850,JPY,支出,demo-001,京都,餐饮\r\n2026-05-05 10:10:00,京都站到大阪站,580,JPY,支出,demo-002,京都,交通\r\n2026-05-06 12:00:00,商品退货,-300,JPY,退款,demo-003,大阪,购物\r\n'],{type:'text/csv;charset=utf-8'}),'拾途-示例账单.csv');break;
    case 'backup':backupArchive();break;
    case 'restore':document.getElementById('restore-input')?.click();break;
  }
});
app.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id==='archive-mode'){state.mode=el.value;localStorage.setItem('shitu-mode',state.mode);if(state.view==='trip')go('trips');else render();}
  if(el.id==='other-country'){state.otherCountry=el.value;render();}
  if(el.dataset.mapField){state.mapping[el.dataset.mapField]=el.value;rebuildBills();render();}
  if(el.id==='default-currency'){state.defaultCurrency=el.value;rebuildBills();render();}
  if(el.dataset.pendingId){const r=state.pending.find(r=>r.id===el.dataset.pendingId);if(r)r.included=el.checked;}
  if(el.id==='import-group'){const groups=suggestGroups(state.pending),group=groups[Number(el.value)];state.pending.forEach(r=>{r.included=el.value==='all'?!r.possibleDuplicate&&!r.refundReview:group?.records.some(q=>q.id===r.id)&&!r.possibleDuplicate&&!r.refundReview;});document.querySelectorAll('[data-pending-id]').forEach(input=>{input.checked=state.pending.find(r=>r.id===input.dataset.pendingId)?.included!==false;});}
  if(el.dataset.action==='memory-include'){const r=data().records.find(r=>r.id===el.dataset.id);if(r){const old=r.excludeMemory;r.excludeMemory=!el.checked;try{await persist();render();}catch(err){r.excludeMemory=old;toast(err.message);}}}
  if(el.id==='restore-input')restoreArchive(el.files[0]);
});
modalRoot.addEventListener('click',async event=>{
  if(event.target.hasAttribute('data-backdrop')){closeModal();return;}
  const el=event.target.closest('[data-action]');if(!el)return;
  if(el.dataset.action==='close-modal')closeModal();
  if(el.dataset.action==='remove-record'){const r=data().records.find(r=>r.id===el.dataset.id);if(!r)return;r.deletedAt=new Date().toISOString();try{await persist();closeModal();render();toast('已移入「数据与备份 → 最近移除」，可以恢复');}catch(err){delete r.deletedAt;toast(err.message);}}
});
document.addEventListener('keydown',event=>{
  if(!modalRoot.firstChild)return;
  if(event.key==='Escape'){event.preventDefault();closeModal();}
  if(event.key==='Tab'){const all=[...modalRoot.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')],first=all[0],last=all.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
});
window.addEventListener('hashchange',route);
try{await openDB();}catch(error){toast(error.message || '本机存储暂不可用。你仍可查看示例，导入后请及时备份。');}
route();loadGeo().catch(()=>toast('部分地图资源暂不可用，可继续查看旅行列表。'));


