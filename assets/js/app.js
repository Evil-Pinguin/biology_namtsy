/* =============================================================
   Энсиэли · Биология Намского улуса — логика интерфейса
   Режимы: Викторина · Спринт · Карточки · Справочник · Прогресс
   ============================================================= */
(function (global) {
  'use strict';

  const D = global.DATA;
  const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];

  /* ---------------- утилиты ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

  const view = $('#view');
  const navEl = $('#nav');
  const topTitle = $('#topTitle');
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');

  /* ---------------- состояние ---------------- */
  const state = {
    route: 'home',
    setup: { cat: 'all', topics: [], count: 10 },
    session: null,
    cards: null,
    ref: { group: 'all', q: '' }
  };

  /* =========================================================
     НАВИГАЦИЯ
     ========================================================= */
  function buildNav() {
    navEl.innerHTML = D.NAV.map((n) => `
      <a class="nav-item" href="${n.route}" data-route="${n.id}" data-sfx="nav">
        <span class="nav-emoji" aria-hidden="true">${n.emoji}</span>
        <span class="nav-label">${n.label}</span>
        <span class="nav-desc">${n.desc}</span>
      </a>`).join('');
  }

  function setActiveNav(id) {
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === id));
  }

  function routeFromHash() {
    const h = (global.location && global.location.hash) || '#/home';
    const raw = h.replace(/^#\/?/, '').split('?')[0];
    return D.NAV.some((n) => n.id === raw) ? raw : 'home';
  }

  function go(route) {
    if (global.location) global.location.hash = '#/' + route;
    else render(route);
  }

  /* =========================================================
     ОБЩИЕ КУСОЧКИ РАЗМЕТКИ
     ========================================================= */
  function ring(percent, label, sub) {
    const r = 52, c = 2 * Math.PI * r;
    return `
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120" class="ring" width="168" height="168" role="img" aria-label="Результат ${percent} процентов">
          <defs>
            <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#4285f4"/><stop offset=".55" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="${r}" class="ring-bg"></circle>
          <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - percent / 100)).toFixed(2)}"></circle>
        </svg>
        <div class="ring-text"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
      </div>`;
  }

  function gemBubble(html) {
    return `
      <div class="gem-bubble">
        <span class="gem-spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="url(#gb)" d="M12 2c.6 4.9 2.6 8.1 5.2 9.1-2.6 1-4.6 4.2-5.2 9.1-.6-4.9-2.6-8.1-5.2-9.1C9.4 10.1 11.4 6.9 12 2Z"/><defs><linearGradient id="gb" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="#4285f4"/><stop offset=".55" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/></linearGradient></defs></svg>
        </span>
        <div class="gem-body">${html}</div>
      </div>`;
  }

  function toast(msg) {
    const wrap = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
  }

  /* =========================================================
     ГЛАВНАЯ
     ========================================================= */
  function renderHome() {
    const acc = Store.accuracy();
    const modes = [
      { r: 'quiz', emoji: '❓', t: 'Викторина', d: `${D.QUESTIONS.length} вопроса с подсказками и объяснениями`, c: 'blue' },
      { r: 'sprint', emoji: '⏱️', t: 'Спринт 60 секунд', d: 'Успей ответить на максимум вопросов', c: 'pink' },
      { r: 'cards', emoji: '🃏', t: 'Карточки', d: `${D.CARDS.length} терминов для заучивания`, c: 'purple' },
      { r: 'reference', emoji: '📖', t: 'Справочник', d: `${D.SPECIES.length} видов растений и животных улуса`, c: 'green' },
      { r: 'progress', emoji: '📊', t: 'Прогресс', d: 'Статистика ответов и темы для повторения', c: 'amber' }
    ];

    view.innerHTML = `
      <section class="hero">
        <div class="hero-spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34"><path fill="url(#hg)" d="M12 2c.6 4.9 2.6 8.1 5.2 9.1-2.6 1-4.6 4.2-5.2 9.1-.6-4.9-2.6-8.1-5.2-9.1C9.4 10.1 11.4 6.9 12 2Z"/><path fill="url(#hg)" d="M19.8 15c.3 2.2 1.2 3.6 2.4 4.1-1.2.5-2.1 1.9-2.4 4.1-.3-2.2-1.2-3.6-2.4-4.1 1.2-.5 2.1-1.9 2.4-4.1Z" opacity=".65"/><defs><linearGradient id="hg" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="#4285f4"/><stop offset=".55" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/></linearGradient></defs></svg>
        </div>
        <h2 class="hero-title">Здравствуйте! <span class="grad">Что изучим сегодня?</span></h2>
        <p class="hero-sub">Флора и фауна <b>Намского улуса</b> — долины Энсиэли в Центральной Якутии. Выберите режим занятия: викторина, спринт на время, карточки для заучивания или справочник видов.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" data-go="quiz" data-sfx="click">Начать викторину</button>
          <button class="btn btn-ghost" data-go="reference" data-sfx="click">Открыть справочник</button>
        </div>
      </section>

      <section class="facts">
        <div class="fact"><b>36</b><span>видов млекопитающих</span></div>
        <div class="fact"><b>3</b><span>завезены человеком</span></div>
        <div class="fact"><b>${D.QUESTIONS.length}</b><span>вопросов викторины</span></div>
        <div class="fact"><b>${D.CARDS.length}</b><span>карточек-терминов</span></div>
      </section>

      <h3 class="section-title">Режимы занятий</h3>
      <section class="mode-grid">
        ${modes.map((m) => `
          <button class="mode-card ${m.c}" data-go="${m.r}" data-sfx="click">
            <span class="mode-emoji" aria-hidden="true">${m.emoji}</span>
            <span class="mode-t">${m.t}</span>
            <span class="mode-d">${m.d}</span>
            <span class="mode-arrow" aria-hidden="true">→</span>
          </button>`).join('')}
      </section>

      <h3 class="section-title">Как вы занимаетесь</h3>
      <section class="panel">
        <div class="stat-line">
          <span>Точность ответов</span>
          <b>${acc}%</b>
        </div>
        <div class="bar"><span style="width:${acc}%"></span></div>
        <div class="stat-line soft">
          <span>Ответов дано: <b>${Store.data.answered}</b></span>
          <span>Лучшая серия: <b>${Store.data.bestStreak}</b></span>
        </div>
        ${Store.data.answered === 0 ? gemBubble('Начните с <b>викторины</b>: после каждого ответа я объясню правильный вариант. Если сомневаетесь — нажмите «Подсказка», она не снимает баллы.') : gemBubble(`Хороший темп! Рекомендую закрепить термины в режиме <b>«Карточки»</b>, а затем проверить себя в <b>спринте на 60 секунд</b>.`)}
      </section>
    `;
  }

  /* =========================================================
     НАСТРОЙКА ВИКТОРИНЫ
     ========================================================= */
  function poolFor(setup) {
    let list = D.QUESTIONS.slice();
    if (setup.topics.length) {
      list = list.filter((q) => setup.topics.indexOf(q.topic) !== -1);
    } else if (setup.cat !== 'all') {
      const ids = D.TOPICS.filter((t) => t.cat === setup.cat).map((t) => t.id);
      list = list.filter((q) => ids.indexOf(q.topic) !== -1);
    }
    return shuffle(list);
  }

  function renderSetup(sprint) {
    const s = state.setup;
    const available = poolFor(s).length;
    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">${sprint ? 'Спринт на 60 секунд' : 'Настройка викторины'}</h2>
        <p class="page-sub">${sprint
          ? 'Отвечайте как можно быстрее: за каждый правильный ответ — одно очко, объяснения появятся в итогах.'
          : 'Выберите раздел, темы и количество вопросов. После каждого ответа — подсказка и объяснение.'}</p>
      </section>

      <section class="panel">
        <h3 class="panel-title">Раздел</h3>
        <div class="chip-row" id="catRow">
          ${D.CATEGORIES.map((c) => `
            <button class="chip ${s.cat === c.id && !s.topics.length ? 'on' : ''}" data-cat="${c.id}" data-sfx="select">
              <span aria-hidden="true">${c.emoji}</span> ${c.title}
            </button>`).join('')}
        </div>

        <h3 class="panel-title mt">Темы <span class="muted">(можно выбрать несколько)</span></h3>
        <div class="chip-row" id="topicRow">
          ${D.TOPICS.map((t) => `
            <button class="chip chip-sm ${s.topics.indexOf(t.id) !== -1 ? 'on' : ''}" data-topic="${t.id}" data-sfx="select">
              <span aria-hidden="true">${t.emoji}</span> ${t.title}
            </button>`).join('')}
        </div>

        ${sprint ? '' : `
        <h3 class="panel-title mt">Количество вопросов</h3>
        <div class="chip-row" id="countRow">
          ${[5, 10, 0].map((n) => `
            <button class="chip ${s.count === n ? 'on' : ''}" data-count="${n}" data-sfx="select">${n === 0 ? 'Все' : n}</button>`).join('')}
        </div>`}

        <div class="setup-foot">
          <span class="muted">Доступно вопросов: <b id="avail">${available}</b></span>
          <div class="btn-row">
            ${s.topics.length ? `<button class="btn btn-ghost" id="clearTopics" data-sfx="click">Сбросить темы</button>` : ''}
            <button class="btn btn-primary" id="startBtn" data-sfx="click" ${available ? '' : 'disabled'}>
              ${sprint ? '⏱️ Старт!' : '▶ Начать'}
            </button>
          </div>
        </div>
      </section>

      ${gemBubble('В викторине нет «неправильных» попыток: объяснение после ответа помогает запомнить факт надолго. Все результаты сохраняются в разделе <b>Прогресс</b>.')}
    `;

    $('#catRow').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      state.setup.cat = b.dataset.cat;
      state.setup.topics = [];
      renderSetup(sprint);
    });
    $('#topicRow').addEventListener('click', (e) => {
      const b = e.target.closest('[data-topic]');
      if (!b) return;
      const id = b.dataset.topic;
      const i = state.setup.topics.indexOf(id);
      if (i === -1) state.setup.topics.push(id); else state.setup.topics.splice(i, 1);
      renderSetup(sprint);
    });
    const cr = $('#countRow');
    if (cr) cr.addEventListener('click', (e) => {
      const b = e.target.closest('[data-count]');
      if (!b) return;
      state.setup.count = parseInt(b.dataset.count, 10);
      renderSetup(sprint);
    });
    const clr = $('#clearTopics');
    if (clr) clr.addEventListener('click', () => { state.setup.topics = []; renderSetup(sprint); });

    $('#startBtn').addEventListener('click', () => startSession(sprint ? 'sprint' : 'classic'));
  }

  /* =========================================================
     СЕССИЯ ВИКТОРИНЫ / СПРИНТА
     ========================================================= */
  function startSession(mode) {
    const s = state.setup;
    let pool = poolFor(s);
    if (mode === 'sprint') {
      pool = shuffle(pool.concat(pool, pool)); // чтобы вопросов точно хватило
    } else if (s.count > 0) {
      pool = pool.slice(0, Math.min(s.count, pool.length));
    }
    if (!pool.length) { toast('Не нашлось вопросов по выбранным темам'); return; }

    stopTimer();
    state.session = {
      mode, pool, idx: 0, correct: 0, picked: null, locked: false,
      hintShown: false, log: [], streak: 0, maxStreak: 0,
      timeLeft: mode === 'sprint' ? 60 : 0, startedAt: Date.now(), over: false
    };
    renderQuestion();
    if (mode === 'sprint') startTimer();
  }

  let timerId = null;   // держим глобально: интервал не должен пережить уход со страницы

  function startTimer() {
    const sess = state.session;
    if (!sess) return;
    stopTimer();
    timerId = setInterval(() => {
      sess.timeLeft -= 1;
      const t = $('#timeVal');
      const bar = $('#timeBar');
      if (t) t.textContent = sess.timeLeft;
      if (bar) bar.style.width = Math.max(0, (sess.timeLeft / 60) * 100) + '%';
      if (sess.timeLeft <= 5 && sess.timeLeft > 0) Sound.play('tick');
      if (sess.timeLeft <= 0) finishSession();
    }, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
    if (state.session) state.session.timer = null;
  }

  function currentQuestion() {
    const s = state.session;
    return s ? s.pool[s.idx] : null;
  }

  function renderQuestion() {
    const s = state.session;
    if (!s) return;
    const q = currentQuestion();
    const topic = D.topicById(q.topic) || { title: 'Тема', emoji: '📚' };
    const sprint = s.mode === 'sprint';
    const total = sprint ? '∞' : s.pool.length;
    const progress = sprint ? 100 : pct(s.idx, s.pool.length);

    view.innerHTML = `
      <section class="quiz-head">
        <div class="quiz-meta">
          <span class="topic-chip">${topic.emoji} ${esc(topic.title)}</span>
          ${sprint
            ? `<span class="pill pill-timer">⏱️ <b id="timeVal">${s.timeLeft}</b> с</span>
               <span class="pill">✅ ${s.correct}</span>`
            : `<span class="pill">Вопрос ${s.idx + 1} из ${total}</span>
               <span class="pill">✅ ${s.correct}</span>
               <span class="pill">🔥 ${s.streak}</span>`}
        </div>
        ${sprint ? `<div class="time-bar"><span id="timeBar" style="width:${(s.timeLeft / 60) * 100}%"></span></div>`
                 : `<div class="bar bar-thin"><span style="width:${progress}%"></span></div>`}
      </section>

      <section class="q-card">
        <div class="q-top">
          <span class="q-num">${sprint ? 'Спринт' : 'Вопрос ' + (s.idx + 1)}</span>
          <button class="icon-btn small" id="speakBtn" data-sfx="click" title="Прослушать вопрос">🔊</button>
        </div>
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

        <div id="hintBox">${s.hintShown ? gemBubble('<b>Подсказка.</b> ' + esc(q.hint)) : ''}</div>

        ${s.locked && !sprint ? `
          <div class="feedback ${s.picked === q.answer ? 'good' : 'bad'}">
            <b>${s.picked === q.answer ? 'Верно!' : 'Не совсем так'}</b>
            ${s.picked === q.answer ? '' : `<span>Правильный ответ: <b>${LETTERS[q.answer]}) ${esc(q.options[q.answer])}</b></span>`}
          </div>
          <div class="explain">
            <h4>Почему так</h4>
            <p>${esc(q.explain)}</p>
          </div>` : ''}

        <div class="q-actions">
          ${!s.locked ? `<button class="btn btn-ghost" id="hintBtn" data-sfx="hint">${s.hintShown ? 'Скрыть подсказку' : '💡 Подсказка'}</button>` : ''}
          ${s.locked ? (sprint
            ? `<span class="muted">Следующий вопрос…</span>`
            : `<button class="btn btn-primary" id="nextBtn" data-sfx="click">${s.idx + 1 >= s.pool.length ? 'Показать результат' : 'Далее →'}</button>`) : ''}
          ${!sprint ? `<button class="btn btn-ghost" id="quitBtn" data-sfx="click">Завершить</button>` : ''}
        </div>
      </section>
    `;

    $('#opts').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (!b || s.locked) return;
      answer(parseInt(b.dataset.i, 10));
    });

    const hb = $('#hintBtn');
    if (hb) hb.addEventListener('click', () => { s.hintShown = !s.hintShown; Sound.play('hint'); renderQuestion(); });

    const nb = $('#nextBtn');
    if (nb) nb.addEventListener('click', next);

    const qb = $('#quitBtn');
    if (qb) qb.addEventListener('click', () => { Sound.play('click'); finishSession(true); });

    $('#speakBtn').addEventListener('click', () => {
      if (!Speaker.isOn()) {
        Speaker.setOn(true); syncToggles(); toast('Озвучивание включено');
      }
      Speaker.speak(q.text);
    });

    if (Speaker.isOn()) Speaker.speak(q.text);
  }

  function answer(i) {
    const s = state.session;
    if (!s || s.locked) return;
    const q = currentQuestion();
    s.picked = i;
    s.locked = true;
    const ok = i === q.answer;
    if (ok) { s.correct += 1; s.streak += 1; if (s.streak > s.maxStreak) s.maxStreak = s.streak; }
    else s.streak = 0;

    Sound.play(ok ? 'correct' : 'wrong');
    Store.recordAnswer(q, q.topic, ok);
    updateStreakChip();
    s.log.push({ q, picked: i, ok });

    renderQuestion();

    if (s.mode === 'sprint') {
      setTimeout(() => { if (state.session === s && !s.over) next(); }, ok ? 420 : 700);
    }
  }

  function next() {
    const s = state.session;
    if (!s || s.over) return;
    s.idx += 1;
    s.picked = null;
    s.locked = false;
    s.hintShown = false;
    if (s.mode !== 'sprint' && s.idx >= s.pool.length) { finishSession(); return; }
    if (s.idx >= s.pool.length) s.idx = 0; // спринт: продолжаем по кругу
    renderQuestion();
  }

  function finishSession(manual) {
    const s = state.session;
    if (!s || s.over) return;
    s.over = true;
    stopTimer();
    Speaker.stop();

    const answered = s.log.length;
    const percent = pct(s.correct, answered);
    Store.recordRound(percent, s.mode === 'sprint', s.correct);
    Sound.play(s.mode === 'sprint' ? (s.correct >= 8 ? 'win' : 'lose') : (percent >= 70 ? 'win' : 'lose'));
    renderResult(s, percent, manual);
  }

  function renderResult(s, percent, manual) {
    const sprint = s.mode === 'sprint';
    const secs = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
    const wrong = s.log.filter((r) => !r.ok);
    const verdict = sprint
      ? (s.correct >= 15 ? 'Отличный результат!' : s.correct >= 8 ? 'Хороший темп!' : 'Попробуйте ещё раз — темп придёт с практикой.')
      : (percent === 100 ? 'Идеально! Все ответы верные.' : percent >= 70 ? 'Отличная работа!' : percent >= 40 ? 'Хорошее начало, повторите темы ниже.' : 'Стоит заглянуть в справочник и карточки.');

    view.innerHTML = `
      <section class="result">
        ${ring(percent, sprint ? s.correct + '' : percent + '%', sprint ? 'правильных' : 'точность')}
        <h2 class="page-title center">${verdict}</h2>
        <p class="page-sub center">${manual ? 'Раунд завершён досрочно — учтены только данные ответы.' : (sprint ? 'Время вышло!' : 'Раунд завершён.')}</p>
        <div class="result-stats">
          <div class="rs"><b>${s.correct}</b><span>верных</span></div>
          <div class="rs"><b>${s.log.length}</b><span>ответов</span></div>
          <div class="rs"><b>${s.maxStreak}</b><span>лучшая серия</span></div>
          <div class="rs"><b>${secs} с</b><span>время</span></div>
        </div>
        <div class="btn-row center">
          <button class="btn btn-primary" id="againBtn" data-sfx="click">Сыграть ещё раз</button>
          <button class="btn btn-ghost" data-go="${sprint ? 'sprint' : 'quiz'}" data-sfx="click">Изменить настройку</button>
          <button class="btn btn-ghost" data-go="home" data-sfx="click">На главную</button>
        </div>
      </section>

      ${wrong.length ? `
        <h3 class="section-title">Разбор ошибок (${wrong.length})</h3>
        <section class="review">
          ${wrong.map((r) => `
            <details class="review-item">
              <summary>
                <span class="rv-no">✕</span>
                <span class="rv-q">${esc(r.q.text)}</span>
              </summary>
              <div class="rv-body">
                <p class="rv-line bad">Ваш ответ: <b>${LETTERS[r.picked]}) ${esc(r.q.options[r.picked])}</b></p>
                <p class="rv-line good">Правильно: <b>${LETTERS[r.q.answer]}) ${esc(r.q.options[r.q.answer])}</b></p>
                <p class="rv-exp">${esc(r.q.explain)}</p>
              </div>
            </details>`).join('')}
        </section>` : '<p class="page-sub center">Ошибок нет — разбирать нечего! 🎉</p>'}

      ${gemBubble(sprint
        ? `В спринте лучше всего заходят вопросы, которые знаешь «автоматически». Пройдите <b>карточки</b>, чтобы довести термины до автоматизма.`
        : `Рекомендую повторить темы, где были ошибки, в режиме <b>«Карточки»</b>, а потом закрепите знания в <b>спринте</b>.`)}
    `;

    $('#againBtn').addEventListener('click', () => startSession(s.mode));
    state.session = null;
  }

  /* =========================================================
     КАРТОЧКИ
     ========================================================= */
  function initCards() {
    state.cards = { deck: shuffle(D.CARDS), idx: 0, flipped: false, known: {} };
  }

  function renderCards() {
    if (!state.cards) initCards();
    const c = state.cards;
    if (!c.deck.length) return;
    if (c.idx >= c.deck.length) c.idx = 0;
    const card = c.deck[c.idx];
    const knownCount = Object.keys(c.known).length;

    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">Карточки для заучивания</h2>
        <p class="page-sub">Термины и понятия из ботаники и зоологии Намского улуса. Пробел — перевернуть карточку, ← → — листать.</p>
      </section>

      <section class="flash-wrap">
        <div class="flash-progress">
          <span>Карточка <b>${c.idx + 1}</b> из ${c.deck.length}</span>
          <span>Выучено: <b>${knownCount}</b></span>
        </div>
        <div class="bar bar-thin"><span style="width:${pct(c.idx + 1, c.deck.length)}%"></span></div>

        <div class="flash ${c.flipped ? 'flipped' : ''}" id="flash" role="button" tabindex="0" aria-label="Карточка, нажмите чтобы перевернуть">
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
          <button class="btn btn-primary" id="nextCardBtn" data-sfx="flip">Вперёд →</button>
        </div>
        <div class="btn-row center mt">
          <button class="btn btn-soft ${c.known[card.term] ? 'on' : ''}" id="knowBtn" data-sfx="click">${c.known[card.term] ? '✓ Выучено' : 'Отметить «знаю»'}</button>
          <button class="btn btn-soft" id="againBtn" data-sfx="click">↻ Повторить сначала</button>
          <button class="btn btn-soft" id="shuffleBtn" data-sfx="shuffle">🔀 Перемешать</button>
        </div>
      </section>

      ${gemBubble('Совет: сначала пролистайте всю колоду, отмечая знакомые термины, а затем оставьте в колоде только те, что помечены как «повторить».')}
    `;

    const flip = () => { c.flipped = !c.flipped; Sound.play('flip'); renderCards(); };
    const move = (d) => {
      c.idx = (c.idx + d + c.deck.length) % c.deck.length;
      c.flipped = false;
      Sound.play('flip');
      renderCards();
    };

    $('#flash').addEventListener('click', flip);
    $('#flash').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    $('#flipBtn').addEventListener('click', flip);
    $('#prevBtn').addEventListener('click', () => move(-1));
    $('#nextCardBtn').addEventListener('click', () => move(1));
    $('#knowBtn').addEventListener('click', () => {
      if (c.known[card.term]) delete c.known[card.term]; else c.known[card.term] = 1;
      Sound.play('toggle');
      renderCards();
    });
    $('#againBtn').addEventListener('click', () => { c.idx = 0; c.flipped = false; Sound.play('shuffle'); renderCards(); });
    $('#shuffleBtn').addEventListener('click', () => { c.deck = shuffle(c.deck); c.idx = 0; c.flipped = false; renderCards(); });
  }

  /* =========================================================
     СПРАВОЧНИК
     ========================================================= */
  function renderReference() {
    const r = state.ref;
    const list = D.SPECIES.filter((sp) => {
      const okGroup = r.group === 'all' || sp.group === r.group;
      const q = r.q.trim().toLowerCase();
      const okQ = !q || (sp.name + ' ' + sp.facts.join(' ')).toLowerCase().indexOf(q) !== -1;
      return okGroup && okQ;
    });

    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">Справочник видов</h2>
        <p class="page-sub">Животные, птицы, деревья и растения Намского улуса (долины Энсиэли).</p>
      </section>

      <section class="panel flat">
        <div class="search-row">
          <span class="search-ico" aria-hidden="true">🔎</span>
          <input class="search" id="refSearch" type="search" placeholder="Поиск: лебедь, брусника, алас…" value="${esc(r.q)}">
        </div>
        <div class="chip-row" id="groupRow">
          ${D.GROUPS.map((g) => `<button class="chip ${r.group === g.id ? 'on' : ''}" data-group="${g.id}" data-sfx="select"><span aria-hidden="true">${g.emoji}</span> ${g.title}</button>`).join('')}
        </div>
      </section>

      ${list.length ? `
        <section class="ref-grid">
          ${list.map((sp) => {
            const i = D.SPECIES.indexOf(sp);
            return `<button class="ref-card" data-sp="${i}" data-sfx="click">
              <span class="ref-emoji" aria-hidden="true">${sp.emoji}</span>
              <span class="ref-name">${esc(sp.name)}</span>
              <span class="ref-status">${esc(sp.status)}</span>
              <span class="ref-more">Подробнее →</span>
            </button>`;
          }).join('')}
        </section>` : '<p class="page-sub center">Ничего не нашлось. Попробуйте другой запрос.</p>'}
    `;

    $('#groupRow').addEventListener('click', (e) => {
      const b = e.target.closest('[data-group]');
      if (!b) return;
      state.ref.group = b.dataset.group;
      renderReference();
    });
    const input = $('#refSearch');
    input.addEventListener('input', () => { state.ref.q = input.value; renderReference(); focusSearchEnd(); });
  }

  function focusSearchEnd() {
    const input = $('#refSearch');
    if (!input) return;
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
  }

  function openSpecies(i) {
    const sp = D.SPECIES[i];
    if (!sp) return;
    Sound.play('nav');
    openModal(`
      <div class="modal-head">
        <span class="modal-emoji" aria-hidden="true">${sp.emoji}</span>
        <div>
          <h3>${esc(sp.name)}</h3>
          <span class="ref-status">${esc(sp.status)}</span>
        </div>
      </div>
      <ul class="modal-list">
        ${sp.facts.map((f) => `<li>${esc(f)}</li>`).join('')}
      </ul>
    `);
  }

  /* =========================================================
     ПРОГРЕСС
     ========================================================= */
  function renderProgress() {
    const d = Store.data;
    const acc = Store.accuracy();
    const topicStats = D.TOPICS.map((t) => ({ t, s: Store.topicStat(t.id) })).filter((x) => x.s.answered > 0);
    const weak = topicStats.slice().sort((a, b) => a.s.percent - b.s.percent).slice(0, 3);

    view.innerHTML = `
      <section class="page-head">
        <h2 class="page-title">Мой прогресс</h2>
        <p class="page-sub">Статистика сохраняется в этом браузере — можно закрыть страницу и вернуться позже.</p>
      </section>

      <section class="stat-grid">
        <div class="stat-card"><b>${d.rounds}</b><span>раундов сыграно</span></div>
        <div class="stat-card"><b>${d.answered}</b><span>ответов дано</span></div>
        <div class="stat-card"><b>${acc}%</b><span>точность</span></div>
        <div class="stat-card"><b>${d.bestStreak}</b><span>лучшая серия</span></div>
        <div class="stat-card"><b>${d.bestScore}%</b><span>лучший раунд</span></div>
        <div class="stat-card"><b>${d.bestSprint}</b><span>рекорд спринта</span></div>
      </section>

      <h3 class="section-title">По темам</h3>
      <section class="panel">
        ${topicStats.length ? topicStats.map((x) => `
          <div class="topic-row">
            <span class="tr-name">${x.t.emoji} ${esc(x.t.title)}</span>
            <div class="bar bar-thin"><span style="width:${x.s.percent}%"></span></div>
            <span class="tr-val">${x.s.percent}% <small>(${x.s.correct}/${x.s.answered})</small></span>
          </div>`).join('')
        : '<p class="muted">Пока нет данных — сыграйте первую викторину.</p>'}
      </section>

      ${weak.length ? gemBubble(`Стоит повторить темы: <b>${weak.map((w) => esc(w.t.title)).join(', ')}</b>. Откройте <b>карточки</b> и пролистайте колоду, а затем проверьте себя в викторине по этим темам.`) : ''}

      <div class="btn-row mt">
        <button class="btn btn-ghost danger" id="resetBtn" data-sfx="click">Сбросить статистику</button>
      </div>
    `;

    $('#resetBtn').addEventListener('click', () => {
      Store.reset();
      updateStreakChip();
      Sound.play('toggle');
      toast('Статистика очищена');
      renderProgress();
    });
  }

  /* =========================================================
     МОДАЛЬНОЕ ОКНО
     ========================================================= */
  function openModal(inner) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${inner}
      <div class="modal-foot"><button class="btn btn-ghost" id="modalClose" data-sfx="click">Закрыть</button></div>
    </div></div>`;
    root.hidden = false;
    $('#modalClose').addEventListener('click', closeModal);
    $('.modal-back').addEventListener('click', (e) => { if (e.target.classList.contains('modal-back')) closeModal(); });
  }

  function closeModal() {
    const root = $('#modalRoot');
    root.hidden = true;
    root.innerHTML = '';
  }

  /* =========================================================
     РОУТЕР И ОБВЯЗКА
     ========================================================= */
  const TITLES = {
    home: 'Главная', quiz: 'Викторина', sprint: 'Спринт',
    cards: 'Карточки', reference: 'Справочник', progress: 'Прогресс'
  };

  function render(forced) {
    const route = forced || routeFromHash();
    state.route = route;
    setActiveNav(route);
    topTitle.textContent = TITLES[route] || 'Энсиэли';
    Speaker.stop();
    if (route !== 'sprint' && route !== 'quiz') stopTimer();
    closeSidebar();

    switch (route) {
      case 'quiz': renderSetup(false); break;
      case 'sprint': renderSetup(true); break;
      case 'cards': renderCards(); break;
      case 'reference': renderReference(); break;
      case 'progress': renderProgress(); break;
      default: renderHome();
    }
    try { if (view && typeof view.scrollTo === 'function') view.scrollTo(0, 0); } catch (e) {}
    try { if (typeof global.scrollTo === 'function') global.scrollTo(0, 0); } catch (e) {}
  }

  function updateStreakChip() {
    const el = $('#streakVal');
    if (el) el.textContent = Store.data.streak;
  }

  function syncToggles() {
    const soundOn = Sound.isEnabled();
    const s1 = $('#soundToggle');
    const s2 = $('#voiceToggle');
    const btn = $('#soundBtn');
    if (s1) { s1.classList.toggle('on', soundOn); s1.setAttribute('aria-checked', String(soundOn)); }
    if (btn) {
      btn.classList.toggle('off', !soundOn);
      btn.setAttribute('aria-label', soundOn ? 'Звук включён' : 'Звук выключен');
      btn.title = soundOn ? 'Звук включён' : 'Звук выключен';
      btn.textContent = soundOn ? '🔊' : '🔇';
    }
    const voiceOn = Speaker.isOn();
    if (s2) { s2.classList.toggle('on', voiceOn); s2.setAttribute('aria-checked', String(voiceOn)); }
  }

  function openSidebar() { sidebar.classList.add('open'); scrim.hidden = false; }
  function closeSidebar() { sidebar.classList.remove('open'); scrim.hidden = true; }

  function bind() {
    /* звук на любой кликабельный элемент с data-sfx */
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target.closest('[data-sfx]') : null;
      if (t) Sound.play(t.dataset.sfx);
    });

    /* переходы по data-go */
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target.closest('[data-go]') : null;
      if (t) { e.preventDefault(); go(t.dataset.go); }
      const a = e.target.closest ? e.target.closest('.nav-item') : null;
      if (a) { e.preventDefault(); go(a.dataset.route); }
      const sp = e.target.closest ? e.target.closest('[data-sp]') : null;
      if (sp) openSpecies(parseInt(sp.dataset.sp, 10));
    });

    $('#menuBtn').addEventListener('click', () => {
      Sound.play('click');
      if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
    });
    scrim.addEventListener('click', closeSidebar);

    $('#soundToggle').addEventListener('click', () => {
      const on = Sound.setEnabled(!Sound.isEnabled());
      syncToggles();
      if (on) Sound.play('toggle');
    });
    $('#soundBtn').addEventListener('click', () => {
      const on = Sound.setEnabled(!Sound.isEnabled());
      syncToggles();
      if (on) Sound.play('toggle');
    });
    $('#voiceToggle').addEventListener('click', () => {
      const on = Speaker.setOn(!Speaker.isOn());
      syncToggles();
      Sound.play('toggle');
      toast(on ? 'Озвучивание вопросов включено' : 'Озвучивание выключено');
    });

    global.addEventListener('hashchange', () => render());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closeSidebar(); return; }
      const s = state.session;
      if (state.route === 'cards') {
        const c = state.cards;
        if (!c) return;
        if (e.key === ' ') { e.preventDefault(); c.flipped = !c.flipped; Sound.play('flip'); renderCards(); }
        else if (e.key === 'ArrowRight') { c.idx = (c.idx + 1) % c.deck.length; c.flipped = false; Sound.play('flip'); renderCards(); }
        else if (e.key === 'ArrowLeft') { c.idx = (c.idx - 1 + c.deck.length) % c.deck.length; c.flipped = false; Sound.play('flip'); renderCards(); }
        return;
      }
      if (s && !s.over && (state.route === 'quiz' || state.route === 'sprint')) {
        if (!s.locked) {
          const n = parseInt(e.key, 10);
          const idx = !isNaN(n) && n >= 1 && n <= 4 ? n - 1 : LETTERS.indexOf(e.key.toUpperCase());
          if (idx !== undefined && idx >= 0 && idx < 4) { answer(idx); return; }
          if (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р') { s.hintShown = !s.hintShown; Sound.play('hint'); renderQuestion(); }
        } else if (e.key === 'Enter') { next(); }
      }
    });
  }

  /* ---------------- старт ---------------- */
  buildNav();
  bind();
  syncToggles();
  updateStreakChip();
  render();

  global.App = { state, render, go, startSession, answer, next, finishSession, toast };
})(typeof window !== 'undefined' ? window : globalThis);
