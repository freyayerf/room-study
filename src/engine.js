(function (root) {
  const defaults = {
    W: 600,
    H: 260,
    L: 140,
    NW: 90,
    ND: 72,
    NT: 188,
    M: 250,
    EW: 80,
    R: 40,
    ED: 94,
  };
  const fields = [
    ['W', 'Overall room width', 'A', 'Across the top wall'],
    ['H', 'Main room depth', 'B', 'Top wall to the lower main wall'],
    ['L', 'Left lower wall', 'C', 'Window wall to the recess'],
    ['NW', 'Recess width', 'D', 'Horizontal wall inside the recess'],
    ['ND', 'Recess depth', 'E', 'How far the recess cuts into the room'],
    ['NT', 'Top wall to recess', 'F', 'Top wall to the horizontal recess wall'],
    ['M', 'Middle lower wall', 'G', 'Recess to the left side of the entrance'],
    ['EW', 'Entrance width', 'H', 'Opening between the entrance walls'],
    ['R', 'Right lower wall', 'I', 'Entrance to the right exterior wall'],
    ['ED', 'Entrance depth', 'J', 'Length of the entrance extension'],
  ];
  const equations = [
    { W: 1, L: -1, NW: -1, M: -1, EW: -1, R: -1 },
    { H: 1, NT: -1, ND: -1 },
  ];

  const shapes = {
    rectangle: { defaults: { W: 500, H: 400 }, fields: fields.slice(0, 2), equations: [] },
    l: {
      defaults: { W: 600, H: 400, NW: 180, ND: 150, NT: 250 },
      fields: fields
        .filter((f) => ['W', 'H', 'NW', 'ND', 'NT'].includes(f[0]))
        .map((f) =>
          f[0] === 'NW'
            ? ['NW', 'Cutout width', 'D', 'Width removed from the lower right corner']
            : f[0] === 'ND'
              ? ['ND', 'Cutout depth', 'E', 'Depth removed from the lower right corner']
              : f[0] === 'NT'
                ? ['NT', 'Upper right wall', 'F', 'Top wall to the cutout']
                : f,
        ),
      equations: [equations[1]],
    },
    study: { defaults, fields, equations },
  };
  function template(shape = 'study') {
    return shapes[shape] || shapes.study;
  }
  function fieldsFor(shape) {
    return template(shape).fields;
  }
  function solve(known, shape = 'study') {
    const { defaults, equations } = template(shape);
    const keys = Object.keys(defaults),
      n = keys.length;
    let rows = equations.map((e) => keys.map((k) => e[k] || 0).concat(0));
    for (let k of keys)
      if (Number.isFinite(known[k]) && known[k] > 0)
        rows.push(keys.map((j) => (j === k ? 1 : 0)).concat(known[k]));
    let row = 0,
      pivots = [];
    for (let col = 0; col < n && row < rows.length; col++) {
      let p = rows.findIndex((r, i) => i >= row && Math.abs(r[col]) > 1e-8);
      if (p < 0) continue;
      [rows[p], rows[row]] = [rows[row], rows[p]];
      let d = rows[row][col];
      rows[row] = rows[row].map((v) => v / d);
      for (let i = 0; i < rows.length; i++) {
        if (i === row) continue;
        let f = rows[i][col];
        rows[i] = rows[i].map((v, j) => v - f * rows[row][j]);
      }
      pivots.push([row, col]);
      row++;
    }
    let conflict = rows.some(
        (r) => r.slice(0, n).every((v) => Math.abs(v) < 1e-7) && Math.abs(r[n]) > 0.01,
      ),
      values = {},
      derived = {};
    for (let [r, c] of pivots)
      if (rows[r].slice(0, n).every((v, j) => j === c || Math.abs(v) < 1e-7)) {
        values[keys[c]] = rows[r][n];
        if (!known[keys[c]]) derived[keys[c]] = rows[r][n];
      }
    if (conflict) return { values: { ...known }, derived: {}, conflict: true };
    return { values, derived, conflict: false };
  }
  function geometry(values, shape = 'study') {
    const { defaults } = template(shape);
    let ratio = values.W ? values.W / defaults.W : values.H ? values.H / defaults.H : 1;
    let g = {};
    for (let k in defaults) g[k] = values[k] || defaults[k] * ratio;
    // Unmeasured spans absorb a remaining run while retaining sketch proportions.
    for (const [total, parts] of shape === 'rectangle'
      ? []
      : shape === 'l'
        ? [['H', ['NT', 'ND']]]
        : [
            ['W', ['L', 'NW', 'M', 'EW', 'R']],
            ['H', ['NT', 'ND']],
          ]) {
      if (!values[total]) {
        g[total] = parts.reduce((a, k) => a + g[k], 0);
        continue;
      }
      let unknown = parts.filter((k) => !values[k]),
        remaining = g[total] - parts.filter((k) => values[k]).reduce((a, k) => a + values[k], 0),
        weight = unknown.reduce((a, k) => a + defaults[k], 0);
      if (remaining > 0) unknown.forEach((k) => (g[k] = (remaining * defaults[k]) / weight));
    }
    return g;
  }
  function points(g, shape = 'study') {
    if (shape === 'rectangle')
      return [
        [0, 0],
        [g.W, 0],
        [g.W, g.H],
        [0, g.H],
      ];
    if (shape === 'l')
      return [
        [0, 0],
        [g.W, 0],
        [g.W, g.H - g.ND],
        [g.W - g.NW, g.H - g.ND],
        [g.W - g.NW, g.H],
        [0, g.H],
      ];
    let { W, H, L, NW, ND, EW, R, ED } = g;
    return [
      [0, 0],
      [W, 0],
      [W, H],
      [W - R, H],
      [W - R, H + ED],
      [W - R - EW, H + ED],
      [W - R - EW, H],
      [L + NW, H],
      [L + NW, H - ND],
      [L, H - ND],
      [L, H],
      [0, H],
    ];
  }
  function contains(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      let a = poly[i],
        b = poly[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        c = !c;
    }
    return c;
  }
  function fits(rect, poly) {
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0)
      return false;
    const eps = Math.min(0.01, rect.w / 4, rect.h / 4);
    let corners = [
      [rect.x + eps, rect.y + eps],
      [rect.x + rect.w - eps, rect.y + eps],
      [rect.x + rect.w - eps, rect.y + rect.h - eps],
      [rect.x + eps, rect.y + rect.h - eps],
    ];
    if (!corners.every((p) => contains(p, poly))) return false; // Reject rectangles spanning a concave notch, too.
    for (let i = 0; i < poly.length; i++) {
      let a = poly[i],
        b = poly[(i + 1) % poly.length];
      if (
        a[0] === b[0] &&
        a[0] > rect.x + eps &&
        a[0] < rect.x + rect.w - eps &&
        Math.max(a[1], b[1]) > rect.y + eps &&
        Math.min(a[1], b[1]) < rect.y + rect.h - eps
      )
        return false;
      if (
        a[1] === b[1] &&
        a[1] > rect.y + eps &&
        a[1] < rect.y + rect.h - eps &&
        Math.max(a[0], b[0]) > rect.x + eps &&
        Math.min(a[0], b[0]) < rect.x + rect.w - eps
      )
        return false;
    }
    return true;
  }
  function overlap(a, b) {
    return (
      a.x < b.x + b.w - 0.1 &&
      a.x + a.w > b.x + 0.1 &&
      a.y < b.y + b.h - 0.1 &&
      a.y + a.h > b.y + 0.1
    );
  }
  const api = {
    defaults,
    fields,
    shapes,
    template,
    fieldsFor,
    solve,
    geometry,
    points,
    fits,
    overlap,
    contains,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.RoomEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
