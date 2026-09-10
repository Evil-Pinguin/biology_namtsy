/* Тесты: данные, редактируемый слой и реальные клики по интерфейсу (jsdom).
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

await test('два набора заданий: «Моя Родина» и «Природа улуса»', () => {
  assert.equal(D.SETS.length, 2);
  assert.equal(D.QUESTIONS.length, 33);
  for (const set of D.SETS) {
    const qs = D.QUESTIONS.filter((q) => q.set === set.id);
    assert.ok(qs.length >= 10, `в наборе «${set.title}» мало вопросов: ${qs.length}`);
  }
  assert.equal(D.QUESTIONS.filter((q) => !D.SETS.some((s) => s.id === q.set)).length, 0,
    'есть вопросы без набора');
});

await test('каждый вопрос: 4 разных варианта, верный индекс, подсказка и объяснение', () => {
  D.QUESTIONS.forEach((q) => {
    assert.equal(q.options.length, 4, `${q.id}: нужно 4 варианта`);
    assert.equal(new Set(q.options).size, 4, `${q.id}: дубли вариантов`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${q.id}: answer=${q.answer}`);
    assert.ok(q.text.length > 15 && q.hint.length > 10 && q.explain.length > 30, `${q.id}: неполный состав`);
    assert.ok(D.topicById(q.topic), `${q.id}: неизвестная тема ${q.topic}`);
  });
});

await test('правильный ответ не стоит всегда на одном месте', () => {
  const all = [0, 0, 0, 0];
  D.QUESTIONS.forEach((q) => { all[q.answer] += 1; });
  assert.ok(Math.max(...all) <= 11 && Math.min(...all) >= 5, `общий перекос: ${all.join('/')}`);
  for (const set of D.SETS) {
    const c = [0, 0, 0, 0];
    D.QUESTIONS.filter((q) => q.set === set.id).forEach((q) => { c[q.answer] += 1; });
    assert.ok(c.every((n) => n >= 2), `в наборе ${set.id} есть незадействованные позиции: ${c.join('/')}`);
  }
});

await test('урок 1: 10 вопросов по темам плана урока', () => {
  const rodina = D.QUESTIONS.filter((q) => q.set === 'rodina');
  assert.equal(rodina.length, 10);
  const topics = Array.from(new Set(rodina.map((q) => D.topicById(q.topic).title)));
  assert.equal(topics.length, 5, 'тем урока: ' + topics.join(', '));
  for (const t of ['Малая и большая родина', 'Село Намцы', 'Расстояния', 'Река Лена', 'Ведение календаря погоды']) {
    assert.ok(topics.includes(t), 'нет темы «' + t + '»');
  }
});

await test('тексты и подсказки урока 1 совпадают с заданием учителя', () => {
  const r = (id) => D.QUESTIONS.find((q) => q.id === id);
  assert.equal(r('r01').text, 'Что обычно называют «малой родиной»?');
  assert.equal(r('r01').options[1], 'Место, где ты родился, где живут твои близкие и которое тебе дорого с детства');
  assert.equal(r('r01').answer, 1);
  assert.equal(r('r02').text, 'Как связаны между собой понятия «малая родина» и «большая родина» (наша страна — Россия)?');
  assert.equal(r('r03').options[0], 'Село Намцы');
  assert.equal(r('r05').options[1], 'Около 80–90 километров');
  assert.ok(r('r05').explain.includes('84'), 'в объяснении нет точных 84 км');
  assert.equal(r('r07').options[3], 'Река Лена');
  assert.equal(r('r09').text, 'Для чего школьникам на уроках окружающего мира или краеведения полезно вести календарь погоды?');
  assert.equal(r('r10').options[0], 'Температура воздуха, облачность, осадки и сила и направление ветра');
  D.QUESTIONS.filter((q) => q.set === 'rodina').forEach((q) => {
    assert.ok(q.hint.length > 15, `${q.id}: нет подсказки`);
    assert.ok(q.explain.length > 20, `${q.id}: нет объяснения`);
  });
});

await test('у готовых видов есть файлы картинок, у остальных — эмодзи', () => {
  const withImg = D.SPECIES.filter((x) => x.img);
  assert.ok(withImg.length >= 7, 'картинок меньше семи: ' + withImg.length);
  withImg.forEach((x) => assert.ok(fs.existsSync(path.join(ROOT, 'assets/img', x.img)), `нет файла ${x.img}`));
  D.SPECIES.forEach((x) => assert.ok(x.emoji, `${x.id}: нет эмодзи-запасного варианта`));
});

await test('карточки и виды на месте, id уникальны', () => {
  assert.equal(D.CARDS.length, 20);
  assert.equal(new Set(D.CARDS.map((c) => c.id)).size, 20);
  assert.equal(D.SPECIES.length, 22);
  assert.equal(new Set(D.SPECIES.map((s) => s.id)).size, 22);
  D.SPECIES.forEach((s) => assert.ok(s.facts.length >= 3, `${s.name}: мало фактов`));
});

/* ================================================================
   2. ИНТЕРФЕЙС
   ================================================================ */
