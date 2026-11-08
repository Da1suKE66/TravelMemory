export const SCHEMA_VERSION = 1;
export const REGION_LABELS = { world: '全球', mainland: '大陆', japan: '日本', usa: '美国', other: '其他' };
export const CURRENCY_DIGITS = { JPY: 0, KRW: 0, VND: 0, KWD: 3, BHD: 3, OMR: 3 };
export const digitsFor = currency => CURRENCY_DIGITS[currency] ?? 2;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const regionForCountry = code => ({ CHN: 'mainland', JPN: 'japan', USA: 'usa' }[code] || 'other');
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function parseMoney(value, currency = 'CNY') {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const raw = String(value).trim();
  const negative = /[-−]/.test(raw) || /^\s*\(.*\)\s*$/.test(raw);
  const clean = raw.replace(/[,，\s￥¥$€£₩]/g, '').replace(/[A-Za-z]/g, '').replace(/[()−-]/g, '');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const digits = digitsFor(currency), parts = clean.split('.');
  if ((parts[1] || '').length > digits && /[1-9]/.test(parts[1].slice(digits))) return null;
  const minor = Number(parts[0]) * 10 ** digits + Number((parts[1] || '').padEnd(digits, '0').slice(0, digits));
  return Number.isSafeInteger(minor) ? minor * (negative ? -1 : 1) : null;
}

export function formatMoney(minor, currency) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: digitsFor(currency) }).format(minor / 10 ** digitsFor(currency));
}

