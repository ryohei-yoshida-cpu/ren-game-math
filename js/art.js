// え（ぼうしと ながぐつの ねこ・さかな）
window.Art = (() => {
  // ---- ねこ（きいろい レインハットと ながぐつ）----
  // ROD は つりざおを もつ て の いち（viewBox の なか）
  const ROD = { x: 92, y: 80 };
  function cat() {
    return `<svg class="cat-svg" viewBox="0 0 120 132" aria-hidden="true">
      <path d="M34 104 Q8 100 12 78 Q15 64 26 70 Q20 80 24 88 Q28 96 38 96 Z" fill="#e8873a"/>
      <ellipse cx="56" cy="90" rx="27" ry="27" fill="#f6a04d"/>
      <path d="M40 72 Q46 76 44 84 M70 70 Q66 76 69 82" stroke="#d9742b" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="61" cy="96" rx="15" ry="17" fill="#ffe3c2"/>
      <rect x="36" y="106" width="19" height="20" rx="6" fill="#ffcf2e"/>
      <rect x="58" y="106" width="19" height="20" rx="6" fill="#ffcf2e"/>
      <rect x="33" y="121" width="24" height="7" rx="3.5" fill="#e0a800"/>
      <rect x="55" y="121" width="24" height="7" rx="3.5" fill="#e0a800"/>
      <rect x="36" y="109" width="19" height="3" fill="#fff3b0" opacity=".7"/>
      <rect x="58" y="109" width="19" height="3" fill="#fff3b0" opacity=".7"/>
      <ellipse cx="86" cy="84" rx="10" ry="8" fill="#f6a04d"/>
      <path d="M80 84 q3 -4 6 0 q3 -4 6 0" stroke="#d9742b" stroke-width="1.6" fill="none"/>
      <circle cx="63" cy="52" r="25" fill="#f6a04d"/>
      <path d="M41 40 L44 22 L56 32 Z M70 32 L82 22 L85 40 Z" fill="#f6a04d"/>
      <path d="M45 37 L47 27 L53 33 Z M73 33 L79 27 L81 37 Z" fill="#ffb7a6"/>
      <path d="M52 30 Q63 20 75 30 Q78 35 75 36 L51 36 Q48 35 52 30 Z" fill="#ffcf2e"/>
      <path d="M50 31 Q63 6 77 31" fill="#ffcf2e" stroke="#e0a800" stroke-width="1.5"/>
      <path d="M28 38 Q63 24 98 38 Q92 44 63 41 Q34 44 28 38 Z" fill="#ffd84d" stroke="#e0a800" stroke-width="1.5"/>
      <path d="M55 46 q-4 -4 -9 0 M80 46 q-4 -4 -9 0" stroke="#d9742b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="54" cy="53" rx="3.4" ry="4.4" fill="#2b1d14"/>
      <ellipse cx="73" cy="53" rx="3.4" ry="4.4" fill="#2b1d14"/>
      <circle cx="55.2" cy="51.6" r="1.2" fill="#fff"/>
      <circle cx="74.2" cy="51.6" r="1.2" fill="#fff"/>
      <ellipse cx="64" cy="63" rx="10" ry="7" fill="#fff4e6"/>
      <path d="M61.5 59.5 L66.5 59.5 L64 62.5 Z" fill="#ff7b8a"/>
      <path d="M64 62.5 q-2 4 -5 2 M64 62.5 q2 4 5 2" stroke="#2b1d14" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="47" cy="61" rx="4.5" ry="3" fill="#ff9e8f" opacity=".55"/>
      <ellipse cx="81" cy="61" rx="4.5" ry="3" fill="#ff9e8f" opacity=".55"/>
      <path d="M52 62 L38 60 M52 65 L39 67 M76 62 L90 60 M76 65 L89 67" stroke="#8a5a30" stroke-width="1" stroke-linecap="round"/>
    </svg>`;
  }

  // ---- さかな（あたまが ひだり）----
  let gid = 0;
  function fishSVG(o) {
    const id = `g${++gid}`;
    const x0 = o.x0 || 12, x1 = o.x1 || 92, cy = 40, h = o.h || 16;
    const body = `M${x0} ${cy} C${x0 + 8} ${cy - h * 1.05} ${x1 - 26} ${cy - h * 1.1} ${x1} ${cy - 2} ` +
      `C${x1 - 26} ${cy + h * 1.05} ${x0 + 8} ${cy + h} ${x0} ${cy} Z`;
    let tail = '';
    if (o.tail === 'fork') {
      tail = `<path d="M${x1 - 4} ${cy - 1} L${x1 + 20} ${cy - h * 1.15} Q${x1 + 12} ${cy} ${x1 + 20} ${cy + h * 1.15} Z" fill="${o.fin}"/>`;
    } else if (o.tail === 'fan') {
      tail = `<path d="M${x1 - 6} ${cy} C${x1 + 8} ${cy - h * 2.2} ${x1 + 34} ${cy - h * 1.6} ${x1 + 30} ${cy - h * 0.3} ` +
        `C${x1 + 22} ${cy - h * 0.6} ${x1 + 14} ${cy - 2} ${x1 + 20} ${cy} C${x1 + 14} ${cy + 2} ${x1 + 22} ${cy + h * 0.6} ${x1 + 30} ${cy + h * 0.3} ` +
        `C${x1 + 34} ${cy + h * 1.6} ${x1 + 8} ${cy + h * 2.2} ${x1 - 6} ${cy} Z" fill="${o.fin}" opacity=".9"/>` +
        `<path d="M${x1} ${cy} L${x1 + 26} ${cy - h * 1.1} M${x1} ${cy} L${x1 + 28} ${cy - h * 0.5} M${x1} ${cy} L${x1 + 26} ${cy + h * 1.1} M${x1} ${cy} L${x1 + 28} ${cy + h * 0.5}" stroke="${o.line || '#fff'}" stroke-width=".8" opacity=".5"/>`;
    } else {
      tail = `<path d="M${x1 - 4} ${cy - 1} Q${x1 + 18} ${cy - h} ${x1 + 18} ${cy} Q${x1 + 18} ${cy + h} ${x1 - 4} ${cy + 1} Z" fill="${o.fin}"/>`;
    }
    const dorsal = o.dorsal !== false
      ? `<path d="M${o.dx || x0 + 30} ${cy - h * 0.9} Q${(o.dx || x0 + 30) + 14} ${cy - h * (o.dh || 1.7)} ${(o.dx || x0 + 30) + (o.dw || 26)} ${cy - h * 0.85} Z" fill="${o.fin}"/>`
      : '';
    const pelvic = `<path d="M${x0 + 26} ${cy + h * 0.8} Q${x0 + 32} ${cy + h * 1.5} ${x0 + 40} ${cy + h * 0.75} Z" fill="${o.fin}"/>`;
    const eyeR = o.eye || 3.6;
    return `<svg class="art" viewBox="0 0 ${x1 + (o.tail === 'fan' ? 38 : 24)} 80" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${o.back}"/><stop offset=".55" stop-color="${o.mid || o.back}"/><stop offset="1" stop-color="${o.belly}"/>
        </linearGradient>
        <clipPath id="${id}c"><path d="${body}"/></clipPath>
      </defs>
      ${tail}${dorsal}${pelvic}
      <path d="${body}" fill="url(#${id})" ${o.opacity ? `opacity="${o.opacity}"` : ''}/>
      <g clip-path="url(#${id}c)">${o.pattern || ''}</g>
      <path d="M${x0 + 20} ${cy - h * 0.7} Q${x0 + 14} ${cy} ${x0 + 20} ${cy + h * 0.7}" stroke="${o.gill || 'rgba(0,0,0,.25)'}" stroke-width="1.3" fill="none"/>
      <path d="M${x0 + 22} ${cy + 1} Q${x0 + 30} ${cy + 6} ${x0 + 34} ${cy + 1} Z" fill="${o.fin}" opacity=".8"/>
      <circle cx="${x0 + 9}" cy="${cy - h * 0.28}" r="${eyeR}" fill="#fff"/>
      <circle cx="${x0 + 8.4}" cy="${cy - h * 0.28}" r="${eyeR * 0.68}" fill="#14110f"/>
      <circle cx="${x0 + 7.6}" cy="${cy - h * 0.28 - eyeR * 0.3}" r="${eyeR * 0.25}" fill="#fff"/>
      <path d="M${x0 + 1} ${cy + 2} q3 1 5 -0.5" stroke="rgba(0,0,0,.35)" stroke-width="1" fill="none"/>
      ${o.extra || ''}
    </svg>`;
  }

  const FISH = {
    medaka: () => fishSVG({
      x0: 14, x1: 94, h: 10, back: '#9c9a74', mid: '#c9c6a2', belly: '#efe9cf', fin: 'rgba(210,205,170,.75)',
      tail: 'round', eye: 5, dx: 70, dw: 14, dh: 1.6, opacity: .95,
      pattern: '<path d="M30 40 L96 38" stroke="#5f5c43" stroke-width="1.2" opacity=".6"/>',
    }),
    kingyo: () => fishSVG({
      x0: 16, x1: 76, h: 21, back: '#e8361c', mid: '#ff6a2a', belly: '#ffd3a8', fin: '#ff5a2a', line: '#ffd0b0',
      tail: 'fan', eye: 4.2, dx: 36, dw: 24, dh: 1.55,
      pattern: '<ellipse cx="48" cy="52" rx="22" ry="9" fill="#fff2df" opacity=".55"/>',
    }),
    aji: () => fishSVG({
      x0: 10, x1: 98, h: 14, back: '#3f6e8c', mid: '#a9c3cf', belly: '#f1f5f6', fin: '#c8b86a',
      tail: 'fork', eye: 4.4, dx: 38, dw: 30, dh: 1.5,
      pattern: '<path d="M26 40 Q60 34 98 39" stroke="#f0d35a" stroke-width="2.4" fill="none" opacity=".85"/>' +
        '<path d="M60 38 L98 39" stroke="#6b7f87" stroke-width="3" stroke-dasharray="2 1.6" opacity=".6"/>',
    }),
    nettai: () => fishSVG({
      x0: 14, x1: 86, h: 18, back: '#ff7a00', mid: '#ff8f1f', belly: '#ffae4a', fin: '#ff7a00',
      tail: 'round', eye: 4.2, dx: 34, dw: 30, dh: 1.5, gill: 'rgba(0,0,0,0)',
      pattern: [30, 54, 78].map((x, i) => `<path d="M${x} 0 Q${x + (i === 1 ? 6 : 2)} 40 ${x} 80" stroke="#222" stroke-width="${i === 2 ? 9 : 11}" fill="none"/>` +
        `<path d="M${x} 0 Q${x + (i === 1 ? 6 : 2)} 40 ${x} 80" stroke="#fff" stroke-width="${i === 2 ? 6 : 8}" fill="none"/>`).join(''),
    }),
    // じかんざかな: きんいろの からだに 2じの とけい
    clock: () => fishSVG({
      x0: 12, x1: 92, h: 18, back: '#d99a00', mid: '#ffd23f', belly: '#fff3b0', fin: '#ffb703',
      tail: 'fork', eye: 4.2, dx: 30, dw: 34, dh: 1.5,
      extra: '<circle cx="56" cy="41" r="13" fill="#fff" stroke="#ff8a3d" stroke-width="2.4"/>' +
        [0, 3, 6, 9].map(i => `<line x1="56" y1="30.5" x2="56" y2="32.5" stroke="#4a3426" stroke-width="1.4" transform="rotate(${i * 30} 56 41)"/>`).join('') +
        '<line x1="56" y1="41" x2="56" y2="33" stroke="#ff5a5f" stroke-width="1.8" stroke-linecap="round"/>' +
        '<line x1="56" y1="41" x2="60.5" y2="38.4" stroke="#1d3557" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="56" cy="41" r="1.6" fill="#1d3557"/>',
    }),
  };

  // しゅるいの え（さかなは え、ほかは えもじ）
  function of(sp) {
    if (FISH[sp.id]) return `<span class="art-wrap">${FISH[sp.id]()}</span>`;
    return `<span class="femoji${sp.gold ? ' gold' : ''}">${sp.emoji}</span>`;
  }

  return { cat, ROD, of };
})();
