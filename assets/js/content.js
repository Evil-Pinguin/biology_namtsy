/* =============================================================
   Content — редактируемый слой данных.
   Исходные тексты лежат в data.js, правки учителя — в localStorage.
   Правки хранятся как «заплатки» (только изменённые поля), поэтому
   сброс всегда возвращает исходный текст.
   ============================================================= */
(function (global) {
  'use strict';

  const KEY = 'namtsy.content.v1';
  /* q — вопросы, s — справочник (картинки и рассказы) */
  const KINDS = { q: 'QUESTIONS', s: 'SPECIES' };
  const KIND_KEYS = Object.keys(KINDS);

  function blank() {
    const o = {};
    KIND_KEYS.forEach((k) => { o[k] = {}; });
    return o;
  }
  const EMPTY = blank();

  function read() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
      if (!raw) return JSON.parse(JSON.stringify(EMPTY));
      const p = JSON.parse(raw);
      /* старые правки могут содержать удалённые разделы — их просто пропускаем */
      const out = blank();
      KIND_KEYS.forEach((k) => {
        if (p[k] && typeof p[k] === 'object') out[k] = p[k];
      });
      return out;
    } catch (e) {
      return blank();
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

  const Content = {
    /* --- чтение --- */
    questions() { return merge(global.DATA.QUESTIONS, ov.q); },
    species() { return merge(global.DATA.SPECIES, ov.s); },
    topics() { return global.DATA.TOPICS; },
    sets() { return global.DATA.SETS; },
    topicById(id) { return global.DATA.topicById(id); },

    question(id) { return find(this.questions(), id); },
    spec(id) { return find(this.species(), id); },

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
      return KIND_KEYS.reduce((n, k) => n + Object.keys(ov[k]).length, 0);
    },

    resetAll() { ov = JSON.parse(JSON.stringify(EMPTY)); save(); },

    /* --- перенос правок между устройствами --- */
    exportJSON() { return JSON.stringify(ov, null, 2); },

    importJSON(text) {
      const p = JSON.parse(text);
      if (!p || typeof p !== 'object') throw new Error('Это не похоже на файл правок');
      const next = blank();
      KIND_KEYS.forEach((k) => {
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
