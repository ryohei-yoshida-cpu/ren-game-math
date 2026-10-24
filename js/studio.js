// 🎙 こえの スタジオ
//   ・ぜんぶの セリフを やくごとに ならべて、1つずつ ろくおん（● → ■）できる
//   ・「LINEで たのむ」: えらんだ セリフの ろくおんを、リンクで ともだちに おねがいする
//   ・おねがいの リンク（#koe=...）を ひらくと、その セリフだけの ろくおん がめんに なる
//   ・「おくる」: とった こえを こえパック（.pdf）に して LINE などで おくる
//   ・「よみこむ」: もらった こえパックを いれる
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const { Sound, VoiceBox } = window;
  const ov = $('#overlay-studio');
  const list = $('#studio-list');
  const msg = $('#studio-msg');
  const NAME_KEY = 'sujitsuri-voice-name';

  const ROLES = [
    { who: 'narr', name: 'ナレーション' },
    { who: 'kid', name: 'ねこ' },
    { who: 'num', name: 'すうじ' },
    { who: 'time', name: 'とけい' },
    { who: 'cal', name: 'カレンダー' },
  ];
  const ORIGINAL = { narr: '春日部つむぎ', kid: 'ずんだもん', num: '春日部つむぎ', time: '春日部つむぎ', cal: '春日部つむぎ' };

  let lines = [];          // { key, who, text, id }
  let tab = 'narr';
  let request = null;      // おねがい モード: { ids:Set, from }
  const picked = new Set();
  let recording = null;    // { key, ctl, btn }

  async function loadLines() {
    if (lines.length) return;
    await Sound.indexReady;
    let idx = Sound.voiceIndex();
    if (!idx) idx = await (await fetch('audio/voice/index.json')).json();
    lines = Object.entries(idx).filter(([k]) => k !== '_v').map(([key, file]) => {
      const i = key.indexOf('|');
      return { key, who: key.slice(0, i), text: key.slice(i + 1), id: file.replace(/\.mp3$/, '') };
    });
  }

  function myName() {
    return $('#studio-name').value.trim();
  }
  function say(t) {
    msg.textContent = t;
    msg.classList.remove('pop');
    void msg.offsetWidth;
    msg.classList.add('pop');
  }

  // ---- がめん ----
  function visible() {
    if (request) return lines.filter(l => request.ids.has(l.id));
    const q = $('#studio-search').value.trim();
    if (q) return lines.filter(l => l.text.includes(q));
    return lines.filter(l => l.who === tab);
  }

  function renderTabs() {
    $('#studio-tabs').innerHTML = ROLES.map(r => {
      const all = lines.filter(l => l.who === r.who);
      const mine = all.filter(l => VoiceBox.recorded(l.key)).length;
      return `<button class="stab${r.who === tab ? ' on' : ''}" data-who="${r.who}">${r.name}<small>${mine}/${all.length}</small></button>`;
    }).join('');
    $('#studio-tabs').querySelectorAll('.stab').forEach(b => {
      b.onclick = () => { tab = b.dataset.who; $('#studio-search').value = ''; render(); };
    });
  }

  function rowHTML(l) {
    const mine = VoiceBox.recorded(l.key);
    let who = mine ? `🎙 ${VoiceBox.by(l.key) || 'じぶん'} の こえ` : `もとの こえ（${ORIGINAL[l.who]}）`;
    if (request || $('#studio-search').value.trim()) who = `${(ROLES.find(r => r.who === l.who) || {}).name} ・ ${who}`;
    return `<div class="srow${mine ? ' mine' : ''}" data-key="${encodeURIComponent(l.key)}">` +
      (request ? '' : `<input type="checkbox" class="sr-pick" aria-label="えらぶ"${picked.has(l.key) ? ' checked' : ''}>`) +
      `<div class="sr-text">${l.text.replace(/</g, '&lt;')}<small>${who}</small></div>` +
      `<button class="sr-play" aria-label="きく">▶</button>` +
      `<button class="sr-rec" aria-label="ろくおん">●</button>` +
      `<button class="sr-reset" aria-label="もとに もどす"${mine ? '' : ' hidden'}>↺</button></div>`;
  }

  function render() {
    renderTabs();
    $('#studio-tabs').hidden = !!request;
    $('#studio-search').hidden = !!request;
    $('#studio-ask').hidden = !!request;
    const rows = visible();
    list.innerHTML = rows.map(rowHTML).join('') || '<p class="sempty">セリフが ないよ</p>';
    if (request) {
      const done = rows.filter(l => VoiceBox.recorded(l.key)).length;
      $('#studio-request').innerHTML =
        `📨 <b>${(request.from || 'ともだち').replace(/</g, '&lt;')}</b> から こえの おねがい！<br>ぜんぶで ${rows.length}こ（とった: ${done}こ）。🔴を おして よみあげてね`;
      $('#studio-send').textContent = `✅ できた！ おくりかえす（${done}こ）`;
    } else {
      $('#studio-send').textContent = `📤 とった こえを おくる（${VoiceBox.keys().length}こ）`;
      $('#studio-ask').textContent = `📨 えらんだ セリフを LINEで たのむ（${picked.size}こ）`;
    }
  }

  // ---- ろくおん ----
  async function startRec(l, btn) {
    if (recording) return;
    Sound.hush();
    recording = { key: l.key, pending: true };   // マイクが じゅんびできるまで ほかの ボタンは きかない
    try {
      const ctl = await VoiceBox.record();
      recording = { key: l.key, ctl, btn };
      btn.textContent = '■';
      btn.classList.add('on');
      btn.closest('.srow').classList.add('recording');
      say('🔴 ろくおんちゅう… よみおわったら ■ を おしてね');
      ctl.stopped.then(() => { if (recording && recording.ctl === ctl) stopRec(); });
    } catch (e) {
      recording = null;
      say(/unsupported/.test(e.message)
        ? 'この ブラウザでは ろくおん できないよ'
        : 'マイクが つかえないよ。LINEの なかで ひらいている ときは「ブラウザで ひらく」を えらんでね');
    }
  }
  async function stopRec() {
    const r = recording;
    if (!r || r.pending) return;
    recording = null;
    try {
      const wav = await r.ctl.stop();
      await VoiceBox.put(r.key, wav, myName() || 'じぶん');
      say('とれたよ！');
      Sound.say(r.key);
    } catch (e) {
      say(e.message === 'quiet' ? 'こえが きこえなかったよ。もういちど やってみてね' : 'うまく とれなかったよ。もういちど やってみてね');
    }
    render();
  }

  list.addEventListener('click', e => {
    const row = e.target.closest('.srow');
    if (!row) return;
    const key = decodeURIComponent(row.dataset.key);
    const l = lines.find(x => x.key === key);
    if (e.target.classList.contains('sr-play')) {
      Sound.unlock();
      Sound.hush();
      Sound.say(key);
    } else if (e.target.classList.contains('sr-rec')) {
      Sound.unlock();
      if (recording && recording.key === key) stopRec();
      else if (!recording) startRec(l, e.target);
    } else if (e.target.classList.contains('sr-reset')) {
      if (confirm(`「${l.text}」を もとの こえに もどしますか？`)) {
        VoiceBox.remove(key).then(render);
      }
    } else if (e.target.classList.contains('sr-pick')) {
      if (e.target.checked) picked.add(key); else picked.delete(key);
      render();
    }
  });

  // ---- LINE で たのむ / おくる / よみこむ ----
  // LINE は メッセージと ファイルを いっしょに わたすと メッセージだけ おくって しまうので、ファイルだけ わたす
  async function shareFile(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        say('おくれたよ！ あいてには「📥 こえを よみこむ」で この ファイルを えらんで もらってね');
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    say('ファイルを ほぞん したよ。LINEの トークで「＋」→「ファイル」から この ファイルを おくってね');
    return true;
  }

  $('#studio-ask').onclick = async () => {
    if (!picked.size) return say('たのみたい セリフに ✓ を つけてね（タブごとに えらべるよ）');
    const ids = lines.filter(l => picked.has(l.key)).map(l => l.id);
    const name = myName() || 'ともだち';
    const url = `${location.origin}${location.pathname}#koe=${ids.join('.')}&from=${encodeURIComponent(name)}`;
    const text = `${name}より：「のんびりつりつり」の こえを とって ほしいな！（セリフ ${ids.length}こ）\n` +
      'リンクを ひらいて、🔴ボタンで ろくおんしてね。LINEの なかで マイクが つかえない ときは、みぎうえの メニューから「ブラウザで ひらく」を えらんでね。';
    if (navigator.share) {
      try { await navigator.share({ title: 'こえの おねがい', text, url }); } catch (e) { /* やめた */ }
    } else {
      window.open('https://line.me/R/share?text=' + encodeURIComponent(`${text}\n${url}`), '_blank');
    }
  };

  $('#studio-send').onclick = async () => {
    const keys = request ? visible().map(l => l.key).filter(k => VoiceBox.recorded(k)) : VoiceBox.keys();
    if (!keys.length) return say('まだ こえを とって いないよ');
    if (!myName()) {
      $('#studio-name').focus();
      return say('さいしょに なまえを いれてね（だれの こえか わかるように）');
    }
    const { file, count } = await VoiceBox.exportPack(keys, myName());
    say(`こえパック（${count}こ）を つくったよ。LINEを えらんで おくってね`);
    await shareFile(file);
  };

  // ---- こえパックを よみこむ: なにを いれるか えらぶ ----
  const dlg = $('#import-dialog');
  let pack = null;   // { by, groups: [{ who, items: [{ key, text, blob, on }] }] }
  const roleName = who => (ROLES.find(r => r.who === who) || { name: who }).name;

  function renderImport() {
    let total = 0;
    dlg.querySelector('.imp-body').innerHTML = pack.groups.map((g, gi) => {
      const rows = g.items.map((it, ii) => {
        if (it.on) total++;
        const note = VoiceBox.recorded(it.key) ? '<small class="imp-over">うわがき</small>' : '';
        return `<div class="imp-row"><input type="checkbox" data-g="${gi}" data-i="${ii}"${it.on ? ' checked' : ''}>` +
          `<span>${it.text.replace(/</g, '&lt;')}${note}</span><button class="imp-play" data-g="${gi}" data-i="${ii}" aria-label="きく">▶</button></div>`;
      }).join('');
      return `<div class="imp-group"><div class="imp-head">${roleName(g.who)} <small>${g.items.length}こ</small></div>${rows}</div>`;
    }).join('');
    dlg.querySelector('.imp-title').textContent = `📥 ${pack.by || 'ともだち'} の こえパック`;
    $('#imp-ok').textContent = `${total}こ いれる`;
    $('#imp-ok').disabled = !total;
  }

  dlg.addEventListener('change', e => {
    const g = pack && pack.groups[e.target.dataset.g];
    if (!g) return;
    g.items[e.target.dataset.i].on = e.target.checked;
    renderImport();
  });
  // とどいた こえを ためしに きく
  let previewCtx = null;
  dlg.addEventListener('click', async e => {
    if (!e.target.classList.contains('imp-play')) return;
    const it = pack.groups[e.target.dataset.g].items[e.target.dataset.i];
    previewCtx = previewCtx || new (window.AudioContext || window.webkitAudioContext)();
    const buf = await previewCtx.decodeAudioData(await it.blob.arrayBuffer());
    const src = previewCtx.createBufferSource();
    const gain = previewCtx.createGain();
    gain.gain.value = VoiceBox.loudnessGain(buf.getChannelData(0), 0, buf.length, buf.sampleRate);
    src.buffer = buf;
    src.connect(gain).connect(previewCtx.destination);
    src.start();
  });
  $('#imp-cancel').onclick = () => { dlg.classList.remove('show'); pack = null; };
  $('#imp-ok').onclick = async () => {
    let n = 0;
    for (const g of pack.groups) {
      for (const it of g.items) {
        if (!it.on) continue;
        await VoiceBox.put(it.key, it.blob, pack.by || 'ともだち');
        n++;
      }
    }
    dlg.classList.remove('show');
    say(`${pack.by || 'ともだち'} の こえを ${n}こ いれたよ！`);
    pack = null;
    render();
  };

  $('#studio-file').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      await loadLines();
      const r = await VoiceBox.readPack(f);
      const groups = new Map();
      for (const c of r.clips) {
        const i = c.key.indexOf('|');
        const who = c.key.slice(0, i);
        if (!groups.has(who)) groups.set(who, { who, items: [] });
        groups.get(who).items.push({ key: c.key, text: c.key.slice(i + 1), blob: c.blob, on: true });
      }
      pack = { by: r.by, groups: [...groups.values()] };
      renderImport();
      dlg.classList.add('show');
    } catch (err) {
      say('こえパックが よみこめなかったよ');
    }
  };

  $('#studio-name').addEventListener('change', () => {
    try { localStorage.setItem(NAME_KEY, myName()); } catch (e) { /* むし */ }
  });
  $('#studio-use').onchange = e => { VoiceBox.enabled = e.target.checked; };
  $('#studio-search').addEventListener('input', render);

  // ---- ひらく / とじる ----
  async function open(req = null) {
    request = req;
    await VoiceBox.ready;
    await loadLines();
    try { $('#studio-name').value = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* むし */ }
    $('#studio-use').checked = VoiceBox.enabled;
    $('#studio-request').hidden = !request;
    msg.textContent = /Line\//i.test(navigator.userAgent)
      ? 'LINEの なかでは ろくおん できない ことが あるよ。みぎうえの メニューから「ブラウザで ひらく」を えらんでね'
      : '';
    render();
    ov.classList.add('show');
    history.pushState({ studio: true }, '');
  }
  function close() {
    if (recording && recording.ctl) recording.ctl.cancel();
    recording = null;
    ov.classList.remove('show');
    if (request) {
      request = null;
      history.replaceState(null, '', location.pathname);
    }
  }
  $('#studio-close').onclick = () => {
    close();
    if (history.state && history.state.studio) history.back();
  };
  window.addEventListener('popstate', () => { if (ov.classList.contains('show')) close(); });
  $('#btn-studio').onclick = () => { Sound.unlock(); open(); };

  // おねがいの リンクから ひらいた とき
  const m = location.hash.match(/^#koe=([\w.-]+)(?:&from=([^&]*))?/);
  if (m) open({ ids: new Set(m[1].split('.')), from: decodeURIComponent(m[2] || '') });
})();