console.log('\n[2] Интерфейс');

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
const mainButtons = () => $$('.main button');
const lastToast = () => { const t = $$('.toast'); return t.length ? t[t.length - 1].textContent : ''; };
const played = [];
const realPlay = win.Sound.play.bind(win.Sound);
win.Sound.play = (n) => { played.push(n); realPlay(n); };

await test('стартовый экран: список заданий и ничего лишнего', () => {
  assert.equal($$('.task-row').length, 4, 'ожидалось 4 задания');
  assert.ok($('h1.title').textContent.includes('Интерактивные задания'));
  assert.ok($('.lead').textContent.includes('Выбери задание'), 'нет короткой инструкции');
  // аудит шума: нет панелей, сайдбара, градиентных «AI»-блоков
  assert.equal($('#sidebar'), null);
  assert.equal($('.gem'), null, 'остался AI-пузырь');
  assert.equal($$('.mode-card').length, 0);
  assert.equal($$('.panel').length, 0, 'на старте не должно быть панелей');
  assert.ok(mainButtons().length <= 6, `слишком много кнопок на старте: ${mainButtons().length}`);
  assert.ok($$('.task-row').every((b) => b.dataset.go), 'у заданий нет действия');
});

await test('клик по «Моя Родина» сразу открывает первое задание', async () => {
  click($$('.task-row')[0]);
  assert.equal(win.location.hash, '#/quiz/rodina');
  await tick();
  const s = win.App.state.quiz;
  assert.equal(s.set, 'rodina');
  assert.equal(s.pool.length, 10);
  assert.ok(s.pool.every((q) => q.set === 'rodina'), 'в набор попали чужие вопросы');
  assert.ok($('h1.title').textContent.includes('Родина'));
  assert.ok($('.step').textContent.includes('Задание 1 из 10'), 'нет номера задания');
  assert.ok($('.bar > span'), 'нет полосы прогресса');
  assert.ok($('.instr').textContent.includes('Выбери один ответ'), 'нет инструкции');
  assert.equal($$('.answer').length, 4);
  assert.ok(mainButtons().length <= 7, `слишком много кнопок: ${mainButtons().length}`);
});

await test('кнопка «Проверить» не активна, пока не выбран ответ', () => {
  assert.equal($('#checkBtn').disabled, true, '«Проверить» должна быть недоступна');
  click($('.answer'));
  assert.ok($('.answer').classList.contains('sel'), 'не видно выбранного ответа');
  assert.equal($('#checkBtn').disabled, false);
});

await test('ошибка: вариант помечен, можно попробовать другой', () => {
  const s = win.App.state.quiz;
  const q = s.pool[0];
  const wrong = q.options.findIndex((_, i) => i !== q.answer);
  click($(`.answer[data-i="${wrong}"]`));
  played.length = 0;
  click($('#checkBtn'));
  assert.ok($('.msg.no'), 'нет сообщения об ошибке');
  assert.ok($('.msg.no').textContent.includes('Попробуй выбрать другой вариант'));
  assert.ok($(`.answer[data-i="${wrong}"]`).classList.contains('no'));
  assert.equal($(`.answer[data-i="${wrong}"]`).disabled, true, 'неверный вариант должен закрыться');
  assert.ok(played.includes('wrong'));
  assert.equal(s.correctFirst, 0, 'ответ со второй попытки не должен засчитываться');
  assert.equal($('#checkBtn').disabled, true, 'кнопка должна ждать нового выбора');
});

