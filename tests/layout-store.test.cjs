const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LayoutStore } = require('../src/layout-store');
const M = require('../src/model');
function setup() {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  return { store: new LayoutStore(storage, M.validate), storage };
}
test('save and restore preserve measurements and protect unsaved changes', () => {
  const { store } = setup();
  const p = M.fresh();
  p.known = { W: 500, H: 400 };
  const entry = store.create(p, 'First');
  const changed = M.fresh();
  changed.known = { W: 700, H: 300 };
  const result = store.restore(entry.id, changed);
  assert.equal(result.data.known.W, 500);
  assert.ok(result.backup);
  assert.equal(store.read().plans.length, 2);
  assert.equal(store.restore(entry.id, changed).backup, null);
});
test('library export and repeated imports are idempotent', () => {
  const { store } = setup();
  store.ensureStarting(M.fresh());
  const bundle = store.export();
  const other = setup().store;
  assert.equal(other.import(bundle), 1);
  assert.equal(other.import(bundle), 0);
  bundle.plans[0].name = 'Different';
  assert.equal(other.import(bundle), 1);
  assert.equal(new Set(other.read().plans.map((p) => p.id)).size, 2);
});
test('invalid library import is atomic and retains prior entries', () => {
  const { store } = setup();
  store.create(M.fresh(), 'Safe');
  const before = store.export();
  assert.throws(() =>
    store.import({ format: 'room-study-library', version: 1, plans: [{ id: 'broken' }] }),
  );
  assert.deepEqual(store.export(), before);
});
test('storage failures are surfaced and signatures ignore property order', () => {
  const store = new LayoutStore(
    {
      getItem() {
        throw Error('blocked');
      },
    },
    M.validate,
  );
  assert.throws(() => store.read());
  const good = setup().store;
  const p = M.fresh();
  assert.equal(good.signature(p), good.signature({ ...p, known: {} }));
});
test('create respects the same 1000-layout limit as import', () => {
  const { store, storage } = setup();
  const p = store.entry(M.fresh(), 'Example');
  storage.setItem(
    store.key,
    JSON.stringify({
      version: 1,
      plans: Array.from({ length: 1000 }, (_, i) => ({ ...p, id: String(i) })),
    }),
  );
  assert.throws(() => store.create(M.fresh(), 'Overflow'));
  assert.equal(store.read().plans.length, 1000);
});