export function parseDate(value) {
  if (typeof value === 'number' && value > 20000 && value < 100000) {
    value = new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 19);
  }
  const raw = String(value ?? '').trim().replace(/^['`]/, '');
  const match = raw.match(/^(\d{4})[-/年:.](\d{1,2})[-/月:.](\d{1,2})日?(?:[ T\s]+(\d{1,2}):?(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const [, y, m, d, h, min, sec] = match;
  const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const [yy, mm, dd] = date.split('-').map(Number), check = new Date(Date.UTC(yy, mm - 1, dd));
  if (check.getUTCFullYear() !== yy || check.getUTCMonth() !== mm - 1 || check.getUTCDate() !== dd || Number(h || 0) > 23 || Number(min || 0) > 59 || Number(sec || 0) > 59) return null;
  const zone = raw.match(/(Z|[+-]\d{2}:?\d{2})$/)?.[1] || '';
  return { date, dateTime: h ? `${date}T${h.padStart(2, '0')}:${min}:${sec || '00'}${zone}` : date, zoneKnown: Boolean(zone), raw };
}

export function normaliseExpense(row, mapping, source, defaultCurrency = 'CNY') {
  const read = field => mapping[field] !== undefined && mapping[field] !== '' ? row[mapping[field]] : '';
  const date = parseDate(read('date'));
  const currencyRaw = String(read('currency') || defaultCurrency).trim().toUpperCase();
  const currency = ({'人民币':'CNY','日元':'JPY','美元':'USD','RMB':'CNY','元':'CNY','¥':'CNY'}[currencyRaw] || currencyRaw);
  if (!/^[A-Z]{3}$/.test(currency)) return { error: '币种不明确，请先指定币种' };
  let amountMinor = parseMoney(read('amount'), currency);
  if (!date) return { error: '缺少可识别的日期' };
  if (amountMinor === null) return { error: '金额格式或小数位需要核对' };
  const direction = String(read('direction') || ''), status = String(read('status') || '');
  const title = String(read('title') || '未命名消费').trim().slice(0, 300);
  if (/关闭|失败|撤销|待付款|已取消/.test(status)) return { skip: '未完成的交易' };
  if (/还款|提现|充值|转账|红包|信用卡还款/.test(title + String(read('category') || ''))) return { skip: '资金转移，不作为消费' };
  const refundReview = /退款|退费/.test(status) && !/退款|退费|退货/.test(direction + title) && !/收入|收款/.test(direction);
  if (/退款|退费|退货/.test(direction + title) || /收入|收款/.test(direction) && /退款|退费/.test(status)) amountMinor = -Math.abs(amountMinor);
  else if (/收入|收款/.test(direction)) return { skip: '非退款收入' };
  else if (/支出|付款|消费/.test(direction)) amountMinor = Math.abs(amountMinor);
  return {
    id: uid(), kind: 'expense', source, ...date, title, currency, amountMinor,
    externalId: String(read('externalId') || '').trim().replace(/^['`]/, '').slice(0, 150),
    place: String(read('place') || '').trim().slice(0, 150), locationStatus: 'unconfirmed',
    category: String(read('category') || '其他').slice(0, 80), included: !refundReview, refundReview
  };
}

const normalText = value => String(value || '').toLowerCase().replace(/[\s\p{P}]/gu, '');
export function duplicateStatus(record, existing) {
  for (const other of existing) {
    if (record.kind !== other.kind) continue;
    if (record.fileHash && other.fileHash === record.fileHash) return 'exact';
    if (record.kind !== 'expense') continue;
    if (record.externalId && record.source === other.source && record.externalId === other.externalId) return record.currency === other.currency && record.amountMinor === other.amountMinor ? 'exact' : 'possible';
    if (record.currency !== other.currency || record.amountMinor !== other.amountMinor || record.date !== other.date) continue;
    const sameMerchant = normalText(record.title) === normalText(other.title);
    if (!sameMerchant) continue;
    // A daily timestamp cannot establish an identical purchase. It stays a review candidate.
    return 'possible';
  }
  return null;
}

export function sumsByCurrency(records) {
  const totals = new Map();
  for (const r of records) {
    if (r.kind !== 'expense' || r.deletedAt || r.included === false || !Number.isSafeInteger(r.amountMinor)) continue;
    totals.set(r.currency, (totals.get(r.currency) || 0) + r.amountMinor);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}

export function tripInRegion(trip, region) {
  return region === 'world' || (trip.regions || [trip.region]).includes(region);
}

export function suggestGroups(records, gapDays = 3) {
  const sorted = records.filter(r => r.date && !r.deletedAt).toSorted((a, b) => (a.dateTime || a.date).localeCompare(b.dateTime || b.date));
  const groups = [];
  for (const record of sorted) {
    const last = groups.at(-1), day = Date.parse(record.date + 'T00:00:00Z') / 86400000;
    if (!last || day - last.lastDay > gapDays) groups.push({ records: [record], start: record.date, end: record.date, lastDay: day });
    else { last.records.push(record); last.end = record.date; last.lastDay = day; }
  }
  return groups;
}

export function selectMemories(records, max = 18) {
  const photos = records.filter(r => r.kind === 'photo' && r.image && !r.deletedAt && !r.excludeMemory);
  const selected = [], days = new Set(), places = new Set(), hashes = new Set();
  for (const r of photos.toSorted((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || (a.dateTime || a.date || '').localeCompare(b.dateTime || b.date || ''))) {
    if (r.fileHash && hashes.has(r.fileHash)) continue;
    const freshDay = !days.has(r.date), freshPlace = r.place && !places.has(r.place);
    if (r.favorite || freshDay || freshPlace || selected.length < Math.min(3, photos.length)) {
      selected.push({ ...r, selectionReason: r.favorite ? '你标记的珍藏' : freshDay ? '保留不同日期的片段' : freshPlace ? '保留不同地点的片段' : '按时间串起旅程' });
      days.add(r.date); places.add(r.place); if (r.fileHash) hashes.add(r.fileHash);
    }
    if (selected.length >= max) break;
  }
  return selected.toSorted((a, b) => (a.dateTime || a.date || '').localeCompare(b.dateTime || b.date || ''));
}

export function validateArchive(data) {
  if (!data || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.trips) || !Array.isArray(data.records)) throw new Error('这不是受支持的拾途备份文件');
  if (data.records.length > 30000 || data.trips.length > 2000) throw new Error('档案过大，请分批恢复');
  const trips = new Set();
  for (const t of data.trips) {
    if (!t || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.start !== 'string' || typeof t.end !== 'string' || !parseDate(t.start) || !parseDate(t.end) || t.start > t.end || trips.has(t.id) || t.regions && !Array.isArray(t.regions) || t.countryCodes && !Array.isArray(t.countryCodes) || t.places && !Array.isArray(t.places)) throw new Error('备份中的旅行信息有误');
    trips.add(t.id);
  }
  const ids = new Set();
  for (const r of data.records) {
    if (!r || typeof r.id !== 'string' || ids.has(r.id) || !['photo','expense','ticket'].includes(r.kind) || (r.tripId && !trips.has(r.tripId))) throw new Error('备份中的记录信息有误');
    if (r.kind === 'expense' && (!Number.isSafeInteger(r.amountMinor) || !/^[A-Z]{3}$/.test(r.currency))) throw new Error('备份中的金额有误');
    if (r.date && (typeof r.date !== 'string' || !parseDate(r.date))) throw new Error('备份中的日期有误');
    if (r.dateTime && typeof r.dateTime !== 'string' || r.title && typeof r.title !== 'string') throw new Error('备份中的文字信息有误');
    if (r.image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image)) throw new Error('备份照片格式不受支持');
    if (r.coords && (!Array.isArray(r.coords) || r.coords.length !== 2 || !r.coords.every(Number.isFinite) || Math.abs(r.coords[0]) > 180 || Math.abs(r.coords[1]) > 90)) throw new Error('备份中的坐标有误');
    ids.add(r.id);
  }
  return data;
}