await test('правильный ответ со второй попытки: объяснение и «Следующее задание»', () => {
  const s = win.App.state.quiz;
  const q = s.pool[0];
  click($(`.answer[data-i="${q.answer}"]`));
  played.length = 0;
  click($('#checkBtn'));
  assert.ok($('.msg.ok'), 'нет сообщения «Правильно»');
  assert.ok($('.msg.ok').textContent.includes('Правильно'));
  assert.ok($('.msg.ok').textContent.includes(q.explain.slice(0, 25)), 'нет объяснения');
  assert.ok($(`.answer[data-i="${q.answer}"]`).classList.contains('ok'));
  assert.ok(played.includes('correct'));
  assert.equal(s.correctFirst, 0, 'со второй попытки не засчитывается как верный с первой');
  assert.equal(s.log.length, 1);
  assert.equal(s.log[0].ok, false);
  assert.ok($('#nextBtn').textContent.includes('Следующее задание'));
  click($('#nextBtn'));
  assert.equal(win.App.state.quiz.idx, 1);
  assert.ok($('.step').textContent.includes('Задание 2 из 10'));
});

await test('подсказка открывается по ссылке и не мешает ответу', () => {
  assert.equal($('.msg.hint'), null);
  click($('#hintBtn'));
  assert.ok($('.msg.hint'), 'подсказка не появилась');
  assert.ok($('.msg.hint').textContent.includes('Подсказка'));
  const q = win.App.state.quiz.pool[1];
  click($(`.answer[data-i="${q.answer}"]`));
  click($('#checkBtn'));
  assert.ok($('.msg.ok'));
  assert.equal(win.App.state.quiz.correctFirst, 1, 'верный ответ с первой попытки не засчитан');
});

await test('клавиатура: цифры выбирают ответ, Enter проверяет и идёт дальше', () => {
  click($('#nextBtn'));
  const s = win.App.state.quiz;
  key(String(s.pool[2].answer + 1));
  assert.ok($(`.answer[data-i="${s.pool[2].answer}"]`).classList.contains('sel'), 'цифра не выбрала ответ');
  key('Enter');
  assert.ok($('.msg.ok'), 'Enter не проверил ответ');
  assert.equal(s.correctFirst, 2);
  key('Enter');
  assert.ok($('.step').textContent.includes('Задание 4 из 10'));
});

await test('викторина доходит до результата: счёт, процент, две кнопки, разбор ошибок', () => {
  const s = win.App.state.quiz;
  for (let i = s.idx; i < s.pool.length; i++) {
    const q = win.App.state.quiz.pool[i];
    click($(`.answer[data-i="${q.answer}"]`));
    click($('#checkBtn'));
    click($('#nextBtn'));
  }
  assert.equal(win.App.state.quiz.done, true);
  assert.ok($('.result-score').textContent.includes('9'), 'ожидалось 9 верных: ' + $('.result-score').textContent);
  assert.ok($('.result-score').textContent.includes('10'));
  assert.equal($('.result-pct').textContent, '90%');
  assert.equal($('.bar > span').style.width, '90%');
  assert.equal($$('.btn').length, 2, 'на результате должно быть две кнопки');
  assert.ok($$('.btn')[0].textContent.includes('Пройти ещё раз'));
  assert.ok($$('.btn')[1].textContent.includes('К списку заданий'));
  assert.equal($$('.mistakes li').length, 1, 'в разборе должна быть одна ошибка');
  const st = JSON.parse(win.localStorage.getItem('namtsy.progress.v1'));
  assert.equal(st.rounds, 1);
  assert.equal(st.bestScore, 90);
});

