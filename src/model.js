(function (root) {
  'use strict';
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RoomEngine;
  const initialItems = [
    {
      id: 'bed',
      name: 'Bed',
      type: 'bed',
      color: '#d6ba8c',
      x: 115 / 600,
      y: 7 / 260,
      bw: 155,
      bd: 170,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
    {
      id: 'stand',
      name: 'Bedside stand',
      type: 'table',
      color: '#aaac93',
      x: 272 / 600,
      y: 5 / 260,
      bw: 38,
      bd: 40,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
    {
      id: 'sofa',
      name: 'Sofa',
      type: 'sofa',
      color: '#9da98c',
      x: 314 / 600,
      y: 7 / 260,
      bw: 126,
      bd: 52,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
    {
      id: 'coffee',
      name: 'Coffee table',
      type: 'table',
      color: '#bf9c7b',
      x: 332 / 600,
      y: 72 / 260,
      bw: 94,
      bd: 40,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
    {
      id: 'table',
      name: 'Table',
      type: 'table',
      color: '#c7ac8f',
      x: 19 / 600,
      y: 173 / 260,
      bw: 52,
      bd: 70,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
    {
      id: 'wardrobe',
      name: 'Wardrobe',
      type: 'wardrobe',
      color: '#a4b293',
      x: 237 / 600,
      y: 192 / 260,
      bw: 93,
      bd: 63,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
    {
      id: 'tv',
      name: 'TV stand',
      type: 'tv',
      color: '#b7ad9b',
      x: 333 / 600,
      y: 230 / 260,
      bw: 100,
      bd: 26,
      w: null,
      d: null,
      rot: 0,
      locked: false,
    },
  ];
  const initialBathroom = {
    id: 'bathroom',
    name: 'Bathroom',
    type: 'bathroom',
    color: '#e0e5d9',
    x: 440 / 600,
    y: 0,
    bw: 160,
    bd: 94,
    w: null,
    d: null,
    rot: 0,
    locked: false,
  };
  const initialSink = {
    id: 'sink',
    name: 'Sink',
    type: 'sink',
    color: '#d7e2d8',
    x: 562 / 600,
    y: 0.61,
    bw: 38,
    bd: 100,
    w: null,
    d: null,
    rot: 0,
    locked: false,
  };
  function fresh() {
    return {
      version: 1,
      shape: 'rectangle',
      unit: 'cm',
      known: {},
      fixtures: { windowEnabled: false },
      bathroom: { ...structuredClone(initialBathroom), enabled: false },
      sink: { ...structuredClone(initialSink), enabled: false },
      items: structuredClone(initialItems),
    };
  }
  const unitFactor = (unit) => (unit === 'm' ? 100 : unit === 'ft' ? 30.48 : 1);
  const unitLabel = (unit) => (unit === 'ft' ? 'ft / in' : unit);
  function fmt(v, unit = 'cm') {
    if (!Number.isFinite(v)) return '';
    if (unit === 'ft') {
      let tenths = Math.round((v / 2.54) * 10),
        ft = Math.floor(tenths / 120),
        rest = (tenths - ft * 120) / 10;
      return ft + '′ ' + rest + '″';
    }
    return +(v / unitFactor(unit)).toFixed(2) + '';
  }
  function num(v, unit = 'cm') {
    if (!v.trim()) return null;
    if (unit === 'ft') {
      const s = v.trim();
      let m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|′|ft)\s*(\d+(?:\.\d+)?)?\s*(?:"|″|in)?$/i);
      if (m) return +m[1] * 30.48 + (+m[2] || 0) * 2.54;
    }
    let n = Number(v);
    return Number.isFinite(n) && n > 0 ? n * unitFactor(unit) : NaN;
  }
  function parsePosition(v, unit = 'cm') {
    let n = num(v, unit);
    return /^\s*0(?:\.0*)?\s*$/.test(v) ? 0 : n;
  }
  function validate(data) {
    if (
      !data ||
      data.version !== 1 ||
      !['cm', 'm', 'ft'].includes(data.unit) ||
      !Array.isArray(data.items) ||
      data.items.length > 100 ||
      !data.known ||
      typeof data.known !== 'object' ||
      Array.isArray(data.known) ||
      !data.fixtures ||
      typeof data.fixtures !== 'object' ||
      Array.isArray(data.fixtures)
    )
      throw Error('Invalid plan file');
    const f = fresh();
    f.unit = data.unit;
    f.shape = data.shape === undefined ? 'study' : data.shape;
    if (!Object.hasOwn(E.shapes, f.shape)) throw Error('Invalid room shape');
    for (let [k, v] of Object.entries(data.known))
      if (Object.hasOwn(E.template(f.shape).defaults, k) && Number.isFinite(v) && v > 0 && v <= 1e6)
        f.known[k] = v;
    for (let [k, v] of Object.entries(data.fixtures))
      if (
        ['TW', 'TD', 'SW', 'SD', 'SY', 'WO', 'WL'].includes(k) &&
        Number.isFinite(v) &&
        v >= 0 &&
        v <= 1e6
      )
        f.fixtures[k] = v;
    f.fixtures.windowEnabled = data.fixtures.windowEnabled !== false;
    const ids = new Set(['bathroom', 'sink']);
    function piece(i, feature = null) {
      if (
        !i ||
        typeof i.id !== 'string' ||
        i.id.length > 80 ||
        (!feature && ids.has(i.id)) ||
        typeof i.name !== 'string' ||
        !(feature
          ? i.type === feature
          : ['bed', 'table', 'sofa', 'wardrobe', 'tv'].includes(i.type)) ||
        !Number.isFinite(i.x) ||
        i.x < 0 ||
        i.x > 1000 ||
        !Number.isFinite(i.y) ||
        i.y < 0 ||
        i.y > 1000 ||
        !Number.isFinite(i.bw) ||
        i.bw <= 0 ||
        i.bw > 1e6 ||
        !Number.isFinite(i.bd) ||
        i.bd <= 0 ||
        i.bd > 1e6 ||
        ![0, 90, 180, 270].includes(i.rot)
      )
        throw Error('Invalid furniture data');
      ids.add(i.id);
      for (let k of ['w', 'd'])
        if (i[k] !== null && (!Number.isFinite(i[k]) || i[k] <= 0 || i[k] > 1e6))
          throw Error('Invalid size');
      return {
        id: feature || i.id,
        name: feature ? (feature === 'sink' ? 'Sink' : 'Bathroom') : i.name.slice(0, 40),
        type: i.type,
        color: /^#[a-f0-9]{6}$/i.test(i.color) ? i.color : '#b7ad9b',
        x: i.x,
        y: i.y,
        bw: i.bw,
        bd: i.bd,
        w: i.w,
        d: i.d,
        rot: i.rot,
        enabled: feature ? i.enabled !== false : true,
        locked: !!i.locked,
      };
    }
    // Older plans stored bathroom measurements under fixtures. Keep those dimensions.
    f.bathroom = piece(
      data.bathroom || { ...initialBathroom, w: f.fixtures.TW || null, d: f.fixtures.TD || null },
      'bathroom',
    );
    const outline = E.geometry(E.solve(f.known, f.shape).values, f.shape),
      scale = outline.W / 600;
    f.sink = piece(
      data.sink || {
        ...initialSink,
        w: f.fixtures.SW || null,
        d: f.fixtures.SD || null,
        x: (outline.W - (f.fixtures.SW || 38 * scale)) / outline.W,
        y: (f.fixtures.SY ?? outline.H * 0.61) / outline.H,
      },
      'sink',
    );
    f.items = data.items.map((i) => piece(i));
    return f;
  }

  const api = { fresh, validate, fmt, num, parsePosition, unitFactor, unitLabel };
  if (typeof module !== 'undefined') module.exports = api;
  else root.RoomModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
