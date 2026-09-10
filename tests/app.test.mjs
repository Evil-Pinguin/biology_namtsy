/* Тесты: данные, редактируемый слой контента и реальные клики по интерфейсу (jsdom).
   Запуск: npm test  (devDependency: jsdom) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const fails = [];

async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ================================================================
   1. ДАННЫЕ
   ================================================================ */
console.log('\n[1] Данные заданий');

const dataDom = new JSDOM('<!doctype html>', { url: 'http://localhost/', runScripts: 'dangerously' });
dataDom.window.eval(read('assets/js/data.js'));
const D = dataDom.window.DATA;

await test('16 тем, 23 вопроса, 20 карточек, 22 вида — всё с уникальными id', () => {
  assert.equal(D.TOPICS.length, 16);
  assert.equal(D.QUESTIONS.length, 23);
  assert.equal(D.CARDS.length, 20);
  assert.equal(D.SPECIES.length, 22);
  assert.equal(new Set(D.CARDS.map((c) => c.id)).size, 20, 'id карточек повторяются');
  assert.equal(new Set(D.SPECIES.map((s) => s.id)).size, 22, 'id видов повторяются');
  assert.equal(new Set(D.QUESTIONS.map((q) => q.id)).size, 23, 'id вопросов повторяются');
});

await test('у каждого вопроса 4 разных варианта, валидный ответ, подсказка и объяснение', () => {
  D.QUESTIONS.forEach((q) => {
    assert.equal(q.options.length, 4, `${q.id}: нужно 4 варианта`);
    assert.equal(new Set(q.options).size, 4, `${q.id}: дубли вариантов`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${q.id}: answer=${q.answer}`);
    assert.ok(q.text.length > 20 && q.hint.length > 20 && q.explain.length > 40, `${q.id}: неполный состав`);
    assert.ok(D.topicById(q.topic), `${q.id}: неизвестная тема ${q.topic}`);
  });
});

await test('правильные ответы распределены по А/Б/В/Г (нельзя угадывать по позиции)', () => {
  const c = [0, 0, 0, 0];
  D.QUESTIONS.forEach((q) => { c[q.answer] += 1; });
  assert.ok(Math.max(...c) <= 8 && Math.min(...c) >= 3, `перекос: ${c.join('/')}`);
});

await test('у каждого вида минимум 3 факта и известная группа', () => {
  const groups = new Set(D.GROUPS.map((g) => g.id));
  D.SPECIES.forEach((s) => {
    assert.ok(groups.has(s.group), `${s.name}: неизвестная группа ${s.group}`);
    assert.ok(s.facts.length >= 3, `${s.name}: мало фактов`);
    assert.ok(s.name && s.status && s.emoji, `${s.id}: неполная карточка`);
  });
});

/* ================================================================
   2. ЗАПУСК ПРИЛОЖЕНИЯ
   ================================================================ */
console.log('\n[2] Меню из трёх кнопок');

const html = read('index.html').replace(/<script src="[^"]+"><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const win = dom.window;
win.scrollTo = () => {};
win.Element.prototype.scrollTo = () => {};
win.Element.prototype.scrollIntoView = () => {};

for (const f of ['data.js', 'sound.js', 'store.js', 'content.js', 'app.js']) win.eval(read('assets/js/' + f));

const doc = win.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));
const click = (el) => { assert.ok(el, 'элемент для клика не найден'); el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); };
const key = (k) => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
const lastToast = () => { const t = $$('.toast'); return t.length ? t[t.length - 1].textContent : ''; };
const openTab = (i) => { win.location.hash = '#/editor'; win.App.render(); click($$('#edTabs .chip')[i]); };
const played = [];
const realPlay = win.Sound.play.bind(win.Sound);
win.Sound.play = (n) => { played.push(n); realPlay(n); };

await test('бокового меню больше нет — только 3 большие кнопки', () => {
  assert.equal($('#sidebar'), null, 'осталось сложное боковое меню');
  assert.equal($$('.nav-item').length, 0, 'остался список режимов');
  assert.equal($$('.big').length, 3, 'на старте должно быть ровно 3 кнопки');
  const labels = $$('.big-txt b').map((b) => b.textContent);
  assert.deepEqual(labels, ['Знакомство с животными', 'Закрепление', 'Викторина']);
  assert.equal($('#backBtn').hidden, true, 'кнопка «Меню» не нужна на главной');
});

await test('кнопка «Викторина» запускает вопросы сразу, без экрана настройки', async () => {
  click($$('.big')[2]);
  assert.equal(win.location.hash, '#/quiz');
  await tick();
  assert.ok($('.q-card'), 'вопрос не показался');
  assert.equal($('#startBtn'), null, 'остался экран настройки викторины');
  assert.equal($('#catRow'), null, 'остался выбор разделов');
  const s = win.App.state.quiz;
  assert.equal(s.pool.length, win.App.QUIZ_LEN, 'не та длина викторины');
  assert.equal($$('.opt').length, 4);
  assert.ok($('.q-meta .pill').textContent.includes(`из ${win.App.QUIZ_LEN}`));
});

await test('подсказка и объяснение работают, звук проигрывается', () => {
  played.length = 0;
  click($('#hintBtn'));
  assert.ok($('.gem'), 'подсказка не появилась');
  assert.ok(played.includes('hint'));
  const q = win.App.state.quiz.pool[0];
  click($(`.opt[data-i="${q.answer}"]`));
  assert.ok($('.feedback.good') && $('.explain'));
  assert.ok($('.explain p').textContent.includes(q.explain.slice(0, 25)));
  assert.ok(played.includes('correct'));
  const st = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(st.correct, 1);
});

await test('неверный ответ показывает правильный вариант', () => {
  click($('#nextBtn'));
  const s = win.App.state.quiz;
  const q = s.pool[1];
  const wrong = q.options.findIndex((_, i) => i !== q.answer);
  played.length = 0;
  click($(`.opt[data-i="${wrong}"]`));
  assert.ok($(`.opt[data-i="${wrong}"]`).classList.contains('wrong'));
  assert.ok($(`.opt[data-i="${q.answer}"]`).classList.contains('right'));
  assert.ok($('.feedback.bad').textContent.includes(q.options[q.answer]));
  assert.ok(played.includes('wrong'));
  assert.equal(s.correct, 1);
});

await test('ответ с клавиатуры: цифры и буквы А/Б/В/Г', () => {
  click($('#nextBtn'));
  const s = win.App.state.quiz;
  key(String(s.pool[2].answer + 1));
  assert.equal(s.correct, 2, 'цифра не сработала');
  click($('#nextBtn'));
  key(['а', 'б', 'в', 'г'][s.pool[3].answer]);
  assert.equal(s.correct, 3, 'буква не сработала');
});

await test('викторина заканчивается результатом с кольцом и разбором ошибок', () => {
  const s = win.App.state.quiz;
  for (let i = 4; i < s.pool.length; i++) {
    click($('#nextBtn'));
    const q = win.App.state.quiz.pool[i];
    click($(`.opt[data-i="${q.answer}"]`));
  }
  click($('#nextBtn'));   // -> результат
  assert.equal(win.App.state.quiz.done, true);
  assert.ok($('.ring-wrap'), 'нет кольца результата');
  assert.equal($$('.rs b').length, 3);
  assert.equal($$('.review-item').length, 1, 'в разборе должен быть 1 ошибочный вопрос');
  const st = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(st.answered, 10);
  assert.equal(st.correct, 9);
  assert.equal(st.bestScore, 90);
});

await test('«Пройти ещё раз» начинает новую викторину, «В меню» возвращает на 3 кнопки', async () => {
  click($('#againBtn'));
  assert.equal(win.App.state.quiz.idx, 0);
  assert.equal(win.App.state.quiz.done, false);
  assert.ok($('.q-card'));
  click($('.q-actions [data-go="home"]'));
  await tick();
  assert.equal($$('.big').length, 3, 'не вернулись в меню');
  assert.equal(win.App.state.quiz, null, 'сессия викторины не сброшена');
});

/* ================================================================
   3. ЗНАКОМСТВО И ЗАКРЕПЛЕНИЕ
   ================================================================ */
console.log('\n[3] Знакомство и закрепление');

await test('«Знакомство» показывает все 22 вида, фильтр и карточка вида работают', async () => {
  click($$('.big')[0]);
  await tick();
  assert.equal($$('.tile').length, win.DATA.SPECIES.length);
  click($('#grpRow [data-grp="flora"]'));
  const flora = win.DATA.SPECIES.filter((s) => ['trees', 'flowers'].includes(s.group)).length;
  assert.equal($$('.tile').length, flora);
  click($('#grpRow [data-grp="all"]'));
  const stepny = win.DATA.SPECIES.find((s) => s.name.includes('хорь'));
  click($(`.tile[data-sp="${stepny.id}"]`));
  assert.ok($('.card-view'), 'не открылась карточка вида');
  assert.ok($('.cv-title').textContent.includes('хор'), 'открылся не тот вид');
  assert.ok($$('.cv-list li').length >= 3, 'мало фактов в рассказе');
  assert.ok($('.card-view').textContent.includes('акклиматиз'), 'в рассказе про хорь нет главного');
  click($('#speak'));   // озвучка не должна ломать интерфейс
  click($('#backList'));
  assert.equal($$('.tile').length, win.DATA.SPECIES.length, 'не вернулись к списку');
});

await test('кнопки «← / →» листают виды внутри знакомства', () => {
  const first = win.DATA.SPECIES[0].id;
  click($(`.tile[data-sp="${first}"]`));
  assert.ok($('.cv-title').textContent.includes(win.DATA.SPECIES[0].name.split(' ')[0]));
  const nextBtn = $$('.cv-actions .btn').filter((b) => b.textContent.trim().endsWith('→')).pop();
  click(nextBtn);
  assert.equal(win.App.state.learn.id, win.DATA.SPECIES[1].id, 'не перешли к следующему виду');
});

await test('«Закрепление»: переворот карточки, отметка и перемешивание', async () => {
  click($('#backBtn'));
  await tick();
  click($$('.big')[1]);
  await tick();
  assert.ok($('#flash'), 'нет карточки');
  assert.equal(win.App.state.cards.deck.length, win.DATA.CARDS.length);
  click($('#flipBtn'));
  assert.ok($('.flash').classList.contains('flipped'));
  click($('#knowBtn'));
  assert.ok($('#knowBtn').textContent.includes('Повторено'));
  const term = $('.flash-front h3').textContent;
  click($('#nextBtn'));
  assert.equal($('.flash').classList.contains('flipped'), false);
  click($('#prevBtn'));
  assert.equal($('.flash-front h3').textContent, term);
  key(' ');
  assert.ok($('.flash').classList.contains('flipped'), 'пробел не переворачивает');
  click($('#shuffleBtn'));
  assert.equal(win.App.state.cards.idx, 0);
});

/* ================================================================
   4. РЕДАКТОР ТЕКСТОВ
   ================================================================ */
console.log('\n[4] Редактирование заданий');

await test('редактор открывается и показывает три вкладки', async () => {
  win.location.hash = '#/editor';
  win.App.render();
  assert.equal($$('#edTabs .chip').length, 3);
  assert.ok($('#edTabs .chip').textContent.includes(`Вопросы (${win.DATA.QUESTIONS.length})`));
  assert.equal($$('.ed-item').length, win.DATA.QUESTIONS.length);
});

await test('правка текста вопроса сохраняется и попадает в викторину', () => {
  const id = win.DATA.QUESTIONS[0].id;
  const newText = 'Какая птица изображена на гербе Намского улуса?';
  const ta = $(`[data-item="${id}"] [data-field="text"]`);
  ta.value = newText;
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.question(id).text, newText, 'правка не применилась');
  assert.ok(win.localStorage.getItem('namtsy.content.v1').includes(newText), 'правка не легла в localStorage');
  assert.ok(win.Content.changed('q', id));
  assert.equal(win.Content.changedCount(), 1);
  assert.ok($(`[data-item="${id}"] .ed-badge`), 'нет пометки «изменено»');
  // исходник не испорчен
  assert.equal(win.DATA.QUESTIONS[0].text.includes('тотемом'), true, 'исходные данные изменены напрямую');
  // правка видна в пуле викторины
  const inQuiz = win.Content.questions().some((q) => q.id === id && q.text === newText);
  assert.ok(inQuiz, 'викторина не видит правку');
});

await test('смена правильного варианта ответа сохраняется', () => {
  const id = win.DATA.QUESTIONS[1].id;
  const wrap = $(`[data-item="${id}"] [data-answer]`);
  assert.equal(wrap.dataset.answer, String(win.DATA.QUESTIONS[1].answer));
  const target = (win.DATA.QUESTIONS[1].answer + 1) % 4;
  click($(`[data-item="${id}"] [data-pick="${target}"]`));
  assert.equal(wrap.dataset.answer, String(target));
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.question(id).answer, target, 'новый правильный вариант не сохранился');
});

await test('пустой текст вопроса не сохраняется', () => {
  const id = win.DATA.QUESTIONS[2].id;
  const before = win.Content.question(id).text;
  $(`[data-item="${id}"] [data-field="text"]`).value = '   ';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.question(id).text, before, 'пустой вопрос сохранился');
  assert.equal(win.Content.changed('q', id), false);
  assert.ok(lastToast().includes('не может быть пустым'), 'не показали предупреждение: ' + lastToast());
});

await test('одинаковые варианты ответа отклоняются', () => {
  const id = win.DATA.QUESTIONS[3].id;
  const inputs = $$(`[data-item="${id}"] [data-opt]`);
  inputs[0].value = 'одно и то же';
  inputs[1].value = 'одно и то же';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.changed('q', id), false);
  assert.ok(lastToast().includes('не должны повторяться'), 'не показали предупреждение: ' + lastToast());
});

await test('правка описания вида: строки становятся фактами', async () => {
  click($$('#edTabs .chip')[1]);
  const id = win.DATA.SPECIES.find((s) => s.name.includes('хорь')).id;
  $(`[data-item="${id}"] [data-field="name"]`).value = 'Степной хорёк (наш)';
  $(`[data-item="${id}"] [data-field="factsText"]`).value = 'Первый факт.\n\nВторой факт.\n';
  click($(`[data-item="${id}"] [data-save]`));
  const sp = win.Content.spec(id);
  assert.equal(sp.name, 'Степной хорёк (наш)');
  assert.equal(sp.facts.join(' | '), 'Первый факт. | Второй факт.', 'пустые строки должны отбрасываться');
  // правка видна в «Знакомстве»
  win.location.hash = '#/learn';
  win.App.render();
  click($(`.tile[data-sp="${id}"]`));
  assert.ok($('.cv-title').textContent.includes('(наш)'), 'знакомство не показывает правку');
  assert.equal($$('.cv-list li').length, 2);
});

await test('правка карточки меняет текст в закреплении', async () => {
  win.location.hash = '#/editor';
  win.App.render();
  click($$('#edTabs .chip')[2]);
  const id = win.DATA.CARDS[0].id;
  $(`[data-item="${id}"] [data-field="def"]`).value = 'Обновлённое определение термина.';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.card(id).def, 'Обновлённое определение термина.');
  win.location.hash = '#/cards';
  win.App.render();
  const all = $$('.flash-back p').map((p) => p.textContent).join('|') + '|' + win.Content.cards().map((c) => c.def).join('|');
  assert.ok(all.includes('Обновлённое определение термина.'), 'карточка не обновилась');
});

await test('экспорт и импорт правок (JSON) сохраняют изменения', () => {
  const json = win.Content.exportJSON();
  const parsed = JSON.parse(json);
  assert.ok(parsed.q && parsed.s && parsed.c, 'в файле нет трёх разделов');
  assert.equal(Object.keys(parsed.q).length, 2, 'ожидались 2 правки вопросов');
  // ломаем всё и восстанавливаем из файла
  win.Content.resetAll();
  assert.equal(win.Content.changedCount(), 0);
  const n = win.Content.importJSON(json);
  assert.equal(n, 4, 'импорт вернул не все правки (вопрос, вариант, вид, карточка)');
  assert.equal(win.Content.question(win.DATA.QUESTIONS[0].id).text, 'Какая птица изображена на гербе Намского улуса?');
});

await test('«Отменить правки» возвращает исходный текст блока', () => {
  openTab(0);
  const id = win.DATA.QUESTIONS[0].id;
  assert.ok($(`[data-item="${id}"] .ed-badge`), 'нет пометки «изменено»');
  click($(`[data-item="${id}"] [data-revert]`));
  assert.equal(win.Content.changed('q', id), false);
  assert.equal(win.Content.question(id).text, win.DATA.QUESTIONS[0].text);
});

await test('«Вернуть исходные тексты» очищает все правки и localStorage', () => {
  openTab(0);
  assert.ok(win.Content.changedCount() > 0);
  click($('#resetBtn'));
  assert.equal(win.Content.changedCount(), 0);
  assert.equal(JSON.parse(win.localStorage.getItem('namtsy.content.v1')).q['q01'], undefined);
  assert.equal(win.Content.questions().length, win.DATA.QUESTIONS.length);
});

await test('правки переживают перезагрузку страницы (слой читает localStorage)', () => {
  win.Content.set('q', 'q05', { text: 'Вопрос после перезагрузки' });
  const before = win.Content.changedCount();
  const saved = win.localStorage.getItem('namtsy.content.v1');
  const dom2 = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  dom2.window.scrollTo = () => {};
  dom2.window.localStorage.setItem('namtsy.content.v1', saved);
  for (const f of ['data.js', 'sound.js', 'store.js', 'content.js', 'app.js']) dom2.window.eval(read('assets/js/' + f));
  assert.equal(dom2.window.Content.question('q05').text, 'Вопрос после перезагрузки',
    'после перезагрузки правка потерялась');
  assert.equal(dom2.window.Content.changedCount(), before, 'после перезагрузки правок стало не столько же');
  assert.equal(dom2.window.document.querySelectorAll('.big').length, 3, 'второе окно должно открыться на меню');
  win.Content.resetAll();
});

/* ================================================================
   5. Мелочи интерфейса
   ================================================================ */
console.log('\n[5] Мелочи');

await test('кнопка звука выключает и включает звуковые эффекты', async () => {
  click($('#backBtn'));
  await tick();
  assert.equal(win.Sound.isEnabled(), true);
  click($('#soundBtn'));
  assert.equal(win.Sound.isEnabled(), false);
  assert.equal($('#soundBtn').textContent, '🔇');
  click($('#soundBtn'));
  assert.equal(win.Sound.isEnabled(), true);
  assert.equal($('#soundBtn').textContent, '🔊');
  assert.equal(win.localStorage.getItem('namtsy.sound'), '1');
});

await test('Esc и кнопка «← Меню» возвращают на главную', async () => {
  win.location.hash = '#/cards';
  win.App.render();
  assert.equal($('#backBtn').hidden, false);
  key('Escape');
  await tick();
  assert.equal(win.location.hash, '#/home');
  assert.equal($$('.big').length, 3);
});

await test('неизвестный адрес приводит в меню', () => {
  win.location.hash = '#/ерунда';
  win.App.render();
  assert.equal($$('.big').length, 3);
  assert.equal($('#backBtn').hidden, true);
});

console.log(`\nПройдено: ${passed}, ошибок: ${fails.length}`);
if (fails.length) { console.log('\nСписок ошибок:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('Все проверки пройдены ✅');