await test('«Пройти ещё раз» начинает тот же набор заново', () => {
  click($('#againBtn'));
  const s = win.App.state.quiz;
  assert.equal(s.set, 'rodina');
  assert.equal(s.idx, 0);
  assert.equal(s.done, false);
  assert.equal(s.correctFirst, 0);
});

await test('второй набор «Природа улуса» берёт свои 10 вопросов', async () => {
  win.App.go('quiz', 'nature');
  await tick();
  const s = win.App.state.quiz;
  assert.equal(s.set, 'nature');
  assert.equal(s.pool.length, 10);
  assert.ok(s.pool.every((q) => q.set === 'nature'));
  assert.ok($('.step').textContent.includes('из 10'));
});

/* ================================================================
   3. ЗНАКОМСТВО И ЗАКРЕПЛЕНИЕ
   ================================================================ */
console.log('\n[3] Знакомство и закрепление');

await test('знакомство: список из 22 карточек, фильтр и рассказ', async () => {
  win.App.go('home');
  await tick();
  click($$('.task-row')[1]);
  await tick();
  assert.equal($$('.row').length, win.DATA.SPECIES.length);
  assert.ok($('.lead').textContent.includes('Выбери'), 'нет инструкции');
  click($('[data-tab="flora"]'));
  const flora = win.DATA.SPECIES.filter((s) => ['trees', 'flowers'].includes(s.group)).length;
  assert.equal($$('.row').length, flora);
  click($('[data-tab="all"]'));
  const horek = win.DATA.SPECIES.find((s) => s.name.includes('хорь'));
  const withImg = win.DATA.SPECIES.find((x) => x.img);
  click($(`.row[data-sp="${withImg.id}"]`));
  assert.ok($('.photo'), 'в рассказе не показалась картинка вида');
  assert.equal($('.photo').getAttribute('src'), 'assets/img/' + withImg.img);
  assert.ok($('.photo').getAttribute('alt').length > 3, 'у картинки нет подписи для чтения с экрана');
  click($('#toList'));
  assert.ok($('.thumb'), 'в списке нет маленьких картинок');
  click($(`.row[data-sp="${horek.id}"]`));
  assert.ok($('.facts'), 'не открылся рассказ');
  assert.ok($('h1.title').textContent.includes('хор'));
  assert.ok($$('.facts li').length >= 3);
  assert.ok($('#speakBtn'), 'нет кнопки «Прочитать вслух»');
  click($('#speakBtn'));
  assert.ok(mainButtons().length <= 6, `слишком много кнопок: ${mainButtons().length}`);
});

await test('кнопки «← / →» листают рассказы, «← К списку» возвращает', () => {
  const was = win.App.state.learn.id;
  const fwd = $$('.actions .btn').filter((b) => b.textContent.trim().endsWith('→'));
  assert.ok(fwd.length, 'нет кнопки перехода к следующему рассказу');
  click(fwd[0]);
  assert.notEqual(win.App.state.learn.id, was, 'переход не сработал');
  click($('#toList'));
  assert.equal($$('.row').length, win.DATA.SPECIES.length);
});

await test('закрепление: карточка переворачивается и листается', async () => {
  win.App.go('home');
  await tick();
  click($$('.task-row')[2]);
  await tick();
  assert.ok($('#flip'), 'нет карточки');
  assert.ok($('.step').textContent.includes('Карточка 1 из 20'));
  assert.equal($('.flip').classList.contains('over'), false);
  assert.ok($('#flipBtn').textContent.includes('Показать ответ'));
  click($('#flipBtn'));
  assert.ok($('.flip').classList.contains('over'), 'карточка не перевернулась');
  assert.ok($('#flipBtn').textContent.includes('Скрыть ответ'));
  const word = $('.side.a .word').textContent;
  click($('#nextBtn'));
  assert.equal($('.flip').classList.contains('over'), false, 'переворот не сбросился');
  click($('#prevBtn'));
  assert.equal($('.side.a .word').textContent, word);
  key(' ');
  assert.ok($('.flip').classList.contains('over'), 'пробел не переворачивает карточку');
  assert.ok(mainButtons().length <= 4, `слишком много кнопок: ${mainButtons().length}`);
});

