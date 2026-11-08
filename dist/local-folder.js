import { uid } from './core.js';

// Only a directory explicitly selected by the visitor can receive archive data.
export class LocalArchiveFolder {
  constructor({ picker = globalThis.showDirectoryPicker?.bind(globalThis), makeId = uid, now = () => new Date().toISOString() } = {}) {
    this.picker = picker;
    this.makeId = makeId;
    this.now = now;
    this.binding = null;
    this.status = 'off';
    this.error = '';
    this.queue = Promise.resolve();
  }

  get supported() { return typeof this.picker === 'function'; }
  get enabled() { return Boolean(this.binding); }
  get config() { return this.binding ? { ...this.binding } : null; }

  restore(config) {
    if (!config?.directory || typeof config.directory.getFileHandle !== 'function' || !/^shitu-archive-[a-zA-Z0-9-]+\.json$/.test(config.fileName || '')) return;
    this.binding = { directory: config.directory, fileName: config.fileName, savedAt: config.savedAt || '' };
    this.status = 'ready';
  }

  async choose() {
    if (!this.supported) throw new Error('当前浏览器不支持选择保存文件夹，请使用下载档案。');
    const directory = await this.picker({ id: 'shitu-local-archive', mode: 'readwrite', startIn: 'documents' });
    // A new filename for each binding prevents overwriting an existing archive.
    for (let attempt = 0; attempt < 5; attempt++) {
      const fileName = `shitu-archive-${this.makeId()}.json`;
      if (!/^shitu-archive-[a-zA-Z0-9-]+\.json$/.test(fileName)) throw new Error('无法生成档案文件名。');
      try { await directory.getFileHandle(fileName); }
      catch (error) {
        if (error.name !== 'NotFoundError') throw error;
        this.binding = { directory, fileName, savedAt: '' };
        this.status = 'ready';
        this.error = '';
        return this.config;
      }
    }
    throw new Error('未找到可用的档案文件名，请重新选择。');
  }

  async read() {
    if (!this.binding) return null;
    const permission = await this.binding.directory.queryPermission?.({ mode: 'readwrite' }) || 'granted';
    if (permission !== 'granted') {
      this.status = 'needs-permission';
      this.error = '请点击「重新授权并保存」，恢复这个文件夹的访问权限。';
      return null;
    }
    const file = await this.binding.directory.getFileHandle(this.binding.fileName);
    return JSON.parse(await (await file.getFile()).text());
  }

  async write(archive, { requestPermission = false } = {}) {
    if (!this.binding) return false;
    const binding = this.binding;
    const content = JSON.stringify(archive);
    const task = this.queue.then(async () => {
      if (this.binding !== binding) return false;
      let stream;
      try {
        let permission = await binding.directory.queryPermission?.({ mode: 'readwrite' }) || 'granted';
        if (permission !== 'granted' && requestPermission) permission = await binding.directory.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          if (this.binding === binding) {
            this.status = 'needs-permission';
            this.error = '请点击「重新授权并保存」，恢复这个文件夹的写入权限。';
          }
          return false;
        }
        if (this.binding === binding) this.status = 'saving';
        const file = await binding.directory.getFileHandle(binding.fileName, { create: true });
        stream = await file.createWritable();
        await stream.write(content);
        if (this.binding !== binding) { await stream.abort(); return false; }
        await stream.close();
        if (this.binding === binding) {
          binding.savedAt = this.now();
          this.status = 'saved';
          this.error = '';
        }
        return true;
      } catch (error) {
        try { await stream?.abort(); } catch { /* Preserve the last completed file. */ }
        if (this.binding === binding) {
          this.status = 'error';
          this.error = error.name === 'NotAllowedError' ? '文件夹写入权限已失效，请重新授权并保存。' : '本地文件写入失败，请检查文件夹权限或磁盘空间。';
        }
        return false;
      }
    });
    this.queue = task.catch(() => false);
    return task;
  }

  stop() {
    this.binding = null;
    this.status = 'off';
    this.error = '';
  }
}
