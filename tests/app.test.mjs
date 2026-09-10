/* Тесты: данные, редактируемый слой и реальные клики по интерфейсу (jsdom).
   Запуск: npm test  (devDependency: jsdom) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

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

await test('справочник: 26 видов, id уникальны, у каждого картинка и рассказ', () => {
  assert.equal(D.CARDS, undefined, 'термины-карточки должны быть удалены');
  assert.equal(D.SPECIES.length, 26);
  assert.equal(new Set(D.SPECIES.map((s) => s.id)).size, 26);
  D.SPECIES.forEach((s) => {
    assert.ok(s.facts.length >= 3, `${s.name}: мало фактов`);
    assert.ok(s.img, `${s.id}: нет картинки — её не угадать`);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets/img', s.img)), `нет файла ${s.img}`);
  });
});

await test('в справочнике есть животные, растения и местности', () => {
  const groups = D.GROUPS.map((g) => g.id);
  for (const g of ['birds', 'mammals', 'farm', 'trees', 'flowers', 'places']) {
    assert.ok(groups.includes(g), 'в GROUPS нет группы ' + g);
    const n = D.SPECIES.filter((s) => s.group === g).length;
    assert.ok(n >= 2, `в группе ${g} всего ${n} записей`);
  }
});

/* ================================================================
   2. ИНТЕРФЕЙС
   ================================================================ */
console.log('\n[2] Интерфейс');

const html = read('index.html').replace(/<script src="[^"]+"><\/script>/g, '').replace(/<link[^>]*>/g, '');
const picsDB = new IDBFactory();          // настоящее IndexedDB-хранилище для своих картинок
const boot = (w) => {
  w.scrollTo = () => {};
  w.Element.prototype.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = () => {};
  w.indexedDB = picsDB;
  for (const f of ['data.js', 'sound.js', 'store.js', 'pics.js', 'content.js', 'app.js']) w.eval(read('assets/js/' + f));
  return w;
};
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const win = boot(dom.window);

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

