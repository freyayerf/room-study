const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine');

test('rectangular room does not invent unknown measurements', () => {
  assert.deepEqual(E.solve({}, 'rectangle').values, {});
  assert.deepEqual(E.solve({ W: 500, H: 400 }, 'rectangle').values, { W: 500, H: 400 });
  assert.equal(E.fieldsFor('rectangle').length, 2);
});
test('original constraints derive only uniquely determined spans', () => {
  const r = E.solve({ W: 600, L: 140, NW: 90, EW: 80, R: 40, H: 260, ND: 72 });
  assert.equal(r.derived.M, 250);
  assert.equal(r.derived.NT, 188);
  assert.equal(r.conflict, false);
  assert.deepEqual(E.solve({ W: 600 }).derived, {});
});
test('inconsistent measurements are reported rather than silently replaced', () => {
  const r = E.solve({ ...E.defaults, W: 700 });
  assert.equal(r.conflict, true);
  assert.equal(r.values.W, 700);
  assert.deepEqual(r.derived, {});
});
test('L-shaped room derives depth and exposes five measured spans', () => {
  const r = E.solve({ W: 600, H: 400, ND: 150, NW: 180 }, 'l');
  assert.equal(r.derived.NT, 250);
  assert.equal(E.fieldsFor('l').length, 5);
  assert.equal(E.points(E.geometry(r.values, 'l'), 'l').length, 6);
});
test('fallback proportions close every template without marking them measured', () => {
  for (const shape of Object.keys(E.shapes)) {
    const r = E.solve({ W: 800 }, shape),
      g = E.geometry(r.values, shape);
    assert.equal(g.W, 800);
    assert.ok(E.points(g, shape).every((p) => p.every(Number.isFinite)));
    if (shape === 'study') assert.ok(Math.abs(g.L + g.NW + g.M + g.EW + g.R - g.W) < 1e-9);
    assert.equal(Object.keys(r.values).length, 1);
  }
});
test('furniture fits on boundaries but not beyond them', () => {
  const p = E.points({ W: 500, H: 400 }, 'rectangle');
  assert.equal(E.fits({ x: 0, y: 0, w: 500, h: 400 }, p), true);
  assert.equal(E.fits({ x: -1, y: 0, w: 100, h: 100 }, p), false);
  assert.equal(E.fits({ x: 490, y: 0, w: 11, h: 10 }, p), false);
  assert.equal(E.fits({ x: 1, y: 1, w: 0, h: 2 }, p), false);
  assert.equal(E.fits({ x: 1, y: 1, w: 0.001, h: 0.001 }, p), true);
});
test('concave cutout rejects a rectangle whose four corners are otherwise inside', () => {
  const p = E.points(E.defaults);
  assert.equal(E.fits({ x: 130, y: 180, w: 110, h: 70 }, p), false);
  const l = E.points(E.template('l').defaults, 'l');
  assert.equal(E.fits({ x: 450, y: 300, w: 30, h: 30 }, l), false);
  assert.equal(E.fits({ x: 10, y: 10, w: 100, h: 100 }, l), true);
});
test('edge contact is not overlap, intersections beyond 1 mm are', () => {
  const a = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(E.overlap(a, { x: 100, y: 0, w: 20, h: 20 }), false);
  assert.equal(E.overlap(a, { x: 99, y: 10, w: 20, h: 20 }), true);
});
