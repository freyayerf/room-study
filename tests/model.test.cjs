const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/model');
test('new plan is a rectangle with optional fixed features disabled', () => {
  const p = M.validate(M.fresh());
  assert.equal(p.shape, 'rectangle');
  assert.equal(p.bathroom.enabled, false);
  assert.deepEqual(p.known, {});
  assert.equal(p.fixtures.windowEnabled, false);
  const next = M.fresh();
  next.items[0].x = 5;
  assert.notEqual(M.fresh().items[0].x, 5);
});
test('legacy v1 imports retain their original room topology and fixtures', () => {
  const p = M.fresh();
  delete p.shape;
  delete p.bathroom;
  delete p.sink;
  p.fixtures = { TW: 140, TD: 90, SW: 40, SD: 60, SY: 80 };
  const result = M.validate(p);
  assert.equal(result.shape, 'study');
  assert.equal(result.bathroom.w, 140);
  assert.equal(result.bathroom.enabled, true);
  assert.equal(result.sink.d, 60);
});
test('known dimension names cannot pollute prototypes', () => {
  const p = M.fresh();
  p.known = JSON.parse('{"__proto__":1,"toString":2,"W":500}');
  assert.deepEqual(M.validate(p).known, { W: 500 });
});
test('malformed plans and duplicate IDs are rejected', () => {
  const p = M.fresh();
  p.items.push({ ...p.items[0] });
  assert.throws(() => M.validate(p));
  for (const change of [
    { version: 2 },
    { shape: 'other' },
    { unit: 'inch' },
    { known: [] },
    { fixtures: [] },
  ])
    assert.throws(() => M.validate({ ...M.fresh(), ...change }));
});
test('dangerous colors and excessive coordinates are constrained', () => {
  const p = M.fresh();
  p.items[0].color = 'red" onload="alert(1)';
  assert.equal(M.validate(p).items[0].color, '#b7ad9b');
  p.items[0].x = Infinity;
  assert.throws(() => M.validate(p));
  p.items[0].x = 1e9;
  assert.throws(() => M.validate(p));
});
test('plan accepts 100 pieces but rejects 101', () => {
  const p = M.fresh();
  p.items = Array.from({ length: 100 }, (_, i) => ({ ...p.items[0], id: String(i) }));
  assert.equal(M.validate(p).items.length, 100);
  p.items.push({ ...p.items[0], id: 'extra' });
  assert.throws(() => M.validate(p));
});
test('unit conversions preserve internal centimeter precision', () => {
  assert.equal(M.num('1.25', 'm'), 125);
  assert.equal(M.num('1', 'ft'), 30.48);
  assert.ok(Math.abs(M.num('8\' 6"', 'ft') - 259.08) < 1e-8);
  assert.equal(M.num('8′ 6″', 'ft'), 259.08);
  assert.equal(M.parsePosition('0'), 0);
  assert.equal(M.num(''), null);
  assert.ok(Number.isNaN(M.num('-3')));
  assert.equal(M.fmt(125, 'm'), '1.25');
  assert.equal(M.fmt(30.48, 'ft'), '1′ 0″');
  assert.equal(M.fmt(30.479, 'ft'), '1′ 0″');
});
