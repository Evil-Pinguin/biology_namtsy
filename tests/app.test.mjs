/* Тесты: целостность данных + реальные клики по интерфейсу в jsdom.
   Запуск: npm test  (нужен devDependency jsdom) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const fails = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ================================================================
   1. ЦЕЛОСТНОСТЬ ДАННЫХ
   ================================================================ */
console.log('\n[1] Данные викторины');

const dataDom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'dangerously' });
dataDom.window.eval(fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8'));
const D = dataDom.window.DATA;

await test('16 тем объявлены с уникальными id', () => {
  assert.equal(D.TOPICS.length, 16);
  assert.equal(new Set(D.TOPICS.map((t) => t.id)).size, 16);
  D.TOPICS.forEach((t) => assert.ok(['fauna', 'flora'].includes(t.cat), `bad cat: ${t.id}`));
});

await test('вопросов столько, сколько заявлено в разметке (23), все id уникальны', () => {
  assert.equal(D.QUESTIONS.length, 23);
  assert.equal(new Set(D.QUESTIONS.map((q) => q.id)).size, 23);
});

await test('у каждого вопроса 4 уникальных варианта и валидный индекс ответа', () => {
  D.QUESTIONS.forEach((q) => {
    assert.equal(q.options.length, 4, `${q.id}: нужно 4 варианта`);
    assert.equal(new Set(q.options).size, 4, `${q.id}: дубли вариантов`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${q.id}: answer=${q.answer}`);
    assert.ok(q.text.length > 20, `${q.id}: короткий вопрос`);
    assert.ok(q.hint.length > 20, `${q.id}: нет подсказки`);
    assert.ok(q.explain.length > 40, `${q.id}: нет объяснения`);
    assert.ok(D.topicById(q.topic), `${q.id}: неизвестная тема ${q.topic}`);
  });
});

await test('все темы используются хотя бы в одном вопросе', () => {
  const used = new Set(D.QUESTIONS.map((q) => q.topic));
  const unused = D.TOPICS.filter((t) => !used.has(t.id)).map((t) => t.id);
  assert.equal(unused.join(','), '', `темы без вопросов: ${unused.join(', ')}`);
});

await test('карточки и справочник заполнены и не дублируются', () => {
  assert.equal(D.CARDS.length, 20);
  assert.equal(new Set(D.CARDS.map((c) => c.term)).size, 20);
  D.CARDS.forEach((c) => assert.ok(c.def.length > 20 && c.tag, `плохая карточка: ${c.term}`));
  assert.ok(D.SPECIES.length >= 20);
  const groups = new Set(D.GROUPS.map((g) => g.id));
  D.SPECIES.forEach((s) => {
    assert.ok(groups.has(s.group), `неизвестная группа: ${s.group}`);
    assert.ok(s.facts.length >= 3, `мало фактов: ${s.name}`);
  });
});

await test('правильные ответы распределены по разным позициям (нет одного шаблона)', () => {
  const counts = [0, 0, 0, 0];
  D.QUESTIONS.forEach((q) => { counts[q.answer] += 1; });
  assert.ok(Math.max(...counts) <= 8, `перекос ответов: ${counts.join('/')}`);
  assert.ok(Math.min(...counts) >= 3, `есть незадействованные позиции: ${counts.join('/')}`);
});

/* ================================================================
   2. ЗАПУСК ПРИЛОЖЕНИЯ В РЕАЛЬНОМ DOM
   ================================================================ */
console.log('\n[2] Интерфейс и режимы');

const rawHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<script src="[^"]+"><\/script>/g, '')
  .replace(/<link[^>]*>/g, '');

const dom = new JSDOM(rawHtml, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const win = dom.window;
win.scrollTo = () => {};
win.Element.prototype.scrollTo = () => {};

for (const f of ['data.js', 'sound.js', 'store.js', 'app.js']) {
  win.eval(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'));
}

const doc = win.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));
const click = (el) => {
  assert.ok(el, 'элемент для клика не найден');
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const key = (k) => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));

/* звуки: перехватываем вызовы Sound.play */
const played = [];
const realPlay = win.Sound.play.bind(win.Sound);
win.Sound.play = (n) => { played.push(n); realPlay(n); };

await test('приложение стартует на главной, меню содержит 6 режимов', () => {
  assert.equal($$('.nav-item').length, 6);
  assert.ok($('.hero-title'), 'нет hero-блока');
  assert.ok($('.hero-title').textContent.includes('Что изучим сегодня'), 'нет приветствия');
  assert.ok($('.hero-sub').textContent.includes('Намского улуса'), 'hero не про Намский улус');
  assert.equal($$('.mode-card').length, 5, 'ожидалось 5 карточек режимов');
  assert.ok($('.nav-item[data-route="home"]').classList.contains('active'));
});

await test('заявленные числа на главной совпадают с данными', () => {
  const facts = $$('.fact b').map((b) => b.textContent);
  assert.deepEqual(facts, ['36', '3', String(win.DATA.QUESTIONS.length), String(win.DATA.CARDS.length)]);
});

await test('клик по «Начать викторину» переходит на настройку викторины', async () => {
  click($('.hero-actions .btn-primary'));
  assert.equal(win.location.hash, '#/quiz');
  await tick();   // hashchange в jsdom приходит асинхронно
  assert.ok($('#startBtn'), 'нет кнопки старта');
  assert.equal($$('#topicRow .chip').length, 16, 'ожидалось 16 чипов тем');
  assert.equal($('#avail').textContent, String(win.DATA.QUESTIONS.length));
});

await test('фильтр «Растения» ограничивает пул вопросами ботаники', () => {
  click($('#catRow [data-cat="flora"]'));
  const floraTopics = new Set(win.DATA.TOPICS.filter((t) => t.cat === 'flora').map((t) => t.id));
  const expect = win.DATA.QUESTIONS.filter((q) => floraTopics.has(q.topic)).length;
  assert.equal($('#avail').textContent, String(expect));
  assert.ok(expect > 0 && expect < win.DATA.QUESTIONS.length);
});

await test('выбор тем и сброс работают', () => {
  click($('#catRow [data-cat="all"]'));
  click($('#topicRow [data-topic="birds"]'));
  click($('#topicRow [data-topic="trees"]'));
  const expect = win.DATA.QUESTIONS.filter((q) => ['birds', 'trees'].includes(q.topic)).length;
  assert.equal($('#avail').textContent, String(expect));
  assert.equal($$('#topicRow .chip.on').length, 2);
  click($('#clearTopics'));
  assert.equal($('#avail').textContent, String(win.DATA.QUESTIONS.length));
});

await test('кнопка звука выключает и включает звуковые эффекты', () => {
  assert.equal(win.Sound.isEnabled(), true);
  click($('#soundToggle'));
  assert.equal(win.Sound.isEnabled(), false, 'звук должен выключиться');
  assert.equal($('#soundBtn').textContent, '🔇');
  click($('#soundToggle'));
  assert.equal(win.Sound.isEnabled(), true, 'звук должен включиться');
  assert.equal($('#soundBtn').textContent, '🔊');
});

await test('старт викторины на 5 вопросов: пул, прогресс, варианты', () => {
  click($('#countRow [data-count="5"]'));
  assert.equal(win.App.state.setup.count, 5);
  click($('#startBtn'));
  const s = win.App.state.session;
  assert.ok(s, 'сессия не создана');
  assert.equal(s.mode, 'classic');
  assert.equal(s.pool.length, 5);
  assert.equal($$('.opt').length, 4, 'не отрисованы 4 варианта');
  assert.ok($('.q-text').textContent.length > 20);
  assert.ok($('.quiz-meta .pill').textContent.includes('из 5'));
});

await test('подсказка показывается и скрывается, играет звук hint', () => {
  played.length = 0;
  click($('#hintBtn'));
  assert.ok($('.gem-bubble'), 'подсказка не появилась');
  assert.ok($('.gem-bubble').textContent.includes('Подсказка'));
  assert.ok(played.includes('hint'), 'не проигран звук подсказки');
  click($('#hintBtn'));
  assert.equal($('.gem-bubble'), null, 'подсказка не скрылась');
});

await test('правильный ответ: зелёная подсветка, «Верно!», статистика и звук', async () => {
  played.length = 0;
  const q = win.App.state.session.pool[0];
  click($(`.opt[data-i="${q.answer}"]`));
  assert.ok($(`.opt[data-i="${q.answer}"]`).classList.contains('right'));
  assert.ok($('.feedback.good'), 'нет блока «Верно!»');
  assert.ok(played.includes('correct'), 'не проигран звук правильного ответа');
  const stored = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(stored.correct, 1, 'в localStorage нет правильного ответа');
  assert.equal(stored.answered, 1);
  assert.equal(stored.byQuestion[q.id].correct, 1);
  assert.equal($('#streakVal').textContent, '1', 'чип серии не обновился');
});

await test('нельзя ответить дважды после блокировки', () => {
  const s = win.App.state.session;
  const before = s.correct;
  click($('.opt:not(:disabled)') || $('.opt'));
  assert.equal(s.correct, before, 'двойной ответ засчитан');
  assert.equal(JSON.parse(win.localStorage.getItem('namtsy.progress.v1')).answered, 1);
});

await test('объяснение появляется после ответа', () => {
  const q = win.App.state.session.pool[0];
  assert.ok($('.explain'), 'нет блока объяснения');
  assert.ok($('.explain p').textContent.includes(q.explain.slice(0, 30)));
});

await test('неверный ответ: красный вариант + показ верного', () => {
  click($('#nextBtn'));
  const s = win.App.state.session;
  const q = s.pool[1];
  const wrongIdx = q.options.findIndex((_, i) => i !== q.answer);
  played.length = 0;
  click($(`.opt[data-i="${wrongIdx}"]`));
  assert.ok($(`.opt[data-i="${wrongIdx}"]`).classList.contains('wrong'));
  assert.ok($(`.opt[data-i="${q.answer}"]`).classList.contains('right'));
  assert.ok($('.feedback.bad'), 'нет блока «Не совсем так»');
  assert.ok($('.feedback.bad').textContent.includes(q.options[q.answer]));
  assert.ok(played.includes('wrong'), 'не проигран звук ошибки');
  assert.equal(s.correct, 1);
  assert.equal(s.streak, 0, 'серия не сброшена');
});

await test('ответ с клавиатуры (цифра и буква) и Enter для перехода', () => {
  click($('#nextBtn'));
  let s = win.App.state.session;
  let q = s.pool[2];
  key(String(q.answer + 1));
  assert.equal(s.correct, 2, 'клавиша-цифра не сработала');
  click($('#nextBtn'));
  q = s.pool[3];
  const letters = ['а', 'б', 'в', 'г'];
  key(letters[q.answer]);
  assert.equal(s.correct, 3, 'клавиша-буква не сработала');
});

await test('раунд завершается экраном результатов с кольцом и разбором', () => {
  click($('#nextBtn'));                       // 5-й вопрос
  const s = win.App.state.session;
  const q = s.pool[4];
  click($(`.opt[data-i="${q.answer}"]`));     // верно
  click($('#nextBtn'));                       // -> результат
  assert.equal(win.App.state.session, null, 'сессия не очищена');
  assert.ok($('.ring-wrap'), 'нет кольца результата');
  assert.equal($$('.rs b').length, 4);
  assert.ok($('.result .page-title').textContent.length > 5);
  const wrong = $$('.review-item').length;
  assert.equal(wrong, 1, 'в разборе должен быть 1 ошибочный вопрос');
  const stored = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(stored.answered, 5);
  assert.equal(stored.correct, 4);
  assert.equal(stored.rounds, 1);
  assert.equal(stored.bestScore, 80);
  assert.equal(stored.bestStreak, 3);
  assert.equal($('#streakVal').textContent, '3'); // верно 1, 3, 4, 5; на 2-м ошиблись
});

await test('кнопка «Сыграть ещё раз» запускает новый раунд', () => {
  click($('#againBtn'));
  const s = win.App.state.session;
  assert.ok(s && s.idx === 0 && !s.locked);
  assert.equal(s.pool.length, 5);
  assert.ok($('.q-card'), 'нет карточки вопроса');
});

await test('спринт: 60 секунд, автопереход и учёт рекорда', async () => {
  win.location.hash = '#/sprint';
  win.App.render();
  assert.ok($('#startBtn'), 'нет старта спринта');
  click($('#startBtn'));
  const s = win.App.state.session;
  assert.equal(s.mode, 'sprint');
  assert.equal(s.timeLeft, 60);
  assert.ok($('#timeVal'), 'нет таймера');
  assert.ok($('#timeBar'), 'нет полосы времени');
  assert.ok(s.pool.length > 20, 'пул спринта должен быть с запасом');
  const q = s.pool[0];
  click($(`.opt[data-i="${q.answer}"]`));
  assert.equal(s.correct, 1);
  await new Promise((r) => setTimeout(r, 600));   // автопереход
  assert.equal(win.App.state.session.idx, 1, 'нет автоперехода к следующему вопросу');
  win.App.finishSession();
  assert.ok($('.ring-wrap'), 'нет итогов спринта');
  const stored = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(stored.bestSprint, 1);
  assert.equal(stored.rounds, 2);
});

await test('уход со спринта останавливает таймер (нет «протёкшего» интервала)', async () => {
  win.location.hash = '#/sprint';
  win.App.render();
  click($('#startBtn'));
  const s = win.App.state.session;
  const t0 = s.timeLeft;
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(s.timeLeft < t0, 'таймер вообще не тикает');
  click($('.nav-item[data-route="home"]'));
  await tick();
  assert.ok($('.hero-title'), 'не ушли на главную');
  const frozen = s.timeLeft;
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(s.timeLeft, frozen, 'таймер продолжает тикать после ухода со страницы');
});

await test('карточки: переворот, навигация, отметка «знаю», перемешивание', () => {
  win.location.hash = '#/cards';
  win.App.render();
  assert.ok($('#flash'), 'нет карточки');
  assert.equal(win.App.state.cards.deck.length, win.DATA.CARDS.length);
  assert.ok($('.flash-front h3').textContent.length > 1);
  assert.equal($('.flash').classList.contains('flipped'), false);
  click($('#flipBtn'));
  assert.ok($('.flash').classList.contains('flipped'), 'карточка не перевернулась');
  click($('#knowBtn'));
  assert.ok($('#knowBtn').textContent.includes('Выучено'));
  assert.equal($('.flash-progress').textContent.match(/Выучено:\s*(\d+)/)[1], '1');
  const before = $('.flash-front h3').textContent;
  click($('#nextCardBtn'));
  assert.equal($('.flash').classList.contains('flipped'), false, 'не сбросился переворот');
  click($('#prevBtn'));
  assert.equal($('.flash-front h3').textContent, before, '«Назад» вернул не ту карточку');
  key(' ');
  assert.ok($('.flash').classList.contains('flipped'), 'пробел не переворачивает карточку');
  click($('#shuffleBtn'));
  assert.equal(win.App.state.cards.idx, 0);
});

await test('справочник: поиск, фильтр по группе и модальное окно', () => {
  win.location.hash = '#/reference';
  win.App.render();
  const total = win.DATA.SPECIES.length;
  assert.equal($$('.ref-card').length, total);
  click($('#groupRow [data-group="birds"]'));
  assert.equal($$('.ref-card').length, win.DATA.SPECIES.filter((s) => s.group === 'birds').length);
  click($('#groupRow [data-group="all"]'));
  const input = $('#refSearch');
  input.value = 'брусника';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  assert.equal($$('.ref-card').length, 1, 'поиск не отфильтровал');
  assert.ok($('.ref-name').textContent.toLowerCase().includes('брусника'));
  click($('.ref-card'));
  assert.equal($('#modalRoot').hidden, false, 'модалка не открылась');
  assert.ok($('.modal').textContent.includes('Брусника'));
  assert.ok($('.modal-list li').textContent.length > 10);
  key('Escape');
  assert.equal($('#modalRoot').hidden, true, 'модалка не закрылась по Esc');
});

await test('прогресс: метрики, полосы по темам и сброс статистики', () => {
  win.location.hash = '#/progress';
  win.App.render();
  const stored = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  const vals = $$('.stat-card b').map((b) => b.textContent);
  assert.equal(vals[0], String(stored.rounds));
  assert.equal(vals[1], String(stored.answered));
  assert.equal(vals[3], String(stored.bestStreak));
  assert.ok($$('.topic-row').length >= 3, 'ожидались строки по темам');
  click($('#resetBtn'));
  const after = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(after.answered, 0, 'статистика не сброшена');
  assert.equal($('#streakVal').textContent, '0');
});

await test('переключатель звука сохраняется в localStorage', () => {
  win.Sound.setEnabled(false);
  assert.equal(win.Sound.isEnabled(), false);
  assert.equal(win.localStorage.getItem('namtsy.sound'), '0');
  win.Sound.setEnabled(true);
  assert.equal(win.localStorage.getItem('namtsy.sound'), '1');
  assert.ok(win.Sound._names.includes('correct') && win.Sound._names.includes('wrong'),
    'в движке нет звуков ответа');
});

await test('неизвестный хеш приводит на главную', () => {
  win.location.hash = '#/что-то-непонятное';
  win.App.render();
  assert.ok($('.hero-title'), 'не вернулись на главную');
  assert.ok($('.nav-item[data-route="home"]').classList.contains('active'));
});

/* ---- отчёт ---- */
console.log(`\nПройдено: ${passed}, ошибок: ${fails.length}`);
if (fails.length) {
  console.log('\nСписок ошибок:\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('Все проверки пройдены ✅');
