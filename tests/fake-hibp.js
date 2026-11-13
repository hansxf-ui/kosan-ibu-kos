'use strict';
/* Tiruan API range Have I Been Pwned untuk tes (tanpa jaringan).
   Menjawab GET https://api.pwnedpasswords.com/range/<PREFIX> persis
   formatnya: "SUFFIX:COUNT\r\n" + baris padding (count 0) seperti
   Add-Padding. Daftar "bocor" di sini contoh UJI, bukan password penghuni.
   mode: 'normal' | 'mati' (fetch melempar) | 'lambat' (tidak pernah
   menjawab) | '500' (status error). */
const crypto = require('node:crypto');

/* '12345678' sengaja TIDAK di sini: tes lama memakainya untuk menguji daftar
   password umum (aturan yang tetap berlaku saat HIBP mati). HIBP asli tentu
   memuatnya. */
const BOCOR_UJI = ['password123', 'qwerty123', 'iloveyou', 'kosrumahkedua2024'];

function buatFakeHibp({ bocor = BOCOR_UJI, mode = 'normal' } = {}) {
  const peta = new Map();
  for (const pw of bocor) {
    const h = crypto.createHash('sha1').update(pw, 'utf8').digest('hex').toUpperCase();
    const p = h.slice(0, 5);
    if (!peta.has(p)) peta.set(p, []);
    peta.get(p).push(h.slice(5) + ':' + (1000 + pw.length));
  }
  const log = [];
  async function fetchFn(url, opt) {
    log.push({ url, opt });
    if (mode === 'mati') throw new Error('ENOTFOUND api.pwnedpasswords.com');
    if (mode === 'lambat') return new Promise(() => {});
    if (mode === '500') return { ok: false, status: 500, text: async () => 'error' };
    const m = /^https:\/\/api\.pwnedpasswords\.com\/range\/([0-9A-F]{5})$/.exec(url);
    if (!m) return { ok: false, status: 400, text: async () => 'bad prefix' };
    const baris = (peta.get(m[1]) || []).slice();
    /* padding: sisa hash acak dengan count 0 (bukan bocor) */
    for (let i = 0; i < 6; i++) baris.push(crypto.randomBytes(18).toString('hex').toUpperCase().slice(0, 35) + ':0');
    return { ok: true, status: 200, text: async () => baris.join('\r\n') };
  }
  return { fetchFn, log, set mode(v) { mode = v; }, get mode() { return mode; } };
}

module.exports = { buatFakeHibp, BOCOR_UJI };
