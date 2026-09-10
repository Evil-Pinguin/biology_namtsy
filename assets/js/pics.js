/* =============================================================
   Pics — свои картинки учителя.
   Хранятся в этом браузере в IndexedDB и подменяют рисунки
   из папки assets/img. Ничего не отправляется на сервер,
   поэтому работает и без интернета.

   Если IndexedDB в браузере нет (очень старый браузер),
   картинки живут только до закрытия вкладки — модуль об этом
   сообщает через Pics.backend().
   ============================================================= */
(function (global) {
  'use strict';

  const DB_NAME = 'namtsy.pics';
  const DB_VERSION = 1;
  const STORE = 'pics';
  const MAX_SIDE = 900;      // как у рисунков в assets/img
  const QUALITY = 0.82;
  const SHRINK_TIMEOUT = 1200;

  let db = null;
  let backend = 'memory';
  let started = null;
  const cache = {};          // ключ -> адрес картинки (blob: или data:)
  const mem = {};            // запасное хранилище, если IndexedDB нет

  /* ---------- IndexedDB ---------- */
  function open() {
    return new Promise((resolve) => {
      const idb = global.indexedDB;
      if (!idb) { backend = 'memory'; return resolve(null); }
      let req;
      try { req = idb.open(DB_NAME, DB_VERSION); }
      catch (e) { backend = 'memory'; return resolve(null); }

      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => { db = req.result; backend = 'idb'; resolve(db); };
      req.onerror = () => { backend = 'memory'; resolve(null); };
      req.onblocked = () => { backend = 'memory'; resolve(null); };
    });
  }

  function idbAll() {
    return new Promise((resolve, reject) => {
      const os = db.transaction(STORE, 'readonly').objectStore(STORE);
      const keys = os.getAllKeys();
      const vals = os.getAll();
      let err = null;
      const done = () => {
        if (err) return reject(err);
        if (keys.readyState === 'done' && vals.readyState === 'done') resolve([keys.result, vals.result]);
      };
      keys.onsuccess = done; vals.onsuccess = done;
      keys.onerror = () => { err = keys.error; reject(err); };
      vals.onerror = () => { err = vals.error; reject(err); };
    });
  }

  function idbPut(key, blob) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error || new Error('Не удалось сохранить картинку'));
    });
  }

  function idbDel(key) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error || new Error('Не удалось удалить картинку'));
    });
  }

  /* ---------- адрес картинки ---------- */
  function toUrl(blob) {
    if (global.URL && typeof global.URL.createObjectURL === 'function') {
      return Promise.resolve(global.URL.createObjectURL(blob));
    }
    return new Promise((resolve, reject) => {
      const r = new global.FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Не удалось прочитать картинку'));
      r.readAsDataURL(blob);
    });
  }

  /* в хранилище лежит { type, data: ArrayBuffer } — обычный Blob
     между перезагрузками страницы может не прочитаться */
  function toBuf(blob) {
    return new Promise((resolve, reject) => {
      const r = new global.FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Не удалось прочитать картинку'));
      r.readAsArrayBuffer(blob);
    });
  }

  function toBlob(rec) {
    if (!rec) return null;
    if (typeof rec.arrayBuffer === 'function' && !rec.data) return rec;   // запись старого вида
    return new global.Blob([rec.data], { type: rec.type || 'image/jpeg' });
  }

  function dropUrl(key) {
    if (cache[key] && global.URL && typeof global.URL.revokeObjectURL === 'function') {
      try { global.URL.revokeObjectURL(cache[key]); } catch (e) {}
    }
    delete cache[key];
  }

  /* ---------- сжатие до размера остальных рисунков ---------- */
  function shrink(file) {
    return new Promise((resolve) => {
      const type = String((file && file.type) || '');
      if (type.indexOf('image/') !== 0) return resolve(null);   // не картинка — пусть решает вызывающий

      let done = false;
      const finish = (blob) => { if (!done) { done = true; resolve(blob); } };
      // если сжать не удалось (браузер без canvas, необычный формат) — сохраним как есть
      const timer = setTimeout(() => finish(file), SHRINK_TIMEOUT);

      const im = new global.Image();
      im.onload = () => {
        clearTimeout(timer);
        try {
          const w = im.naturalWidth || im.width;
          const h = im.naturalHeight || im.height;
          if (!w || !h) return finish(file);
          const k = Math.min(1, MAX_SIDE / Math.max(w, h));
          const cw = Math.max(1, Math.round(w * k));
          const ch = Math.max(1, Math.round(h * k));
          const canvas = global.document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) return finish(file);
          ctx.fillStyle = '#eef1f4';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(im, 0, 0, cw, ch);
          canvas.toBlob((b) => finish(b || file), 'image/jpeg', QUALITY);
        } catch (e) {
          finish(file);
        }
      };
      im.onerror = () => { clearTimeout(timer); finish(file); };
      toUrl(file).then((u) => { im.src = u; }, () => { clearTimeout(timer); finish(null); });
    });
  }

  async function load() {
    await open();
    try {
      if (backend === 'idb') {
        const [keys, vals] = await idbAll();
        for (let i = 0; i < keys.length; i++) {
          const b = toBlob(vals[i]);
          if (b) cache[keys[i]] = await toUrl(b);
        }
      } else {
        for (const k of Object.keys(mem)) {
          const b = toBlob(mem[k]);
          if (b) cache[k] = await toUrl(b);
        }
      }
    } catch (e) {
      backend = 'memory';
    }
    return Pics;
  }

  const Pics = {
    /* заполнить кэш из хранилища; повторный вызов просто ждёт первого */
    init() {
      if (!started) started = load();
      return started;
    },

    backend() { return backend; },
    has(key) { return !!key && !!cache[key]; },
    url(key) { return (key && cache[key]) || ''; },
    keys() { return Object.keys(cache); },
    count() { return Object.keys(cache).length; },
    size() {
      return Object.keys(mem).reduce((n, k) => n + (mem[k] ? mem[k].size : 0), 0);
    },

    /* сохранить готовый файл (без сжатия) — используется в тестах и как запасной путь */
    async setBlob(key, blob) {
      if (!key) throw new Error('Не указано, к чему относится картинка');
      if (!started) await this.init();
      const rec = { type: blob.type || 'image/jpeg', data: await toBuf(blob) };
      if (backend === 'idb') {
        if (!db) await open();
        await idbPut(key, rec);
      } else {
        mem[key] = rec;
      }
      dropUrl(key);
      cache[key] = await toUrl(blob);
      return cache[key];
    },

    /* принять файл от учителя: сжать и сохранить */
    async set(key, file) {
      if (!file) throw new Error('Файл не выбран');
      const blob = await shrink(file);
      if (!blob) throw new Error('Это не картинка. Подойдёт файл JPG, PNG или WEBP');
      return this.setBlob(key, blob);
    },

    async remove(key) {
      if (backend === 'idb') {
        if (!db) await open();
        await idbDel(key);
      }
      delete mem[key];
      dropUrl(key);
      return true;
    },

    /* скачать свою картинку под именем из поля «Файл картинки»,
       чтобы положить её в папку assets/img и опубликовать для всех */
    async download(key, filename) {
      const url = cache[key];
      if (!url) throw new Error('Своей картинки нет — скачивать нечего');
      const a = global.document.createElement('a');
      a.href = url;
      a.download = filename || (key + '.jpg');
      global.document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 300);
      return true;
    },

    /* для отладки и тестов */
    _cache: cache
  };

  global.Pics = Pics;
})(typeof window !== 'undefined' ? window : globalThis);
