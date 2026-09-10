/* =============================================================
   Интерактивные задания · Намский улус · 5 класс
   Структура каждого экрана:
   заголовок → инструкция → задание → варианты → проверка → результат
   ============================================================= */
(function (global) {
  'use strict';

  const LETTERS = ['А', 'Б', 'В', 'Г'];
  const ROUND_LEN = 10;

  const view = document.getElementById('view');
  const backBtn = document.getElementById('backBtn');
  const head = document.getElementById('head');
  const soundBtn = document.getElementById('soundBtn');

  const state = {
    route: 'home',
    quiz: null,
    cards: null,
    learn: { tab: 'all', id: null },
    editor: { tab: 'q', openId: null }
  };

  const Pics = global.Pics || {
    has() { return false; }, url() { return ''; }, count() { return 0; },
    backend() { return 'none'; }, init() { return Promise.resolve(this); }
  };
  const picKey = (id) => 'sp:' + id;

  /* своя картинка из браузера важнее рисунка из папки assets/img */
  function picSrc(sp) {
    const own = Pics.url(picKey(sp.id));
    if (own) return own;
    return sp.img ? 'assets/img/' + sp.img : '';
  }
  function hasPic(sp) { return !!picSrc(sp); }

  /* ---------------- утилиты ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }
  const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);

  /* 1 вопрос · 2 вопроса · 5 вопросов */
  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
  }

  function parseHash() {
    const h = (global.location && global.location.hash) || '';
    const parts = h.replace(/^#\/?/, '').split('/');
    return { route: parts[0] || 'home', param: parts[1] || '' };
  }
  function go(route, param) {
    const h = '#/' + route + (param ? '/' + param : '');
    if (global.location) global.location.hash = h;
    else render();
  }

  /* текущее задание: викторина или угадайка по картинке */
  function active() { return state.route === 'cards' ? state.cards : state.quiz; }

  /* =========================================================
     ЭКРАН 1 · СПИСОК ЗАДАНИЙ
     ========================================================= */
  function renderHome() {
    const qs = Content.questions();
    const n = (setId) => qs.filter((q) => q.set === setId).length;
    const words = (setId) => {
      const c = n(setId);
      return c + ' ' + plural(c, 'вопрос', 'вопроса', 'вопросов');
    };
    const pics = Content.species().filter(hasPic).length;
    const tasks = [
      { r: 'learn', n: 'Животные, растения и местности', d: Content.species().length + ' карточек с рисунками' },
      { r: 'quiz/rodina', n: 'Моя Родина — Намский улус', d: words('rodina') + ' про наш край' },
      { r: 'cards', n: 'Закрепление: угадай по картинке', d: Math.min(ROUND_LEN, pics) + ' картинок — назови, кто или что это' },
      { r: 'quiz/nature', n: 'Природа улуса', d: words('nature') + ' про животных и растения' }
    ];

    view.innerHTML = `
      <h1 class="title">Интерактивные задания</h1>
      <p class="lead">Намский улус · Республика Саха (Якутия). Выбери задание.</p>

      <div class="tasks">
        ${tasks.map((t, i) => `
          <button class="task-row" data-go="${t.r}" data-sfx="click">
            <span class="task-num">${i + 1}</span>
            <span class="task-body">
              <span class="task-name">${esc(t.n)}</span>
              <span class="task-note">${esc(t.d)}</span>
            </span>
            <span class="task-go" aria-hidden="true">→</span>
          </button>`).join('')}
      </div>

      <button class="teacher" data-go="editor" data-sfx="click">Для учителя: изменить задания</button>
    `;
  }

  /* =========================================================
     ЭКРАН 2 · ВИКТОРИНА (ВОПРОС ТЕКСТОМ)
     ========================================================= */
  function newSession(extra) {
    return Object.assign({
      idx: 0, picked: null, checked: false, firstTry: true,
      correctFirst: 0, dead: [], hint: false, log: [], done: false, startedAt: Date.now()
    }, extra);
  }

  function startQuiz(setId) {
    const set = Content.sets().filter((s) => s.id === setId)[0] || Content.sets()[0];
    const all = Content.questions().filter((q) => q.set === set.id);
    state.quiz = newSession({
      type: 'quiz', set: set.id, title: set.title,
      pool: shuffle(all).slice(0, Math.min(ROUND_LEN, all.length))
    });
  }

  function renderQuiz(setId) {
    const s = state.quiz;
    if (!s || s.set !== setId || !s.pool.length) startQuiz(setId);
    if (state.quiz.done) return renderResult();
    renderQuestion();
  }

  /* =========================================================
     ЭКРАН 3 · ЗАКРЕПЛЕНИЕ (УГАДАЙ ПО КАРТИНКЕ)
     ========================================================= */
  const catOf = (sp) => (sp.group === 'trees' || sp.group === 'flowers' ? 'flora'
    : sp.group === 'places' ? 'places' : 'fauna');

  function askFor(sp) {
    const c = catOf(sp);
    if (c === 'flora') return 'Как называется это растение?';
    if (c === 'places') return 'Как называется это место?';
    return 'Как называется это животное?';
  }

  function startCards() {
    const withPic = Content.species().filter(hasPic);
    const picked = shuffle(withPic).slice(0, Math.min(ROUND_LEN, withPic.length));
    const pool = picked.map((sp) => {
      const same = shuffle(Content.species().filter((x) => x.id !== sp.id && catOf(x) === catOf(sp)));
      const rest = shuffle(Content.species().filter((x) => x.id !== sp.id && catOf(x) !== catOf(sp)));
      const names = same.concat(rest).slice(0, 3).map((x) => x.name);
      const options = shuffle([sp.name].concat(names));
      return {
        id: 'pic-' + sp.id, topic: sp.group, img: picSrc(sp), emoji: sp.emoji,
        text: askFor(sp), options, answer: options.indexOf(sp.name),
        hint: sp.facts[0],
        explain: sp.name + '. ' + (sp.facts[1] || sp.facts[0])
      };
    });
    state.cards = newSession({ type: 'cards', title: 'Закрепление', pool });
  }

  function renderCards() {
    if (!state.cards || !state.cards.pool.length) startCards();
    if (state.cards.done) return renderResult();
    renderQuestion();
  }

  /* =========================================================
     ОБЩИЙ ЭКРАН ЗАДАНИЯ
     ========================================================= */
  function renderQuestion() {
    const s = active();
    const q = s.pool[s.idx];
    const total = s.pool.length;

    view.innerHTML = `
      <h1 class="title">${esc(s.title)}</h1>
      <p class="step">Задание ${s.idx + 1} из ${total}</p>
      <div class="bar"><span style="width:${pct(s.idx, total)}%"></span></div>

      ${q.img ? `<img class="quiz-photo" src="${esc(q.img)}" alt="" data-emoji="${esc(q.emoji || '')}" loading="lazy">` : ''}

      <h2 class="q">${esc(q.text)}</h2>
      <p class="instr">${s.checked ? 'Правильный ответ найден.' : 'Выбери один ответ и нажми «Проверить».'}</p>

      <div class="answers" role="group" aria-label="Варианты ответа">
        ${q.options.map((o, i) => {
          const dead = s.dead.indexOf(i) !== -1;
          const cls = ['answer'];
          let mark = '';
          if (s.checked && i === q.answer) { cls.push('ok'); mark = '<span class="mark" aria-hidden="true">✓</span>'; }
          else if (dead) { cls.push('no'); mark = '<span class="mark" aria-hidden="true">✕</span>'; }
          else if (s.picked === i) cls.push('sel');
          const label = dead ? 'Неправильно' : (s.checked && i === q.answer ? 'Правильно' : '');
          return `<button class="${cls.join(' ')}" data-i="${i}" data-sfx="select"
                     ${dead || s.checked ? 'disabled' : ''} aria-pressed="${s.picked === i && !dead}">
              <span class="dot" aria-hidden="true"></span>
              <span class="txt">${esc(o)}</span>
              ${mark}${label ? `<span class="sr">${label}</span>` : ''}
            </button>`;
        }).join('')}
      </div>

      <div id="feedback">
        ${s.checked ? `<div class="msg ok" role="status"><span class="sign" aria-hidden="true">✓</span>
            <span><b>Правильно!</b><span>${esc(q.explain)}</span></span></div>` : ''}
        ${!s.checked && s.dead.length ? `<div class="msg no" role="status"><span class="sign" aria-hidden="true">✕</span>
            <span><b>Неправильно.</b><span>Попробуй выбрать другой вариант.</span></span></div>` : ''}
        ${!s.checked && s.hint ? `<div class="msg hint"><span class="sign" aria-hidden="true">💡</span>
            <span><b>Подсказка</b><span>${esc(q.hint)}</span></span></div>` : ''}
      </div>

      <div class="actions">
        ${s.checked
          ? `<button class="btn primary" id="nextBtn" data-sfx="click">${s.idx + 1 >= total ? 'Показать результат' : 'Следующее задание →'}</button>`
          : `<button class="btn primary" id="checkBtn" data-sfx="click" ${s.picked === null ? 'disabled' : ''}>Проверить</button>
             ${!s.hint ? '<button class="linkish" id="hintBtn" data-sfx="click">Нужна подсказка</button>' : ''}`}
      </div>
    `;

    $('.answers').addEventListener('click', (e) => {
      const b = e.target.closest('.answer');
      if (!b || s.checked) return;
      const i = parseInt(b.dataset.i, 10);
      if (s.dead.indexOf(i) !== -1) return;
      s.picked = i;
      renderQuestion();
    });

    const check = $('#checkBtn');
    if (check) check.addEventListener('click', () => checkAnswer());
    const hint = $('#hintBtn');
    if (hint) hint.addEventListener('click', () => { s.hint = true; Sound.play('hint'); renderQuestion(); });
    const next = $('#nextBtn');
    if (next) next.addEventListener('click', nextQuestion);
  }

  function checkAnswer() {
    const s = active();
    if (!s || s.checked || s.picked === null) return;
    const q = s.pool[s.idx];

    if (s.picked === q.answer) {
      s.checked = true;
      if (s.firstTry) s.correctFirst += 1;
      Sound.play('correct');
      Store.recordAnswer(q, q.topic, s.firstTry);
      s.log.push({ q, ok: s.firstTry });
      renderQuestion();
    } else {
      s.dead.push(s.picked);
      s.firstTry = false;
      s.picked = null;
      Sound.play('wrong');
      renderQuestion();
    }
  }

  function nextQuestion() {
    const s = active();
    if (!s) return;
    s.idx += 1;
    s.picked = null;
    s.checked = false;
    s.firstTry = true;
    s.dead = [];
    s.hint = false;
    if (s.idx >= s.pool.length) {
      s.done = true;
      const p = pct(s.correctFirst, s.pool.length);
      Store.recordRound(p, false, s.correctFirst);
      Sound.play(p >= 70 ? 'win' : 'lose');
    }
    if (s.type === 'cards') renderCards(); else renderQuiz(s.set);
  }

  function renderResult() {
    const s = active();
    const total = s.pool.length;
    const good = s.correctFirst;
    const p = pct(good, total);
    const praise = p === 100 ? 'Отлично! Все ответы верные'
      : p >= 70 ? 'Отличная работа!'
      : p >= 40 ? 'Хорошо, но можно лучше'
      : 'Стоит повторить тему';
    const wrong = s.log.filter((r) => !r.ok);

    view.innerHTML = `
      <h1 class="title">${esc(praise)}</h1>
      <p class="result-score"><b>${good}</b> из <b>${total}</b> правильных ответов</p>
      <div class="bar"><span style="width:${p}%"></span></div>
      <p class="result-pct">${p}%</p>

      <div class="btn-row" style="margin-top:24px">
        <button class="btn primary" id="againBtn" data-sfx="click">Пройти ещё раз</button>
        <button class="btn" data-go="home" data-sfx="click">К списку заданий</button>
      </div>

      ${wrong.length ? `
        <section class="mistakes">
          <h2>Разберём ошибки</h2>
          <ul>
            ${wrong.map((r) => `<li>
              ${r.q.img ? `<img class="mini" src="${esc(r.q.img)}" alt="">` : esc(r.q.text)}
              <span class="right">Правильный ответ: ${esc(r.q.options[r.q.answer])}</span></li>`).join('')}
          </ul>
        </section>` : ''}
    `;

    $('#againBtn').addEventListener('click', () => {
      Sound.play('click');
      if (s.type === 'cards') { startCards(); renderCards(); } else { startQuiz(s.set); renderQuiz(s.set); }
    });
  }

  /* =========================================================
     ЭКРАН 4 · ЗНАКОМСТВО
     ========================================================= */
  const TABS = [
    { id: 'all', title: 'Все' },
    { id: 'fauna', title: 'Животные' },
    { id: 'flora', title: 'Растения' },
    { id: 'places', title: 'Местности' }
  ];

  function learnList() {
    return Content.species().filter((sp) => state.learn.tab === 'all' || catOf(sp) === state.learn.tab);
  }

  function renderLearn() {
    if (state.learn.id) return renderLearnOne();
    const list = learnList();
    view.innerHTML = `
      <h1 class="title">Животные, растения и местности</h1>
      <p class="lead">Выбери, о ком или о чём хочешь узнать.</p>

      <div class="tabs" role="group" aria-label="Фильтр">
        ${TABS.map((t) => `<button class="tab ${state.learn.tab === t.id ? 'on' : ''}" data-tab="${t.id}" data-sfx="select">${t.title}</button>`).join('')}
      </div>

      <div class="grid-cards">
        ${list.map((sp) => `
          <button class="pcard" data-sp="${esc(sp.id)}" data-sfx="click">
            ${hasPic(sp)
              ? `<img src="${esc(picSrc(sp))}" alt="" data-emoji="${esc(sp.emoji)}" loading="lazy">`
              : `<span class="noimg" aria-hidden="true">${sp.emoji}</span>`}
            <span class="nm">${esc(sp.name)}</span>
          </button>`).join('')}
      </div>
    `;

    $('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      state.learn.tab = b.dataset.tab;
      renderLearn();
    });
  }

  function renderLearnOne() {
    const all = Content.species();
    const sp = all.filter((x) => x.id === state.learn.id)[0];
    if (!sp) { state.learn.id = null; return renderLearn(); }
    const list = learnList();
    const i = list.map((x) => x.id).indexOf(sp.id);
    const prev = i > 0 ? list[i - 1] : null;
    const nextSp = i >= 0 && i < list.length - 1 ? list[i + 1] : null;

    view.innerHTML = `
      ${hasPic(sp) ? `<img class="photo" src="${esc(picSrc(sp))}" alt="${esc(sp.name)}" data-emoji="${esc(sp.emoji)}" loading="lazy">` : ''}
      <h1 class="title">${esc(sp.name)}</h1>
      <p class="tagline">${esc(sp.status)}</p>
      <ul class="facts">${sp.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>

      <div class="actions">
        <button class="btn" id="speakBtn" data-sfx="click">🔊 Прочитать вслух</button>
        <div class="btn-row">
          ${prev ? `<button class="btn" data-sp="${esc(prev.id)}" data-sfx="click">← ${esc(short(prev.name))}</button>` : ''}
          ${nextSp ? `<button class="btn" data-sp="${esc(nextSp.id)}" data-sfx="click">${esc(short(nextSp.name))} →</button>` : ''}
        </div>
        <button class="btn" id="toList" data-sfx="click">← К списку</button>
      </div>
    `;

    $('#speakBtn').addEventListener('click', () => { Speaker.say(sp.name + '. ' + sp.facts.join(' ')); Sound.play('hint'); });
    $('#toList').addEventListener('click', () => { state.learn.id = null; Sound.play('click'); renderLearn(); });
  }

  function short(name) {
    const w = name.split(' ')[0].replace(/[,()]/g, '');
    return w.length > 14 ? w.slice(0, 13) + '…' : w;
  }

  /* =========================================================
     ЭКРАН 5 · РЕДАКТОР (ДЛЯ УЧИТЕЛЯ)
     ========================================================= */
  const ED_TABS = [
    { id: 'q', title: 'Вопросы' },
    { id: 's', title: 'Рисунки и рассказы' }
  ];

  function edItems() {
    return state.editor.tab === 's' ? Content.species() : Content.questions();
  }

  function renderEditor() {
    const tab = state.editor.tab;
    const counts = { q: Content.questions().length, s: Content.species().length };
    const changed = Content.changedCount();

    view.innerHTML = `
      <h1 class="title">Задания (для учителя)</h1>
      <p class="lead">Меняй любые слова и картинки. Правки сохраняются в этом браузере${changed ? `, изменено блоков: ${changed}` : ''}${Pics.count() ? `, своих картинок: ${Pics.count()}` : ''}.</p>

      <div class="tabs" id="edTabs">
        ${ED_TABS.map((t) => `<button class="tab ${tab === t.id ? 'on' : ''}" data-tab="${t.id}" data-sfx="select">${t.title} · ${counts[t.id]}</button>`).join('')}
      </div>

      <div class="panel">
        <div class="btn-row">
          <button class="btn" id="expBtn" data-sfx="click">Скачать правки</button>
          <button class="btn" id="impBtn" data-sfx="click">Загрузить правки</button>
          <input type="file" id="impFile" accept="application/json,.json" hidden>
          <button class="btn" id="resetBtn" data-sfx="click" ${changed ? '' : 'disabled'}>Вернуть исходные тексты</button>
        </div>
      </div>

      <div class="items" id="edList">
        ${edItems().map((it) => edItem(tab, it)).join('')}
      </div>
    `;

    $('#edTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      state.editor.tab = b.dataset.tab;
      state.editor.openId = null;
      renderEditor();
    });

    $('#expBtn').addEventListener('click', () => {
      const blob = new Blob([Content.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'namsky-pravki.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
      Sound.play('toggle');
      toast('Файл с правками скачан');
    });

    const file = $('#impFile');
    $('#impBtn').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const n = Content.importJSON(String(reader.result));
          Sound.play('win');
          toast('Загружено правок: ' + n);
          renderEditor();
        } catch (err) {
          Sound.play('wrong');
          toast('Файл не подошёл: ' + err.message);
        }
      };
      reader.readAsText(f);
    });

    $('#resetBtn').addEventListener('click', () => {
      Content.resetAll();
      state.quiz = null;
      state.cards = null;
      Sound.play('toggle');
      toast('Вернули исходные тексты');
      renderEditor();
    });

    $('#edList').addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        const wrap = pick.closest('[data-answer]');
        wrap.dataset.answer = pick.dataset.pick;
        $$('[data-pick]', wrap).forEach((b) => b.classList.toggle('on', b === pick));
        Sound.play('select');
        return;
      }
      const save = e.target.closest('[data-save]');
      if (save) { saveItem(save.dataset.save); return; }
      const rev = e.target.closest('[data-revert]');
      if (rev) {
        Content.revert(state.editor.tab, rev.dataset.revert);
        state.quiz = null;
        state.cards = null;
        state.editor.openId = rev.dataset.revert;
        Sound.play('toggle');
        toast('Правки этого блока отменены');
        renderEditor();
      }
    });

    $('#edList').addEventListener('click', (e) => {
      const pick = e.target.closest('[data-picpick]');
      if (pick) {
        const f = $(`[data-picfile="${pick.dataset.picpick}"]`, pick.closest('.item'));
        if (f) f.click();
        return;
      }
      const del = e.target.closest('[data-picdel]');
      if (del) { dropPic(del.dataset.picdel); return; }
      const down = e.target.closest('[data-picdown]');
      if (down) { savePicFile(down.dataset.picdown); }
    });

    $('#edList').addEventListener('change', (e) => {
      const f = e.target.closest('[data-picfile]');
      if (f && f.files && f.files[0]) uploadPic(f.dataset.picfile, f.files[0]);
    });

    if (state.editor.openId) {
      const d = $(`#edList [data-item="${state.editor.openId}"]`);
      if (d) { d.open = true; try { if (typeof d.scrollIntoView === 'function') d.scrollIntoView({ block: 'center' }); } catch (e) {} }
    }
  }

  function edPic(it) {
    const key = picKey(it.id);
    const own = Pics.url(key);
    const preview = own
      ? `<img class="ed-pic" src="${esc(own)}" alt="Своя картинка: ${esc(it.name)}">`
      : (it.img
        ? `<img class="ed-pic" src="assets/img/${esc(it.img)}" alt="${esc(it.name)}" data-emoji="${esc(it.emoji)}">`
        : `<span class="ed-pic noimg" aria-hidden="true">${esc(it.emoji)}</span>`);
    const note = own
      ? 'Показывается ваша картинка. Она сохранена в этом браузере — на других компьютерах её не будет.'
      : (it.img
        ? 'Показывается рисунок из папки assets/img.'
        : 'Картинки нет: в заданиях вместо неё эмодзи, а в угадайку этот объект не попадает.');

    return `
      <div class="field">
        <label>Картинка</label>
        <div class="pic-row">
          ${preview}
          <div class="pic-side">
            <p class="pic-note">${esc(note)}</p>
            <div class="btn-row">
              <button type="button" class="btn" data-picpick="${esc(it.id)}" data-sfx="click">Загрузить свою картинку</button>
              ${own ? `<button type="button" class="btn" data-picdown="${esc(it.id)}" data-sfx="click">Скачать картинку</button>
                     <button type="button" class="btn" data-picdel="${esc(it.id)}" data-sfx="click">Убрать свою картинку</button>` : ''}
            </div>
            <input type="file" accept="image/*" data-picfile="${esc(it.id)}" hidden>
          </div>
        </div>
      </div>`;
  }

  function edItem(tab, it) {
    const ch = Content.changed(tab, it.id);
    const sum = tab === 'q' ? esc(it.text.length > 70 ? it.text.slice(0, 70) + '…' : it.text) : esc(it.name);
    const tag = tab === 'q' ? `<span class="sum-tag">${it.set === 'rodina' ? 'Родина' : 'Природа'}</span>` : '';

    const body = tab === 'q' ? `
        <div class="field"><label>Текст вопроса</label>
          <textarea rows="2" data-field="text">${esc(it.text)}</textarea></div>
        <div class="field"><label>Набор заданий</label>
          <select data-field="set">
            ${Content.sets().map((s) => `<option value="${s.id}" ${it.set === s.id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Варианты ответа (нажми букву правильного)</label>
          <div data-answer="${it.answer}">
            ${it.options.map((o, i) => `
              <div class="opt-edit">
                <button type="button" class="pick ${i === it.answer ? 'on' : ''}" data-pick="${i}" data-sfx="select">${LETTERS[i]}</button>
                <input type="text" data-opt="${i}" value="${esc(o)}">
              </div>`).join('')}
          </div></div>
        <div class="field"><label>Подсказка</label><textarea rows="2" data-field="hint">${esc(it.hint)}</textarea></div>
        <div class="field"><label>Объяснение правильного ответа</label><textarea rows="3" data-field="explain">${esc(it.explain)}</textarea></div>`
      : `
        <div class="field"><label>Название (его и угадывают дети)</label><input type="text" data-field="name" value="${esc(it.name)}"></div>
        <div class="field"><label>Подпись</label><input type="text" data-field="status" value="${esc(it.status)}"></div>
        <div class="field"><label>Эмодзи (показывается, если картинки нет)</label><input type="text" data-field="emoji" value="${esc(it.emoji)}"></div>
        ${edPic(it)}
        <div class="field"><label>Файл рисунка в папке assets/img — он виден всем (например, s07-volk.jpg)</label>
          <input type="text" data-field="img" value="${esc(it.img || '')}"></div>
        <div class="field"><label>Что рассказать (каждая строка — отдельный пункт)</label>
          <textarea rows="4" data-field="factsText">${esc(it.facts.join('\n'))}</textarea></div>`;

    return `
      <details class="item" data-item="${esc(it.id)}" ${state.editor.openId === it.id ? 'open' : ''}>
        <summary><span class="sum-text">${sum}</span>${tag}${ch ? '<span class="sum-tag">изменено</span>' : ''}</summary>
        <div class="item-body">
          ${body}
          <div class="btn-row" style="margin-top:16px">
            <button class="btn primary" data-save="${esc(it.id)}" data-sfx="click">Сохранить</button>
            ${ch ? `<button class="btn" data-revert="${esc(it.id)}" data-sfx="click">Отменить правки</button>` : ''}
          </div>
        </div>
      </details>`;
  }

  function saveItem(id) {
    const box = $(`#edList [data-item="${id}"]`);
    if (!box) return;
    const val = (f) => { const el = $(`[data-field="${f}"]`, box); return el ? el.value.trim() : null; };

    if (state.editor.tab === 'q') {
      const text = val('text');
      const hint = val('hint');
      const explain = val('explain');
      const options = $$('[data-opt]', box).map((i) => i.value.trim());
      const answer = parseInt($('[data-answer]', box).dataset.answer, 10);
      if (!text) return fail('Текст вопроса не может быть пустым');
      if (options.some((o) => !o)) return fail('Все четыре варианта должны быть заполнены');
      if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return fail('Варианты ответа не должны повторяться');
      if (!(answer >= 0 && answer <= 3)) return fail('Отметь правильный вариант');
      if (!hint || !explain) return fail('Подсказка и объяснение не могут быть пустыми');
      Content.set('q', id, { text, options, answer, hint, explain, set: val('set') });
    } else {
      const name = val('name');
      const facts = val('factsText').split('\n').map((x) => x.trim()).filter(Boolean);
      if (!name) return fail('Название не может быть пустым');
      if (!facts.length) return fail('Нужен хотя бы один пункт рассказа');
      const patch = { name, status: val('status') || 'Обычный вид', emoji: val('emoji') || '🌿', facts };
      const img = val('img');
      if (img) patch.img = img;
      Content.set('s', id, patch);
    }

    state.editor.openId = id;
    state.quiz = null;
    state.cards = null;
    Sound.play('correct');
    toast('Сохранено');
    renderEditor();
  }

  function fail(msg) { Sound.play('wrong'); toast(msg); }

  function afterPic(id) {
    state.editor.openId = id;
    state.cards = null;
    renderEditor();
  }

  async function uploadPic(id, file) {
    try {
      await Pics.set(picKey(id), file);
      Sound.play('correct');
      toast('Картинка сохранена в этом браузере');
    } catch (err) {
      Sound.play('wrong');
      toast(err.message || 'Не удалось загрузить картинку');
    }
    afterPic(id);
  }

  async function dropPic(id) {
    try {
      await Pics.remove(picKey(id));
      Sound.play('toggle');
      toast('Своя картинка убрана');
    } catch (err) {
      Sound.play('wrong');
      toast('Не удалось убрать картинку');
    }
    afterPic(id);
  }

  async function savePicFile(id) {
    const box = $(`#edList [data-item="${id}"]`);
    const field = box ? $('[data-field="img"]', box) : null;
    let name = field && field.value.trim();
    if (!name) name = id + '.jpg';
    if (!/\.(jpe?g|png|webp)$/i.test(name)) name += '.jpg';
    try {
      await Pics.download(picKey(id), name);
      Sound.play('toggle');
      toast('Файл ' + name + ' скачан — положите его в папку assets/img');
    } catch (err) {
      Sound.play('wrong');
      toast(err.message || 'Не удалось скачать картинку');
    }
  }

  /* =========================================================
     РОУТЕР И ОБВЯЗКА
     ========================================================= */
  function render(forced) {
    const p = parseHash();
    const route = forced || p.route;
    state.route = route;

    const isHome = route === 'home';
    backBtn.hidden = isHome;
    head.classList.toggle('has-back', !isHome);
    if (route !== 'learn') state.learn.id = null;
    document.title = isHome ? 'Намский улус — интерактивные задания' : 'Задание · Намский улус';

    if (route === 'quiz') renderQuiz(p.param || 'rodina');
    else if (route === 'learn') renderLearn();
    else if (route === 'cards') renderCards();
    else if (route === 'editor') renderEditor();
    else { state.quiz = null; state.cards = null; renderHome(); }

    try { global.scrollTo(0, 0); } catch (e) {}
  }

  const ICO_ON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
    + '<path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3Zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.47 4.47 0 0 0 16.5 12ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z"/></svg>';
  const ICO_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
    + '<path fill="currentColor" d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63Zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z"/></svg>';

  function syncSound() {
    const on = Sound.isEnabled();
    soundBtn.innerHTML = on ? ICO_ON : ICO_OFF;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Звук включён' : 'Звук выключен');
    soundBtn.title = on ? 'Звук включён' : 'Звук выключен';
  }

  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t.closest) return;
      const sfx = t.closest('[data-sfx]');
      if (sfx) Sound.play(sfx.dataset.sfx);

      const g = t.closest('[data-go]');
      if (g) { e.preventDefault(); const parts = g.dataset.go.split('/'); go(parts[0], parts[1]); return; }

      const sp = t.closest('[data-sp]');
      if (sp) { state.learn.id = sp.dataset.sp; renderLearn(); }
    });

    backBtn.addEventListener('click', () => {
      if (state.route === 'learn' && state.learn.id) { state.learn.id = null; Sound.play('click'); renderLearn(); }
      else go('home');
    });

    soundBtn.addEventListener('click', () => {
      const on = Sound.setEnabled(!Sound.isEnabled());
      syncSound();
      if (on) Sound.play('toggle');
    });

    /* файл рисунка мог пропасть или быть назван неправильно — показываем эмодзи */
    document.addEventListener('error', (e) => {
      const el = e.target;
      if (!el || el.tagName !== 'IMG' || el.dataset.broken) return;
      el.dataset.broken = '1';
      const emoji = el.getAttribute('data-emoji');
      if (emoji) {
        const span = document.createElement('span');
        span.className = el.classList.contains('pcard') ? 'noimg' : 'noimg inline';
        span.textContent = emoji;
        if (el.parentNode) el.parentNode.replaceChild(span, el);
      } else {
        el.style.display = 'none';
      }
    }, true);

    global.addEventListener('hashchange', () => render());

    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') { if (state.route !== 'home') go('home'); return; }

      const s = active();
      if ((state.route === 'quiz' || state.route === 'cards') && s && !s.done) {
        if (!s.checked) {
          const n = parseInt(e.key, 10);
          const idx = !isNaN(n) && n >= 1 && n <= 4 ? n - 1 : LETTERS.indexOf(e.key.toUpperCase());
          if (idx !== undefined && idx >= 0 && idx < 4 && s.dead.indexOf(idx) === -1) {
            s.picked = idx;
            Sound.play('select');
            renderQuestion();
          } else if (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р') {
            s.hint = true; Sound.play('hint'); renderQuestion();
          } else if (e.key === 'Enter' && s.picked !== null) checkAnswer();
        } else if (e.key === 'Enter') nextQuestion();
      }
    });
  }

  syncSound();
  bind();
  render();
  Pics.init().then(() => { if (Pics.count()) render(); }).catch(() => {});

  global.App = {
    state, render, go, startQuiz, startCards, checkAnswer, nextQuestion,
    toast, picSrc, hasPic, ROUND_LEN
  };
})(typeof window !== 'undefined' ? window : globalThis);
