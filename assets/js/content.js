/* =============================================================
   Content — редактируемый слой данных.
   Исходные тексты лежат в data.js, правки учителя — в localStorage.
   Правки хранятся как «заплатки» (только изменённые поля), поэтому
   сброс всегда возвращает исходный текст.
   ============================================================= */
(function (global) {
  'use strict';

  const KEY = 'namtsy.content.v1';
  const EMPTY = { q: {}, s: {}, c: {} };

  function read() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
      if (!raw) return JSON.parse(JSON.stringify(EMPTY));
      const p = JSON.parse(raw);
      return {
        q: p.q && typeof p.q === 'object' ? p.q : {},
        s: p.s && typeof p.s === 'object' ? p.s : {},
        c: p.c && typeof p.c === 'object' ? p.c : {}
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(EMPTY));
    }
  }

  let ov = read();

  function save() {
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, JSON.stringify(ov));
    } catch (e) {}
  }

  function merge(list, map) {
    return list.map((item) => (map[item.id] ? Object.assign({}, item, map[item.id]) : Object.assign({}, item)));
  }

  function find(list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  const KINDS = { q: 'QUESTIONS', s: 'SPECIES', c: 'CARDS' };

  const Content = {
    /* --- чтение --- */
    questions() { return merge(global.DATA.QUESTIONS, ov.q); },
    species() { return merge(global.DATA.SPECIES, ov.s); },
    cards() { return merge(global.DATA.CARDS, ov.c); },
    topics() { return global.DATA.TOPICS; },
    topicById(id) { return global.DATA.topicById(id); },

    question(id) { return find(this.questions(), id); },
    spec(id) { return find(this.species(), id); },
    card(id) { return find(this.cards(), id); },

    /* --- правки --- */
    set(kind, id, patch) {
      if (!KINDS[kind]) throw new Error('неизвестный раздел: ' + kind);
      const base = find(global.DATA[KINDS[kind]], id);
      if (!base) throw new Error('нет элемента с id ' + id);
      const cur = ov[kind][id] || {};
      const next = {};
      Object.keys(patch).forEach((f) => {
        const val = patch[f];
        const same = JSON.stringify(val) === JSON.stringify(base[f]);
        if (same) return;                       // совпало с исходником — правку не храним
        next[f] = val;
      });
      if (Object.keys(next).length) ov[kind][id] = next;
      else delete ov[kind][id];
      save();
      return this;
    },

    revert(kind, id) {
      if (ov[kind] && ov[kind][id]) { delete ov[kind][id]; save(); }
      return this;
    },

    changed(kind, id) {
      return !!(ov[kind] && ov[kind][id] && Object.keys(ov[kind][id]).length);
    },

    changedCount() {
      return ['q', 's', 'c'].reduce((n, k) => n + Object.keys(ov[k]).length, 0);
    },

    resetAll() { ov = JSON.parse(JSON.stringify(EMPTY)); save(); },

    /* --- перенос правок между устройствами --- */
    exportJSON() { return JSON.stringify(ov, null, 2); },

    importJSON(text) {
      const p = JSON.parse(text);
      if (!p || typeof p !== 'object') throw new Error('Это не похоже на файл правок');
      const next = { q: {}, s: {}, c: {} };
      ['q', 's', 'c'].forEach((k) => {
        const src = p[k] || {};
        Object.keys(src).forEach((id) => {
          const base = find(global.DATA[KINDS[k]], id);
          if (base && src[id] && typeof src[id] === 'object') next[k][id] = src[id];
        });
      });
      ov = next;
      save();
      return this.changedCount();
    },

    _overrides() { return ov; }
  };

  global.Content = Content;
})(typeof window !== 'undefined' ? window : globalThis);
