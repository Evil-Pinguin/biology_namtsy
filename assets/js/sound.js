/* =============================================================
   Звуковое сопровождение — синтез через Web Audio API
   Никаких внешних файлов: все звуки генерируются в браузере.
   ============================================================= */
(function (global) {
  'use strict';

  const KEY = 'namtsy.sound';
  let ctx = null;
  let master = null;
  let enabled = true;

  try {
    const saved = global.localStorage ? global.localStorage.getItem(KEY) : null;
    enabled = saved === null ? true : saved === '1';
  } catch (e) { /* приватный режим — остаёмся со звуком */ }

  function ac() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  /* --- один тон с огибающей --- */
  function tone(opts) {
    const c = ac();
    if (!c) return;
    const o = Object.assign({
      freq: 440, dur: 0.12, type: 'sine', gain: 0.2, at: 0,
      attack: 0.006, release: 0.06, slideTo: null, filter: null
    }, opts);

    const t0 = c.currentTime + o.at;
    const osc = c.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.slideTo), t0 + o.dur);

    let node = osc;
    if (o.filter) {
      const bq = c.createBiquadFilter();
      bq.type = o.filter.type || 'lowpass';
      bq.frequency.value = o.filter.freq || 1200;
      osc.connect(bq);
      node = bq;
    }

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t0 + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur + o.release);

    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + o.release + 0.02);
  }

  /* --- короткий шумовой всплеск (листание, «щелчок» воздуха) --- */
  function noiseBurst(opts) {
    const c = ac();
    if (!c) return;
    const o = Object.assign({ dur: 0.16, gain: 0.14, at: 0, from: 900, to: 2400, q: 1.2 }, opts);
    const t0 = c.currentTime + o.at;
    const len = Math.floor(c.sampleRate * o.dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = o.q;
    bp.frequency.setValueAtTime(o.from, t0);
    bp.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);

    const g = c.createGain();
    g.gain.setValueAtTime(o.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  const SFX = {
    click() {
      tone({ freq: 780, slideTo: 520, dur: 0.05, type: 'triangle', gain: 0.16, attack: 0.002, release: 0.03 });
    },
    nav() {
      tone({ freq: 520, dur: 0.07, type: 'sine', gain: 0.13, release: 0.08 });
      tone({ freq: 880, dur: 0.07, type: 'sine', gain: 0.07, at: 0.045, release: 0.1 });
    },
    select() {
      tone({ freq: 640, dur: 0.06, type: 'square', gain: 0.05, release: 0.04 });
    },
    hint() {
      tone({ freq: 988, dur: 0.09, type: 'sine', gain: 0.12, release: 0.12 });
      tone({ freq: 1319, dur: 0.09, type: 'sine', gain: 0.09, at: 0.08, release: 0.16 });
    },
    correct() {
      const seq = [659.25, 783.99, 1046.5];
      seq.forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.17, at: i * 0.085, release: 0.14 }));
    },
    wrong() {
      tone({ freq: 220, slideTo: 150, dur: 0.2, type: 'sawtooth', gain: 0.11, filter: { type: 'lowpass', freq: 700 }, release: 0.12 });
      tone({ freq: 165, slideTo: 120, dur: 0.22, type: 'sine', gain: 0.12, at: 0.1 });
    },
    flip() {
      noiseBurst({ dur: 0.18, gain: 0.1, from: 700, to: 2600 });
    },
    shuffle() {
      noiseBurst({ dur: 0.26, gain: 0.09, from: 2400, to: 600 });
    },
    tick() {
      tone({ freq: 1200, dur: 0.03, type: 'square', gain: 0.05, release: 0.02 });
    },
    warn() {
      tone({ freq: 880, dur: 0.08, type: 'triangle', gain: 0.1, release: 0.05 });
    },
    win() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.15, at: i * 0.1, release: 0.2 }));
      tone({ freq: 261.63, dur: 0.5, type: 'sine', gain: 0.08, at: 0.1 });
    },
    lose() {
      [392, 349.23, 293.66].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'sine', gain: 0.12, at: i * 0.13, release: 0.16 }));
    },
    toggle() {
      tone({ freq: 440, slideTo: 880, dur: 0.09, type: 'sine', gain: 0.1, release: 0.05 });
    }
  };

  const Sound = {
    play(name) {
      if (!enabled) return;
      const fn = SFX[name];
      if (!fn) return;
      try {
        if (!ac()) return;
        fn();
      } catch (e) { /* звук не должен ломать интерфейс */ }
    },
    /* разблокировка аудиоконтекста первым жестом пользователя */
    unlock() { ac(); },
    isEnabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      try { if (global.localStorage) global.localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) {}
      return enabled;
    },
    /* служебный доступ для тестов */
    _names: Object.keys(SFX)
  };

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
