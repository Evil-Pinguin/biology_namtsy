/* =============================================================
   Энсиэли · Биология Намского улуса
   Меню из трёх шагов: Знакомство → Закрепление → Викторина.
   Плюс редактор текстов заданий.
   ============================================================= */
(function (global) {
  'use strict';

  const LETTERS = ['А', 'Б', 'В', 'Г'];
  const QUIZ_LEN = 10;           // вопросов в одной викторине
  const ROUTES = ['home', 'learn', 'cards', 'quiz', 'editor'];
  const TITLES = {
    home: 'Меню', learn: 'Знакомство с животными', cards: 'Закрепление',
    quiz: 'Викторина', editor: 'Редактор заданий'
  };

  /* ---------------- утилиты ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

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

  const view = $('#view');
  const backBtn = $('#backBtn');

  const state = {
    route: 'home',
    learn: { group: 'all', id: null },
    cards: null,
    quiz: null,
    editor: { tab: 'q', openId: null }
  };

  function go(route) {
    if (ROUTES.indexOf(route) === -1) route = 'home';
    if (global.location) global.location.hash = '#/' + route;
    else render(route);
  }
  function routeFromHash() {
    const h = (global.location && global.location.hash) || '#/home';
    const raw = h.replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(raw) !== -1 ? raw : 'home';
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
  }

  function gem(html) {
    return `<div class="gem"><span class="gem-spark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="url(#gb)" d="M12 2c.6 4.9 2.6 8.1 5.2 9.1-2.6 1-4.6 4.2-5.2 9.1-.6-4.9-2.6-8.1-5.2-9.1C9.4 10.1 11.4 6.9 12 2Z"/><defs><linearGradient id="gb" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="#4285f4"/><stop offset=".55" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/></linearGradient></defs></svg>
      </span><div>${html}</div></div>`;
  }

  function ring(percent, label, sub) {
    const r = 52, c = 2 * Math.PI * r;
    return `<div class="ring-wrap">
      <svg viewBox="0 0 120 120" class="ring" width="168" height="168" role="img" aria-label="Результат ${percent} процентов">
        <defs><linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4285f4"/><stop offset=".55" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/>
        </linearGradient></defs>
        <circle cx="60" cy="60" r="${r}" class="ring-bg"></circle>
        <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - percent / 100)).toFixed(2)}"></circle>
      </svg>
      <div class="ring-text"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
    </div>`;
  }

  /* =========================================================
     1. МЕНЮ — три большие кнопки
     ========================================================= */
  function renderHome() {
    const n = { sp: Content.species().length, cards: Content.cards().length, q: Content.questions().length };
    view.innerHTML = `
      <section class="home-head">
        <h1>Биология <span class="grad">Намского улуса</span></h1>
        <p>Долина Энсиэли · Центральная Якутия</p>
      </section>

      <div class="big-list">
        <button class="big b1" data-go="learn" data-sfx="click">
          <span class="big-ico" aria-hidden="true">🦌</span>
          <span class="big-txt"><b>Знакомство с животными</b>
            <small>Кто такой хорь? Кто живёт в тайге и на озёрах улуса?</small></span>
          <span class="big-step">шаг 1</span><span class="big-arrow" aria-hidden="true">→</span>
        </button>

        <button class="big b2" data-go="cards" data-sfx="click">
          <span class="big-ico" aria-hidden="true">🃏</span>
          <span class="big-txt"><b>Закрепление</b>
            <small>${n.cards} карточек: термин — определение</small></span>
          <span class="big-step">шаг 2</span><span class="big-arrow" aria-hidden="true">→</span>
        </button>

        <button class="big b3" data-go="quiz" data-sfx="click">
          <span class="big-ico" aria-hidden="true">❓</span>
          <span class="big-txt"><b>Викторина</b>
            <small>Сразу к вопросам — ${Math.min(QUIZ_LEN, n.q)} вопросов из ${n.q}</small></span>
          <span class="big-step">шаг 3</span><span class="big-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <div class="link-row">
        <button class="link-btn" data-go="editor" data-sfx="click">✏️ Редактировать тексты заданий${Content.changedCount() ? ` (изменено: ${Content.changedCount()})` : ''}</button>
      </div>

      ${gem('Занятие построено по шагам: сначала знакомимся с видами улуса, потом повторяем термины по карточкам и только затем проходим викторину.')}
    `;
  }

  /* =========================================================
     2. ЗНАКОМСТВО С ЖИВОТНЫМИ И РАСТЕНИЯМИ
     ========================================================= */
  const GROUPS = [
    { id: 'all', title: 'Все', emoji: '📚' },
    { id: 'fauna', title: 'Животные и птицы', emoji: '🦌' },
    { id: 'flora', title: 'Растения и грибы', emoji: '🌿' }
  ];
  const catOf = (sp) => ((sp.group === 'trees' || sp.group === 'flowers') ? 'flora' : 'fauna');

  function learnList() {
    return Content.species().filter((sp) => state.learn.group === 'all' || catOf(sp) === state.learn.group);
  }

  function renderLearn() {
    if (state.learn.id) return renderLearnCard();
    const list = learnList();
    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">Знакомство</h2>
        <p class="page-sub">Кто живёт и что растёт в Намском улусе. Нажмите на карточку — расскажу подробнее.</p>
      </section>
      <div class="chip-row" id="grpRow">
        ${GROUPS.map((g) => `<button class="chip ${state.learn.group === g.id ? 'on' : ''}" data-grp="${g.id}" data-sfx="select"><span aria-hidden="true">${g.emoji}</span> ${g.title}</button>`).join('')}
      </div>
      <section class="grid mt">
        ${list.map((sp) => `
          <button class="tile" data-sp="${esc(sp.id)}" data-sfx="click">
            <span class="tile-ico" aria-hidden="true">${sp.emoji}</span>
            <span class="tile-name">${esc(sp.name)}</span>
            <span class="tile-status">${esc(sp.status)}</span>
          </button>`).join('')}
      </section>
    `;

    $('#grpRow').addEventListener('click', (e) => {
      const b = e.target.closest('[data-grp]');
      if (!b) return;
      state.learn.group = b.dataset.grp;
      renderLearn();
    });
  }

  function renderLearnCard() {
    const all = Content.species();
    const sp = all.filter((s) => s.id === state.learn.id)[0];
    if (!sp) { state.learn.id = null; return renderLearn(); }
    const list = learnList();
    const i = list.map((s) => s.id).indexOf(sp.id);
    const prev = i > 0 ? list[i - 1] : null;
    const nextItem = i >= 0 && i < list.length - 1 ? list[i + 1] : null;

    view.innerHTML = `
      <section class="card-view">
        <div class="cv-top">
          <span class="cv-ico" aria-hidden="true">${sp.emoji}</span>
          <div>
            <h2 class="cv-title">${esc(sp.name)}</h2>
            <span class="tile-status">${esc(sp.status)}</span>
          </div>
        </div>
        <p class="cv-lead">Кто это и чем важен для долины Энсиэли:</p>
        <ul class="cv-list">${sp.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <div class="cv-actions">
          <button class="btn btn-ghost" id="backList" data-sfx="click">← К списку</button>
          <button class="btn btn-ghost" id="speak" data-sfx="click">🔊 Прочитать вслух</button>
          <span style="flex:1"></span>
          ${prev ? `<button class="btn" data-sp="${esc(prev.id)}" data-sfx="click">← ${esc(prev.name.split(' ')[0])}</button>` : ''}
          ${nextItem ? `<button class="btn btn-primary" data-sp="${esc(nextItem.id)}" data-sfx="click">${esc(nextItem.name.split(' ')[0])} →</button>` : ''}
        </div>
      </section>
      ${gem('После знакомства перейдите к <b>закреплению</b>: там те же виды и понятия собраны в карточки для повторения.')}
    `;

    $('#backList').addEventListener('click', () => { state.learn.id = null; Sound.play('click'); renderLearn(); });
    $('#speak').addEventListener('click', () => {
      Speaker.say(sp.name + '. ' + sp.facts.join(' '));
      Sound.play('hint');
    });
  }

  /* =========================================================
     3. ЗАКРЕПЛЕНИЕ — карточки
     ========================================================= */
  function initCards() {
    state.cards = { deck: shuffle(Content.cards()), idx: 0, flipped: false, known: {} };
  }

  function renderCards() {
    if (!state.cards) initCards();
    const c = state.cards;
    const deck = c.deck;
    if (!deck.length) {
      view.innerHTML = '<p class="page-sub center">Карточки закончились — добавьте их в редакторе.</p>';
      return;
    }
    if (c.idx >= deck.length) c.idx = 0;
    const card = deck[c.idx];
    const known = Object.keys(c.known).length;

    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">Закрепление</h2>
        <p class="page-sub">Вспомните определение, затем переверните карточку. Пробел — перевернуть, ← → — листать.</p>
      </section>

      <div class="flash-progress">
        <span>Карточка <b>${c.idx + 1}</b> из ${deck.length}</span>
        <span>Повторено: <b>${known}</b></span>
      </div>
      <div class="bar"><span style="width:${pct(c.idx + 1, deck.length)}%"></span></div>

      <div class="flash ${c.flipped ? 'flipped' : ''}" id="flash" role="button" tabindex="0" aria-label="Карточка, нажмите, чтобы перевернуть">
        <div class="flash-face flash-front">
          <span class="flash-tag">${esc(card.tag)}</span>
          <h3>${esc(card.term)}</h3>
          <span class="flash-hint">нажмите, чтобы увидеть определение</span>
        </div>
        <div class="flash-face flash-back">
          <span class="flash-tag back">${esc(card.term)}</span>
          <p>${esc(card.def)}</p>
        </div>
      </div>

      <div class="btn-row center">
        <button class="btn btn-ghost" id="prevBtn" data-sfx="flip">← Назад</button>
        <button class="btn btn-ghost" id="flipBtn" data-sfx="flip">🔄 Перевернуть</button>
        <button class="btn btn-primary" id="nextBtn" data-sfx="flip">Вперёд →</button>
      </div>
      <div class="btn-row center mt">
        <button class="btn btn-soft ${c.known[card.id] ? 'on' : ''}" id="knowBtn" data-sfx="click">${c.known[card.id] ? '✓ Повторено' : 'Отметить «знаю»'}</button>
        <button class="btn btn-soft" id="shuffleBtn" data-sfx="shuffle">🔀 Перемешать</button>
      </div>
    `;

    const flip = () => { c.flipped = !c.flipped; Sound.play('flip'); renderCards(); };
    const move = (d) => { c.idx = (c.idx + d + deck.length) % deck.length; c.flipped = false; Sound.play('flip'); renderCards(); };

    $('#flash').addEventListener('click', flip);
    $('#flash').addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    $('#flipBtn').addEventListener('click', flip);
    $('#prevBtn').addEventListener('click', () => move(-1));
    $('#nextBtn').addEventListener('click', () => move(1));
    $('#knowBtn').addEventListener('click', () => {
      if (c.known[card.id]) delete c.known[card.id]; else c.known[card.id] = 1;
      Sound.play('toggle');
      renderCards();
    });
    $('#shuffleBtn').addEventListener('click', () => { c.deck = shuffle(Content.cards()); c.idx = 0; c.flipped = false; renderCards(); });
  }

  /* =========================================================
     4. ВИКТОРИНА — начинается сразу
     ========================================================= */
  function startQuiz() {
    const all = Content.questions();
    const pool = shuffle(all).slice(0, Math.min(QUIZ_LEN, all.length));
    state.quiz = {
      pool, idx: 0, correct: 0, picked: null, locked: false,
      hint: false, log: [], done: false, startedAt: Date.now()
    };
  }

  function renderQuiz() {
    if (!state.quiz) startQuiz();
    if (state.quiz.done) return renderResult();
    renderQuestion();
  }

  function renderQuestion() {
    const s = state.quiz;
    const q = s.pool[s.idx];
    const topic = Content.topicById(q.topic) || { title: 'Тема', emoji: '📚' };

    view.innerHTML = `
      <section class="q-meta">
        <span class="topic-chip">${topic.emoji} ${esc(topic.title)}</span>
        <span class="pill">Вопрос ${s.idx + 1} из ${s.pool.length}</span>
        <span class="pill">✅ ${s.correct}</span>
      </section>
      <div class="bar" style="margin-bottom:16px"><span style="width:${pct(s.idx, s.pool.length)}%"></span></div>

      <section class="q-card">
        <h2 class="q-text">${esc(q.text)}</h2>
        <div class="opts" id="opts">
          ${q.options.map((o, i) => {
            const cls = ['opt'];
            if (s.locked) {
              if (i === q.answer) cls.push('right');
              else if (i === s.picked) cls.push('wrong');
              else cls.push('dim');
            } else if (i === s.picked) cls.push('picked');
            return `<button class="${cls.join(' ')}" data-i="${i}" data-sfx="select" ${s.locked ? 'disabled' : ''}>
              <span class="opt-letter">${LETTERS[i]}</span>
              <span class="opt-text">${esc(o)}</span>
              ${s.locked && i === q.answer ? '<span class="opt-mark ok">✓</span>' : ''}
              ${s.locked && i === s.picked && i !== q.answer ? '<span class="opt-mark no">✕</span>' : ''}
            </button>`;
          }).join('')}
        </div>

        ${s.hint ? gem('<b>Подсказка.</b> ' + esc(q.hint)) : ''}

        ${s.locked ? `
          <div class="feedback ${s.picked === q.answer ? 'good' : 'bad'}">
            <b>${s.picked === q.answer ? 'Верно!' : 'Не совсем так'}</b>
            ${s.picked === q.answer ? '' : `<span>Правильный ответ: <b>${LETTERS[q.answer]}) ${esc(q.options[q.answer])}</b></span>`}
          </div>
          <div class="explain"><h4>Почему так</h4><p>${esc(q.explain)}</p></div>` : ''}

        <div class="q-actions">
          ${s.locked
            ? `<button class="btn btn-primary" id="nextBtn" data-sfx="click">${s.idx + 1 >= s.pool.length ? 'Показать результат' : 'Далее →'}</button>`
            : `<button class="btn btn-ghost" id="hintBtn" data-sfx="hint">${s.hint ? 'Скрыть подсказку' : '💡 Подсказка'}</button>
               <button class="btn btn-ghost" id="speakBtn" data-sfx="click">🔊 Прочитать</button>`}
          <button class="btn btn-ghost" data-go="home" data-sfx="click">Выйти в меню</button>
        </div>
      </section>
    `;

    $('#opts').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (!b || s.locked) return;
      answer(parseInt(b.dataset.i, 10));
    });
    const hb = $('#hintBtn');
    if (hb) hb.addEventListener('click', () => { s.hint = !s.hint; Sound.play('hint'); renderQuestion(); });
    const sb = $('#speakBtn');
    if (sb) sb.addEventListener('click', () => { Speaker.say(q.text); Sound.play('hint'); });
    const nb = $('#nextBtn');
    if (nb) nb.addEventListener('click', next);
  }

  function answer(i) {
    const s = state.quiz;
    if (!s || s.locked || s.done) return;
    const q = s.pool[s.idx];
    s.picked = i;
    s.locked = true;
    const ok = i === q.answer;
    if (ok) s.correct += 1;
    Sound.play(ok ? 'correct' : 'wrong');
    Store.recordAnswer(q, q.topic, ok);
    s.log.push({ q, picked: i, ok });
    renderQuestion();
  }

  function next() {
    const s = state.quiz;
    if (!s || s.done) return;
    s.idx += 1;
    s.picked = null;
    s.locked = false;
    s.hint = false;
    if (s.idx >= s.pool.length) {
      s.done = true;
      Store.recordRound(pct(s.correct, s.log.length), false, s.correct);
      Sound.play(pct(s.correct, s.log.length) >= 70 ? 'win' : 'lose');
      Speaker.stop();
    }
    renderQuiz();
  }

  function renderResult() {
    const s = state.quiz;
    const percent = pct(s.correct, s.log.length);
    const secs = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
    const wrong = s.log.filter((r) => !r.ok);
    const verdict = percent === 100 ? 'Идеально! Все ответы верные.'
      : percent >= 70 ? 'Отличная работа!'
      : percent >= 40 ? 'Хорошее начало — повторите виды из «Знакомства».'
      : 'Загляните в «Знакомство» и «Закрепление», затем попробуйте ещё раз.';

    view.innerHTML = `
      <section class="center">
        ${ring(percent, percent + '%', 'точность')}
        <h2 class="page-title center">${verdict}</h2>
        <div class="result-stats">
          <div class="rs"><b>${s.correct}</b><span>верных</span></div>
          <div class="rs"><b>${s.log.length}</b><span>вопросов</span></div>
          <div class="rs"><b>${secs} с</b><span>время</span></div>
        </div>
        <div class="btn-row center">
          <button class="btn btn-primary" id="againBtn" data-sfx="click">Пройти ещё раз</button>
          <button class="btn btn-ghost" data-go="home" data-sfx="click">В меню</button>
        </div>
        <p class="muted mt">Рекорд: ${Store.data.bestScore}% · всего сыграно раундов: ${Store.data.rounds}</p>
      </section>

      ${wrong.length ? `
        <h3 class="page-title" style="font-size:18px;margin-top:28px">Разбор ошибок (${wrong.length})</h3>
        <section class="review">
          ${wrong.map((r) => `
            <details class="review-item">
              <summary><span class="rv-no">✕</span><span>${esc(r.q.text)}</span></summary>
              <div class="rv-body">
                <p class="rv-line bad">Ваш ответ: <b>${LETTERS[r.picked]}) ${esc(r.q.options[r.picked])}</b></p>
                <p class="rv-line good">Правильно: <b>${LETTERS[r.q.answer]}) ${esc(r.q.options[r.q.answer])}</b></p>
                <p class="rv-exp">${esc(r.q.explain)}</p>
              </div>
            </details>`).join('')}
        </section>` : '<p class="page-sub center mt">Ошибок нет — разбирать нечего! 🎉</p>'}
    `;

    $('#againBtn').addEventListener('click', () => { Sound.play('click'); startQuiz(); renderQuiz(); });
  }

  /* =========================================================
     5. РЕДАКТОР ТЕКСТОВ
     ========================================================= */
  const TABS = [
    { id: 'q', title: 'Вопросы', emoji: '❓' },
    { id: 's', title: 'Виды', emoji: '🦌' },
    { id: 'c', title: 'Карточки', emoji: '🃏' }
  ];

  function editorItems() {
    const t = state.editor.tab;
    if (t === 's') return Content.species();
    if (t === 'c') return Content.cards();
    return Content.questions();
  }

  function renderEditor() {
    const tab = state.editor.tab;
    const items = editorItems();
    const changed = Content.changedCount();
    const counts = { q: Content.questions().length, s: Content.species().length, c: Content.cards().length };

    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">Редактор заданий</h2>
        <p class="page-sub">Меняйте любые слова: вопрос, варианты, подсказку, объяснение, описание вида или карточку.
          Правки сохраняются в этом браузере${changed ? ` · изменено блоков: <b>${changed}</b>` : ''}.</p>
      </section>

      <div class="chip-row ed-tabs" id="edTabs">
        ${TABS.map((t) => `<button class="chip ${tab === t.id ? 'on' : ''}" data-tab="${t.id}" data-sfx="select">${t.emoji} ${t.title} (${counts[t.id]})</button>`).join('')}
      </div>

      <div class="panel" style="margin-bottom:16px">
        <div class="btn-row">
          <button class="btn btn-ghost" id="expBtn" data-sfx="click">⬇️ Скачать правки (JSON)</button>
          <button class="btn btn-ghost" id="impBtn" data-sfx="click">⬆️ Загрузить правки</button>
          <input type="file" id="impFile" accept="application/json,.json" hidden>
          <button class="btn btn-ghost" id="resetBtn" data-sfx="click" ${changed ? '' : 'disabled'}>↺ Вернуть исходные тексты</button>
        </div>
      </div>

      <section id="edList">
        ${items.map((it) => editorItem(tab, it)).join('')}
      </section>
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
      a.download = 'ensieli-pravki.json';
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
          toast('Загружено блоков с правками: ' + n);
          renderEditor();
        } catch (err) {
          Sound.play('wrong');
          toast('Не удалось прочитать файл: ' + err.message);
        }
      };
      reader.readAsText(f);
    });

    $('#resetBtn').addEventListener('click', () => {
      Content.resetAll();
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
        state.editor.openId = rev.dataset.revert;
        Sound.play('toggle');
        toast('Изменения этого блока отменены');
        renderEditor();
      }
    });

    if (state.editor.openId) {
      const d = $(`#edList [data-item="${state.editor.openId}"]`);
      if (d) {
        d.open = true;
        try { if (typeof d.scrollIntoView === 'function') d.scrollIntoView({ block: 'center' }); } catch (e) {}
      }
    }
  }

  function editorItem(tab, it) {
    const isCh = Content.changed(tab, it.id);
    const badge = isCh ? '<span class="ed-badge">изменено</span>' : '';
    const sum = tab === 'q' ? `${esc(it.text.slice(0, 78))}${it.text.length > 78 ? '…' : ''}`
      : tab === 's' ? `${it.emoji} ${esc(it.name)}`
      : `<b>${esc(it.term)}</b> · ${esc(it.tag)}`;

    let body = '';
    if (tab === 'q') {
      body = `
        <div class="field"><label>Текст вопроса</label>
          <textarea rows="2" data-field="text">${esc(it.text)}</textarea></div>
        <div class="field"><label>Варианты ответа (нажмите букву, чтобы сделать вариант правильным)</label>
          <div data-answer="${it.answer}">
            ${it.options.map((o, i) => `
              <div class="opt-row">
                <button type="button" class="pick ${i === it.answer ? 'on' : ''}" data-pick="${i}" data-sfx="select">${LETTERS[i]}</button>
                <input type="text" data-opt="${i}" value="${esc(o)}">
              </div>`).join('')}
          </div>
        </div>
        <div class="field"><label>Подсказка</label><textarea rows="2" data-field="hint">${esc(it.hint)}</textarea></div>
        <div class="field"><label>Объяснение правильного ответа</label><textarea rows="3" data-field="explain">${esc(it.explain)}</textarea></div>`;
    } else if (tab === 's') {
      body = `
        <div class="field"><label>Название</label><input type="text" data-field="name" value="${esc(it.name)}"></div>
        <div class="field"><label>Подпись (статус)</label><input type="text" data-field="status" value="${esc(it.status)}"></div>
        <div class="field"><label>Эмодзи</label><input type="text" data-field="emoji" value="${esc(it.emoji)}"></div>
        <div class="field"><label>Что рассказать (каждая строка — отдельный пункт)</label>
          <textarea rows="4" data-field="factsText">${esc(it.facts.join('\n'))}</textarea></div>`;
    } else {
      body = `
        <div class="field"><label>Термин (лицевая сторона)</label><input type="text" data-field="term" value="${esc(it.term)}"></div>
        <div class="field"><label>Определение (обратная сторона)</label><textarea rows="3" data-field="def">${esc(it.def)}</textarea></div>
        <div class="field"><label>Метка</label><input type="text" data-field="tag" value="${esc(it.tag)}"></div>`;
    }

    return `
      <details class="ed-item" data-item="${esc(it.id)}" ${state.editor.openId === it.id ? 'open' : ''}>
        <summary><span class="ed-sum">${sum}</span>${badge}</summary>
        <div class="ed-body">
          ${body}
          <div class="ed-foot">
            <button class="btn btn-primary" data-save="${esc(it.id)}" data-sfx="click">Сохранить</button>
            ${isCh ? `<button class="btn btn-ghost" data-revert="${esc(it.id)}" data-sfx="click">Отменить правки</button>` : ''}
          </div>
        </div>
      </details>`;
  }

  function saveItem(id) {
    const box = $(`#edList [data-item="${id}"]`);
    if (!box) return;
    const val = (f) => {
      const el = $(`[data-field="${f}"]`, box);
      return el ? el.value.trim() : null;
    };

    if (state.editor.tab === 'q') {
      const text = val('text');
      const hint = val('hint');
      const explain = val('explain');
      const options = $$('[data-opt]', box).map((i) => i.value.trim());
      const answer = parseInt($('[data-answer]', box).dataset.answer, 10);
      if (!text) return fail('Текст вопроса не может быть пустым');
      if (options.some((o) => !o)) return fail('Все четыре варианта должны быть заполнены');
      if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return fail('Варианты ответа не должны повторяться');
      if (!(answer >= 0 && answer <= 3)) return fail('Отметьте правильный вариант');
      if (!hint || !explain) return fail('Подсказка и объяснение не могут быть пустыми');
      Content.set('q', id, { text, options, answer, hint, explain });
    } else if (state.editor.tab === 's') {
      const name = val('name');
      const facts = val('factsText').split('\n').map((s) => s.trim()).filter(Boolean);
      if (!name) return fail('Название не может быть пустым');
      if (!facts.length) return fail('Нужен хотя бы один пункт рассказа');
      Content.set('s', id, { name, status: val('status') || 'Обычный вид', emoji: val('emoji') || '🌿', facts });
    } else {
      const term = val('term');
      const def = val('def');
      if (!term || !def) return fail('Термин и определение не могут быть пустыми');
      Content.set('c', id, { term, def, tag: val('tag') || 'Термин' });
    }

    state.editor.openId = id;
    state.cards = null;      // колоду соберём заново из обновлённых текстов
    Sound.play('correct');
    toast('Сохранено');
    renderEditor();
  }

  function fail(msg) { Sound.play('wrong'); toast(msg); }

  /* =========================================================
     РОУТЕР
     ========================================================= */
  function render(forced) {
    const route = forced || routeFromHash();
    state.route = route;
    backBtn.hidden = route === 'home';
    document.title = (route === 'home' ? '' : TITLES[route] + ' · ') + 'Энсиэли · Биология Намского улуса';
    if (route !== 'learn') state.learn.id = null;

    switch (route) {
      case 'learn': renderLearn(); break;
      case 'cards': renderCards(); break;
      case 'quiz': renderQuiz(); break;
      case 'editor': renderEditor(); break;
      default:
        Speaker.stop();
        state.quiz = null;
        renderHome();
    }
    try { global.scrollTo(0, 0); } catch (e) {}
  }

  function syncSound() {
    const on = Sound.isEnabled();
    const b = $('#soundBtn');
    b.textContent = on ? '🔊' : '🔇';
    b.classList.toggle('off', !on);
    b.setAttribute('aria-label', on ? 'Звук включён' : 'Звук выключен');
    b.title = on ? 'Звук включён' : 'Звук выключен';
  }

  function bind() {
    document.addEventListener('click', (e) => {
      const sfx = e.target.closest ? e.target.closest('[data-sfx]') : null;
      if (sfx) Sound.play(sfx.dataset.sfx);
      const goEl = e.target.closest ? e.target.closest('[data-go]') : null;
      if (goEl) { e.preventDefault(); go(goEl.dataset.go); }
      const sp = e.target.closest ? e.target.closest('[data-sp]') : null;
      if (sp) { state.learn.id = sp.dataset.sp; renderLearn(); }
    });

    backBtn.addEventListener('click', () => go('home'));
    $('#soundBtn').addEventListener('click', () => {
      const on = Sound.setEnabled(!Sound.isEnabled());
      syncSound();
      if (on) Sound.play('toggle');
    });

    global.addEventListener('hashchange', () => render());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (state.route !== 'home') go('home'); return; }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (state.route === 'cards' && state.cards) {
        const c = state.cards;
        const n = c.deck.length;
        if (e.key === ' ') { e.preventDefault(); c.flipped = !c.flipped; Sound.play('flip'); renderCards(); }
        else if (e.key === 'ArrowRight') { c.idx = (c.idx + 1) % n; c.flipped = false; Sound.play('flip'); renderCards(); }
        else if (e.key === 'ArrowLeft') { c.idx = (c.idx - 1 + n) % n; c.flipped = false; Sound.play('flip'); renderCards(); }
        return;
      }
      if (state.route === 'quiz' && state.quiz && !state.quiz.done) {
        const s = state.quiz;
        if (!s.locked) {
          const n = parseInt(e.key, 10);
          const idx = !isNaN(n) && n >= 1 && n <= 4 ? n - 1 : LETTERS.indexOf(e.key.toUpperCase());
          if (idx !== undefined && idx >= 0 && idx < 4) answer(idx);
          else if (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р') { s.hint = !s.hint; Sound.play('hint'); renderQuestion(); }
        } else if (e.key === 'Enter') next();
      }
    });
  }

  syncSound();
  bind();
  render();

  global.App = { state, render, go, startQuiz, answer, next, toast, QUIZ_LEN };
})(typeof window !== 'undefined' ? window : globalThis);
