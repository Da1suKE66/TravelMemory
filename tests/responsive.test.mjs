import test from 'node:test';
import assert from 'node:assert/strict';
import { installViewportLayout } from '../dist/responsive.js';

function environment(withViewport = true) {
  const properties = new Map(), frames = new Map();
  const root = { style: { setProperty: (k, v) => properties.set(k, v), removeProperty: k => properties.delete(k) }, dataset: {} };
  const doc = Object.assign(new EventTarget(), { documentElement: root, activeElement: null });
  const viewport = Object.assign(new EventTarget(), { width: 430, height: 739, offsetTop: 0, offsetLeft: 0, scale: 1 });
  let next = 0;
  const win = Object.assign(new EventTarget(), { innerHeight: 739, innerWidth: 430,
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
    ...(withViewport ? { visualViewport: viewport } : {}),
  });
  return { win, doc, root, viewport, properties, frames, flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
}

test('visible viewport follows browser bars without hiding navigation', () => {
  const env = environment();
  const dispose = installViewportLayout(env.win, env.doc);
  env.viewport.height = 680;
  env.viewport.dispatchEvent(new Event('resize'));
  env.viewport.dispatchEvent(new Event('scroll'));
  assert.equal(env.frames.size, 1, 'coalesce resize and scroll updates');
  env.flush();
  assert.equal(env.properties.get('--visual-height'), '680px');
  assert.equal(env.root.dataset.keyboardOpen, 'false');
  dispose();
});

test('editing uses the keyboard viewport and resets after closing the keyboard', () => {
  const env = environment();
  const dispose = installViewportLayout(env.win, env.doc);
  env.doc.activeElement = { matches: () => true };
  Object.assign(env.viewport, { height: 390, offsetTop: 115 });
  env.doc.dispatchEvent(new Event('focusin'));
  env.flush();
  assert.equal(env.root.dataset.keyboardOpen, 'true');
  assert.equal(env.properties.get('--visual-top'), '115px');
  assert.equal(env.properties.get('--visual-height'), '390px');
  env.doc.activeElement = null;
  env.viewport.height = 739;
  env.doc.dispatchEvent(new Event('focusout'));
  env.flush();
  assert.equal(env.root.dataset.keyboardOpen, 'false');
  assert.equal(env.properties.get('--visual-height'), '739px');
  dispose();
});

test('pinch zoom is not mistaken for a keyboard', () => {
  const env = environment();
  env.doc.activeElement = { matches: () => true };
  Object.assign(env.viewport, { scale: 2, width: 215, height: 370, offsetTop: 80 });
  const dispose = installViewportLayout(env.win, env.doc);
  assert.equal(env.root.dataset.keyboardOpen, 'false');
  assert.equal(env.properties.get('--visual-width'), '430px');
  assert.equal(env.properties.get('--visual-top'), '0px');
  dispose();
});

test('works without visualViewport and removes listeners and pending work', () => {
  const env = environment(false);
  const dispose = installViewportLayout(env.win, env.doc);
  assert.equal(env.properties.get('--visual-height'), '739px');
  env.win.dispatchEvent(new Event('resize'));
  assert.equal(env.frames.size, 1);
  dispose();
  assert.equal(env.frames.size, 0);
  assert.equal(env.properties.size, 0);
  assert.equal(env.root.dataset.keyboardOpen, undefined);
  env.win.dispatchEvent(new Event('resize'));
  assert.equal(env.frames.size, 0);
});
