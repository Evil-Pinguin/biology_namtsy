/* =============================================================
   Интерактивные задания · Намский улус · 5 класс
   Структура каждого экрана:
   заголовок → инструкция → задание → варианты → проверка → результат
   ============================================================= */
(function (global) {
  'use strict';

  const LETTERS = ['А', 'Б', 'В', 'Г'];
  const QUIZ_LEN = 10;

  const view = document.getElementById('view');
  const backBtn = document.getElementById('backBtn');
  const head = document.getElementById('head');
  const soundBtn = document.getElementById('soundBtn');

  const state = {
    route: 'home',
    quiz: null,
    learn: { tab: 'all', id: null },
    cards: null,
    editor: { tab: 'q', openId: null }
  };

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

  /* =========================================================
     ЭКРАН 1 · СПИСОК ЗАДАНИЙ
     ========================================================= */
  function renderHome() {
    const tasks = [
      { r: 'quiz/rodina', n: 'Моя Родина — Намский улус', d: Content.questions().filter((q) => q.set === 'rodina').length + ' вопросов' },
      { r: 'learn', n: 'Животные и растения улуса', d: Content.species().length + ' карточек для знакомства' },
      { r: 'cards', n: 'Закрепление: карточки', d: Content.cards().length + ' терминов' },
      { r: 'quiz/nature', n: 'Природа улуса', d: QUIZ_LEN + ' вопросов' }
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
     ЭКРАН 2 · ВИКТОРИНА
     ========================================================= */
  function startQuiz(setId) {
    const set = Content.sets().filter((s) => s.id === setId)[0] || Content.sets()[0];
    const all = Content.questions().filter((q) => q.set === set.id);
    const pool = shuffle(all).slice(0, Math.min(QUIZ_LEN, all.length));
    state.quiz = {
      set: set.id, title: set.title,
      pool, idx: 0, picked: null, checked: false,
      firstTry: true, correctFirst: 0, dead: [],
      hint: false, log: [], done: false, startedAt: Date.now()
    };
  }

  function renderQuiz(setId) {
    const s = state.quiz;
    if (!s || s.set !== setId || !s.pool.length) startQuiz(setId);
    if (state.quiz.done) return renderResult();
    renderQuestion();
  }

  function renderQuestion() {
    const s = state.quiz;
    const q = s.pool[s.idx];
    const total = s.pool.length;
    const answeredOk = s.correctFirst;

    view.innerHTML = `
      <h1 class="title">${esc(s.title)}</h1>
      <p class="step">Задание ${s.idx + 1} из ${total}</p>
      <div class="bar"><span style="width:${pct(s.idx, total)}%"></span></div>

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
              ${mark}
              ${label ? `<span class="sr">${label}</span>` : ''}
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
    const s = state.quiz;
    if (!s || s.checked || s.picked === null) return;
    const q = s.pool[s.idx];
    const ok = s.picked === q.answer;

    if (ok) {
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
    const s = state.quiz;
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
    renderQuiz(s.set);
  }

  function renderResult() {
    const s = state.quiz;
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
            ${wrong.map((r) => `<li>${esc(r.q.text)}
              <span class="right">Правильный ответ: ${esc(r.q.options[r.q.answer])}</span></li>`).join('')}
          </ul>
        </section>` : ''}
    `;

    $('#againBtn').addEventListener('click', () => { Sound.play('click'); startQuiz(s.set); renderQuiz(s.set); });
  }

  /* =========================================================
     ЭКРАН 3 · ЗНАКОМСТВО
     ========================================================= */
  const TABS = [
    { id: 'all', title: 'Все' },
    { id: 'fauna', title: 'Животные' },
    { id: 'flora', title: 'Растения' }
  ];
  const catOf = (sp) => ((sp.group === 'trees' || sp.group === 'flowers') ? 'flora' : 'fauna');

  function learnList() {
    return Content.species().filter((sp) => state.learn.tab === 'all' || catOf(sp) === state.learn.tab);
  }

  function renderLearn() {
    if (state.learn.id) return renderLearnOne();
    const list = learnList();
    view.innerHTML = `
      <h1 class="title">Животные и растения улуса</h1>
      <p class="lead">Выбери, о ком или о чём хочешь узнать.</p>

      <div class="tabs" role="group" aria-label="Фильтр">
        ${TABS.map((t) => `<button class="tab ${state.learn.tab === t.id ? 'on' : ''}" data-tab="${t.id}" data-sfx="select">${t.title}</button>`).join('')}
      </div>

      <div class="rows">
        ${list.map((sp) => `
          <button class="row" data-sp="${esc(sp.id)}" data-sfx="click">
            <span class="pic" aria-hidden="true">${sp.emoji}</span>
            <span>${esc(sp.name)}</span>
            <span class="go" aria-hidden="true">→</span>
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
     ЭКРАН 4 · ЗАКРЕПЛЕНИЕ (КАРТОЧКИ)
     ========================================================= */
  function initCards() {
    state.cards = { deck: shuffle(Content.cards()), idx: 0, over: false };
  }

  function renderCards() {
    if (!state.cards) initCards();
    const c = state.cards;
    if (!c.deck.length) {
      view.innerHTML = '<h1 class="title">Карточек пока нет</h1><p class="lead">Их можно добавить в разделе «Для учителя».</p>';
      return;
    }
    if (c.idx >= c.deck.length) c.idx = 0;
    const card = c.deck[c.idx];
    const last = c.idx === c.deck.length - 1;

    view.innerHTML = `
      <h1 class="title">Закрепление</h1>
      <p class="step">Карточка ${c.idx + 1} из ${c.deck.length}</p>
      <div class="bar"><span style="width:${pct(c.idx + 1, c.deck.length)}%"></span></div>
      <p class="instr">Вспомни, что это значит, и нажми на карточку.</p>

      <div class="card-box">
        <div class="flip ${c.over ? 'over' : ''}" id="flip" role="button" tabindex="0"
             aria-label="Карточка. Нажми, чтобы увидеть ответ.">
          <div class="side a">
            <span class="small">${esc(card.tag)}</span>
            <span class="word">${esc(card.term)}</span>
          </div>
          <div class="side b">
            <span class="def">${esc(card.def)}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" id="flipBtn" data-sfx="flip">${c.over ? 'Скрыть ответ' : 'Показать ответ'}</button>
        <div class="btn-row">
          <button class="btn" id="prevBtn" data-sfx="flip">← Назад</button>
          <button class="btn" id="nextBtn" data-sfx="flip">${last ? 'В начало' : 'Дальше →'}</button>
        </div>
      </div>
    `;

    const flip = () => { c.over = !c.over; Sound.play('flip'); renderCards(); };
    const move = (d) => {
      c.idx = (c.idx + d + c.deck.length) % c.deck.length;
      c.over = false;
      Sound.play('flip');
      renderCards();
    };

    $('#flip').addEventListener('click', flip);
    $('#flip').addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    $('#flipBtn').addEventListener('click', flip);
    $('#prevBtn').addEventListener('click', () => move(-1));
    $('#nextBtn').addEventListener('click', () => move(1));
  }

  /* =========================================================
     ЭКРАН 5 · РЕДАКТОР (ДЛЯ УЧИТЕЛЯ)
     ========================================================= */
  const ED_TABS = [
    { id: 'q', title: 'Вопросы' },
    { id: 's', title: 'Карточки знакомства' },
    { id: 'c', title: 'Термины' }
  ];

  function edItems() {
    const t = state.editor.tab;
    if (t === 's') return Content.species();
    if (t === 'c') return Content.cards();
    return Content.questions();
  }

  function renderEditor() {
    const tab = state.editor.tab;
    const counts = { q: Content.questions().length, s: Content.species().length, c: Content.cards().length };
    const changed = Content.changedCount();

    view.innerHTML = `
      <h1 class="title">Задания (для учителя)</h1>
      <p class="lead">Меняй любые слова. Правки сохраняются в этом браузере${changed ? `, изменено блоков: ${changed}` : ''}.</p>

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

    if (state.editor.openId) {
      const d = $(`#edList [data-item="${state.editor.openId}"]`);
      if (d) { d.open = true; try { if (typeof d.scrollIntoView === 'function') d.scrollIntoView({ block: 'center' }); } catch (e) {} }
    }
  }

  function edItem(tab, it) {
    const ch = Content.changed(tab, it.id);
    const sum = tab === 'q'
      ? `${esc(it.text.length > 70 ? it.text.slice(0, 70) + '…' : it.text)}`
      : tab === 's' ? `${esc(it.name)}` : `${esc(it.term)}`;
    const tag = tab === 'q'
      ? `<span class="sum-tag">${it.set === 'rodina' ? 'Родина' : 'Природа'}</span>` : '';

    let body = '';
    if (tab === 'q') {
      body = `
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
        <div class="field"><label>Объяснение правильного ответа</label><textarea rows="3" data-field="explain">${esc(it.explain)}</textarea></div>`;
    } else if (tab === 's') {
      body = `
        <div class="field"><label>Название</label><input type="text" data-field="name" value="${esc(it.name)}"></div>
        <div class="field"><label>Подпись</label><input type="text" data-field="status" value="${esc(it.status)}"></div>
        <div class="field"><label>Эмодзи</label><input type="text" data-field="emoji" value="${esc(it.emoji)}"></div>
        <div class="field"><label>Что рассказать (каждая строка — отдельный пункт)</label>
          <textarea rows="4" data-field="factsText">${esc(it.facts.join('\n'))}</textarea></div>`;
    } else {
      body = `
        <div class="field"><label>Термин</label><input type="text" data-field="term" value="${esc(it.term)}"></div>
        <div class="field"><label>Определение</label><textarea rows="3" data-field="def">${esc(it.def)}</textarea></div>
        <div class="field"><label>Метка</label><input type="text" data-field="tag" value="${esc(it.tag)}"></div>`;
    }

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
      const set = val('set');
      const options = $$('[data-opt]', box).map((i) => i.value.trim());
      const answer = parseInt($('[data-answer]', box).dataset.answer, 10);
      if (!text) return fail('Текст вопроса не может быть пустым');
      if (options.some((o) => !o)) return fail('Все четыре варианта должны быть заполнены');
      if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return fail('Варианты ответа не должны повторяться');
      if (!(answer >= 0 && answer <= 3)) return fail('Отметь правильный вариант');
      if (!hint || !explain) return fail('Подсказка и объяснение не могут быть пустыми');
      Content.set('q', id, { text, options, answer, hint, explain, set });
    } else if (state.editor.tab === 's') {
      const name = val('name');
      const facts = val('factsText').split('\n').map((x) => x.trim()).filter(Boolean);
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
    state.quiz = null;
    state.cards = null;
    Sound.play('correct');
    toast('Сохранено');
    renderEditor();
  }

  function fail(msg) { Sound.play('wrong'); toast(msg); }

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
    else { state.quiz = null; renderHome(); }

    try { global.scrollTo(0, 0); } catch (e) {}
  }

  function syncSound() {
    const on = Sound.isEnabled();
    soundBtn.textContent = on ? '🔊 Звук вкл' : '🔇 Звук выкл';
    soundBtn.setAttribute('aria-pressed', String(on));
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

    global.addEventListener('hashchange', () => render());

    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') { if (state.route !== 'home') go('home'); return; }

      if (state.route === 'cards' && state.cards) {
        const c = state.cards;
        const n = c.deck.length;
        if (e.key === ' ') { e.preventDefault(); c.over = !c.over; Sound.play('flip'); renderCards(); }
        else if (e.key === 'ArrowRight') { c.idx = (c.idx + 1) % n; c.over = false; Sound.play('flip'); renderCards(); }
        else if (e.key === 'ArrowLeft') { c.idx = (c.idx - 1 + n) % n; c.over = false; Sound.play('flip'); renderCards(); }
        return;
      }

      if (state.route === 'quiz' && state.quiz && !state.quiz.done) {
        const s = state.quiz;
        if (!s.checked) {
          const n = parseInt(e.key, 10);
          const idx = !isNaN(n) && n >= 1 && n <= 4 ? n - 1 : LETTERS.indexOf(e.key.toUpperCase());
          if (idx !== undefined && idx >= 0 && idx < 4 && s.dead.indexOf(idx) === -1) {
            s.picked = idx;
            Sound.play('select');
            renderQuestion();
          } else if (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р') {
            s.hint = true; Sound.play('hint'); renderQuestion();
          } else if (e.key === 'Enter' && s.picked !== null) {
            checkAnswer();
          }
        } else if (e.key === 'Enter') nextQuestion();
      }
    });
  }

  syncSound();
  bind();
  render();

  global.App = { state, render, go, startQuiz, checkAnswer, nextQuestion, toast, QUIZ_LEN };
})(typeof window !== 'undefined' ? window : globalThis);