await test('клик по «Моя Родина» сразу открывает викторину', async () => {
  const task = $$('.task-row').filter((b) => b.dataset.go === 'quiz/rodina')[0];
  assert.ok(task, 'в меню нет викторины «Моя Родина»');
  assert.equal($$('.task-row')[1], task, '«Моя Родина» должна стоять второй');
  click(task);
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

await test('знакомство: список из 26 карточек, фильтр и рассказ', async () => {
  win.App.go('home');
  await tick();
  const task = $$('.task-row').filter((b) => b.dataset.go === 'learn')[0];
  assert.equal($$('.task-row')[0], task, 'знакомство должно стоять первым');
  click(task);
  await tick();
  assert.equal($$('.pcard').length, win.DATA.SPECIES.length);
  assert.ok($('.lead').textContent.includes('Выбери'), 'нет инструкции');
  click($('[data-tab="flora"]'));
  const flora = win.DATA.SPECIES.filter((s) => ['trees', 'flowers'].includes(s.group)).length;
  assert.equal($$('.pcard').length, flora);
  click($('[data-tab="places"]'));
  const places = win.DATA.SPECIES.filter((s) => s.group === 'places').length;
  assert.equal($$('.pcard').length, places, 'вкладке «Местности» нечего показать');
  assert.ok($$('.tab').some((t) => t.textContent.trim() === 'Местности'), 'нет вкладки «Местности»');
  click($('[data-tab="all"]'));
  const horek = win.DATA.SPECIES.find((s) => s.name.includes('хорь'));
  const withImg = win.DATA.SPECIES.find((x) => x.img);
  click($(`.pcard[data-sp="${withImg.id}"]`));
  assert.ok($('.photo'), 'в рассказе не показалась картинка вида');
  assert.equal($('.photo').getAttribute('src'), 'assets/img/' + withImg.img);
  assert.ok($('.photo').getAttribute('alt').length > 3, 'у картинки нет подписи для чтения с экрана');
  click($('#toList'));
  assert.ok($('.grid-cards .pcard img'), 'в списке нет картинок видов');
  assert.ok($('.grid-cards .pcard img').getAttribute('src').startsWith('assets/img/'),
    'превью вида указывает не в assets/img');
  click($(`.pcard[data-sp="${horek.id}"]`));
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
  assert.equal($$('.pcard').length, win.DATA.SPECIES.length);
});

await test('закрепление: вместо слов — картинка, внизу четыре названия', async () => {
  win.App.go('home');
  await tick();
  const task = $$('.task-row')[2];
  assert.ok(task.textContent.includes('Закрепление'));
  assert.ok(task.dataset.go === 'cards');
  click(task);
  await tick();
  const s = win.App.state.cards;
  assert.ok(s, 'раунд не начался');
  assert.equal($('.title').textContent, 'Закрепление');
  assert.ok($('.step').textContent.includes('Задание 1 из 10'), $('.step').textContent);
  assert.equal(s.pool.length, 10, 'картинок в раунде: ' + s.pool.length);

  const img = $('.quiz-photo');
  assert.ok(img, 'нет большой картинки');
  assert.ok(img.getAttribute('src').startsWith('assets/img/'), 'картинка не из assets/img');
  assert.ok(fs.existsSync(path.join(ROOT, img.getAttribute('src'))), 'файл картинки не найден');
  assert.equal(img.getAttribute('alt'), '', 'подпись картинки подсказывает ответ');
  assert.ok($('h2.q').textContent.includes('Как называется'), $('h2.q').textContent);
  assert.ok($('.instr').textContent.includes('Выбери один ответ'), 'нет инструкции');

  const names = $$('.answer .txt').map((n) => n.textContent);
  assert.equal(names.length, 4, 'вариантов: ' + names.length);
  assert.equal(new Set(names).size, 4, 'варианты повторяются');
  assert.ok(mainButtons().length <= 6, `слишком много кнопок: ${mainButtons().length}`);
  assert.ok($('#checkBtn'), 'нет кнопки «Проверить»');
  assert.ok($('#hintBtn'), 'нет ссылки «Нужна подсказка»');
});

await test('закрепление: ошибка, подсказка и верный ответ работают как в викторине', () => {
  const s = win.App.state.cards;
  const q = s.pool[0];
  const wrong = [0, 1, 2, 3].find((i) => i !== q.answer);

  click($('#hintBtn'));
  assert.ok($('#feedback .msg.hint'), 'подсказка не появилась');

  click($(`.answer[data-i="${wrong}"]`));
  click($('#checkBtn'));
  assert.ok($('#feedback .msg.no'), 'нет сообщения об ошибке');
  assert.ok($('#feedback .msg.no').textContent.includes('Попробуй'), 'ошибка не объяснена словами');
  assert.ok($(`.answer[data-i="${wrong}"]`).classList.contains('no'));
  assert.equal(s.firstTry, false);

  click($(`.answer[data-i="${q.answer}"]`));
  click($('#checkBtn'));
  assert.ok($('#feedback .msg.ok'), 'нет сообщения «Правильно»');
  assert.equal(s.correctFirst, 0, 'со второй попытки не должно засчитываться');
  click($('#nextBtn'));
  assert.ok($('.quiz-photo'), 'на втором задании нет картинки');
  assert.ok($('.step').textContent.includes('Задание 2 из 10'));
});

await test('закрепление: в раунд попадают животные, растения и местности', () => {
  const seen = new Set();
  const asks = new Set();
  for (let i = 0; i < 40; i++) {
    win.App.startCards();
    win.App.state.cards.pool.forEach((q) => { seen.add(q.topic); asks.add(q.text); });
  }
  for (const g of ['birds', 'mammals', 'farm', 'trees', 'flowers', 'places']) {
    assert.ok(seen.has(g), 'в угадайке не встретилась группа ' + g);
  }
  assert.ok(asks.has('Как называется это животное?'), 'нет вопроса про животное');
  assert.ok(asks.has('Как называется это растение?'), 'нет вопроса про растение');
  assert.ok(asks.has('Как называется это место?'), 'нет вопроса про местность');

  const names = new Set(win.DATA.SPECIES.map((s) => s.name));
  win.App.state.cards.pool.forEach((q) => {
    assert.equal(new Set(q.options).size, 4, q.id + ': дубли названий');
    q.options.forEach((o) => assert.ok(names.has(o), 'неизвестное название: ' + o));
    assert.equal(q.options[q.answer], win.Content.spec(q.id.replace('pic-', '')).name,
      'правильный вариант не совпадает с названием на картинке');
    assert.ok(q.hint && q.explain, q.id + ': нет подсказки или объяснения');
    assert.ok(q.img.startsWith('assets/img/'), q.id + ': рисунок не из папки assets/img');
    assert.ok(fs.existsSync(path.join(ROOT, q.img)), 'нет файла ' + q.img);
  });
});

await test('закрепление доходит до результата и начинается заново', () => {
  win.App.startCards();
  win.App.render();
  assert.ok($('.quiz-photo'), 'раунд не перерисовался');
  const s = win.App.state.cards;
  for (let i = s.idx; i < s.pool.length; i++) {
    const q = win.App.state.cards.pool[i];
    click($(`.answer[data-i="${q.answer}"]`));
    click($('#checkBtn'));
    click($('#nextBtn'));
  }
  assert.equal(win.App.state.cards.done, true);
  assert.ok($('.result-score'), 'нет счёта');
  assert.equal($$('.btn').length, 2, 'на результате должно быть две кнопки');
  click($('#againBtn'));
  assert.equal(win.App.state.cards.idx, 0);
  assert.equal(win.App.state.cards.done, false);
  assert.ok($('.quiz-photo'), 'после повтора нет картинки');
});

await test('старые карточки-перевёртыши удалены', () => {
  win.App.go('cards');
  assert.equal($('#flip'), null, 'осталась переворачивающаяся карточка');
  assert.equal($('.side'), null);
  assert.equal($('#flipBtn'), null);
  assert.equal($('#prevBtn'), null);
  assert.equal(win.Content.cards, undefined, 'в Content остался раздел терминов');
  assert.ok(!read('assets/js/data.js').includes('CARDS'), 'в data.js остался CARDS');
});

/* ================================================================
   4. РЕДАКТОР (ДЛЯ УЧИТЕЛЯ)
   ================================================================ */
console.log('\n[4] Редактор заданий');

const openEditor = async (tab) => { win.App.go('editor'); await tick(); if (tab != null) click($$('#edTabs .tab')[tab]); };

await test('в редакторе две вкладки и все 33 вопроса', async () => {
  await openEditor(0);
  assert.equal($$('#edTabs .tab').length, 2, 'вкладка «Термины» должна уйти вместе с карточками');
  assert.ok($('#edTabs .tab').textContent.includes('Вопросы · 33'));
  assert.equal($$('.item').length, 33);
  click($$('#edTabs .tab')[1]);
  assert.ok($('#edTabs .tab.on').textContent.includes('Рисунки'));
  assert.equal($$('.item').length, 26);
  assert.ok($('[data-field="img"]'), 'нет поля для файла картинки');
});

await test('можно поменять слова в вопросе — правка сразу в викторине', async () => {
  await openEditor(0);
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
  assert.ok($$('.task-row')[1].textContent.includes('11 вопросов'), $$('.task-row')[1].textContent);
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
  click($(`.pcard[data-sp="${id}"]`));
  assert.equal($$('.facts li').length, 2, 'знакомство не показывает правку');
});

await test('правка названия меняет вариант ответа в угадайке', () => {
  const id = win.DATA.SPECIES[0].id;
  win.Content.set('s', id, { name: 'Лебедь-кликун (Куба)' });
  let q = null;
  for (let i = 0; i < 60 && !q; i++) {
    win.App.startCards();
    q = win.App.state.cards.pool.filter((x) => x.id === 'pic-' + id)[0] || null;
  }
  assert.ok(q, 'вид не попал в раунд');
  assert.equal(q.options[q.answer], 'Лебедь-кликун (Куба)', 'правка не дошла до угадайки');
  win.Content.revert('s', id);
});

await test('экспорт, импорт и отмена правок', async () => {
  const json = win.Content.exportJSON();
  const parsed = JSON.parse(json);
  assert.equal(Object.keys(parsed.q).join(','), 'r03,r04', 'лишние или пропавшие правки вопросов');
  win.Content.resetAll();
  assert.equal(win.Content.changedCount(), 0);
  const n = win.Content.importJSON(json);
  assert.equal(n, 3, 'импорт вернул не все правки (2 вопроса + вид)');
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
  dom2.window.localStorage.setItem('namtsy.content.v1', saved);
  boot(dom2.window);
  assert.equal(dom2.window.Content.question('r01').text, 'Текст после перезагрузки');
  assert.equal(dom2.window.document.querySelectorAll('.task-row').length, 4);
  win.Content.resetAll();
});

await test('старые правки с удалённым разделом терминов не ломают загрузку', () => {
  const old = JSON.stringify({ q: { r01: { text: 'Из старой версии' } }, s: {}, c: { c01: { def: 'Куба' } } });
  const dom3 = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  dom3.window.localStorage.setItem('namtsy.content.v1', old);
  boot(dom3.window);
  assert.equal(dom3.window.Content.question('r01').text, 'Из старой версии');
  assert.equal(dom3.window.Content.changedCount(), 1, 'раздел терминов посчитался как правка');
  assert.equal(dom3.window.document.querySelectorAll('.task-row').length, 4);
});

/* ================================================================
   5. СВОИ КАРТИНКИ
   ================================================================ */
console.log('\n[5] Свои картинки');

await win.Pics.init();

await test('своя картинка сохраняется в IndexedDB и подменяет рисунок из папки', async () => {
  const id = win.DATA.SPECIES.find((s) => s.name.includes('хорь')).id;
  const blob = new win.Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });
  const url = await win.Pics.setBlob('sp:' + id, blob);

  assert.equal(win.Pics.backend(), 'idb', 'IndexedDB не подключился');
  assert.ok(url, 'адрес картинки не создан');
  assert.equal(win.Pics.count(), 1);
  assert.equal(win.App.picSrc(win.Content.spec(id)), url, 'приложение не взяло свою картинку');
  assert.ok(win.App.picSrc(win.Content.spec('s01')).startsWith('assets/img/'),
    'чужая картинка не должна меняться');
});