/* ================================================================
   4. РЕДАКТОР (ДЛЯ УЧИТЕЛЯ)
   ================================================================ */
console.log('\n[4] Редактор заданий');

const openEditor = async (tab) => { win.App.go('editor'); await tick(); if (tab != null) click($$('#edTabs .tab')[tab]); };

await test('в редакторе три вкладки и все 33 вопроса', async () => {
  await openEditor(0);
  assert.equal($$('#edTabs .tab').length, 3);
  assert.ok($('#edTabs .tab').textContent.includes('Вопросы · 33'));
  assert.equal($$('.item').length, 33);
});

await test('можно поменять слова в вопросе — правка сразу в викторине', () => {
  const id = 'r03';
  const newText = 'Как называется село, в котором живёт администрация Намского улуса?';
  $(`[data-item="${id}"] [data-field="text"]`).value = newText;
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.question(id).text, newText);
  assert.ok(win.Content.changed('q', id));
  assert.ok($(`[data-item="${id}"] .sum-tag`), 'нет пометки «изменено»');
  assert.ok(win.DATA.QUESTIONS.find((q) => q.id === id).text !== newText, 'исходник изменён напрямую');
});

await test('вопрос можно перенести в другой набор заданий', async () => {
  const id = 'q23';
  const sel = $(`[data-item="${id}"] [data-field="set"]`);
  assert.ok(sel, 'нет выбора набора заданий');
  sel.value = 'rodina';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.question(id).set, 'rodina');
  assert.equal(win.Content.questions().filter((q) => q.set === 'rodina').length, 11);
  // на стартовом экране счётчик обновился
  win.App.go('home');
  await tick();
  assert.ok($$('.task-row')[0].textContent.includes('11 вопросов'), $$('.task-row')[0].textContent);
  // вернуть обратно
  await openEditor(0);
  $(`[data-item="${id}"] [data-field="set"]`).value = 'nature';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.questions().filter((q) => q.set === 'rodina').length, 10);
});

await test('смена правильного варианта ответа сохраняется', async () => {
  await openEditor(0);
  const id = 'r04';
  const wrap = $(`[data-item="${id}"] [data-answer]`);
  const target = (win.DATA.QUESTIONS.find((q) => q.id === id).answer + 1) % 4;
  click($(`[data-item="${id}"] [data-pick="${target}"]`));
  assert.equal(wrap.dataset.answer, String(target));
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.question(id).answer, target);
});

await test('пустой текст и одинаковые варианты не сохраняются', async () => {
  await openEditor(0);
  const id = 'r05';
  $(`[data-item="${id}"] [data-field="text"]`).value = '   ';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.changed('q', id), false);
  assert.ok(lastToast().includes('не может быть пустым'), lastToast());

  $(`[data-item="${id}"] [data-field="text"]`).value = win.DATA.QUESTIONS.find((q) => q.id === id).text;
  const inputs = $$(`[data-item="${id}"] [data-opt]`);
  inputs[0].value = 'одно и то же';
  inputs[1].value = 'одно и то же';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.changed('q', id), false);
  assert.ok(lastToast().includes('не должны повторяться'), lastToast());
});

await test('правка рассказа: строки становятся пунктами', async () => {
  await openEditor(1);
  const id = win.DATA.SPECIES.find((s) => s.name.includes('хорь')).id;
  $(`[data-item="${id}"] [data-field="name"]`).value = 'Степной хорёк';
  $(`[data-item="${id}"] [data-field="factsText"]`).value = 'Первый факт.\n\nВторой факт.\n';
  click($(`[data-item="${id}"] [data-save]`));
  const sp = win.Content.spec(id);
  assert.equal(sp.name, 'Степной хорёк');
  assert.equal(sp.facts.join(' | '), 'Первый факт. | Второй факт.');
  win.App.go('learn');
  await tick();
  click($(`.row[data-sp="${id}"]`));
  assert.equal($$('.facts li').length, 2, 'знакомство не показывает правку');
});

