// さかなの しゅるい・すうじ / とけい / カレンダーの よみかた
(() => {
  // しゅるい（すうじの ちいさい じゅん）
  //   tier: えさの「まえ と うしろ 3つ」に つかう だんかい（ながぐつ などの マイナスは まとめて -1）
  //   tint: えもじの いろを かえる（めだか・きんぎょ・じかんざかな）
  const SPECIES = [
    { id: 'boot', name: 'ながぐつ', emoji: '👢', min: -3, max: -1, junk: true },
    { id: 'can', name: 'あきかん', emoji: '🥫', min: -6, max: -4, junk: true },
    { id: 'sock', name: 'くつした', emoji: '🧦', min: -10, max: -7, junk: true },
    { id: 'shell', name: 'かいがら', emoji: '🐚', min: 0, max: 0 },
    { id: 'medaka', name: 'めだか', emoji: '🐟', min: 1, max: 3, tint: 'medaka' },
    { id: 'ebi', name: 'えび', emoji: '🦐', min: 4, max: 6 },
    { id: 'kingyo', name: 'きんぎょ', emoji: '🐟', min: 7, max: 10, tint: 'kingyo' },
    { id: 'kani', name: 'かに', emoji: '🦀', min: 11, max: 15 },
    { id: 'aji', name: 'あじ', emoji: '🐟', min: 16, max: 20 },
    { id: 'ika', name: 'いか', emoji: '🦑', min: 21, max: 25 },
    { id: 'iseebi', name: 'いせえび', emoji: '🦞', min: 26, max: 30 },
    { id: 'tako', name: 'たこ', emoji: '🐙', min: 31, max: 36 },
    { id: 'fugu', name: 'ふぐ', emoji: '🐡', min: 37, max: 42 },
    { id: 'nettai', name: 'ねったいぎょ', emoji: '🐠', min: 43, max: 49 },
    { id: 'kame', name: 'かめ', emoji: '🐢', min: 50, max: 55 },
    { id: 'wani', name: 'ワニ', emoji: '🐊', min: 56, max: 62 },
    { id: 'azarashi', name: 'アザラシ', emoji: '🦭', min: 63, max: 69 },
    { id: 'penguin', name: 'ペンギン', emoji: '🐧', min: 70, max: 77 },
    { id: 'iruka', name: 'イルカ', emoji: '🐬', min: 78, max: 85 },
    { id: 'same', name: 'サメ', emoji: '🦈', min: 86, max: 92 },
    { id: 'kujira', name: 'クジラ', emoji: '🐋', min: 93, max: 99 },
    { id: 'daiou', name: 'だいおうクジラ', emoji: '🐳', min: 100, max: 100, gold: true },
  ];
  let t = 0;
  SPECIES.forEach(s => { s.tier = s.junk ? -1 : t++; });
  const MAX_TIER = t - 1;
  // じかんざかな（すうじの かわりに とけいを せおっている）
  const CLOCK_FISH = { id: 'clock', name: 'じかんざかな', emoji: '🐟', tint: 'clock', tier: null };
  const WORM = { id: 'worm', name: 'ミミズ', emoji: '🪱', n: 1 };

  const speciesOf = n => SPECIES.find(s => n >= s.min && n <= s.max);
  const tierOf = n => speciesOf(n).tier;
  const byTier = tier => SPECIES.filter(s => s.tier === tier);

  // ---- カレンダー ----
  const WEEKDAYS = ['にちようび', 'げつようび', 'かようび', 'すいようび', 'もくようび', 'きんようび', 'どようび'];
  const WEEKDAY_SHORT = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];
  const WEEKDAY_COLOR = ['#ff5a5f', '#9b8c7a', '#ff8a3d', '#3aa0ff', '#3cb371', '#e0a800', '#5b6cff'];
  const MONTH_READ = ['いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ', 'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ'];
  const DAY_READ = ['', 'ついたち', 'ふつか', 'みっか', 'よっか', 'いつか', 'むいか', 'なのか', 'ようか', 'ここのか', 'とおか',
    'じゅういちにち', 'じゅうににち', 'じゅうさんにち', 'じゅうよっか', 'じゅうごにち', 'じゅうろくにち', 'じゅうしちにち', 'じゅうはちにち', 'じゅうくにち', 'はつか',
    'にじゅういちにち', 'にじゅうににち', 'にじゅうさんにち', 'にじゅうよっか', 'にじゅうごにち', 'にじゅうろくにち', 'にじゅうしちにち', 'にじゅうはちにち', 'にじゅうくにち',
    'さんじゅうにち', 'さんじゅういちにち'];

  // ---- とけい ----
  // 1ぷん・3ぷん・4ぷん・6ぷん・8ぷん・10ぷん … は「ぷん」、ほかは「ふん」
  const funText = m => `${m}${[0, 1, 3, 4, 6, 8].includes(m % 10) ? 'ぷん' : 'ふん'}`;

  // ---- こえの キー（"だれ|セリフ"）----
  //   num: すうじ / time: とけい / cal: カレンダー（どれも ナレーションの こえ）
  const Keys = {
    num: n => (n < 0 ? ['narr|マイナス', `num|${-n}`] : [`num|${n}`]),
    ji: h => `time|${h}じ`,
    fun: m => `time|${funText(m)}`,
    jikan: h => `time|${h}じかん`,
    // 3じ15ふん（ちょうどの ときは 3じ だけ）
    time: (h, m) => (m ? [Keys.ji(h), Keys.fun(m)] : [Keys.ji(h)]),
    span: (h, m) => [...(h ? [Keys.jikan(h)] : []), ...(m ? [Keys.fun(m)] : [])],
    month: m => `cal|${m}がつ`,
    day: d => `cal|${d}にち`,
    weekday: w => `cal|${WEEKDAYS[w]}`,
    date: dt => [Keys.month(dt.getMonth() + 1), Keys.day(dt.getDate()), Keys.weekday(dt.getDay())],
    caught: s => `narr|${s.name}だ！`,
    name: s => `narr|${s.name}`,
    rank: i => `narr|${i}い！`,
  };

  // VOICEVOX に よませる ときの よみかた（tools/voices/lines.mjs で つかう）
  // VOICEVOX が よみまちがえる セリフ
  const READ_FIX = { 'の つぎは': 'の 次は', 'つぎは なにを する？': '次は なにを する？' };
  function reading(who, text) {
    if (READ_FIX[text]) return READ_FIX[text];
    if (who === 'time') {
      return text.replace(/(\d+)じかん/, '$1時間').replace(/(\d+)じ$/, '$1時').replace(/(\d+)[ふぷ]ん/, '$1分');
    }
    if (who === 'cal') {
      let m = text.match(/^(\d+)がつ$/);
      if (m) return MONTH_READ[m[1] - 1];
      m = text.match(/^(\d+)にち$/);
      if (m) return DAY_READ[m[1]];
    }
    const r = text.match(/^(\d+)い！$/);
    if (r) return `${r[1]}位！`;
    return text;
  }

  // ゲームで つかう すべての よみあげ（セリフ いがい）
  function dataLines() {
    const out = [];
    for (let n = 0; n <= 1000; n++) out.push(['num', String(n)]);
    for (let h = 1; h <= 24; h++) out.push(Keys.ji(h).split('|'));
    for (let m = 1; m <= 59; m++) out.push(Keys.fun(m).split('|'));
    for (let h = 1; h <= 12; h++) out.push(Keys.jikan(h).split('|'));
    for (let m = 1; m <= 12; m++) out.push(Keys.month(m).split('|'));
    for (let d = 1; d <= 31; d++) out.push(Keys.day(d).split('|'));
    for (let w = 0; w < 7; w++) out.push(Keys.weekday(w).split('|'));
    for (const s of [...SPECIES, CLOCK_FISH]) {
      out.push(Keys.caught(s).split('|'));
      out.push(Keys.name(s).split('|'));
    }
    for (let i = 1; i <= 10; i++) out.push(Keys.rank(i).split('|'));
    return out;
  }

  Object.assign(window, {
    SPECIES, CLOCK_FISH, WORM, MAX_TIER, speciesOf, tierOf, byTier,
    WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_COLOR, funText, Keys, reading, dataLines,
  });
})();
