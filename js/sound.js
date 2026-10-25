// おと と こえ（Web Audio + Web Speech）
window.Sound = (() => {
  let ctx = null;
  let jaVoice = null;
  const synth = window.speechSynthesis || null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function pickVoice() {
    if (!synth) return;
    const ja = synth.getVoices().filter(v => /^ja/i.test(v.lang));
    jaVoice = ja.find(v => /Kyoko|O-ren|Nanami|Google/i.test(v.name)) || ja[0] || null;
  }
  if (synth) {
    pickVoice();
    synth.onvoiceschanged = pickVoice;
  }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function tone(freq, start, dur, { type = 'triangle', vol = 0.15, slide = 0 } = {}) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(start, dur, { vol = 0.15, freq = 1200 } = {}) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  // ---- こえ ----
  // じぶんたちで とった こえ（VoiceBox）→ VOICEVOX で つくった こえ（audio/voice）→ ブラウザの よみあげ の じゅんに つかう
  //   キーは "だれ|セリフ"。だれ: narr（ナレーション）/ kid（ねこ）/ num（すうじ）/ time（とけい）/ cal（カレンダー）
  //   say に キーを ならべて わたすと、つなげて ならす（「25|たす|30|は|55」など）
  const VOICE_DIR = 'audio/voice/';
  let voiceIndex = null;
  const clips = new Map();   // ファイル → AudioBuffer の Promise
  let queue = Promise.resolve();
  let gen = 0;
  let playing = null;
  let muted = false;         // テストよう: こえを ださずに すぐ つぎへ

  const indexReady = fetch(VOICE_DIR + 'index.json')
    .then(r => r.json())
    .then(j => { voiceIndex = j; })
    .catch(() => { /* こえが ない ときは よみあげで */ });

  function decode(buf) {
    const c = ac();
    return new Promise((res, rej) => {
      const p = c.decodeAudioData(buf, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  const VB = window.VoiceBox;
  if (VB) VB.onChange(k => { if (k) clips.delete('c:' + k); else clips.clear(); });

  // id は 'c:キー'（じぶんの こえ）か 'v:ファイル'（VOICEVOX）
  function clip(id) {
    if (!clips.has(id)) {
      const src = id.startsWith('c:')
        ? VB.blob(id.slice(2)).then(b => b.arrayBuffer())
        : fetch(VOICE_DIR + id.slice(2)).then(r => r.arrayBuffer());
      // じぶんの こえは ならす ときにも おおきさを そろえる
      const p = src.then(decode).then(buf => {
        if (id.startsWith('c:')) buf.level = VB.loudnessGain(buf.getChannelData(0), 0, buf.length, buf.sampleRate);
        return buf;
      });
      p.catch(() => clips.delete(id));
      clips.set(id, p);
      // つかいおわった ものは すこしずつ わすれる（メモリ たいさく）
      if (clips.size > 80) clips.delete(clips.keys().next().value);
    }
    return clips.get(id);
  }
  function clipId(key) {
    if (VB && VB.has(key)) return 'c:' + key;
    const f = voiceIndex && voiceIndex[key];
    return f ? 'v:' + f : null;
  }
  function playBuffer(buf) {
    return new Promise(res => {
      const c = ac();
      if (!c) return res();
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = buf.level || 1;
      src.connect(g).connect(c.destination);
      let done = false;
      const end = () => { if (!done) { done = true; if (playing === src) playing = null; res(); } };
      src.onended = end;
      setTimeout(end, buf.duration * 1000 + 400);   // おとが とまっていても さきに すすむ
      playing = src;
      src.start();
    });
  }

  function speak(text, { pitch = 1.2, rate = 1.0, volume = 1 } = {}) {
    return new Promise(res => {
      if (!synth) return setTimeout(res, 300 + text.length * 120);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      if (jaVoice) u.voice = jaVoice;
      u.pitch = pitch;
      u.rate = rate;
      u.volume = volume;
      let done = false;
      const end = () => { if (!done) { done = true; res(); } };
      u.onend = end;
      u.onerror = end;
      setTimeout(end, 1500 + text.length * 250);
      synth.speak(u);
    });
  }

  const textOf = key => key.slice(key.indexOf('|') + 1);

  // keys: "だれ|セリフ" の はいれつ（1つなら もじれつでも よい）
  // かえりちの Promise は しゃべりおわったら（hush されたら すぐ）おわる
  function say(keys, opts = {}) {
    const list = [].concat(keys).flat().filter(Boolean);
    const my = gen;
    if (muted) {
      queue = queue.then(() => new Promise(r => setTimeout(r, 20)));
      return queue;
    }
    // こえの ある ところは つくった こえ、ない ところ（じぶんで いれた よてい など）は ブラウザの よみあげ
    const parts = list.map(k => {
      const id = clipId(k);
      return id ? { load: clip(id) } : { text: textOf(k) };   // すぐ よみこみ はじめる
    });
    queue = queue.then(async () => {
      for (const p of parts) {
        if (my !== gen) return;
        if (p.text) { await speak(p.text, opts); continue; }
        let buf;
        try { buf = await p.load; } catch (e) { continue; }
        if (my !== gen) return;
        await playBuffer(buf);
      }
    });
    return queue;
  }

  function hush() {
    gen++;
    queue = Promise.resolve();
    if (playing) {
      try { playing.stop(); } catch (e) { /* もう とまっている */ }
      playing = null;
    }
    if (synth) synth.cancel();
  }

  // こえを まえもって ダウンロードして おく（オフラインでも ならせるように）
  function preloadVoices() {
    if (!voiceIndex) return;
    const files = Object.entries(voiceIndex).filter(([k]) => k !== '_v').map(([, f]) => f);
    let i = 0;
    const next = () => {
      if (i >= files.length) return;
      fetch(VOICE_DIR + files[i++]).catch(() => {}).finally(next);
    };
    for (let k = 0; k < 3; k++) next();
  }

  // さいしょの タップで おとを だせるように する（iPhone/iPad たいさく）
  let unlocked = false;
  function unlock() {
    ac();
    if (synth && !muted) synth.speak(Object.assign(new SpeechSynthesisUtterance(' '), { volume: 0 }));
    if (!unlocked) {
      unlocked = true;
      setTimeout(preloadVoices, 3000);
    }
  }

  return {
    unlock,
    say,
    hush,
    indexReady,
    voiceIndex: () => voiceIndex,
    set muted(on) { muted = on; },
    pop() { tone(500, 0, 0.15, { type: 'sine', vol: 0.25, slide: 2.2 }); },
    tap() { tone(700, 0, 0.08, { type: 'sine', vol: 0.12, slide: 1.5 }); },
    // ---- つり ----
    cast() {
      noise(0, 0.35, { vol: 0.2, freq: 1800 });
      tone(900, 0, 0.35, { type: 'sine', vol: 0.05, slide: 0.4 });
    },
    plop() {
      tone(300, 0, 0.18, { type: 'sine', vol: 0.25, slide: 2.5 });
      noise(0.02, 0.2, { vol: 0.15, freq: 900 });
    },
    bite() {
      tone(180, 0, 0.12, { type: 'square', vol: 0.12, slide: 0.6 });
      tone(180, 0.18, 0.12, { type: 'square', vol: 0.12, slide: 0.6 });
      noise(0, 0.3, { vol: 0.3, freq: 600 });
    },
    reel(t) {
      tone(400 + t * 700, 0, 0.06, { type: 'square', vol: 0.06 });
      noise(0, 0.05, { vol: 0.15, freq: 3000 });
    },
    splash() {
      noise(0, 0.6, { vol: 0.5, freq: 700 });
      noise(0.05, 0.4, { vol: 0.3, freq: 2500 });
    },
    caught() {
      [72, 76, 79, 84].forEach((m, i) => tone(midi(m), i * 0.09, 0.3, { type: 'triangle', vol: 0.16 }));
    },
    junk() {
      [67, 64, 60].forEach((m, i) => tone(midi(m), i * 0.14, 0.25, { type: 'square', vol: 0.06 }));
    },
    big() {
      const seq = [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [84, 0.5]];
      seq.forEach(([m, t]) => tone(midi(m), t, 0.3, { type: 'square', vol: 0.07 }));
      [72, 76, 79, 84].forEach(m => tone(midi(m), 0.7, 1.0, { type: 'triangle', vol: 0.09 }));
    },
    newOne() {
      [79, 84, 88, 91, 96].forEach((m, i) => tone(midi(m), i * 0.06, 0.3, { type: 'triangle', vol: 0.1 }));
      noise(0, 0.4, { vol: 0.08, freq: 7000 });
    },
    whoosh() {
      noise(0, 0.5, { vol: 0.25, freq: 1600 });
      tone(300, 0, 0.5, { type: 'sine', vol: 0.08, slide: 3 });
      [76, 81, 86].forEach((m, i) => tone(midi(m), 0.25 + i * 0.07, 0.25, { type: 'triangle', vol: 0.1 }));
    },
    yawn() {
      tone(330, 0, 0.9, { type: 'sine', vol: 0.05, slide: 0.6 });
    },
    caw() {
      [0, 0.45].forEach(t => {
        tone(620, t, 0.22, { type: 'sawtooth', vol: 0.05, slide: 0.7 });
        noise(t, 0.2, { vol: 0.12, freq: 1400 });
      });
    },
    // ---- とけい・こよみ ----
    tick() { tone(1800, 0, 0.05, { type: 'square', vol: 0.06 }); },
    tock() { tone(1200, 0, 0.06, { type: 'square', vol: 0.06 }); },
    hourChime(i) {
      const base = 72 + (i % 4) * 2;
      tone(midi(base), 0, 0.35, { type: 'sine', vol: 0.2 });
      tone(midi(base + 7), 0.06, 0.45, { type: 'sine', vol: 0.12 });
    },
    sunset() {
      [76, 72, 69, 67].forEach((m, i) => tone(midi(m), i * 0.22, 0.5, { type: 'triangle', vol: 0.1 }));
    },
    step() {
      tone(midi(79), 0, 0.15, { type: 'triangle', vol: 0.12 });
      tone(midi(84), 0.1, 0.25, { type: 'triangle', vol: 0.12 });
    },
    ding(i) {
      tone(midi(76 + (i % 5) * 2), 0, 0.3, { type: 'sine', vol: 0.18 });
    },
    fanfare() {
      const seq = [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [76, 0.65], [79, 0.8]];
      seq.forEach(([m, t]) => tone(midi(m), t, 0.25, { type: 'square', vol: 0.07 }));
      [72, 76, 79, 84].forEach(m => tone(midi(m), 1.0, 1.2, { type: 'triangle', vol: 0.1 }));
    },
  };
})();
