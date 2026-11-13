'use strict';
/* Ronde rasa aman, Fase A — fungsi murni server (tanpa jaringan).
   Folder api/_lib diawali "_" supaya Vercel TIDAK menjadikannya endpoint.
   JANGAN pernah menulis password, PIN, token sesi, atau rahasia ke log. */
const crypto = require('node:crypto');

/* ---------- PIN lama: port 1:1 dari pinHash() di index.html ----------
   Dipakai server untuk memanggil RPC lama kosan_login dengan PIN mentah
   dari klien. PIN dan pin_hash tersimpan TIDAK diubah. Tes
   tests/server.test.js membandingkan fungsi ini dengan salinan verbatim
   dari index.html. */
const PIN_SALT = 'kosan-ibu-kos-pin-v1';
function pinHash(pin) {
  let h = 0x811c9dc5;
  let s = PIN_SALT + '|' + String(pin || '');
  for (let iter = 0; iter < 10000; iter++) {
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    s = h.toString(16);
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/* ---------- username: sama persis dengan normalize/usernameValid klien ---------- */
function normalize(nama) {
  return String(nama || '').trim().replace(/^@+/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function usernameValid(nama) {
  const n = normalize(nama);
  return n.length > 0 && n.length <= 30 && /^[a-z0-9 _.\-]+$/.test(n) && /[a-z0-9]/.test(n);
}
function cariPenghuni(occupants, username) {
  const k = normalize(username);
  if (!k || !Array.isArray(occupants)) return null;
  for (const o of occupants) {
    if (o && typeof o.name === 'string' && Number.isInteger(o.room) && normalize(o.name) === k) return { room: o.room, name: o.name };
  }
  return null;
}
function penghuniKamar(occupants, room) {
  if (!Array.isArray(occupants)) return null;
  for (const o of occupants) if (o && o.room === room && typeof o.name === 'string') return { room: o.room, name: o.name };
  return null;
}

/* ---------- password (scrypt bawaan Node, tanpa dependensi) ---------- */
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 32 };
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
function scryptAsync(pw, salt, o) {
  return new Promise((res, rej) => {
    crypto.scrypt(pw, salt, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: SCRYPT_MAXMEM }, (e, k) => (e ? rej(e) : res(k)));
  });
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const k = await scryptAsync(String(pw).normalize('NFC'), salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), k.toString('base64url')].join('$');
}
async function cekPassword(pw, tersimpan) {
  if (typeof pw !== 'string' || typeof tersimpan !== 'string') return false;
  const b = tersimpan.split('$');
  if (b.length !== 6 || b[0] !== 'scrypt') return false;
  const o = { N: +b[1], r: +b[2], p: +b[3], keylen: 32 };
  if (!(o.N >= 16384 && o.N <= 1048576 && o.r >= 1 && o.r <= 16 && o.p >= 1 && o.p <= 4)) return false;
  const harap = Buffer.from(b[5], 'base64url');
  if (harap.length !== 32) return false;
  const k = await scryptAsync(pw.normalize('NFC'), Buffer.from(b[4], 'base64url'), o);
  return crypto.timingSafeEqual(k, harap);
}

/* Daftar password umum (ringkas, termasuk pola lokal). Bukan daftar
   lengkap — tujuannya menolak tebakan paling gampang. */
const PASSWORD_UMUM = new Set((
  '12345678 123456789 1234567890 0123456789 87654321 11111111 00000000 12341234 ' +
  '12121212 11223344 password password1 password123 passw0rd qwerty123 qwertyuiop ' +
  'asdfghjkl zxcvbnm1 iloveyou iloveyou1 abcd1234 abc12345 1q2w3e4r 1qaz2wsx ' +
  'admin123 welcome1 sunshine princess football baseball superman starwars ' +
  'whatever trustno1 letmein1 monkey12 dragon12 master12 shadow12 michael1 ' +
  'bismillah bismillah1 alhamdulillah assalamualaikum sayang123 sayangku ' +
  'sayangkamu cintaku cintaku1 indonesia indonesia1 jakarta1 bandung1 surabaya ' +
  'merdeka45 garuda123 anjing123 kucing123 rahasia rahasia1 rahasia123 ' +
  'kosanibukos kosan123 kosan1234 ibukos123 ibukos1234 ibu__kos penghuni ' +
  'penghuni1 masukaja masuk123 gantengbanget cantikbanget doraemon pokemon123 ' +
  'blackpink btsarmy1 bangtan1 sarangheyo saranghae 147258369 789456123 ' +
  '159753456 987654321 121212121 qweasdzxc 1234qwer qwer1234 asdf1234'
).split(/\s+/));
function cekAturanPassword(pw, username) {
  if (typeof pw !== 'string') return 'Password tidak valid.';
  const n = pw.normalize('NFC');
  if (n.length < 8) return 'Password minimal 8 karakter.';
  if (n.length > 128) return 'Password maksimal 128 karakter.';
  if (/^(.)\1+$/.test(n)) return 'Password terlalu gampang ditebak. Coba yang lain ya.';
  const kecil = n.toLowerCase();
  if (PASSWORD_UMUM.has(kecil)) return 'Password ini terlalu umum. Coba yang lain ya.';
  const u = normalize(username).replace(/[ _.\-]/g, '');
  if (u && kecil.replace(/[ _.\-@]/g, '') === u) return 'Password jangan sama dengan username ya.';
  return null;
}

/* ---------- token, hash, sub-kunci ---------- */
function tokenAcak() { return crypto.randomBytes(32).toString('base64url'); }
function sha256hex(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function subKunci(rahasia, label) { return crypto.createHmac('sha256', rahasia).update('kosan-v1|' + label).digest(); }
function samaAman(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------- IP: disimpan sebagai HMAC, bukan IP mentah ---------- */
function prefiksIp(ip) {
  const s = String(ip || '').trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(s);
  if (v4) return v4[1] + '.' + v4[2] + '.' + v4[3] + '.0/24';
  if (s.indexOf(':') !== -1) {
    const [kiri, kanan] = s.split('::');
    const a = kiri ? kiri.split(':') : [];
    const b = kanan !== undefined && kanan ? kanan.split(':') : [];
    const isi = kanan !== undefined ? Array(Math.max(0, 8 - a.length - b.length)).fill('0') : [];
    const g = a.concat(isi, b);
    return g.slice(0, 3).map((x) => (x || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/48';
  }
  return '';
}
/* Kunci batas percobaan per jaringan: IPv4 per alamat, IPv6 per /64
   (satu pelanggan biasanya punya satu /64 — memutar alamat di dalamnya
   tidak boleh memberi jatah baru). */
function kunciBatasIp(rahasia, ip) {
  const s = String(ip || '').trim();
  let k = s;
  if (s.indexOf(':') !== -1) {
    const [kiri, kanan] = s.split('::');
    const a = kiri ? kiri.split(':') : [];
    const b = kanan !== undefined && kanan ? kanan.split(':') : [];
    const isi = kanan !== undefined ? Array(Math.max(0, 8 - a.length - b.length)).fill('0') : [];
    k = a.concat(isi, b).slice(0, 4).map((x) => (x || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
  }
  if (!k) return 'tanpa-ip';
  return crypto.createHmac('sha256', subKunci(rahasia, 'batas')).update(k).digest('hex');
}
function ipHmac(rahasia, ip) {
  if (!ip) return { ip_hmac: null, ip_prefiks_hmac: null };
  const k = subKunci(rahasia, 'ip');
  const h = (v) => crypto.createHmac('sha256', k).update(v).digest('hex');
  const p = prefiksIp(ip);
  return { ip_hmac: h(String(ip).trim()), ip_prefiks_hmac: p ? h(p) : null };
}

/* ---------- tiket setup bertanda tangan (5 menit) ----------
   Sekali pakai dijamin di database: kosan_akun_setup hanya menulis kalau
   password_hash masih kosong (atomik). */
function buatTiket(rahasia, isi) {
  const json = Buffer.from(JSON.stringify(isi)).toString('base64url');
  const sig = crypto.createHmac('sha256', subKunci(rahasia, 'tiket')).update(json).digest('base64url');
  return json + '.' + sig;
}
function bacaTiket(rahasia, tiket, sekarang) {
  if (typeof tiket !== 'string' || tiket.length > 1024) return null;
  const i = tiket.indexOf('.');
  if (i <= 0) return null;
  const json = tiket.slice(0, i), sig = tiket.slice(i + 1);
  const harap = crypto.createHmac('sha256', subKunci(rahasia, 'tiket')).update(json).digest('base64url');
  if (!samaAman(sig, harap)) return null;
  let isi;
  try { isi = JSON.parse(Buffer.from(json, 'base64url').toString()); } catch (e) { return null; }
  if (!isi || typeof isi.exp !== 'number' || isi.exp <= sekarang) return null;
  if (!Number.isInteger(isi.room) || typeof isi.nama_norm !== 'string') return null;
  if (isi.gender !== 'cewek' && isi.gender !== 'cowok') return null;
  return isi;
}

/* ---------- cookie sesi ----------
   __Host- = wajib Secure + Path=/ + tanpa Domain (browser menolak kalau
   dilanggar). Mode `aman: false` HANYA untuk server uji lokal (http). */
function namaCookie(aman) { return aman ? '__Host-kosan_sesi' : 'kosan_sesi'; }
function bacaCookie(header, nama) {
  if (typeof header !== 'string') return null;
  for (const bagian of header.split(';')) {
    const i = bagian.indexOf('=');
    if (i === -1) continue;
    if (bagian.slice(0, i).trim() === nama) {
      const v = bagian.slice(i + 1).trim();
      return /^[A-Za-z0-9_-]{20,100}$/.test(v) ? v : null;
    }
  }
  return null;
}
function cookieSesi(token, { ingat, aman, maxAgeDetik }) {
  const b = [namaCookie(aman) + '=' + token, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (aman) b.push('Secure');
  if (ingat) b.push('Max-Age=' + maxAgeDetik);
  return b.join('; ');
}
function cookieHapus(aman) {
  const b = [namaCookie(aman) + '=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (aman) b.push('Secure');
  return b.join('; ');
}

function perangkatSah(p) { return typeof p === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(p) ? p : null; }

module.exports = {
  PIN_SALT, pinHash, normalize, usernameValid, cariPenghuni, penghuniKamar,
  hashPassword, cekPassword, cekAturanPassword, PASSWORD_UMUM,
  tokenAcak, sha256hex, subKunci, samaAman, prefiksIp, ipHmac, kunciBatasIp,
  buatTiket, bacaTiket, namaCookie, bacaCookie, cookieSesi, cookieHapus, perangkatSah
};
