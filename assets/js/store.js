/* =============================================================
   Хранилище прогресса (localStorage) + озвучивание текста
   ============================================================= */
(function (global) {
  'use strict';

  const KEY = 'namtsy.progress.v1';
  const VOICE_KEY = 'namtsy.voice';

  const EMPTY = {
    rounds: 0,          // сыграно раундов
    answered: 0,        // всего ответов
    correct: 0,         // правильных ответов
    bestScore: 0,       // лучший результат за раунд (%)
    bestSprint: 0,      // лучший результат в спринте (правильных)
    streak: 0,          // текущая серия
    bestStreak: 0,      // рекордная серия
    byTopic: {},        // { topicId: {answered, correct} }
    byQuestion: {},     // { questionId: {answered, correct} }
    lastPlayed: null
  };

  function read() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
      if (!raw) return JSON.parse(JSON.stringify(EMPTY));
      const parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(EMPTY)), parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(EMPTY));
    }
  }

  function write(data) {
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* приватный режим */ }
  }

  const Store = {
    data: read(),

    save() { write(this.data); },

    accuracy() {
      return this.data.answered ? Math.round((this.data.correct / this.data.answered) * 100) : 0;
    },

    recordAnswer(question, topicId, isCorrect) {
      const d = this.data;
      d.answered += 1;
      if (isCorrect) {
        d.correct += 1;
        d.streak += 1;
        if (d.streak > d.bestStreak) d.bestStreak = d.streak;
      } else {
        d.streak = 0;
      }
      if (topicId) {
        d.byTopic[topicId] = d.byTopic[topicId] || { answered: 0, correct: 0 };
        d.byTopic[topicId].answered += 1;
        if (isCorrect) d.byTopic[topicId].correct += 1;
      }
      if (question && question.id) {
        d.byQuestion[question.id] = d.byQuestion[question.id] || { answered: 0, correct: 0 };
        d.byQuestion[question.id].answered += 1;
        if (isCorrect) d.byQuestion[question.id].correct += 1;
      }
      d.lastPlayed = new Date().toISOString();
      this.save();
    },

    recordRound(percent, isSprint, correctCount) {
      const d = this.data;
      d.rounds += 1;
      if (isSprint) {
        if (correctCount > d.bestSprint) d.bestSprint = correctCount;
      } else if (percent > d.bestScore) {
        d.bestScore = percent;
      }
      this.save();
    },

    topicStat(id) {
      const s = this.data.byTopic[id] || { answered: 0, correct: 0 };
      return {
        answered: s.answered,
        correct: s.correct,
        percent: s.answered ? Math.round((s.correct / s.answered) * 100) : 0
      };
    },

    reset() {
      this.data = JSON.parse(JSON.stringify(EMPTY));
      this.save();
    }
  };

  /* ---------------- Озвучивание (Web Speech API) ---------------- */
  const VOICE_KEY_DEFAULT = '0';
  let voiceOn = VOICE_KEY_DEFAULT;
  try {
    const v = global.localStorage ? global.localStorage.getItem(VOICE_KEY) : null;
    voiceOn = v === null ? VOICE_KEY_DEFAULT : v;
  } catch (e) {}

  const Speaker = {
    isOn() { return voiceOn === '1'; },
    setOn(v) {
      voiceOn = v ? '1' : '0';
      try { if (global.localStorage) global.localStorage.setItem(VOICE_KEY, voiceOn); } catch (e) {}
      if (!v) this.stop();
      return this.isOn();
    },
    supported() {
      return typeof global !== 'undefined' && !!global.speechSynthesis;
    },
    /* прочитать по нажатию кнопки — работает независимо от автоозвучивания */
    say(text) {
      if (!this.supported() || !text) return false;
      return this._utter(text);
    },
    speak(text) {
      if (!this.isOn() || !this.supported() || !text) return;
      this._utter(text);
    },
    _utter(text) {
      try {
        global.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ru-RU';
        u.rate = 0.98;
        const voices = global.speechSynthesis.getVoices() || [];
        const ru = voices.find((v) => (v.lang || '').toLowerCase().indexOf('ru') === 0);
        if (ru) u.voice = ru;
        global.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    },
    stop() {
      if (!this.supported()) return;
      try { global.speechSynthesis.cancel(); } catch (e) {}
    }
  };

  global.Store = Store;
  global.Speaker = Speaker;
})(typeof window !== 'undefined' ? window : globalThis);
