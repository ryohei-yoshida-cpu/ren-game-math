// 🎣 のんびりつりつり
//   1しゅうかん（にちようび〜どようび）さかなを つる。1にちは 7じ〜18じ（じかんざかなで 2じかんずつ のびる。さいだい 24じ）
//   なみを えらぶ → かかったら れんだ（みずしぶきが おおきく なる）→ さかなが とびだして すうじを よみあげる
//   →「どっちの すうじが おおきい？」で おおきい ほうを のこす（のこした さかなが つぎの えさ）
//   1にち 3かい つる。つるたびに じかんが すすむ（7じ → 12じ → 15じ → 18じ、よるは 1じかんずつ。よるは 2ばい）
//   「よてい」（パパが おしごとに いく じかん など）を いれると、とけいが すすむ とちゅうで とまって よみあげる
//   のこした おおきい さかなの すうじが「いまの すうじ」（てんすう）。どようびの おわりの すうじで ランキングへ
//   じかんざかなは「18じ たす 2じかん は 20じ」と じかんの たしざんを みせる
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const {
    SPECIES, CLOCK_FISH, WORM, speciesOf, WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_COLOR, Keys, Sound, Art,
  } = window;
  const SAVE_KEY = 'sujitsuri-v1';
  const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;   // テストよう（はやおくり・こえなし）
  if (SPEED > 1) Sound.muted = true;

  // ---------- ルール ----------
  const DAY_START = 7 * 60;           // あさ 7じ から
  const BASE_END = 18 * 60;           // ゆうがた 6じ（18じ）まで
  const NIGHT = 18 * 60;              // 18じ からは よるの つり（てんすう 2ばい）
  const MAX_END = 24 * 60;            // じかんざかなで のびても 1にち（24じ）まで
  const SLOTS = [12, 15, 18].map(h => h * 60);   // 1かい つるたびに すすむ じかん（1にち 3かい）
  const CLOCK_ADD = 120;              // じかんざかなは 2じかん
  const CLOCK_MAX = 3;                // じかんざかなは 1しゅうかんに 3かい まで
  const CLOCK_RATE = 0.15;
  const MAX_N = 100;
  // 3つの なみ: いまの さかなより 5〜8 おおきい / 1〜5 おおきい / 1〜5 ちいさい（どれが どれかは ないしょ）
  const WAVES = [[5, 8], [1, 5], [-5, -1]];
  const RIPPLES = [0.52, 0.71, 0.89]; // なみの いち（みずの はばの どこか。デッキの みぎがわ）
  // 1じの ちいさい すうじより したに なったら: たまに マイナス（ながぐつ など）、ときどき かいがら（0）
  const JUNK_RATE = 0.15;
  const SHELL_RATE = 0.25;

  // ---------- こえ ----------
  // nar・kid に かいた セリフは tools/voices/lines.mjs が あつめて VOICEVOX で こえに する
  const nar = t => `narr|${t}`;
  const kid = t => `kid|${t}`;
  // ごはん・おやつ（さりげなく）
  const MEALS = {
    [7 * 60]: { icon: '🍙', voice: kid('あさごはん いただきますなのだ！') },
    [12 * 60]: { icon: '🐟', voice: kid('おさかな ちょっとだけ たべるのだ') },
    [15 * 60]: { icon: '🍪', voice: kid('おやつなのだ！') },
    [18 * 60]: { icon: '🍛', voice: kid('ばんごはんなのだ！'), crow: true },
  };

  // よていの じかんの れい（じぶんで かいても いい。こえは スタジオで ろくおん できる）
  const EVENT_PRESETS = [
    nar('パパが おしごとに いく じかん'),
    nar('ほいくえんの おやつの じかん'),
    nar('ママが おむかえに くる じかん'),
    nar('ほいくえんに いく じかん'),
    nar('あさごはんの じかん'),
    nar('ばんごはんの じかん'),
    nar('おふろの じかん'),
    nar('ねる じかん'),
  ].map(k => k.slice(5));

  // ---------- セーブ ----------
  function defaultSave() {
    return { species: {}, numbers: {}, ranking: [], weeks: 0, events: [] };
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s === 'object') return Object.assign(defaultSave(), s);
    } catch (e) { /* つかえない ときは あたらしく */ }
    return defaultSave();
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* むし */ }
    if (window.Cloud) Cloud.saveChanged();
  }
  let save = loadSave();

  // ---------- キャンセル・いちじていし できる まち ----------
  let epoch = 0;
  let paused = false;
  const CANCEL = Symbol('cancel');
  function cancelAll() {
    epoch++;
    paused = false;
    Sound.hush();
  }
  function ignoreCancel(e) {
    if (e !== CANCEL) console.error(e);
  }
  async function waitPlay(my) {
    while (paused && my === epoch) await new Promise(r => setTimeout(r, 100));
    if (my !== epoch) throw CANCEL;
  }
  async function sleep(ms) {
    const my = epoch;
    await waitPlay(my);
    await new Promise(r => setTimeout(r, ms / SPEED));
    await waitPlay(my);
  }
  const easeInOut = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const linear = t => t;
  function tween(ms, fn, ease = easeInOut) {
    const my = epoch;
    return new Promise((res, rej) => {
      let last = performance.now();
      let el = 0;
      function frame(now) {
        if (my !== epoch) return rej(CANCEL);
        if (!paused) el += now - last;
        last = now;
        const t = Math.min(1, el * SPEED / ms);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(frame); else res();
      }
      requestAnimationFrame(frame);
    });
  }
  // しゃべりおわるまで まつ
  async function talk(...keys) {
    const my = epoch;
    await waitPlay(my);
    await Sound.say(keys.flat());
    if (my !== epoch) throw CANCEL;
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const shuffle = a => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };

  // ---------- がめん ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  }
  function showOverlay(id, on) {
    $(id).classList.toggle('show', on);
  }

  // ---------- とけい ----------
  const hm = t => [Math.floor(t / 60), Math.round(t % 60)];
  const timeText = t => {
    const [h, m] = hm(t);
    return m ? `${h}じ ${window.funText(m)}` : `${h}じ`;
  };

  // アナログどけい（minutes は 0じ からの ふん）
  function clockSVG(minutes, cls = '', { ticks = false } = {}) {
    let s = `<svg class="clock ${cls}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" class="c-face"/>`;
    if (ticks) {
      for (let i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        s += `<line class="c-tick" x1="50" y1="5" x2="50" y2="9" transform="rotate(${i * 6} 50 50)"/>`;
      }
    }
    for (let i = 1; i <= 12; i++) {
      const a = i * Math.PI / 6;
      s += `<text class="c-num" x="${(50 + 36 * Math.sin(a)).toFixed(1)}" y="${(50 - 36 * Math.cos(a)).toFixed(1)}">${i}</text>`;
    }
    s += '<line class="c-hour" x1="50" y1="50" x2="50" y2="27"/><line class="c-min" x1="50" y1="50" x2="50" y2="13"/>' +
      '<circle cx="50" cy="50" r="4" class="c-dot"/></svg>';
    const wrap = document.createElement('div');
    wrap.innerHTML = s;
    setClock(wrap.firstChild, minutes);
    return wrap.innerHTML;
  }
  function setClock(svg, minutes) {
    if (!svg) return;
    const h = (minutes / 60) % 12;
    const m = minutes % 60;
    svg.querySelector('.c-hour').setAttribute('transform', `rotate(${h * 30} 50 50)`);
    svg.querySelector('.c-min').setAttribute('transform', `rotate(${m * 6} 50 50)`);
  }

  // 6じ〜24じ の じかんの ぼう
  function renderTimeline(el, now, end, { added = 0 } = {}) {
    const pos = t => ((t - DAY_START) / (MAX_END - DAY_START) * 100).toFixed(2) + '%';
    let s = `<div class="tl-bar"><div class="tl-open" style="width:${pos(end)}"></div>`;
    if (added) s += `<div class="tl-added" style="left:${pos(end - added)};width:calc(${pos(end)} - ${pos(end - added)})"></div>`;
    s += `<div class="tl-done" style="width:${pos(now)}"></div><div class="tl-end" style="left:${pos(end)}">🏁</div></div><div class="tl-labels">`;
    for (const h of [7, 12, 15, 18, 21, 24]) s += `<span style="left:${pos(h * 60)}">${h}</span>`;
    el.innerHTML = s + '</div>';
  }

  // ---------- さかな ----------
  const artOf = sp => Art.of(sp);
  const fishName = f => (f.worm ? WORM.name : f.sp.name);
  const fishArt = f => (f.worm ? `<span class="femoji">${WORM.emoji}</span>` : artOf(f.sp));
  const isNight = () => day.now >= NIGHT;

  // いまの さかな と なみ から つれる すうじ
  function nextNumber(base, [a, b]) {
    let n = Math.min(MAX_N, base + randInt(a, b));
    if (n < 1) {
      const r = Math.random();
      n = r < JUNK_RATE ? Math.max(-10, n) : r < JUNK_RATE + SHELL_RATE ? 0 : randInt(1, 3);
    }
    return n;
  }

  // ---------- あそびの じょうたい ----------
  let week = null;     // { start, held, clockCaught, caught, said }
  let day = null;      // { idx, now, end, nightSaid }
  let phase = 'off';   // spot / cast / mash / busy / off
  let waves = null;    // なみごとの ふえかた
  let sessionCaught = [];
  let calendarNext = null;   // つぎの しゅうの にちようび（つづけて あそぶと カレンダーが すすむ）
  let hint = { said: 0, timer: 0 };

  const dateOf = i => new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate() + i);
  const scoreOf = f => f.n * (f.night ? 2 : 1);   // よるに つった さかなは 2ばい
  // おなじ セリフは しゅうの はじめの 3かいだけ ながく いう（なれたら みじかく して テンポよく）
  const longFirst = key => (week.said[key] = (week.said[key] || 0) + 1) <= 3;

  // ---------- がめんの ようす（そら・とけい） ----------
  const SKY = [
    [6 * 60, '#ffb48f', '#ffe2c4', '#5cc4e8', '#2f8fc8'],
    [7 * 60, '#9fd6ff', '#ffeed6', '#4cc0f0', '#2384c4'],
    [8 * 60, '#7fcaff', '#d6f1ff', '#4cc0f0', '#1f7fc0'],
    [15 * 60, '#7fcaff', '#d6f1ff', '#4cc0f0', '#1f7fc0'],
    [17 * 60, '#ffb877', '#ffe6b8', '#4cb4e6', '#1c74b4'],
    [18 * 60, '#ff8f5e', '#ffd39a', '#4aa8d8', '#1c6aa8'],
    [19 * 60, '#3b3570', '#a2709a', '#2b5f94', '#123a66'],
    [20 * 60, '#1b2a55', '#3c4a80', '#1f4f80', '#0d2c55'],
    [24 * 60, '#0a1230', '#1b2a55', '#123a66', '#081d3d'],
  ];
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  function paintSky(t) {
    let i = 0;
    while (i < SKY.length - 2 && t > SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1];
    const k = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
    const scene = $('#scene');
    ['--sky1', '--sky2', '--sea1', '--sea2'].forEach((v, j) => scene.style.setProperty(v, mix(a[j + 1], b[j + 1], k)));
    scene.classList.toggle('night', t >= 18.5 * 60);
    const sun = $('#sun');
    const night = t >= 18.5 * 60;
    sun.textContent = night ? '🌙' : '☀️';
    const p = night ? Math.min(1, (t - 18.5 * 60) / (5 * 60)) : Math.min(1, (t - DAY_START) / (12.5 * 60));
    sun.style.left = `${62 + p * 30}%`;
    sun.style.top = `${75 - Math.sin(p * Math.PI) * 55}%`;
  }

  function renderTime(t = day.now) {
    setClock($('#hud-clock svg'), t);
    $('#hud-now').textContent = timeText(t);
    $('#hud-end').textContent = `🏁 ${timeText(day.end)} まで`;
    renderTimeline($('#timeline'), t, day.end);
    paintSky(t);
    $('#night-badge').hidden = t < NIGHT;
  }

  function renderWeekStrip(el, cur, { marker = true } = {}) {
    el.innerHTML = WEEKDAY_SHORT.map((w, i) => {
      const d = dateOf(i);
      const cls = i < cur ? ' done' : i === cur ? ' now' : '';
      return `<div class="wd${cls}" style="--c:${WEEKDAY_COLOR[i]}"><b>${w}</b><small>${d.getMonth() + 1}/${d.getDate()}</small></div>`;
    }).join('') + (marker ? '<div class="wd-mark">🐟</div>' : '');
  }
  function placeMarker(el, pos) {
    const cells = el.querySelectorAll('.wd');
    const mk = el.querySelector('.wd-mark');
    if (!mk || !cells.length) return;
    const i = Math.max(0, Math.min(6, Math.floor(pos)));
    const j = Math.min(6, i + 1);
    const k = pos - i;
    const cx = c => c.offsetLeft + c.offsetWidth / 2;
    mk.style.left = `${cx(cells[i]) + (cx(cells[j]) - cx(cells[i])) * k}px`;
  }

  function renderHud() {
    renderWeekStrip($('#hud-week'), day.idx, { marker: false });
    const d = dateOf(day.idx);
    $('#hud-date').innerHTML = `${d.getMonth() + 1}がつ ${d.getDate()}にち<br><b style="color:${WEEKDAY_COLOR[day.idx]}">${WEEKDAYS[day.idx]}</b>`;
    const left = CLOCK_MAX - week.clockCaught;
    $('#hud-clockfish').innerHTML = '<small>じかんざかな</small><div>' +
      Array.from({ length: CLOCK_MAX }, (_, i) => `<span class="${i < left ? '' : 'used'}">⏰</span>`).join('') + '</div>';
    if (!$('#hud-clock svg')) $('#hud-clock').innerHTML = clockSVG(day.now);
    renderTime();
    renderHeld();
  }

  function renderHeld(pop) {
    const f = week.held;
    $('#held').innerHTML = `<div class="hf-art">${fishArt(f)}</div><small>${fishName(f)}</small>`;
    $('#score').innerHTML = `<b class="${f.n < 0 ? 'minus' : ''}">${f.n}</b>` +
      (f.night ? `<span class="sc-night">🌙×2 ＝ ${scoreOf(f)}</span>` : '');
    if (pop) {
      ['#held', '#score'].forEach(id => {
        $(id).classList.remove('pop');
        void $(id).offsetWidth;
        $(id).classList.add('pop');
      });
    }
  }

  // ---------- ねこ と いと ----------
  $('#fisher').insertAdjacentHTML('afterbegin', Art.cat());
  $('#cottage').innerHTML = Art.cottage();
  const water = $('#water');
  let geo = { w: 300, h: 100, top: 0, left: 0 };
  function layout() {
    const sc = $('#scene').getBoundingClientRect();
    const wr = water.getBoundingClientRect();
    geo = { w: wr.width, h: wr.height, top: wr.top - sc.top, left: wr.left - sc.left };
    const cat = $('#fisher .cat-svg').getBoundingClientRect();
    geo.rod = { x: cat.left - sc.left + cat.width * Art.ROD.x / 120, y: cat.top - sc.top + cat.height * Art.ROD.y / 132 };
    geo.tip = { x: geo.rod.x + Math.min(110, sc.width * 0.22), y: geo.rod.y - Math.min(90, sc.height * 0.2) };
    drawLine();
  }
  window.addEventListener('resize', () => { if (week) layout(); });

  const line = { on: false, bob: null, sink: 0 };
  function drawLine() {
    const svg = $('#line');
    const r = geo.rod, t = geo.tip;
    if (!r) return;
    let s = `<line class="rod" x1="${r.x}" y1="${r.y}" x2="${t.x}" y2="${t.y}"/>`;
    if (line.on && line.bob) {
      const b = line.bob;
      const mx = (t.x + b.x) / 2, my = Math.max(t.y, b.y) + 20;
      s += `<path class="string" d="M${t.x} ${t.y} Q${mx} ${my} ${b.x} ${b.y + line.sink}"/>`;
      $('#bobber').style.transform = `translate(${b.x}px, ${b.y + line.sink}px) translate(-50%, -70%)`;
    }
    svg.innerHTML = s;
  }

  function catSay(text, ms = 1600) {
    const el = $('#cat-say');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(catSay.t);
    catSay.t = setTimeout(() => el.classList.remove('show'), ms / SPEED);
  }

  // ---------- のんびり ねこ ----------
  // あくび・いねむり・のび・まばたき を ときどき する
  const MOODS = ['blink', 'blink', 'yawn', 'doze', 'stretch'];
  let moodTimer = 0;
  function mood(name, ms) {
    const el = $('#fisher');
    MOODS.concat(['happy', 'eating']).forEach(m => el.classList.remove(m));
    if (!name) return;
    el.classList.add(name);
    clearTimeout(mood.t);
    mood.t = setTimeout(() => el.classList.remove(name), ms / SPEED);
  }
  function idleLife() {
    clearTimeout(moodTimer);
    moodTimer = setTimeout(() => {
      idleLife();
      if (!week || paused || phase !== 'spot') return;
      const m = MOODS[randInt(0, MOODS.length - 1)];
      if (m === 'blink') mood('blink', 220);
      else if (m === 'yawn') { mood('yawn', 1800); catSay('ふぁ〜あ', 1600); Sound.yawn(); }
      else if (m === 'doze') mood('doze', 3200);
      else mood('stretch', 1600);
    }, rand(2500, 5000) / SPEED);
  }
  idleLife();

  // ---------- なみ（つる ばしょ） ----------
  function renderRipples() {
    $('#ripples').innerHTML = RIPPLES.map((x, i) => {
      const l = i === 0 ? 0.42 : (RIPPLES[i - 1] + x) / 2;
      const r = i === RIPPLES.length - 1 ? 1 : (RIPPLES[i + 1] + x) / 2;
      return `<button class="ripple" data-i="${i}" style="left:${l * 100}%;width:${(r - l) * 100}%" aria-label="ここで つる">` +
        `<span class="rings" style="left:${((x - l) / (r - l)) * 100}%"><i></i><i></i><i></i></span></button>`;
    }).join('');
  }
  $('#ripples').addEventListener('click', e => {
    const b = e.target.closest('.ripple');
    if (!b || phase !== 'spot' || paused) return;
    Sound.unlock();
    Sound.tap();
    b.classList.add('on');
    cast(Number(b.dataset.i)).catch(ignoreCancel);
  });

  function nextTurn() {
    phase = 'spot';
    mood(null);
    waves = shuffle(WAVES);
    renderRipples();
    $('#scene').classList.add('want-spot');
    $('#guide').textContent = '👇 どこで つる？';
    $('#guide').className = 'guide show';
    clearTimeout(hint.timer);
    // はじめは こえで あんない。なれてきたら しばらく まよった ときだけ
    if (hint.said < 2) {
      hint.said++;
      Sound.say(nar('どこで つる？ なみを タップしてね'));
    }
    const my = epoch;
    hint.timer = setTimeout(() => {
      if (my === epoch && phase === 'spot' && !paused) Sound.say(nar('どこで つる？ なみを タップしてね'));
    }, 8000 / SPEED);
  }
  function hideGuide() {
    clearTimeout(hint.timer);
    $('#guide').className = 'guide';
    $('#scene').classList.remove('want-spot');
  }

  // ---------- つる ----------
  async function cast(i) {
    phase = 'cast';
    hideGuide();
    Sound.hush();
    const sx = geo.left + RIPPLES[i] * geo.w;
    const sy = geo.top + geo.h * 0.32;
    Sound.cast();
    catSay('えいっ！', 900);
    mood(null);
    $('#fisher').classList.add('casting');
    line.on = true;
    line.sink = 0;
    $('#bobber').hidden = false;
    const t0 = geo.tip;
    await tween(550, k => {
      line.bob = { x: t0.x + (sx - t0.x) * k, y: t0.y + (sy - t0.y) * k - Math.sin(k * Math.PI) * 60 };
      drawLine();
    }, linear);
    $('#fisher').classList.remove('casting');
    Sound.plop();
    // なにが つれるか（つれるまで ないしょ）
    const clockOk = week.clockCaught < CLOCK_MAX && day.end + CLOCK_ADD <= MAX_END && week.caught > 0;
    const f = clockOk && Math.random() < CLOCK_RATE
      ? { clock: true, sp: CLOCK_FISH }
      : (n => ({ n, sp: speciesOf(n) }))(nextNumber(week.held.n, waves[i]));
    // つんつん … ぐいっ！
    await sleep(rand(300, 600));
    for (let k = 0; k < 2; k++) {
      await tween(160, t => { line.sink = Math.sin(t * Math.PI) * 5; drawLine(); }, linear);
      Sound.plop();
      await sleep(rand(150, 350));
    }
    await tween(150, t => { line.sink = t * 14; drawLine(); }, linear);
    $('#bobber').classList.add('sink');
    Sound.bite();
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    catSay('かかった！');
    Sound.say(kid('かかったのだ！'));
    await mash(f, sx, sy);
  }

  // れんだ: みずしぶきが だんだん おおきく なる（おおきい さかなほど おおきい しぶき）
  function mash(f, sx, sy) {
    phase = 'mash';
    const tier = f.clock ? 8 : Math.max(0, f.sp.tier);
    const need = f.clock ? 7 : f.sp.junk ? 3 : 4 + Math.round(tier * 0.4);
    const big = 0.7 + tier / 14;
    let got = 0;
    const sp = $('#splash');
    sp.hidden = false;
    sp.style.left = `${sx}px`;
    sp.style.top = `${sy}px`;
    sp.style.setProperty('--s', (0.5 * big).toFixed(2));
    $('#mash').hidden = false;
    const my = epoch;
    return new Promise((res, rej) => {
      const onTap = e => {
        if (my !== epoch) { cleanup(); return rej(CANCEL); }
        if (paused || e.target.closest('#btn-home')) return;
        if (e.preventDefault) e.preventDefault();
        got++;
        const k = Math.min(1, got / need);
        Sound.reel(k);
        sp.style.setProperty('--s', ((0.5 + k * 1.3) * big).toFixed(2));
        sp.classList.remove('burst');
        void sp.offsetWidth;
        sp.classList.add('burst');
        line.sink = 14 + Math.sin(got) * 4;
        drawLine();
        if (got === Math.ceil(need / 2)) Sound.say(kid('がんばるのだ！'));
        if (got >= need) {
          cleanup();
          res(landed(f));
        }
      };
      const cleanup = () => {
        $('#scene').removeEventListener('pointerdown', onTap);
        $('#mash').hidden = true;
      };
      $('#scene').addEventListener('pointerdown', onTap);
      window.__mashTap = () => onTap({ target: $('#scene') });   // テストよう
    });
  }

  async function landed(f) {
    phase = 'busy';
    const sx = parseFloat($('#splash').style.left), sy = parseFloat($('#splash').style.top);
    $('#splash').hidden = true;
    $('#splash').classList.remove('final', 'burst');
    line.on = false;
    $('#bobber').hidden = true;
    $('#bobber').classList.remove('sink');
    drawLine();
    await leap(f, sx, sy);
    if (f.clock) {
      await revealClock(f);
    } else {
      await revealFish(f);
      await compare(f);
      await advanceTime();
    }
    afterTurn();
  }

  // ざばーん！ さかなが みずから とびだす
  async function leap(f, sx, sy) {
    const scene = $('#scene');
    const W = scene.clientWidth, H = scene.clientHeight;
    const tier = f.clock ? 8 : Math.max(0, f.sp.tier);
    Sound.splash();
    Sound.whoosh();
    if (navigator.vibrate) navigator.vibrate(80);
    scene.classList.remove('shake');
    void scene.offsetWidth;
    scene.classList.add('shake');
    // みずばしら
    const col = document.createElement('div');
    col.className = 'big-splash';
    col.style.left = `${sx}px`;
    col.style.top = `${sy}px`;
    const k = 0.8 + tier / 12;
    col.innerHTML = [-42, -24, -8, 8, 24, 42].map((r, i) =>
      `<i style="--r:${r}deg;height:${Math.round((50 + (i % 3) * 18) * k)}px;animation-delay:${i * 25}ms"></i>`).join('');
    scene.appendChild(col);
    setTimeout(() => col.remove(), 900 / SPEED);
    // さかなが くるくる まわりながら とびだす
    const el = $('#jump');
    el.innerHTML = `<span class="jump-in">${artOf(f.sp)}</span><span class="drops">` +
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return `<i style="--dx:${Math.round(Math.cos(a) * 70)}px;--dy:${Math.round(Math.sin(a) * 60 + 30)}px"></i>`;
      }).join('') + '</span>';
    el.style.fontSize = `${Math.round(40 + tier * 3)}px`;
    el.hidden = false;
    const tx = W * 0.5, ty = H * 0.3, peak = H * 0.08;
    await tween(850, t => {
      const x = sx + (tx - sx) * t;
      const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * peak + t * t * ty;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${t * 540}deg) scale(${0.4 + t * 0.9})`;
    }, t => 1 - Math.pow(1 - t, 2));
    // きらきら
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.textContent = i % 2 ? '✨' : '⭐';
      const a = (i / 8) * Math.PI * 2;
      s.style.left = `${tx}px`;
      s.style.top = `${ty}px`;
      s.style.setProperty('--dx', `${Math.round(Math.cos(a) * 90)}px`);
      s.style.setProperty('--dy', `${Math.round(Math.sin(a) * 90)}px`);
      scene.appendChild(s);
      setTimeout(() => s.remove(), 1000 / SPEED);
    }
    mood('happy', 1500);
    await sleep(250);
    el.hidden = true;
  }

  // ---------- つれた！ ----------
  function showCatch(f) {
    const ov = $('#overlay-catch');
    ov.classList.remove('is-new', 'named', 'said', 'wait', 'junk', 'gold');
    $('#catch-fish').innerHTML = artOf(f.sp);
    const tier = f.clock ? 8 : Math.max(0, f.sp.tier);
    $('#catch-fish').style.fontSize = `${Math.round(54 + tier * 5)}px`;
    $('#catch-num').innerHTML = f.clock ? '' : `<span class="${f.n < 0 ? 'minus' : ''}">${f.n}</span>`;
    $('#catch-name').textContent = f.sp.name;
    ov.classList.toggle('junk', !!f.sp.junk);
    ov.classList.toggle('gold', !!f.sp.gold);
    showOverlay('#overlay-catch', true);
  }

  function record(f) {
    const isNew = !save.species[f.sp.id];
    save.species[f.sp.id] = (save.species[f.sp.id] || 0) + 1;
    if (!f.clock) save.numbers[f.n] = (save.numbers[f.n] || 0) + 1;
    writeSave();
    sessionCaught.push(f.sp.id);
    week.caught++;
    return isNew;
  }

  async function revealFish(f) {
    const isNew = record(f);
    const ov = $('#overlay-catch');
    showCatch(f);
    if (f.sp.junk) Sound.junk(); else if (f.n >= 80) Sound.big(); else Sound.caught();
    ov.classList.add('said');
    Sound.say(f.sp.junk ? kid('なんか へんなの つれたのだ…') : kid('つれたのだー！'));
    await talk(Keys.num(f.n));
    ov.classList.add('named');
    await talk(Keys.caught(f.sp));
    if (isNew) {
      ov.classList.add('is-new');
      Sound.newOne();
      await talk(nar('あたらしい なかまだ！ ずかんに のったよ'));
      if (f.sp.junk) await talk(nar('マイナスは ゼロより ちいさい すうじだよ'));
    }
    await sleep(400);
    showOverlay('#overlay-catch', false);
  }

  // ---------- どっちの すうじが おおきい？ ----------
  async function compare(f) {
    const old = week.held;
    const night = isNight();
    const fresh = { n: f.n, sp: f.sp, night };
    if (old.n === f.n) {
      // おなじ すうじ: あたらしい ほうを のこす
      await talk(nar('おなじ すうじだ！'));
      week.held = fresh;
      renderHeld(true);
      return;
    }
    const ov = $('#overlay-compare');
    const cards = { old: ov.querySelector('[data-side="old"]'), new: ov.querySelector('[data-side="new"]') };
    const fill = (c, x) => {
      c.className = 'ccard';
      c.querySelector('.cc-art').innerHTML = fishArt(x);
      c.querySelector('b').innerHTML = `<span class="${x.n < 0 ? 'minus' : ''}">${x.n}</span>`;
    };
    fill(cards.old, old);
    fill(cards.new, fresh);
    $('#compare-msg').textContent = '';
    ov.classList.remove('done');
    showOverlay('#overlay-compare', true);
    Sound.say(nar('どっちの すうじが おおきい？'));
    const my = epoch;
    const side = await new Promise((res, rej) => {
      const onTap = e => {
        const c = e.target.closest('.ccard');
        if (!c || paused) return;
        if (my !== epoch) return rej(CANCEL);
        ov.removeEventListener('click', onTap);
        res(c.dataset.side);
      };
      ov.addEventListener('click', onTap);
      window.__compare = s => onTap({ target: cards[s] });   // テストよう
    });
    Sound.hush();
    ov.classList.add('done');
    const bigSide = old.n > fresh.n ? 'old' : 'new';
    const smallSide = bigSide === 'old' ? 'new' : 'old';
    const pick = { old, new: fresh };
    if (side === bigSide) {
      cards[bigSide].classList.add('keep');
      cards[smallSide].classList.add('bye');
      $('#compare-msg').textContent = '⭕ せいかい！ おおきい ほうを のこすよ';
      Sound.caught();
      week.held = pick[bigSide];
      await talk(longFirst('ok') ? nar('せいかい！ おおきい ほうを のこすよ') : nar('せいかい！'));
    } else {
      cards[side].classList.add('keep');
      cards[bigSide].classList.add('flee');
      $('#compare-msg').textContent = '💦 ざんねん… おおきい さかなが にげちゃった';
      Sound.junk();
      week.held = pick[smallSide];
      await talk(nar('ざんねん！ おおきい さかなが にげちゃった'));
    }
    await sleep(500);
    showOverlay('#overlay-compare', false);
    renderHeld(true);
    if (!save.hintSeen) {
      save.hintSeen = true;
      writeSave();
      await talk(nar('のこした さかなが つぎの えさに なるよ。おおきい えさだと、おおきい さかなが つれるよ'));
    }
  }

  // ---------- とけいを ズームして すすめる ----------
  // from → to を 10ぷんずつ すすめる。onHour(h) は ちょうどの じかんごとに よぶ
  async function clockRun(from, to, { stepMs, onStep, onHour } = {}) {
    const svg = $('#time-clock svg');
    for (let t = from + 10; t <= to; t += 10) {
      setClock(svg, t);
      Sound.tick();
      if (onStep) onStep(t);
      await sleep(stepMs);
      if (t % 60 === 0 && onHour) await onHour(t);
    }
  }
  function openClock(title, minutes) {
    $('#time-title').innerHTML = title;
    $('#time-clock').innerHTML = clockSVG(minutes, 'big-clock', { ticks: true });
    $('#time-digital').innerHTML = '';
    $('#time-plus').textContent = '';
    $('#time-event').textContent = '';
    showOverlay('#overlay-time', true);
    const ov = $('#overlay-time');
    ov.classList.remove('zoom');
    void ov.offsetWidth;
    ov.classList.add('zoom');
  }

  // 1かい つったら じかんが すすむ
  async function advanceTime() {
    const from = day.now;
    let to = SLOTS.find(s => s > from);
    if (to == null) to = from + 60;   // よるは 1じかんずつ
    to = Math.min(to, day.end);
    openClock('⏰ じかんが すすむよ', from);
    const show = t => {
      $('#time-digital').innerHTML = `<span class="td-from">${timeText(from)}</span> → <b>${timeText(t)}</b>`;
      renderTimeline($('#time-line'), t, day.end);
    };
    show(from);
    await sleep(500);
    // 10ぷんずつ すすめて、よていの じかんで いちど とまる
    const svg = $('#time-clock svg');
    const evs = eventsBetween(from, to);
    let t = from;
    for (const ev of [...evs, null]) {
      const stop = ev ? ev.t : to;
      while (t < stop) {
        t = Math.min(stop, Math.floor(t / 10) * 10 + 10);
        setClock(svg, t);
        Sound.tick();
        show(t);
        await sleep(70);
      }
      if (ev) await announce(ev);
    }
    day.now = to;
    renderTime();
    Sound.hourChime(to / 60);
    await talk(Keys.ji(to / 60), nar('に なったよ！'));
    await sleep(300);
    showOverlay('#overlay-time', false);
    await meal(to);
    if (to >= NIGHT && to < day.end && !day.nightSaid) {
      day.nightSaid = true;
      await talk(nar('よるの つりは てんすうが 2ばい！'));
    }
  }
  // ---------- よていの じかん ----------
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function eventsBetween(a, b) {
    return (save.events || []).map(e => ({ ...e, t: e.h * 60 + e.m }))
      .filter(e => e.t > a && e.t <= b).sort((x, y) => x.t - y.t);
  }
  async function announce(ev) {
    $('#time-event').innerHTML = `⏰ <b>${timeText(ev.t)}</b><br>${esc(ev.label)}`;
    Sound.newOne();
    await talk(Keys.time(ev.h, ev.m), nar(ev.label), nar('だよ！'));
    await sleep(600);
    $('#time-event').innerHTML = '';
  }

  // ごはん・おやつ（さりげなく）
  async function meal(t) {
    const m = MEALS[t];
    if (!m) return;
    catSay(m.icon, 2400);
    mood('eating', 2000);
    if (m.crow) crow();
    await talk(m.voice);
  }
  function crow() {
    const c = document.createElement('div');
    c.className = 'crow';
    c.innerHTML = '🐦<span>カー カー</span>';
    $('#scene').appendChild(c);
    Sound.caw();
    setTimeout(() => c.remove(), 5000 / SPEED);
  }

  // ---------- じかんざかな ----------
  async function revealClock(f) {
    record(f);
    showCatch(f);
    $('#overlay-catch').classList.add('named');
    Sound.big();
    await talk(kid('つれたのだー！'));
    await talk(nar('じかんざかなだ！'));
    await sleep(300);
    showOverlay('#overlay-catch', false);
    // 0じ から 10ぷんずつ はりを うごかして 2じかんを みせる
    openClock('⏰ じかんざかなは なんじかん？', 0);
    const show = t => {
      const [h, m] = hm(t);
      $('#time-digital').innerHTML = `<b>${h ? `${h}じかん` : ''}${m ? ` ${window.funText(m)}` : ''}${t ? '' : '0'}</b>`;
    };
    show(0);
    await sleep(600);
    await clockRun(0, CLOCK_ADD, {
      stepMs: 380,
      onStep: show,
      onHour: async t => { Sound.hourChime(t / 60); await talk(Keys.jikan(t / 60)); },
    });
    await talk(nar('じかんざかなは 2じかんざかなだった！'));
    // おわりの じかんが のびる
    const from = day.end;
    day.end = Math.min(MAX_END, from + CLOCK_ADD);
    week.clockCaught++;
    $('#time-title').innerHTML = '🏁 おわりの じかんが のびた！';
    $('#time-clock').innerHTML = clockSVG(from, 'big-clock', { ticks: true });
    $('#time-digital').innerHTML = '';
    $('#time-plus').innerHTML = `<span class="tp-eq">${timeText(from)} <i>＋</i> 2じかん <i>＝</i> <b class="q">？</b></span>`;
    renderTimeline($('#time-line'), day.now, from);
    await talk(Keys.ji(from / 60), nar('たす'), Keys.jikan(2), nar('は'));
    await sleep(600);
    $('#time-plus').innerHTML = `<span class="tp-eq">${timeText(from)} <i>＋</i> 2じかん <i>＝</i> <b>${timeText(day.end)}</b></span>`;
    renderTimeline($('#time-line'), day.now, day.end, { added: day.end - from });
    setClock($('#time-clock svg'), day.end);
    Sound.fanfare();
    await talk(Keys.ji(day.end / 60));
    await talk(nar('おわりの じかんが'), Keys.ji(day.end / 60), nar('に のびた！'));
    if (from <= NIGHT) await talk(nar('よるの つりは てんすうが 2ばい！'));
    await sleep(400);
    showOverlay('#overlay-time', false);
    renderHud();
  }

  function afterTurn() {
    if (!week) return;
    if (day.now >= day.end) {
      endDay().catch(ignoreCancel);
      return;
    }
    nextTurn();
  }

  // ---------- まいにちの ながれ ----------
  async function startDay(idx) {
    day = { idx, now: DAY_START, end: BASE_END, nightSaid: false };
    layout();
    renderHud();
    await meal(DAY_START);
    for (const ev of eventsBetween(DAY_START - 1, DAY_START)) {
      openClock('⏰ よていの じかん', DAY_START);
      await announce(ev);
      showOverlay('#overlay-time', false);
    }
    nextTurn();
  }

  async function endDay() {
    phase = 'busy';
    hideGuide();
    Sound.hush();
    Sound.sunset();
    catSay(`${timeText(day.end)}！`, 2500);
    await talk(Keys.ji(day.end / 60), nar('に なったよ。きょうの つりは おしまい！'));
    renderHeld(true);
    await talk(nar('いまの すうじは'), Keys.num(week.held.n));
    await sleep(600);
    if (day.idx >= 6) await weekEnd();
    else {
      await showDay(day.idx, day.idx + 1);
      await startDay(day.idx + 1);
    }
  }

  // ---------- ようびが かわる ----------
  async function showDay(prev, idx) {
    const strip = $('#day-strip');
    const d = dateOf(Math.min(idx, 6));
    $('#day-title').textContent = prev == null ? '🎣 1しゅうかん さかなを つろう！' : idx > 6 ? '🎉 1しゅうかん たったよ！' : 'つぎの ひ';
    $('#day-date').innerHTML = '';
    $('#day-note').textContent = '';
    renderWeekStrip(strip, prev == null ? 0 : prev);
    showOverlay('#overlay-day', true);
    await sleep(60);
    placeMarker(strip, prev == null ? 0 : prev);
    if (prev == null) {
      await talk(nar('いっしゅうかん、さかなを つろう！ にちようびから どようびまで だよ'));
    } else {
      await talk(Keys.weekday(prev), nar('の つぎは'));
      Sound.step();
      if (idx > 6) {
        // どようびの つぎは にちようび（1しゅうかんが ひとまわり）
        strip.querySelectorAll('.wd').forEach(c => c.classList.add('done'));
        await tween(1400, k => placeMarker(strip, 6 * (1 - k)));
        strip.querySelector('.wd').classList.add('now');
        await talk(Keys.weekday(0), nar('いっしゅうかん たったよ！'));
        await sleep(600);
        showOverlay('#overlay-day', false);
        return;
      }
      await tween(1600, k => placeMarker(strip, prev + (idx - prev) * k));
      renderWeekStrip(strip, idx);
      placeMarker(strip, idx);
      await talk(Keys.weekday(idx));
    }
    await sleep(300);
    $('#day-date').innerHTML = `<span>${d.getMonth() + 1}</span>がつ <span>${d.getDate()}</span>にち<b style="color:${WEEKDAY_COLOR[idx]}">${WEEKDAYS[idx]}</b>`;
    Sound.ding(idx);
    await talk(nar('きょうは'), Keys.date(d));
    if (idx === 0) {
      $('#day-note').textContent = `⏰ ${timeText(DAY_START)} から ${timeText(BASE_END)} まで・1にち 3かい`;
      await talk(Keys.ji(7), nar('から'), Keys.ji(18), nar('まで、1にち 3かい つれるよ！'));
    }
    await sleep(500);
    showOverlay('#overlay-day', false);
  }

  // ---------- 1しゅうかんの おわり ----------
  async function weekEnd() {
    phase = 'busy';
    await showDay(6, 7);
    const f = week.held;
    const score = scoreOf(f);
    $('#sum-fish').innerHTML = `<div class="final-art">${fishArt(f)}</div><div class="final-name">${fishName(f)}</div>`;
    $('#sum-eq').innerHTML = `<b class="${f.n < 0 ? 'minus' : ''}">${f.n}</b>`;
    $('#sum-total').innerHTML = '';
    $('#sum-rank').innerHTML = '';
    $('#sum-ask').classList.remove('show');
    showOverlay('#overlay-sum', true);
    Sound.fanfare();
    await talk(nar('いっしゅうかん おつかれさま！ さいごの すうじは'), Keys.num(f.n));
    if (f.night) {
      $('#sum-total').innerHTML = `🌙 よるの さかなだから 2ばい！ <b>${score}</b>`;
      await talk(nar('よるに つった さかなだから 2ばい！'), Keys.num(score));
    }
    confetti($('#overlay-sum'));

    // ランキング
    const entry = { score, at: Date.now(), fish: week.caught, best: f.n };
    const ranking = [...save.ranking, entry].sort((a, b) => b.score - a.score || a.at - b.at);
    const rank = ranking.indexOf(entry);
    save.ranking = ranking.slice(0, 10);
    save.weeks = (save.weeks || 0) + 1;
    writeSave();
    $('#sum-rank').innerHTML = rankHTML(save.ranking.slice(0, 5), entry);
    if (rank < 10) {
      await talk(nar('ランキング'), Keys.rank(rank + 1));
      if (rank === 0 && ranking.length > 1) await talk(nar('しんきろく！'));
    }
    calendarNext = dateOf(7);
    week = null;
    phase = 'off';
    $('#sum-ask').classList.add('show');
    await talk(nar('きょうは やめとく？'));
  }

  function rankHTML(list, mine) {
    if (!list.length) return '<p class="rank-empty">まだ ないよ。1しゅうかん あそぶと のるよ</p>';
    const medal = ['🥇', '🥈', '🥉'];
    return list.map((r, i) => {
      const d = new Date(r.at);
      const best = r.best > -99 ? speciesOf(Math.max(-10, Math.min(100, r.best))) : null;
      return `<div class="rk${mine && r.at === mine.at ? ' mine' : ''}"><span class="rk-i">${medal[i] || i + 1}</span>` +
        `<b class="rk-score">${r.score}</b><span class="rk-fish">${best ? `<span class="rk-art">${artOf(best)}</span>` : ''} ${r.fish}ひき</span>` +
        `<small>${d.getMonth() + 1}/${d.getDate()}</small></div>`;
    }).join('');
  }

  function confetti(box) {
    let c = box.querySelector('.confetti');
    if (!c) {
      c = document.createElement('div');
      c.className = 'confetti';
      box.prepend(c);
    }
    c.innerHTML = '';
    const colors = ['#ff6b6b', '#ffd56b', '#6bcBff', '#7ee08a', '#c58bff', '#ff9ff3'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (2 + Math.random() * 2) + 's';
      p.style.animationDelay = Math.random() * 0.8 + 's';
      c.appendChild(p);
    }
  }

  // ---------- はじめる / やめる ----------
  async function startWeek() {
    cancelAll();
    const today = new Date();
    const start = calendarNext || new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    week = { start, held: { ...WORM, sp: speciesOf(1), worm: true, night: false }, clockCaught: 0, caught: 0, said: {} };
    hint = { said: 0, timer: 0 };
    day = { idx: 0, now: DAY_START, end: BASE_END, nightSaid: false };
    phase = 'busy';
    ['#overlay-sum', '#overlay-bye', '#overlay-pause'].forEach(id => showOverlay(id, false));
    $('#hud-clock').innerHTML = '';
    $('#ripples').innerHTML = '';
    showScreen('screen-play');
    keepAwake(true);
    if (!history.state || !history.state.play) history.pushState({ play: true }, '');
    layout();
    renderHud();
    try {
      await showDay(null, 0);
      await startDay(0);
    } catch (e) {
      ignoreCancel(e);
    }
  }

  function openPause() {
    if (!week) return goTitle();
    paused = true;
    Sound.hush();
    showOverlay('#overlay-pause', true);
  }
  $('#btn-home').onclick = openPause;
  $('#btn-resume').onclick = () => {
    showOverlay('#overlay-pause', false);
    paused = false;
  };
  $('#btn-quit').onclick = () => bye();
  window.addEventListener('popstate', () => {
    if (!$('#screen-play').classList.contains('active') || $('#overlay-studio').classList.contains('show')) return;
    if ($('#overlay-pause').classList.contains('show') || !week) {
      goTitle(true);
    } else {
      openPause();
      history.pushState({ play: true }, '');
    }
  });

  const PLAY_OVERLAYS = ['#overlay-sum', '#overlay-pause', '#overlay-catch', '#overlay-compare', '#overlay-time', '#overlay-day'];
  function resetPlay() {
    week = null;
    phase = 'off';
    line.on = false;
    $('#bobber').hidden = true;
    $('#splash').hidden = true;
    $('#mash').hidden = true;
    hideGuide();
  }
  function bye() {
    cancelAll();
    resetPlay();
    calendarNext = null;
    PLAY_OVERLAYS.forEach(id => showOverlay(id, false));
    const kinds = [...new Set(sessionCaught)];
    $('#overlay-bye .bye-text').innerHTML =
      `きょうは <b>${sessionCaught.length}ひき</b> つったよ！<br>ずかん ${Object.keys(save.species).length} / ${SPECIES.length + 1}`;
    $('#overlay-bye .bye-parade').innerHTML = kinds.map(id => {
      const sp = id === 'clock' ? CLOCK_FISH : SPECIES.find(s => s.id === id);
      return `<span>${artOf(sp)}</span>`;
    }).join('');
    showOverlay('#overlay-bye', true);
    Sound.say(nar('きょうも がんばったね。また あしたね！'));
  }
  $('#btn-more').onclick = () => { Sound.unlock(); startWeek(); };
  $('#btn-stop').onclick = () => bye();
  $('#btn-bye').onclick = () => { sessionCaught = []; goTitle(); };

  function goTitle(fromBack) {
    cancelAll();
    resetPlay();
    keepAwake(false);
    if (!fromBack && history.state && history.state.play) history.back();
    [...PLAY_OVERLAYS, '#overlay-bye', '#overlay-zukan', '#overlay-rank', '#overlay-cloud', '#overlay-events'].forEach(id => showOverlay(id, false));
    renderTitle();
    showScreen('screen-title');
  }

  // ---------- タイトル ----------
  const allNumbers = () => { const a = []; for (let n = -10; n <= 100; n++) a.push(n); return a; };
  function renderTitle() {
    const kinds = Object.keys(save.species).length;
    const nums = allNumbers().filter(n => save.numbers[n]).length;
    const best = save.ranking[0];
    $('#title-stats').innerHTML = `📖 さかな ${kinds}/${SPECIES.length + 1} ・ 🔢 すうじ ${nums}/111` +
      (best ? `<br>🏆 さいこう ${best.score}` : '');
    $('#zukan-count').textContent = `${kinds}/${SPECIES.length + 1}`;
    $('#events-count').textContent = (save.events || []).length ? `${save.events.length}こ` : '';
    const sea = $('#title-sea');
    if (!sea.childElementCount) {
      sea.innerHTML = `<div class="title-cat">${Art.cat()}</div><div class="title-water"><span class="rings"><i></i><i></i><i></i></span></div>` +
        ['medaka', 'kingyo', 'aji', 'nettai'].map((id, i) =>
          `<div class="tfish" style="left:${30 + i * 17}%;animation-delay:${-i * 0.9}s">${artOf({ id })}<span class="fnum">${[2, 8, 18, 45][i]}</span></div>`).join('');
    }
  }

  // ---------- ずかん ----------
  let zukanTab = 'species';
  function renderZukan() {
    const all = [...SPECIES, CLOCK_FISH];
    $('#zk-species').textContent = `${all.filter(s => save.species[s.id]).length}/${all.length}`;
    $('#zk-numbers').textContent = `${allNumbers().filter(n => save.numbers[n]).length}/111`;
    document.querySelectorAll('.ztab').forEach(b => b.classList.toggle('on', b.dataset.tab === zukanTab));
    $('#zukan-species').hidden = zukanTab !== 'species';
    $('#zukan-numbers').hidden = zukanTab !== 'numbers';
    $('#zukan-species').innerHTML = all.map(sp => {
      const n = save.species[sp.id] || 0;
      const range = sp === CLOCK_FISH ? '⏰ 2じかん' : sp.min === sp.max ? `${sp.min}` : `${sp.min}〜${sp.max}`;
      return `<button class="zk${n ? ' got' : ''}" data-id="${sp.id}"><span class="zk-art">${artOf(sp)}</span>` +
        `<b>${n ? sp.name : '？？？'}</b><small>${range}</small>${n ? `<i>×${n}</i>` : ''}</button>`;
    }).join('');
    let s = '<div class="zn-row minus">';
    for (let n = -10; n <= -1; n++) s += numCell(n);
    s += `</div><div class="zn-row">${numCell(0)}</div>`;
    for (let r = 0; r < 10; r++) {
      s += '<div class="zn-row">';
      for (let c = 1; c <= 10; c++) s += numCell(r * 10 + c);
      s += '</div>';
    }
    $('#zukan-numbers').innerHTML = s;
  }
  function numCell(n) {
    const got = save.numbers[n];
    return `<button class="zn${got ? ' got' : ''}${n < 0 ? ' neg' : ''}" data-n="${n}">${n}</button>`;
  }
  $('#zukan-species').addEventListener('click', e => {
    const b = e.target.closest('.zk.got');
    if (!b) return;
    const sp = [...SPECIES, CLOCK_FISH].find(s => s.id === b.dataset.id);
    Sound.unlock();
    Sound.hush();
    Sound.say(Keys.name(sp));
  });
  $('#zukan-numbers').addEventListener('click', e => {
    const b = e.target.closest('.zn');
    if (!b) return;
    Sound.unlock();
    Sound.hush();
    Sound.say(Keys.num(Number(b.dataset.n)));
  });
  document.querySelectorAll('.ztab').forEach(b => {
    b.onclick = () => { zukanTab = b.dataset.tab; renderZukan(); };
  });

  // ---------- ⏰ よていの じかん（せってい）----------
  const pad = n => String(n).padStart(2, '0');
  function renderEvents() {
    const list = (save.events || []).slice().sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    $('#ev-presets').innerHTML = EVENT_PRESETS.map(t => `<option value="${esc(t)}">`).join('');
    $('#ev-list').innerHTML = list.length ? list.map(e =>
      `<div class="ev-row" data-id="${e.id}"><input type="time" class="ev-time" value="${pad(e.h)}:${pad(e.m)}" min="07:00" max="23:59">` +
      `<input class="ev-label" list="ev-presets" value="${esc(e.label)}" placeholder="なんの じかん？">` +
      `<button class="ev-play" aria-label="きく">▶</button><button class="ev-del" aria-label="けす">🗑</button></div>`).join('')
      : '<p class="sempty">まだ ないよ。「＋ よていを ふやす」で いれてね</p>';
    $('#events-count').textContent = list.length ? `${list.length}こ` : '';
  }
  function saveEvent(row) {
    const e = save.events.find(x => x.id === row.dataset.id);
    if (!e) return null;
    const [h, m] = (row.querySelector('.ev-time').value || '12:00').split(':').map(Number);
    e.h = h;
    e.m = m;
    e.label = row.querySelector('.ev-label').value.trim() || EVENT_PRESETS[0];
    writeSave();
    return e;
  }
  $('#ev-list').addEventListener('change', e => {
    const row = e.target.closest('.ev-row');
    if (row) { saveEvent(row); renderEvents(); }
  });
  $('#ev-list').addEventListener('click', e => {
    const row = e.target.closest('.ev-row');
    if (!row) return;
    if (e.target.classList.contains('ev-play')) {
      const ev = saveEvent(row);
      Sound.unlock();
      Sound.hush();
      Sound.say([Keys.time(ev.h, ev.m), nar(ev.label), nar('だよ！')]);
    } else if (e.target.classList.contains('ev-del')) {
      save.events = save.events.filter(x => x.id !== row.dataset.id);
      writeSave();
      renderEvents();
    }
  });
  $('#ev-add').onclick = () => {
    const used = new Set(save.events.map(e => e.label));
    const label = EVENT_PRESETS.find(t => !used.has(t)) || EVENT_PRESETS[0];
    const at = { [EVENT_PRESETS[0]]: [8, 10], [EVENT_PRESETS[1]]: [15, 0], [EVENT_PRESETS[2]]: [17, 30] }[label] || [12, 0];
    save.events.push({ id: `e${Date.now().toString(36)}`, h: at[0], m: at[1], label });
    writeSave();
    renderEvents();
  };
  $('#btn-events').onclick = () => { renderEvents(); showOverlay('#overlay-events', true); };
  $('#events-close').onclick = () => showOverlay('#overlay-events', false);

  // ---------- ボタン ----------
  $('#btn-play').onclick = () => { Sound.unlock(); calendarNext = null; startWeek(); };
  $('#btn-zukan').onclick = () => { renderZukan(); showOverlay('#overlay-zukan', true); };
  $('#btn-zukan-close').onclick = () => showOverlay('#overlay-zukan', false);
  $('#btn-rank').onclick = () => { $('#rank-list').innerHTML = rankHTML(save.ranking); showOverlay('#overlay-rank', true); };
  $('#btn-rank-close').onclick = () => showOverlay('#overlay-rank', false);
  $('#btn-reset').onclick = () => {
    if (confirm('ずかんと ランキングを ぜんぶ けして さいしょから に しますか？')) {
      save = defaultSave();
      save.resetAt = Date.now();   // ほかの スマホにも「さいしょから」を つたえる
      writeSave();
      renderTitle();
    }
  };

  // ---------- がめんを くらく しない ----------
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* つかえない ブラウザ */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && week) keepAwake(true);
    // ほかの アプリに うつったら とめる
    if (document.visibilityState === 'hidden' && week && !paused) openPause();
  });

  // ---------- インストール（ホームがめんに ついか）----------
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    $('#btn-install').hidden = false;
  });
  $('#btn-install').onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('#btn-install').hidden = true;
  };
  window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // あたらしい ばんに かわったら、タイトルがめんの ときだけ いちど よみなおす
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded || !$('#screen-title').classList.contains('active')) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => { /* オフラインに ならないだけ */ });
  }

  // テストよう
  window.__game = {
    get save() { return save; },
    get week() { return week; },
    get day() { return day; },
    get phase() { return phase; },
  };
  window.__customLines = () => (save.events || []).map(e => e.label).filter(t => !EVENT_PRESETS.includes(t));

  renderTitle();

  // ☁️ ウェブの データと まぜる
  if (window.Cloud) {
    Cloud.attach({
      get: () => save,
      set: s => {
        save = Object.assign(defaultSave(), s);
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* むし */ }
        if ($('#screen-title').classList.contains('active')) renderTitle();
      },
    });
  }
})();
