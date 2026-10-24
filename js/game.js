// 🎣 すうじつり
//   1しゅうかん（にちようび〜どようび）さかなを つる。1にちは 6じ〜16じ（じかんざかなで のびる。さいだい 24じ）
//   ばしょを えらぶ → えさを えらぶ →「つる！」→ かかったら れんだ → 「せーの」で すうじを いう
//   さいごに バケツに のこった さかなの すうじを ゆっくり たしざん して ランキングへ
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const {
    SPECIES, CLOCK_FISH, WORM, speciesOf, byTier, WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_COLOR, funText, Keys, Sound,
  } = window;
  const SAVE_KEY = 'sujitsuri-v1';
  const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;   // テストよう（はやおくり・こえなし）
  if (SPEED > 1) Sound.muted = true;

  // ---------- ルール ----------
  const DAY_START = 6 * 60;           // あさ 6じ から
  const BASE_END = 16 * 60;           // ゆうがた 4じ（16じ）まで
  const MAX_END = 24 * 60;            // じかんざかなで のびても 1にち（24じ）まで
  const MS_PER_MIN = 1700 / 60;       // 1じかん = 1.7びょう（1しゅうかんが 5ふんくらいで おわる）
  const DAY_MAX = [10, 20, 30, 50, 70, 90, 100];   // ようびごとの いちばん おおきい すうじ（さいしょの 3にちは かんたん）
  const DAY_FLOOR = [1, 1, 1, 4, 6, 8, 10];        // あとの ようびほど、ミミズでも おおきめの さかなが よってくる（えさの だんかいの したげん）
  const SUM_MAX = 1000;               // バケツの ごうけいは どんなに がんばっても 1000 まで
  const CLOCK_MAX = 3;                // じかんざかなは 1しゅうかんに 3かい まで
  const POOL_SIZE = 7;                // およいでいる さかなの かず
  const SPOTS = [0.34, 0.6, 0.85];    // つる ばしょ（みずの はばの どこか）
  // えさの まえと うしろ 3だんかい。おおきい ほうが つれやすい
  const TIER_WEIGHT = { '-3': 0.25, '-2': 0.45, '-1': 0.8, 0: 1, 1: 1.5, 2: 1.3, 3: 0.9 };
  const JUNK_RATE = 0.1;              // マイナス（ながぐつ など）は めったに つれない

  // ---------- こえ ----------
  // nar・kid に かいた セリフは tools/voices/lines.mjs が あつめて VOICEVOX で こえに する
  const nar = t => `narr|${t}`;
  const kid = t => `kid|${t}`;

  // ---------- セーブ ----------
  function defaultSave() {
    return { species: {}, numbers: {}, ranking: [], weeks: 0 };
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
  function pickWeighted(items, weight) {
    const total = items.reduce((s, x) => s + weight(x), 0);
    let r = Math.random() * total;
    for (const x of items) {
      r -= weight(x);
      if (r <= 0) return x;
    }
    return items[items.length - 1];
  }

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
    return m ? `${h}じ ${funText(m)}` : `${h}じ`;
  };
  const spanText = (h, m) => [h ? `${h}じかん` : '', m ? funText(m) : ''].filter(Boolean).join(' ');

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
    for (let h = 6; h <= 24; h += 3) s += `<span style="left:${pos(h * 60)}">${h}</span>`;
    el.innerHTML = s + '</div>';
  }

  // ---------- さかな ----------
  function fishScale(f) {
    if (f.clock) return 1.25;
    if (f.sp.junk) return 0.85;
    if (f.n === 0) return 0.75;
    return 0.7 + 1.5 * Math.sqrt(f.n / 100);
  }
  function emojiHTML(sp) {
    return `<span class="femoji${sp.tint ? ' t-' + sp.tint : ''}${sp.gold ? ' gold' : ''}">${sp.emoji}</span>`;
  }
  // すうじ（または とけい）を せおった さかな
  function fishHTML(f) {
    const badge = f.clock
      ? clockSVG(f.clock.h * 60 + f.clock.m, 'fish-clock')
      : `<span class="fnum${f.n < 0 ? ' minus' : ''}${f.n >= 100 ? ' wide' : ''}">${f.n}</span>`;
    return `<div class="fish-in">${emojiHTML(f.sp)}${badge}</div>`;
  }

  // ---------- あそびの じょうたい ----------
  let week = null;     // { start, day, bucket, clockCaught, uid, caught }
  let day = null;      // { idx, now, end, clockAt, clockDone }
  let phase = 'off';   // spot / bait / ready / cast / mash / busy / off
  let selSpot = null;
  let selBait = null;  // 'worm' か バケツの さかなの uid
  let pool = [];       // およいでいる さかな
  let sessionCaught = [];
  let calendarNext = null;   // つぎの しゅうの にちようび（つづけて あそぶと カレンダーが すすむ）
  let hint = { said: {}, timer: 0 };

  const dateOf = i => new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate() + i);
  const bucketSum = () => week.bucket.reduce((s, f) => s + f.n, 0);
  const dayMax = () => DAY_MAX[day.idx];

  // ---------- えさ と つれる さかな ----------
  const baitOf = id => (id === 'worm' ? { ...WORM, sp: speciesOf(1), worm: true } : week.bucket.find(f => f.uid === id));
  const canBait = f => !f.sp.junk;

  // えさから つれる だんかいの おもさ（ようびと ごうけいの せいげんつき）
  function tierWeights(bait) {
    const keepSum = bucketSum() - (week.bucket.includes(bait) ? bait.n : 0);   // えさに した さかなは のこらない
    const cap = Math.min(dayMax(), SUM_MAX - keepSum);
    const bt = Math.max(bait.sp.tier, DAY_FLOOR[day.idx]);
    const out = [];
    for (let d = -3; d <= 3; d++) {
      const t = bt + d;
      if (t < -1) continue;
      const kinds = byTier(t).filter(s => s.min <= cap);
      if (!kinds.length) continue;
      out.push({ tier: t, kinds, cap, w: TIER_WEIGHT[d] * (t === -1 ? JUNK_RATE : t === 0 ? 0.5 : 1) });
    }
    // ごうけいが 1000に ちかくて なにも つれない ときは かいがら（0）
    if (!out.length) out.push({ tier: 0, kinds: byTier(0), cap: 0, w: 1 });
    return out;
  }
  function sampleNumber(bait) {
    const tw = tierWeights(bait);
    const t = pickWeighted(tw, x => x.w);
    const sp = t.kinds[randInt(0, t.kinds.length - 1)];
    return randInt(sp.min, Math.min(sp.max, t.cap < sp.min ? sp.min : t.cap));
  }
  function baitOptions() {
    return [baitOf('worm'), ...week.bucket.filter(canBait)];
  }

  // ---------- じかんざかな ----------
  // ようびが すすむと むずかしい じこくに なる
  function clockTime(cap) {
    const d = day.idx;
    const maxH = Math.min([2, 2, 3, 4, 4, 5, 6][d], Math.floor(cap / 60));
    if (maxH < 1) return null;
    const step = [0, 0, 30, 15, 15, 5, 1][d];
    for (let i = 0; i < 20; i++) {
      const h = randInt(1, maxH);
      const m = step ? randInt(0, Math.floor(59 / step)) * step : 0;
      if (h * 60 + m <= cap) return { h, m };
    }
    return { h: 1, m: 0 };
  }

  // ---------- およぐ さかな ----------
  const water = $('#water');
  const poolEl = $('#pool');
  let geo = { w: 300, h: 300, top: 0, left: 0 };
  function layout() {
    geo = { w: water.clientWidth, h: water.clientHeight, top: water.offsetTop, left: water.offsetLeft };
    const sc = $('#scene').getBoundingClientRect();
    const kidR = $('#fisher .kid').getBoundingClientRect();
    geo.rod = { x: kidR.right - sc.left - kidR.width * 0.15, y: kidR.top - sc.top + kidR.height * 0.55 };
    geo.tip = { x: geo.rod.x + Math.min(90, geo.w * 0.2), y: geo.rod.y - Math.min(70, geo.h * 0.18) };
    geo.base = Math.max(24, Math.min(46, Math.min(geo.h * 0.085, geo.w * 0.08)));
    pool.forEach(f => sizeFish(f));
  }
  window.addEventListener('resize', layout);

  function sizeFish(f) {
    f.el.style.fontSize = `${(geo.base * fishScale(f)).toFixed(1)}px`;
  }

  let uid = 0;
  function makeFish(n, { clock = null, edge = false, x = null } = {}) {
    const sp = clock ? CLOCK_FISH : speciesOf(n);
    const f = { uid: ++uid, n: clock ? null : n, sp, clock, state: 'swim', phase: rand(0, 6) };
    f.el = document.createElement('div');
    f.el.className = 'fish' + (clock ? ' clockfish' : '');
    f.el.innerHTML = fishHTML(f);
    sizeFish(f);
    const sp0 = rand(0.025, 0.05) * (0.6 + 0.6 / fishScale(f));
    f.y = rand(0.22, 0.9) * geo.h;
    if (edge) {
      const left = Math.random() < 0.5;
      f.x = left ? -geo.base * 2 : geo.w + geo.base * 2;
      f.vx = left ? sp0 : -sp0;
    } else {
      f.x = x != null ? x : rand(0.08, 0.92) * geo.w;
      f.vx = Math.random() < 0.5 ? sp0 : -sp0;
    }
    f.baseY = f.y;
    poolEl.appendChild(f.el);
    pool.push(f);
    placeFish(f);
    return f;
  }
  function placeFish(f) {
    f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) translate(-50%, -50%)`;
    f.el.classList.toggle('right', f.vx > 0);
  }
  function removeFish(f) {
    pool = pool.filter(x => x !== f);
    f.el.remove();
  }
  function spawnRandom(opts) {
    const opt = baitOptions();
    return makeFish(sampleNumber(opt[randInt(0, opt.length - 1)]), opts);
  }
  function fillPool(spread) {
    let i = 0;
    while (pool.filter(f => !f.clock).length < POOL_SIZE) {
      spawnRandom(spread ? { x: ((i++ + 0.5) / POOL_SIZE + rand(-0.04, 0.04)) * geo.w } : { edge: true });
    }
  }
  function clearPool() {
    pool.forEach(f => f.el.remove());
    pool = [];
  }

  function moveFish(dt) {
    for (const f of pool) {
      if (f.state === 'swim' || f.state === 'leave') {
        f.x += f.vx * dt;
        f.phase += dt * 0.002;
        f.y = f.baseY + Math.sin(f.phase) * geo.h * 0.03;
        if (f.state === 'swim') {
          if ((f.x < geo.w * 0.04 && f.vx < 0) || (f.x > geo.w * 0.96 && f.vx > 0)) f.vx = -f.vx;
        } else if (f.x < -geo.base * 3 || f.x > geo.w + geo.base * 3) {
          f.gone = true;
        }
      }
      placeFish(f);
    }
    pool.filter(f => f.gone).forEach(removeFish);
  }

  // ---------- がめんの ようす（そら・とけい） ----------
  const SKY = [
    [6 * 60, '#ffb48f', '#ffe2c4', '#5cc4e8', '#2f8fc8'],
    [8 * 60, '#7fcaff', '#d6f1ff', '#4cc0f0', '#1f7fc0'],
    [15 * 60, '#7fcaff', '#d6f1ff', '#4cc0f0', '#1f7fc0'],
    [16 * 60, '#ffb877', '#ffe6b8', '#4cb4e6', '#1c74b4'],
    [17 * 60, '#ff8f5e', '#ffd39a', '#4aa8d8', '#1c6aa8'],
    [18.5 * 60, '#5e4b8b', '#f49b86', '#3a7fb5', '#164b80'],
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
    scene.classList.toggle('night', t >= 19 * 60);
    const sun = $('#sun');
    const night = t >= 18.5 * 60;
    sun.textContent = night ? '🌙' : '☀️';
    const p = night ? Math.min(1, (t - 18.5 * 60) / (5 * 60)) : Math.min(1, (t - DAY_START) / (12.5 * 60));
    sun.style.left = `${28 + p * 64}%`;
    sun.style.top = `${70 - Math.sin(p * Math.PI) * 55}%`;
  }

  let shownMin = -1;
  function renderTime(force) {
    const now = Math.floor(day.now);
    if (!force && now === shownMin) return;
    const slow = force || Math.floor(now / 5) !== Math.floor(shownMin / 5);
    shownMin = now;
    setClock($('#hud-clock svg'), now);
    $('#hud-now').textContent = timeText(now);
    if (!slow) return;
    $('#hud-end').textContent = `🏁 ${timeText(day.end)} まで`;
    renderTimeline($('#timeline'), now, day.end);
    paintSky(now);
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
    renderTime(true);
  }

  // ---------- えさ ----------
  function renderBaits() {
    const list = [baitOf('worm'), ...[...week.bucket].sort((a, b) => a.n - b.n)];
    $('#baits').innerHTML = list.map(f => {
      const id = f.worm ? 'worm' : f.uid;
      const off = !f.worm && !canBait(f);
      return `<button class="bait${String(selBait) === String(id) ? ' on' : ''}${off ? ' off' : ''}" data-id="${id}"${off ? ' disabled' : ''}>` +
        `${f.worm ? `<span class="femoji">${WORM.emoji}</span>` : emojiHTML(f.sp)}<b class="${f.n < 0 ? 'minus' : ''}">${f.n}</b>` +
        `${f.worm ? '<small>ミミズ</small>' : ''}</button>`;
    }).join('');
    $('#bucket-count').textContent = `🪣 ${week.bucket.length}ひき`;
  }
  $('#baits').addEventListener('click', e => {
    const b = e.target.closest('.bait');
    if (!b || b.disabled || !['spot', 'bait', 'ready'].includes(phase)) return;
    Sound.tap();
    selBait = b.dataset.id === 'worm' ? 'worm' : Number(b.dataset.id);
    renderBaits();
    nextStep();
  });

  // ---------- ばしょ ----------
  function renderSpots() {
    $('#spots').innerHTML = SPOTS.map((x, i) => {
      const l = i === 0 ? 0.18 : (SPOTS[i - 1] + x) / 2;
      const r = i === SPOTS.length - 1 ? 1 : (SPOTS[i + 1] + x) / 2;
      return `<button class="spot${selSpot === i ? ' on' : ''}" data-i="${i}" style="left:${l * 100}%;width:${(r - l) * 100}%" aria-label="ここで つる">` +
        `<span class="ring" style="left:${((x - l) / (r - l)) * 100}%"></span></button>`;
    }).join('');
  }
  $('#spots').addEventListener('click', e => {
    const b = e.target.closest('.spot');
    if (!b || !['spot', 'bait', 'ready'].includes(phase)) return;
    Sound.plop();
    selSpot = Number(b.dataset.i);
    renderSpots();
    nextStep();
  });

  // ---------- てじゅんの あんない ----------
  const GUIDE = {
    spot: { text: '👇 どこで つる？', voice: nar('どこで つる？ ゆびで えらんでね') },
    bait: { text: '👇 えさは どれ？', voice: nar('えさは どれに する？') },
    ready: { text: '👇「つる！」を おしてね', voice: nar('「つる！」ボタンを おしてね') },
  };
  function nextStep() {
    if (!['spot', 'bait', 'ready'].includes(phase)) return;
    phase = selSpot == null ? 'spot' : selBait == null || !baitOf(selBait) ? 'bait' : 'ready';
    if (selBait != null && !baitOf(selBait)) selBait = null;
    const scene = $('#scene');
    scene.classList.toggle('want-spot', phase === 'spot');
    $('.dock').classList.toggle('want-bait', phase === 'bait');
    $('#btn-fish').classList.toggle('want', phase === 'ready');
    $('#btn-fish').disabled = phase !== 'ready';
    $('#guide').textContent = GUIDE[phase].text;
    $('#guide').className = 'guide show g-' + phase;
    // はじめの ころは こえで あんない。なれてきたら しばらく まよった ときだけ
    clearTimeout(hint.timer);
    const said = hint.said[phase] || 0;
    if (said < (phase === 'spot' ? 1 : 2)) {
      hint.said[phase] = said + 1;
      Sound.hush();
      Sound.say(GUIDE[phase].voice);
    }
    const my = epoch, ph = phase;
    hint.timer = setTimeout(() => {
      if (my === epoch && phase === ph && !paused) Sound.say(GUIDE[ph].voice);
    }, 7000 / SPEED);
  }
  function hideGuide() {
    clearTimeout(hint.timer);
    $('#guide').className = 'guide';
    $('#scene').classList.remove('want-spot');
    $('.dock').classList.remove('want-bait');
    $('#btn-fish').classList.remove('want');
    $('#btn-fish').disabled = true;
  }

  function catSay(text, ms = 1600) {
    const el = $('#cat-say');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(catSay.t);
    catSay.t = setTimeout(() => el.classList.remove('show'), ms / SPEED);
  }

  // ---------- いと と うき ----------
  const line = { on: false, bob: null, hook: null, fish: null };
  function drawLine() {
    const svg = $('#line');
    const r = geo.rod, t = geo.tip;
    let s = `<line class="rod" x1="${r.x}" y1="${r.y}" x2="${t.x}" y2="${t.y}"/>`;
    if (line.on && line.bob) {
      const b = line.bob;
      const mx = (t.x + b.x) / 2, my = Math.max(t.y, b.y) + 18;
      s += `<path class="string" d="M${t.x} ${t.y} Q${mx} ${my} ${b.x} ${b.y}"/>`;
      if (line.hook) {
        const h = line.fish ? { x: geo.left + line.fish.x, y: geo.top + line.fish.y } : line.hook;
        s += `<line class="string" x1="${b.x}" y1="${b.y}" x2="${h.x}" y2="${h.y}"/>`;
      }
      const bob = $('#bobber');
      bob.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -60%)`;
    }
    svg.innerHTML = s;
  }

  // ---------- つる ----------
  $('#btn-fish').onclick = () => {
    if (phase !== 'ready') return;
    Sound.unlock();
    cast().catch(ignoreCancel);
  };

  async function cast() {
    const bait = baitOf(selBait);
    const spot = selSpot;
    phase = 'cast';
    hideGuide();
    Sound.hush();
    // えさに した さかなは バケツから でる
    if (!bait.worm) week.bucket = week.bucket.filter(f => f !== bait);
    selBait = null;
    renderBaits();
    const sx = geo.left + SPOTS[spot] * geo.w;
    const sy = geo.top + 4;
    Sound.cast();
    catSay('えいっ！', 900);
    line.on = true;
    line.hook = null;
    line.fish = null;
    $('#bobber').hidden = false;
    $('#bobber').className = 'bobber';
    const t0 = geo.tip;
    await tween(550, k => {
      line.bob = { x: t0.x + (sx - t0.x) * k, y: t0.y + (sy - t0.y) * k - Math.sin(k * Math.PI) * 60 };
    }, linear);
    Sound.plop();
    line.hook = { x: sx, y: geo.top + geo.h * 0.42 };
    await sleep(500);

    // どの さかなが くいつくか
    const f = chooseBiter(bait, sx - geo.left);
    f.state = 'come';
    const hx = sx - geo.left, hy = geo.h * 0.42;
    const fx = f.x, fy = f.y;
    f.vx = hx > fx ? 1 : -1;
    const dist = Math.hypot(hx - fx, hy - fy);
    await tween(Math.max(900, Math.min(2200, dist * 5)), k => {
      f.x = fx + (hx - fx) * k;
      f.y = fy + (hy - fy) * k;
    });
    f.state = 'hooked';
    line.fish = f;
    // つんつん … ぐいっ！
    for (let i = 0; i < 2; i++) {
      $('#bobber').classList.add('nibble');
      Sound.plop();
      await sleep(380);
      $('#bobber').classList.remove('nibble');
      await sleep(rand(250, 550));
    }
    $('#bobber').classList.add('sink');
    Sound.bite();
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    catSay('かかった！');
    Sound.say(kid('かかったのだ！'));
    await mash(f);
  }

  function chooseBiter(bait, spotX) {
    const near = f => Math.abs(f.x - spotX) < geo.w * 0.22;
    const swim = pool.filter(f => f.state === 'swim');
    const cf = swim.find(f => f.clock);
    if (cf && Math.random() < (near(cf) ? 0.55 : 0.1)) return cf;
    const tw = tierWeights(bait);
    const cands = swim.filter(f => !f.clock && tw.some(t => t.tier === f.sp.tier && f.n <= t.cap));
    if (cands.length && Math.random() > 0.2) {
      return pickWeighted(cands, f => tw.find(t => t.tier === f.sp.tier).w * (near(f) ? 4 : 1));
    }
    // とおくから あたらしい さかなが やってくる
    const nf = makeFish(sampleNumber(bait), { edge: true });
    nf.x = spotX < geo.w / 2 ? -geo.base * 2 : geo.w + geo.base * 2;
    return nf;
  }

  // れんだ で ひきあげる
  function mash(f) {
    phase = 'mash';
    const need = f.clock ? 7 : f.sp.junk ? 3 : 4 + Math.round(Math.max(0, f.sp.tier) * 0.55);
    let got = 0;
    const box = $('#mash');
    box.hidden = false;
    $('#mash-fill').style.width = '0%';
    const hookY = f.y;
    const my = epoch;
    return new Promise((res, rej) => {
      const onTap = e => {
        if (my !== epoch) { cleanup(); return rej(CANCEL); }
        if (paused || e.target.closest('#btn-home')) return;
        e.preventDefault();
        got++;
        const k = Math.min(1, got / need);
        $('#mash-fill').style.width = `${k * 100}%`;
        Sound.reel(k);
        f.y = hookY - (hookY - geo.h * 0.06) * k;
        f.el.classList.remove('tug');
        void f.el.offsetWidth;
        f.el.classList.add('tug');
        if (got === Math.ceil(need / 2)) Sound.say(kid('がんばるのだ！'));
        if (got >= need) {
          cleanup();
          res(landed(f));
        }
      };
      const cleanup = () => {
        $('#scene').removeEventListener('pointerdown', onTap);
        box.hidden = true;
      };
      $('#scene').addEventListener('pointerdown', onTap);
      window.__mashTap = () => onTap({ target: $('#scene'), preventDefault() {} });   // テストよう
    });
  }

  async function landed(f) {
    phase = 'busy';
    Sound.splash();
    line.fish = null;
    line.on = false;
    $('#bobber').hidden = true;
    f.el.classList.add('jump');
    await sleep(450);
    removeFish(f);
    if (f.clock) await revealClock(f);
    else await revealFish(f);
    afterCatch();
  }

  // ---------- つれた！ ----------
  function showCatch(f) {
    const ov = $('#overlay-catch');
    ov.classList.remove('is-new', 'named', 'said', 'junk', 'gold');
    $('#catch-fish').innerHTML = fishHTML(f);
    $('#catch-fish').style.fontSize = `${Math.min(150, 70 + (f.clock ? 50 : Math.max(0, f.n)) * 0.8)}px`;
    $('#catch-num').innerHTML = f.clock ? '' : `<span class="${f.n < 0 ? 'minus' : ''}">${f.n}</span>`;
    $('#catch-name').textContent = f.sp.name;
    $('#catch-say').textContent = '🗣️ せーの！';
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
    await talk(f.sp.junk ? kid('なんか へんなの つれたのだ…') : kid('つれたのだー！'));
    await talk(nar('なんの すうじの さかなかな？ いってみよう。せーの！'));
    ov.classList.add('wait');
    await sleep(1600);
    ov.classList.remove('wait');
    ov.classList.add('said');
    await talk(Keys.num(f.n));
    ov.classList.add('named');
    await talk(Keys.caught(f.sp));
    if (isNew) {
      ov.classList.add('is-new');
      Sound.newOne();
      await talk(nar('あたらしい なかまだ！ ずかんに のったよ'));
      if (f.sp.junk) await talk(nar('マイナスは ゼロより ちいさい すうじだよ'));
    }
    await sleep(500);
    showOverlay('#overlay-catch', false);
    week.bucket.push(f);
    renderBaits();
    const chip = $(`#baits .bait[data-id="${f.uid}"]`);
    if (chip) chip.classList.add('pop');
    if (!save.hintSeen && !f.sp.junk) {
      save.hintSeen = true;
      writeSave();
      await talk(nar('つった さかなは えさに できるよ。おおきい すうじの えさだと、おおきい さかなが つれるよ'));
    }
  }

  async function revealClock(f) {
    record(f);
    const ov = $('#overlay-catch');
    showCatch(f);
    $('#catch-num').textContent = '';
    Sound.big();
    await talk(kid('つれたのだー！'));
    ov.classList.add('named');
    await talk(nar('じかんざかなだ！'));
    await talk(nar('なんじ なんぷんかな？ いってみよう。せーの！'));
    ov.classList.add('wait');
    await sleep(1600);
    ov.classList.remove('wait');
    ov.classList.add('said');
    $('#catch-num').textContent = timeText(f.clock.h * 60 + f.clock.m);
    await talk(Keys.time(f.clock.h, f.clock.m));
    await sleep(400);
    showOverlay('#overlay-catch', false);
    await extendTime(f.clock.h, f.clock.m);
  }

  // じかんざかなで おわりの じかんが のびる（ズームして ゆっくり）
  async function extendTime(h, m) {
    const from = day.end;
    const add = Math.min(h * 60 + m, MAX_END - from);
    const ov = $('#overlay-time');
    $('#time-title').innerHTML = `⏰ ${timeText(h * 60 + m)} の じかんざかな`;
    $('#time-clock').innerHTML = clockSVG(from, 'big-clock', { ticks: true }) + '<div class="tc-label">🏁 おわりの じかん</div>';
    const svg = $('#time-clock svg');
    const show = cur => {
      setClock(svg, cur);
      $('#time-digital').innerHTML = `<span class="td-from">${timeText(from)}</span> → <b>${timeText(cur)}</b>`;
      const [ah, am] = hm(cur - from);
      $('#time-plus').textContent = cur > from ? `＋ ${spanText(ah, am)}` : '';
      renderTimeline($('#time-line'), day.now, cur, { added: cur - from });
    };
    show(from);
    showOverlay('#overlay-time', true);
    ov.classList.add('zoom');
    Sound.tick();
    await talk(Keys.time(h, m), nar('の さかなだったから'));
    await sleep(300);
    // 1じかんずつ（ながい はりが ひとまわり）
    for (let i = 1; i <= h && (i - 1) * 60 < add; i++) {
      const a = from + (i - 1) * 60;
      const b = Math.min(from + add, from + i * 60);
      let lastTick = -1;
      await tween(1400, k => {
        const cur = a + (b - a) * k;
        show(cur);
        const tk = Math.floor(cur / 5);
        if (tk !== lastTick) { lastTick = tk; Sound.tick(); }
      }, linear);
      Sound.hourChime(i);
      await talk(Keys.jikan(i));
    }
    // のこりの ふん
    if (m && h * 60 < add) {
      const a = from + h * 60;
      let lastTick = -1;
      await tween(Math.max(900, m * 45), k => {
        const cur = a + m * k;
        show(cur);
        const tk = Math.floor(cur);
        if (tk !== lastTick) { lastTick = tk; Sound.tick(); }
      }, linear);
      Sound.ding(2);
      await talk(Keys.fun(m));
    }
    day.end = from + add;
    week.clockCaught++;
    renderHud();
    Sound.fanfare();
    await talk(Keys.span(h, m), nar('のびた！'));
    const [eh, em] = hm(day.end);
    await talk(nar('おわりの じかんが'), Keys.time(eh, em), nar('に なったよ！'));
    await sleep(500);
    ov.classList.remove('zoom');
    showOverlay('#overlay-time', false);
  }

  function afterCatch() {
    if (!week) return;
    fillPool(false);
    phase = 'spot';
    if (day.now >= day.end) {
      endDay().catch(ignoreCancel);
      return;
    }
    selSpot = null;
    selBait = null;
    renderSpots();
    renderBaits();
    nextStep();
  }

  // ---------- まいにちの ながれ ----------
  let loopLast = 0;
  let swapAt = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(100, now - (loopLast || now)) * SPEED;
    loopLast = now;
    if (!week || !day || paused) return;
    if (!$('#screen-play').classList.contains('active')) return;
    moveFish(dt);
    drawLine();
    if (['spot', 'bait', 'ready', 'cast', 'mash'].includes(phase)) {
      day.now = Math.min(day.end, day.now + dt / MS_PER_MIN);
      renderTime();
      // じかんざかなが やってくる（1にち 1ぴき まで・1しゅうかんに 3びき まで）
      if (!day.clockDone && day.now >= day.clockAt && week.clockCaught < CLOCK_MAX) {
        day.clockDone = true;
        const c = clockTime(MAX_END - day.end);
        if (c) makeFish(null, { clock: c, edge: true });
      }
      // ときどき さかなが いれかわる
      if (now > swapAt) {
        swapAt = now + 6000 / SPEED;
        const out = pool.filter(f => f.state === 'swim' && !f.clock);
        if (out.length >= POOL_SIZE) {
          out[randInt(0, out.length - 1)].state = 'leave';
          spawnRandom({ edge: true });
        }
      }
      if (day.now >= day.end && ['spot', 'bait', 'ready'].includes(phase)) endDay().catch(ignoreCancel);
    }
  }
  requestAnimationFrame(loop);

  function startDay(idx) {
    day = {
      idx, now: DAY_START, end: BASE_END,
      // じかんざかなは 8じ〜12じ ごろに でてくる（でない ひも ある）
      clockAt: Math.random() < 0.8 ? randInt(8 * 60, 12 * 60) : Infinity,
      clockDone: false,
    };
    shownMin = -1;
    clearPool();
    layout();
    fillPool(true);
    renderHud();
    renderBaits();
    selSpot = null;
    selBait = null;
    renderSpots();
    phase = 'spot';
    nextStep();
  }

  async function endDay() {
    if (phase === 'busy' || phase === 'off') return;
    phase = 'busy';
    hideGuide();
    selSpot = null;
    renderSpots();
    Sound.hush();
    Sound.sunset();
    const [h, m] = hm(day.end);
    catSay(`${timeText(day.end)}！`, 2500);
    await talk(Keys.time(h, m), nar('に なったよ。きょうの つりは おしまい！'));
    pool.forEach(f => { f.state = 'leave'; f.vx = (f.x < geo.w / 2 ? -1 : 1) * 0.12; });
    await sleep(900);
    if (day.idx >= 6) await weekEnd();
    else {
      await showDay(day.idx, day.idx + 1);
      startDay(day.idx + 1);
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
    $('#day-note').textContent = `🐟 きょうは ${DAY_MAX[idx]} までの さかなが いるよ`;
    await talk(nar('きょうは'), Keys.num(DAY_MAX[idx]), nar('までの さかなが いるよ'));
    if (idx === 0) {
      $('#day-note').textContent += `\n⏰ ${timeText(DAY_START)} から ${timeText(BASE_END)} まで`;
      await talk(Keys.ji(6), nar('から'), Keys.ji(16), nar('まで つれるよ！'));
    }
    await sleep(500);
    showOverlay('#overlay-day', false);
  }

  // ---------- 1しゅうかんの おわり: たしざん ----------
  async function weekEnd() {
    phase = 'busy';
    clearPool();
    await showDay(6, 7);
    const fish = week.bucket;
    $('#sum-fish').innerHTML = fish.map((f, i) =>
      `<div class="sf" data-i="${i}">${emojiHTML(f.sp)}<b class="${f.n < 0 ? 'minus' : ''}">${f.n}</b></div>`).join('');
    $('#sum-eq').innerHTML = '';
    $('#sum-total').innerHTML = '';
    $('#sum-rank').innerHTML = '';
    $('#sum-ask').classList.remove('show');
    showOverlay('#overlay-sum', true);
    let total = 0;
    if (!fish.length) {
      await talk(nar('バケツが からっぽ…'));
    } else {
      await talk(nar('いっしゅうかん おつかれさま！ のこった さかなを たしざん しよう！'));
    }
    const cards = $('#sum-fish').querySelectorAll('.sf');
    const eq = $('#sum-eq');
    const sign = n => (n < 0 ? `<span class="minus">${n}</span>` : n);
    for (let i = 0; i < fish.length; i++) {
      const n = fish[i].n;
      cards.forEach(c => c.classList.remove('now'));
      cards[i].classList.add('now');
      cards[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (i === 0) {
        total = n;
        eq.innerHTML = `<b>${sign(n)}</b>`;
        await talk(nar('まずは'), Keys.num(n));
      } else {
        const prev = total;
        total += n;
        eq.innerHTML = `${sign(prev)} <i>${n < 0 ? '−' : '＋'}</i> ${Math.abs(n)} <i>＝</i> <b class="q">？</b>`;
        await talk(Keys.num(prev), nar(n < 0 ? 'ひく' : 'たす'), Keys.num(Math.abs(n)));
        await sleep(700);
        eq.innerHTML = `${sign(prev)} <i>${n < 0 ? '−' : '＋'}</i> ${Math.abs(n)} <i>＝</i> <b>${sign(total)}</b>`;
        Sound.ding(i);
        await talk(nar('は'), Keys.num(total));
      }
      cards[i].classList.remove('now');
      cards[i].classList.add('added');
      $('#sum-total').innerHTML = `ごうけい <b>${sign(total)}</b>`;
      await sleep(300);
    }
    cards.forEach(c => c.classList.remove('now'));
    $('#sum-total').innerHTML = `ごうけい <b>${sign(total)}</b>`;
    eq.innerHTML = `ぜんぶで <b>${sign(total)}</b>`;
    Sound.fanfare();
    confetti($('#overlay-sum'));
    await talk(nar('ぜんぶで'), Keys.num(total), nar('に なったよ！'));

    // ランキング
    const entry = { score: total, at: Date.now(), fish: fish.length, best: fish.reduce((b, f) => Math.max(b, f.n), -99) };
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
        `<b class="rk-score">${r.score}</b><span class="rk-fish">${best ? best.emoji : ''} ${r.fish}ひき</span>` +
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
    week = { start, bucket: [], clockCaught: 0, caught: 0 };
    hint = { said: {}, timer: 0 };
    day = { idx: 0, now: DAY_START, end: BASE_END, clockAt: Infinity, clockDone: true };
    phase = 'busy';
    ['#overlay-sum', '#overlay-bye', '#overlay-pause'].forEach(id => showOverlay(id, false));
    $('#hud-clock').innerHTML = '';
    showScreen('screen-play');
    keepAwake(true);
    if (!history.state || !history.state.play) history.pushState({ play: true }, '');
    clearPool();
    layout();
    renderHud();
    renderBaits();
    renderSpots();
    try {
      await showDay(null, 0);
      startDay(0);
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
    if (['spot', 'bait', 'ready'].includes(phase)) nextStep();
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

  function bye() {
    cancelAll();
    week = null;
    phase = 'off';
    calendarNext = null;
    clearPool();
    ['#overlay-sum', '#overlay-pause', '#overlay-catch', '#overlay-time', '#overlay-day'].forEach(id => showOverlay(id, false));
    const kinds = [...new Set(sessionCaught)];
    $('#overlay-bye .bye-text').innerHTML =
      `きょうは <b>${sessionCaught.length}ひき</b> つったよ！<br>ずかん ${Object.keys(save.species).length} / ${SPECIES.length + 1}`;
    $('#overlay-bye .bye-parade').innerHTML = kinds.map(id => {
      const sp = id === 'clock' ? CLOCK_FISH : SPECIES.find(s => s.id === id);
      return `<span>${emojiHTML(sp)}</span>`;
    }).join('');
    showOverlay('#overlay-bye', true);
    Sound.say(nar('きょうも がんばったね。また あしたね！'));
  }
  $('#btn-more').onclick = () => { Sound.unlock(); startWeek(); };
  $('#btn-stop').onclick = () => bye();
  $('#btn-bye').onclick = () => { sessionCaught = []; goTitle(); };

  function goTitle(fromBack) {
    cancelAll();
    week = null;
    phase = 'off';
    keepAwake(false);
    clearPool();
    line.on = false;
    $('#bobber').hidden = true;
    $('#mash').hidden = true;
    if (!fromBack && history.state && history.state.play) history.back();
    ['#overlay-sum', '#overlay-bye', '#overlay-pause', '#overlay-catch', '#overlay-time', '#overlay-day', '#overlay-zukan', '#overlay-rank', '#overlay-cloud']
      .forEach(id => showOverlay(id, false));
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
    const sea = $('#title-sea');
    if (!sea.childElementCount) {
      const show = [SPECIES[4], SPECIES[6], SPECIES[11], SPECIES[9], SPECIES[19], SPECIES[20]];
      sea.innerHTML = show.map((sp, i) =>
        `<div class="tfish" style="top:${12 + (i * 37) % 70}%;animation-delay:${-i * 2.3}s;animation-duration:${12 + i * 2}s;font-size:${26 + i * 5}px">` +
        `${emojiHTML(sp)}<span class="fnum">${[2, 8, 33, 23, 90, 97][i]}</span></div>`).join('');
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
      const range = sp === CLOCK_FISH ? '⏰' : sp.min === sp.max ? `${sp.min}` : `${sp.min}〜${sp.max}`;
      return `<button class="zk${n ? ' got' : ''}" data-id="${sp.id}">${emojiHTML(sp)}` +
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
    return `<button class="zn${got ? ' got' : ''}${n < 0 ? ' neg' : ''}" data-n="${n}">${got ? `<span class="zn-e">${speciesOf(n).emoji}</span>` : ''}${n}</button>`;
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
    get pool() { return pool; },
    tierWeights: b => tierWeights(b),
  };

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