await test('своя картинка переживает перезагрузку страницы', async () => {
  const id = win.DATA.SPECIES.find((s) => s.name.includes('хорь')).id;
  const dom4 = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  boot(dom4.window);
  await dom4.window.Pics.init();
  assert.equal(dom4.window.Pics.count(), 1, 'картинка не сохранилась после перезагрузки');
  assert.ok(dom4.window.Pics.url('sp:' + id).length > 10, 'нет адреса сохранённой картинки');
  assert.ok(dom4.window.App.hasPic(dom4.window.Content.spec(id)));
});

await test('своя картинка показывается в знакомстве и в угадайке', async () => {
  const id = win.DATA.SPECIES.find((s) => s.name.includes('хорь')).id;
  const url = win.Pics.url('sp:' + id);

  win.App.go('learn');
  await tick();
  const card = $(`.pcard[data-sp="${id}"] img`);
  assert.equal(card.getAttribute('src'), url, 'в знакомстве осталась старая картинка');

  click(card.closest('.pcard'));
  assert.equal($('.photo').getAttribute('src'), url, 'в рассказе осталась старая картинка');

  // угадайка тоже берёт свою картинку
  let q = null;
  for (let i = 0; i < 60 && !q; i++) {
    win.App.startCards();
    q = win.App.state.cards.pool.filter((x) => x.id === 'pic-' + id)[0] || null;
  }
  assert.ok(q, 'объект не попал в угадайку');
  assert.equal(q.img, url, 'в угадайке не своя картинка');
  win.App.state.cards.idx = win.App.state.cards.pool.indexOf(q);
  win.App.go('cards');
  await tick();
  assert.equal($('.quiz-photo').getAttribute('src'), url, 'на экране не своя картинка');
});

