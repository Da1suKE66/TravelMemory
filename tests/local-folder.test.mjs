import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalArchiveFolder } from '../dist/local-folder.js';

function directory({ permission = 'granted', failWrite = false, existing = new Map() } = {}) {
  const files = existing;
  return {
    name: '旅行档案', files, permission, calls: [],
    async queryPermission() { return this.permission; },
    async requestPermission() { this.permission = 'granted'; return 'granted'; },
    async getFileHandle(name, options = {}) {
      this.calls.push({ name, create: Boolean(options.create) });
      if (!files.has(name) && !options.create) { const error = new Error('Missing'); error.name = 'NotFoundError'; throw error; }
      return { getFile: async () => ({ text: async () => files.get(name) }), createWritable: async () => {
        let staged;
        return {
          write: async value => { if (failWrite) throw new Error('Disk full'); staged = value; },
          close: async () => { files.set(name, staged); },
          abort: async () => {}
        };
      } };
    }
  };
}
const archive = title => ({ schemaVersion: 1, trips: [{ title }], records: [] });

test('only a picked directory receives data; an existing file is preserved', async () => {
  const dir = directory({ existing: new Map([['shitu-archive-existing.json', 'keep me']]) });
  const ids = ['existing', 'new'];
  const folder = new LocalArchiveFolder({ picker: async options => { assert.equal(options.mode, 'readwrite'); return dir; }, makeId: () => ids.shift() });
  assert.equal(await folder.write(archive('未选择')), false);
  await folder.choose();
  assert.equal(folder.config.fileName, 'shitu-archive-new.json');
  assert.equal(await folder.write(archive('京都')), true);
  assert.equal(JSON.parse(dir.files.get('shitu-archive-new.json')).trips[0].title, '京都');
  assert.equal(dir.files.get('shitu-archive-existing.json'), 'keep me');
});

test('queued writes save the latest archive snapshot in order', async () => {
  const dir = directory();
  const folder = new LocalArchiveFolder({ picker: async () => dir, makeId: () => 'queued' });
  await folder.choose();
  const first = archive('第一版');
  const a = folder.write(first);
  first.trips[0].title = '随后修改';
  const b = folder.write(archive('最终版'));
  assert.deepEqual(await Promise.all([a,b]), [true,true]);
  assert.equal(JSON.parse(dir.files.get(folder.config.fileName)).trips[0].title, '最终版');
  assert.equal(folder.status, 'saved');
});

test('revoked permission leaves the file untouched until the visitor explicitly grants it', async () => {
  const dir = directory({ permission: 'prompt' });
  const folder = new LocalArchiveFolder();
  folder.restore({ directory: dir, fileName: 'shitu-archive-restored.json' });
  assert.equal(await folder.write(archive('等待授权')), false);
  assert.equal(dir.files.size, 0);
  assert.equal(folder.status, 'needs-permission');
  assert.equal(await folder.write(archive('已授权'), { requestPermission: true }), true);
  assert.equal(dir.files.size, 1);
});

test('a failed write preserves the previous completed archive; stopping keeps the saved file', async () => {
  const name = 'shitu-archive-safe.json';
  const dir = directory({ failWrite: true, existing: new Map([[name, 'last good archive']]) });
  const folder = new LocalArchiveFolder();
  folder.restore({ directory: dir, fileName: name });
  assert.equal(await folder.write(archive('失败')), false);
  assert.equal(dir.files.get(name), 'last good archive');
  assert.equal(folder.status, 'error');
  folder.stop();
  assert.equal(folder.enabled, false);
  assert.equal(dir.files.get(name), 'last good archive');
});

test('a remembered folder can reopen the saved archive without a network request', async () => {
  const name='shitu-archive-reopen.json',saved=archive('从文件恢复');
  const dir=directory({existing:new Map([[name,JSON.stringify(saved)]])});
  const folder=new LocalArchiveFolder();
  folder.restore({directory:dir,fileName:name});
  assert.deepEqual(await folder.read(),saved);
});

test('stopping cancels a queued write before it can create or change a file', async () => {
  const dir=directory();
  const folder=new LocalArchiveFolder({picker:async()=>dir,makeId:()=> 'cancelled'});
  await folder.choose();
  const pending=folder.write(archive('不应写入'));
  folder.stop();
  assert.equal(await pending,false);
  assert.equal(dir.files.size,0);
});
