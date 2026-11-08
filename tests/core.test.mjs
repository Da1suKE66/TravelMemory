import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseMoney, normaliseExpense, duplicateStatus, sumsByCurrency, suggestGroups, selectMemories, tripInRegion, validateArchive } from '../dist/core.js';

test('dates retain the local day across the date line and reject invalid dates',()=>{
  assert.deepEqual(parseDate('2026-05-03 00:10:00+09:00'),{date:'2026-05-03',dateTime:'2026-05-03T00:10:00+09:00',zoneKnown:true,raw:'2026-05-03 00:10:00+09:00'});
  assert.equal(parseDate('2025-02-29'),null);
  assert.equal(parseDate('2026-13-01'),null);
  assert.equal(parseDate('2026-05-01 25:00'),null);
  assert.equal(parseDate('2026:05:03 08:15:00').date,'2026-05-03');
  assert.equal(parseDate('2026-05-03').zoneKnown,false);
});
test('money uses integer minor units and the actual currency precision',()=>{
  assert.equal(parseMoney('￥1,234.56','CNY'),123456);
  assert.equal(parseMoney('(12.50)','USD'),-1250);
  assert.equal(parseMoney('580','JPY'),580);
  assert.equal(parseMoney('580.50','JPY'),null);
  assert.equal(parseMoney('0.125','KWD'),125);
  assert.equal(parseMoney('oops','USD'),null);
});
test('payment data handles refunds and excludes transfers without inventing a net amount',()=>{
  const mapping={date:'0',title:'1',amount:'2',direction:'3',status:'4'};
  assert.equal(normaliseExpense(['2026-05-03','咖啡','10','支出','成功'],mapping,'wechat').amountMinor,1000);
  assert.equal(normaliseExpense(['2026-05-03','商品退款','10','收入','成功'],mapping,'alipay').amountMinor,-1000);
  assert.equal(normaliseExpense(['2026-05-03','信用卡还款','500','支出','成功'],mapping,'wechat').skip,'资金转移，不作为消费');
  const refunded=normaliseExpense(['2026-05-03','商品','100','支出','部分退款'],mapping,'wechat');
  assert.equal(refunded.refundReview,true);assert.equal(refunded.included,false);assert.equal(refunded.amountMinor,10000);
  assert.equal(normaliseExpense(['2026-05-03','订单','100','支出','已取消'],mapping,'alipay').skip,'未完成的交易');
});
test('cross-source duplicates need review; same order with different refund amount is not discarded',()=>{
  const a={kind:'expense',source:'wechat',externalId:'a',date:'2026-05-03',title:'Coffee',amountMinor:850,currency:'JPY'};
  assert.equal(duplicateStatus({...a},[a]),'exact');
  assert.equal(duplicateStatus({...a,source:'card',externalId:'b'},[a]),'possible');
  assert.equal(duplicateStatus({...a,amountMinor:-850},[a]),'possible');
  assert.equal(duplicateStatus({...a,source:'card',externalId:'c',currency:'USD'},[a]),null);
});
test('expense totals keep currencies separate and apply refunds only once',()=>{
  assert.deepEqual(sumsByCurrency([{kind:'expense',currency:'CNY',amountMinor:1000},{kind:'expense',currency:'CNY',amountMinor:-300},{kind:'expense',currency:'JPY',amountMinor:850},{kind:'expense',currency:'JPY',amountMinor:850,included:false}]),[['CNY',700],['JPY',850]]);
});
test('trip grouping proposes time ranges without duplicating multi-country trips',()=>{
  const records=[{date:'2026-05-03'},{date:'2026-05-04'},{date:'2026-05-12'}];
  assert.equal(suggestGroups(records).length,2);
  const t={regions:['japan','usa']};assert.equal(tripInRegion(t,'world'),true);assert.equal(tripInRegion(t,'japan'),true);assert.equal(tripInRegion(t,'mainland'),false);
});
test('memory selection excludes receipts and opted-out images, deduplicates photos, and keeps favorites',()=>{
  const records=[{id:'a',kind:'photo',date:'2026-05-03',image:'a',fileHash:'same'},{id:'b',kind:'photo',date:'2026-05-03',image:'b',fileHash:'same'},{id:'c',kind:'photo',date:'2026-05-04',image:'c',favorite:true},{id:'d',kind:'photo',date:'2026-05-05',image:'d',excludeMemory:true},{id:'e',kind:'ticket',date:'2026-05-06',image:'e'}];
  assert.deepEqual(selectMemories(records).map(r=>r.id),['a','c']);
});
test('backup rejects dangling records, unsafe image URLs, and invalid amounts',()=>{
  const data={schemaVersion:1,trips:[{id:'t',title:'旅行',start:'2026-05-01',end:'2026-05-03'}],records:[]};
  assert.equal(validateArchive(data),data);
  assert.throws(()=>validateArchive({...data,records:[{id:'x',tripId:'missing',kind:'ticket'}]}));
  assert.throws(()=>validateArchive({...data,records:[{id:'x',tripId:'t',kind:'photo',image:'https://tracker.invalid/photo'}]}));
  assert.throws(()=>validateArchive({...data,records:[{id:'x',tripId:'t',kind:'expense',currency:'USD',amountMinor:NaN}]}));
});