await test('объект без рисунка попадает в угадайку, если загрузить свою картинку', async () => {
  const bare = win.DATA.SPECIES.find((s) => s.name.includes('Ондатра'));
  win.Content.set('s', bare.id, { img: '' });          // представим, что рисунка пока нет
  await win.Pics.remove('sp:' + bare.id);
  assert.equal(win.App.hasPic(win.Content.spec(bare.id)), false, 'объект должен остаться без картинки');
  let missing = true;
  for (let i = 0; i < 40 && missing; i++) {
    win.App.startCards();
    missing = !win.App.state.cards.pool.some((x) => x.id === 'pic-' + bare.id);
  }
  assert.ok(missing, 'объект без картинки не должен попадать в угадайку');

  const blob = new win.Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });
  await win.Pics.setBlob('sp:' + bare.id, blob);
  assert.equal(win.App.hasPic(win.Content.spec(bare.id)), true, 'своя картинка не вернула объект в задания');

  let found = false;
  for (let i = 0; i < 80 && !found; i++) {
    win.App.startCards();
    found = win.App.state.cards.pool.some((x) => x.id === 'pic-' + bare.id);
  }
  assert.ok(found, 'объект со своей картинкой не попал в раунд');
  win.Content.revert('s', bare.id);
  await win.Pics.remove('sp:' + bare.id);
});

