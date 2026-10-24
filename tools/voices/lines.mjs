// ゲームで しゃべる セリフを ぜんぶ あつめて lines.json に かきだす
//   node tools/voices/lines.mjs
// game.js の nar('...') / kid('...') と、data.js から つくる よみあげ（すうじ・とけい・カレンダー・さかなの なまえ）を ひろう
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read('js/data.js'), ctx);
const { dataLines, reading } = ctx.window;
const game = read('js/game.js');

const lines = [];
const add = (who, text) => {
  const t = text.trim();
  const r = reading(who, t);
  lines.push(r === t ? { who, text: t } : { who, text: t, read: r });
};

const WHO = { nar: 'narr', kid: 'kid' };
for (const m of game.matchAll(/\b(nar|kid)\('([^']+)'\)/g)) add(WHO[m[1]], m[2]);
// nar(n < 0 ? 'ひく' : 'たす') の ような かきかたも ひろう
for (const m of game.matchAll(/\bnar\([^()']*\?\s*'([^']+)'\s*:\s*'([^']+)'\)/g)) { add('narr', m[1]); add('narr', m[2]); }
add('narr', 'マイナス');
for (const [who, text] of dataLines()) add(who, text);

const seen = new Set();
const out = lines.filter(l => {
  const k = `${l.who}|${l.text}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
fs.writeFileSync(path.join(root, 'tools/voices/lines.json'), JSON.stringify(out, null, 1));
console.log(`${out.length} lines`);
