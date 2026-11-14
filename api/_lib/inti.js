'use strict';
/* Ronde rasa aman, Fase A — fungsi murni server (tanpa jaringan).
   Folder api/_lib diawali "_" supaya Vercel TIDAK menjadikannya endpoint.
   JANGAN pernah menulis PIN, token sesi, atau rahasia ke log.
   (Perbaikan 9: kode password/scrypt, tiket setup, dan HIBP DIHAPUS.) */
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
/* port 1:1 roomFor() di index.html: kamar hash yang diminta saat daftar
   (server kosan_register memprobe kamar kosong kalau terisi). */
function roomFor(nama) {
  const s = normalize(nama);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 10) + 1;
}
function penghuniKamar(occupants, room) {
  if (!Array.isArray(occupants)) return null;
  for (const o of occupants) if (o && o.room === room && typeof o.name === 'string') return { room: o.room, name: o.name };
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
  const s = String(ip || '').trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
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
  PIN_SALT, pinHash, normalize, usernameValid, roomFor, cariPenghuni, penghuniKamar,
  tokenAcak, sha256hex, subKunci, samaAman, prefiksIp, ipHmac, kunciBatasIp,
  namaCookie, bacaCookie, cookieSesi, cookieHapus, perangkatSah
};