await test('правка термина меняет текст в закреплении', async () => {
  await openEditor(2);
  const id = win.DATA.CARDS[0].id;
  $(`[data-item="${id}"] [data-field="def"]`).value = 'Обновлённое определение.';
  click($(`[data-item="${id}"] [data-save]`));
  assert.equal(win.Content.card(id).def, 'Обновлённое определение.');
  win.App.go('cards');
  await tick();
  assert.ok(win.App.state.cards.deck.some((c) => c.id === id && c.def === 'Обновлённое определение.'),
    'карточка не обновилась');
});

await test('экспорт, импорт и отмена правок', async () => {
  const json = win.Content.exportJSON();
  const parsed = JSON.parse(json);
  assert.equal(Object.keys(parsed.q).length, 2, 'ожидались 2 правки вопросов (текст и верный вариант)');
  win.Content.resetAll();
  assert.equal(win.Content.changedCount(), 0);
  const n = win.Content.importJSON(json);
  assert.equal(n, 4, 'импорт вернул не все правки (2 вопроса + вид + термин)');
  assert.equal(win.Content.question('r03').text, 'Как называется село, в котором живёт администрация Намского улуса?');

  await openEditor(0);
  click($('[data-item="r03"] [data-revert]'));
  assert.equal(win.Content.changed('q', 'r03'), false);
  assert.equal(win.Content.question('r03').text, win.DATA.QUESTIONS.find((q) => q.id === 'r03').text);
});

await test('«Вернуть исходные тексты» очищает правки', async () => {
  await openEditor(0);
  assert.ok(win.Content.changedCount() > 0);
  click($('#resetBtn'));
  assert.equal(win.Content.changedCount(), 0);
  assert.equal($('#resetBtn').disabled, true);
});

await test('правки переживают перезагрузку страницы', () => {
  win.Content.set('q', 'r01', { text: 'Текст после перезагрузки' });
  const saved = win.localStorage.getItem('namtsy.content.v1');
  const dom2 = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  dom2.window.scrollTo = () => {};
  dom2.window.localStorage.setItem('namtsy.content.v1', saved);
  for (const f of ['data.js', 'sound.js', 'store.js', 'content.js', 'app.js']) dom2.window.eval(read('assets/js/' + f));
  assert.equal(dom2.window.Content.question('r01').text, 'Текст после перезагрузки');
  assert.equal(dom2.window.document.querySelectorAll('.task-row').length, 4);
  win.Content.resetAll();
});

/* ================================================================
   5. МЕЛОЧИ
   ================================================================ */
console.log('\n[5] Мелочи');

await test('звук включается и выключается понятной кнопкой', async () => {
  win.App.go('home');
  await tick();
  assert.equal($('#soundBtn').textContent, '🔊 Звук вкл');
  click($('#soundBtn'));
  assert.equal(win.Sound.isEnabled(), false);
  assert.equal($('#soundBtn').textContent, '🔇 Звук выкл');
  assert.equal($('#soundBtn').getAttribute('aria-pressed'), 'false');
  click($('#soundBtn'));
  assert.equal(win.Sound.isEnabled(), true);
  assert.equal(win.localStorage.getItem('namtsy.sound'), '1');
});

await test('«← Назад» и Esc возвращают к списку заданий', async () => {
  win.App.go('cards');
  await tick();
  assert.equal($('#backBtn').hidden, false);
  click($('#backBtn'));
  await tick();
  assert.equal(win.location.hash, '#/home');
  assert.equal($$('.task-row').length, 4);
  assert.equal($('#backBtn').hidden, true);

  win.App.go('quiz', 'rodina');
  await tick();
  key('Escape');
  await tick();
  assert.equal(win.location.hash, '#/home');
});

await test('неизвестный адрес приводит к списку заданий', () => {
  win.location.hash = '#/ерунда';
  win.App.render();
  assert.equal($$('.task-row').length, 4);
});

console.log(`\nПройдено: ${passed}, ошибок: ${fails.length}`);
if (fails.length) { console.log('\nСписок ошибок:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('Все проверки пройдены ✅');
