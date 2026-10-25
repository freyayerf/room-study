(function (root) {
  'use strict';
  const stable = (value) =>
    JSON.stringify(value, function (k, v) {
      return v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((key) => [key, v[key]]),
          )
        : v;
    });
  class LayoutStore {
    constructor(storage, normalize, key = 'room-study-layouts-v1') {
      this.storage = storage;
      this.normalize = normalize;
      this.key = key;
    }
    id() {
      return (
        'layout-' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2))
      );
    }
    entry(data, name, extra = {}) {
      return {
        id: this.id(),
        name:
          String(name || 'Untitled layout')
            .trim()
            .slice(0, 80) || 'Untitled layout',
        createdAt: new Date().toISOString(),
        data: this.normalize(data),
        ...extra,
      };
    }
    cleanEntry(p) {
      if (
        !p ||
        typeof p.id !== 'string' ||
        p.id.length > 180 ||
        typeof p.name !== 'string' ||
        !p.name.trim() ||
        !Number.isFinite(Date.parse(p.createdAt))
      )
        throw Error('Invalid saved layout');
      return {
        id: p.id,
        name: p.name.trim().slice(0, 80),
        createdAt: p.createdAt,
        data: this.normalize(p.data),
      };
    }
    read() {
      const raw = this.storage.getItem(this.key);
      if (!raw) return { version: 1, plans: [], activeId: null };
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !Array.isArray(data.plans) || data.plans.length > 1000)
        throw Error('Invalid layout library');
      const ids = new Set();
      const plans = data.plans.map((p) => {
        const entry = this.cleanEntry(p);
        if (ids.has(entry.id)) throw Error('Duplicate saved layout');
        ids.add(entry.id);
        return entry;
      });
      return {
        version: 1,
        plans,
        activeId: typeof data.activeId === 'string' ? data.activeId : null,
      };
    }
    write(lib) {
      if (lib.plans.length > 1000) throw Error('Too many layouts');
      this.storage.setItem(this.key, JSON.stringify(lib));
      return lib;
    }
    signature(data) {
      return stable(this.normalize(data));
    }
    ensureStarting(data) {
      const lib = this.read();
      if (lib.plans.length) return null;
      const p = this.entry(data, 'Starting layout');
      lib.plans.push(p);
      lib.activeId = p.id;
      this.write(lib);
      return p;
    }
    create(data, name) {
      const lib = this.read(),
        p = this.entry(data, name);
      lib.plans.push(p);
      lib.activeId = p.id;
      this.write(lib);
      return p;
    }
    restore(id, current) {
      const lib = this.read(),
        target = lib.plans.find((p) => p.id === id);
      if (!target) throw Error('Layout not found');
      const sig = this.signature(current);
      let backup = null;
      if (!lib.plans.some((p) => this.signature(p.data) === sig)) {
        backup = this.entry(current, 'Before opening ' + target.name);
        lib.plans.push(backup);
      }
      lib.activeId = target.id;
      this.write(lib);
      return { data: this.normalize(target.data), backup };
    }
    rename(id, name) {
      const lib = this.read(),
        p = lib.plans.find((p) => p.id === id);
      if (!p) throw Error('Layout not found');
      p.name = String(name || '')
        .trim()
        .slice(0, 80);
      if (!p.name) throw Error('Enter a layout name');
      this.write(lib);
      return p;
    }
    export() {
      return { format: 'room-study-library', version: 1, plans: this.read().plans };
    }
    import(bundle) {
      if (
        !bundle ||
        bundle.format !== 'room-study-library' ||
        bundle.version !== 1 ||
        !Array.isArray(bundle.plans) ||
        bundle.plans.length > 1000
      )
        throw Error('Invalid library file');
      const entries = bundle.plans.map((p) => this.cleanEntry(p)),
        lib = this.read();
      let added = 0;
      for (const p of entries) {
        if (
          lib.plans.some(
            (old) =>
              old.id === p.id &&
              old.name === p.name &&
              this.signature(old.data) === this.signature(p.data),
          )
        )
          continue;
        if (lib.plans.some((old) => old.id === p.id)) p.id = this.id();
        lib.plans.push(p);
        added++;
      }
      if (lib.plans.length > 1000) throw Error('Too many layouts');
      this.write(lib);
      return added;
    }
  }
  const api = { LayoutStore, stable };
  if (typeof module !== 'undefined') module.exports = api;
  else root.RoomPlans = api;
})(typeof window !== 'undefined' ? window : globalThis);
