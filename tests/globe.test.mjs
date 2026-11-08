import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { rotateGlobe, scaleGlobe, onFrontHemisphere } from '../dist/globe.js';
import { demoArchive } from '../dist/demo.js';
import { selectMemories, sumsByCurrency, tripInRegion } from '../dist/core.js';

test('dragging wraps the date line and stops safely at both poles', () => {
  assert.deepEqual(rotateGlobe([175, 0, 0], 20, 0, 90), [-165, 0, 0]);
  assert.deepEqual(rotateGlobe([-175, 0, 0], -20, 0, 90), [165, 0, 0]);
  assert.equal(rotateGlobe([0, 0, 0], 0, 10000, 150)[1], -89);
  assert.equal(rotateGlobe([0, 0, 0], 0, -10000, 150)[1], 89);
  assert.ok(rotateGlobe([0, 0, 0], 10, 10, 0).every(Number.isFinite));
});

test('wheel and pinch zoom stay bounded even when fingers coincide', () => {
  assert.equal(scaleGlobe(1, 1000), 4);
  assert.equal(scaleGlobe(1, 0), 0.8);
  assert.equal(scaleGlobe(2, 0.75), 1.5);
  for (const factor of [NaN, Infinity, -1]) assert.equal(scaleGlobe(2, factor), 2);
});

test('front hemisphere handles the date line and the polar regions', () => {
  assert.equal(onFrontHemisphere([121, 25], [112, 23]), true);
  assert.equal(onFrontHemisphere([-119, 38], [112, 23]), false);
  assert.equal(onFrontHemisphere([-179, 10], [179, 10]), true);
  assert.equal(onFrontHemisphere([180, 89], [0, 89]), true);
  assert.equal(onFrontHemisphere([90, 0], [0, 0]), false, 'hide points on the limb');
});

test('Taiwan sample has a valid itinerary, photos, local-currency spending and memories', () => {
  const archive = structuredClone(demoArchive);
  const trip = archive.trips.find(t => t.id === 'taiwan');
  assert.deepEqual(trip.countryCodes, ['TWN']);
  assert.equal(trip.demo, true);
  assert.equal(tripInRegion(trip, 'world'), true);
  assert.equal(tripInRegion(trip, 'other'), true);
  assert.equal(tripInRegion(trip, 'mainland'), false);
  const records = archive.records.filter(r => r.tripId === trip.id);
  assert.equal(selectMemories(records).length, 2);
  assert.deepEqual(sumsByCurrency(records), [['TWD', 48000]]);
  assert.ok(records.every(r => r.demo));
});

test('new bundled demo photos match their verified public-source hashes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/assets/sample-images.json', import.meta.url), 'utf8'));
  for (const name of ['taipei', 'jiufen']) {
    const path = `dist/assets/${name}.jpg`, entry = manifest.images.find(item => item.path === path);
    assert.equal(entry.verified_against_public_source, true);
    assert.match(entry.photo_page, /^https:\/\/unsplash\.com\/photos\//);
    const photo = await readFile(new URL(`../${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(photo).digest('hex'), entry.sha256);
  }
});