await test('файл от учителя сохраняется даже там, где его не удалось сжать', async () => {
  const id = win.DATA.SPECIES.find((s) => s.name.toLowerCase().includes('лось')).id;
  const file = new win.File([new Uint8Array([255, 216, 255, 217])], 'los.jpg', { type: 'image/jpeg' });
  await win.Pics.set('sp:' + id, file);
  assert.ok(win.Pics.url('sp:' + id), 'загруженный файл не сохранился');

  let bad = null;
  try { await win.Pics.set('sp:' + id, new win.File(['текст'], 'a.txt', { type: 'text/plain' })); }
  catch (e) { bad = e.message; }
  assert.ok(bad && bad.includes('не картинка'), 'обычный файл не должен приниматься: ' + bad);
  await win.Pics.remove('sp:' + id);
});

await test('в редакторе есть загрузка, скачивание и отмена своей картинки', async () => {
  const id = win.DATA.SPECIES.find((s) => s.name.includes('хорь')).id;
  await win.App.go('editor');
  await tick();
  click($$('#edTabs .tab')[1]);
  const box = $(`[data-item="${id}"]`);
  assert.ok(box, 'блок вида не найден');
  assert.ok(box.querySelector('[data-picpick]'), 'нет кнопки «Загрузить свою картинку»');
  assert.ok(box.querySelector('[data-picfile]'), 'нет поля выбора файла');
  assert.ok(box.querySelector('[data-picdel]'), 'нет кнопки «Убрать свою картинку»');
  assert.ok(box.querySelector('[data-picdown]'), 'нет кнопки «Скачать картинку»');
  assert.equal(box.querySelector('.ed-pic').getAttribute('src'), win.Pics.url('sp:' + id),
    'в редакторе показана не та картинка');
  assert.ok(box.querySelector('.pic-note').textContent.includes('ваша картинка'),
    box.querySelector('.pic-note').textContent);

  click(box.querySelector('[data-picdel]'));
  await tick(); await tick();
  assert.equal(win.Pics.has('sp:' + id), false, 'своя картинка не удалилась');
  assert.equal($(`[data-item="${id}"] [data-picdel]`), null, 'кнопка удаления осталась');
  assert.ok($(`[data-item="${id}"] .ed-pic`).getAttribute('src').startsWith('assets/img/'),
    'рисунок из папки не вернулся');
  assert.ok($(`[data-item="${id}"] .pic-note`).textContent.includes('assets/img'));
});

await test('если файл рисунка пропал, вместо него показывается эмодзи', async () => {
  win.App.go('learn');
  await tick();
  const img = $('.grid-cards .pcard img');
  const emoji = img.getAttribute('data-emoji');
  assert.ok(emoji, 'у картинки нет запасного эмодзи');
  img.dispatchEvent(new win.Event('error'));
  const cell = $('.grid-cards .pcard');
  assert.equal(cell.querySelector('img'), null, 'битая картинка осталась на экране');
  assert.equal(cell.querySelector('.noimg').textContent, emoji);
});

await test('«Вернуть исходные тексты» не удаляет свои картинки', async () => {
  const id = win.DATA.SPECIES[2].id;
  await win.Pics.setBlob('sp:' + id, new win.Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
  win.Content.set('q', 'r01', { text: 'Черновик' });
  win.Content.resetAll();
  assert.equal(win.Content.changedCount(), 0);
  assert.equal(win.Pics.has('sp:' + id), true, 'вместе с текстами удалилась и картинка');
  await win.Pics.remove('sp:' + id);
});

/* ================================================================
   6. МЕЛОЧИ
   ================================================================ */
console.log('\n[6] Мелочи');

const ICO_ON_HTML = $('#soundBtn').innerHTML;

await test('звук включается и выключается кнопкой-иконкой', async () => {
  win.App.go('home');
  await tick();
  assert.equal($('#soundBtn').getAttribute('aria-pressed'), 'true');
  assert.equal($('#soundBtn').getAttribute('aria-label'), 'Звук включён');
  assert.ok($('#soundBtn').querySelector('svg'), 'нет иконки динамика');
  click($('#soundBtn'));
  assert.equal(win.Sound.isEnabled(), false);
  assert.equal($('#soundBtn').getAttribute('aria-pressed'), 'false');
  assert.equal($('#soundBtn').getAttribute('aria-label'), 'Звук выключен');
  assert.notEqual($('#soundBtn').innerHTML, ICO_ON_HTML, 'иконка не сменилась');
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
