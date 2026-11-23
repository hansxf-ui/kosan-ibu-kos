'use strict';
/* Playtest browser KOTA (22 Nov) — headless, layar HP mendatar 844 x 390. Benign: broker MQTT diblokir,
   daftar penghuni Supabase di-mock (tests/lokal.js). Khusus tes ini, kait baca `window.__ev` disisipkan ke
   HTML yang dilayani (game asli tidak berubah) supaya keadaan game bisa diperiksa.
   Alur: masuk tamu -> Pergi ke -> KOTA; ketuk SEMUA objek jalan (ketukan kanvas sungguhan -> raycast ->
   reaksi + toast + bunyi); duduk di bangku; JALAN (tombol W) masuk ke 4 pintu interior, ketuk objek di
   dalam, jalan keluar lewat pintu; ukur tinggi NPC vs avatar; hitung draw call + segitiga siang & malam;
   keluar Kota kembali ke halaman; 0 pageerror.
   Pakai: PLAYWRIGHT_CORE=/path/ke/playwright-core CHROME_PATH=/path/ke/chrome node tests/e2e-kota.js
   Opsi: FOTO_DIR=/folder (simpan tangkapan layar tiap interior) */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { buatServer } = require('./lokal');

const PORT = 8797, BASE = 'http://127.0.0.1:' + PORT;
const hasil = [], metrik = {};
const cek = (nama, ok, info) => { hasil.push({ nama, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + nama + (info ? '  [' + info + ']' : '')); };

(async () => {
  const srv = buatServer(PORT); await srv.siap;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

  async function halaman(query) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const err = [];
    await ctx.route('**/*', async (route) => {
      const u = route.request().url();
      if (u === BASE + '/' || u.startsWith(BASE + '/?')) {
        const res = await route.fetch();
        const html = (await res.text()).replace('\nanimate();\n</script>', '\nwindow.__ev = function (s) { return eval(s); };\nanimate();\n</script>');
        return route.fulfill({ response: res, body: html, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
      }
      if (u.startsWith(BASE)) return route.continue();
      if (u.includes('supabase.co/rest/v1/rpc/kosan_occupants')) return route.fulfill({ json: await (await fetch(BASE + '/__uji/occupants')).json() });
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => err.push(e.message));
    await page.goto(BASE + '/' + (query || ''));
    await page.waitForFunction(() => typeof window.__ev === 'function', null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.click('#entryGuestLink');
    await page.waitForTimeout(800);
    const ev = (s) => page.evaluate((x) => window.__ev(x), s);
    await ev("window.__bunyi = []; var __b0 = bunyi; bunyi = function (n, o) { window.__bunyi.push(n); return __b0(n, o); }; window.__toast = []; var __t0 = toastKosan; toastKosan = function (m) { window.__toast.push(String(m)); return __t0(m); }; 1");
    return { ctx, page, err, ev };
  }
  const bingkai = (page, n) => page.evaluate((k) => new Promise((r) => { let i = 0; (function f() { if (++i > k) r(); else requestAnimationFrame(f); })(); }), n || 3);
  async function keKota(H) {
    await H.page.click('#masukBtn'); await H.page.waitForTimeout(250);
    const t0 = Date.now();
    await H.page.click('#kotaBtn');
    /* masuk bertahap (23 Nov): tunggu sampai sudah di Kota DAN layar "Menuju Kota" sudah tertutup (dipantau lewat evaluate: eval di callback halaman diblokir CSP) */
    while (Date.now() - t0 < 400000) { if (await H.ev("myRealm === 'kota' && !kotaMuat")) break; await H.page.waitForTimeout(80); }
    return Date.now() - t0;
  }
  const info = (H) => H.ev('(function(){ renderer.info.autoReset = true; renderer.render(kotaRealmIni(myRealm) ? kotaSceneUntuk(myRealm) : scene, camera); return { calls: renderer.info.render.calls, tri: renderer.info.render.triangles }; })()');
  const pandang = (H, x, z, yaw, pitch, dist) => H.ev('avatarPos.x = ' + x + '; avatarPos.z = ' + z + '; avatar.position.set(avatarPos.x, 0, avatarPos.z); camTarget.set(avatarPos.x, 0, avatarPos.z); camYaw = ' + yaw + '; camPitch = ' + pitch + '; camDist = ' + dist + '; flyTarget = null; 1');
  /* ketukan kanvas sungguhan: cari titik layar di atas sasaran (raycast kena sasaran itu lebih dulu, bukan UI / pemain) */
  async function ketukSasaran(H, saring) {
    const titik = await H.ev('(function(){ var daftar = kotaKlikKini(), m = null; for (var i = 0; i < daftar.length; i++) { var u = daftar[i].userData; if (' + saring + ') { m = daftar[i]; break; } } if (!m) return null;'
      + ' camera.updateMatrixWorld(); m.updateMatrixWorld(); var b = new THREE.Box3().setFromObject(m), W = innerWidth, H = innerHeight, rc = new THREE.Raycaster();'
      + ' var F = [[0, 0]]; [0.12, 0.24, 0.36, 0.45].forEach(function (f) { [[f, 0], [-f, 0], [0, f], [0, -f], [f, f], [-f, f], [f, -f], [-f, -f]].forEach(function (q) { F.push(q); }); }); /* dari tengah keluar (tepi sasaran rawan meleset saat dibulatkan ke piksel) */'
      + ' for (var fi = 0; fi < F.length; fi++) { var gx = F[fi][0], gy = F[fi][1]; var p = new THREE.Vector3((b.min.x + b.max.x) / 2 + (b.max.x - b.min.x) * gx, (b.min.y + b.max.y) / 2 + (b.max.y - b.min.y) * gy, (b.min.z + b.max.z) / 2 + (b.max.z - b.min.z) * gx).project(camera);'
      + '  if (p.z > 1 || Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.9) continue; var sx = (p.x + 1) / 2 * W, sy = (1 - p.y) / 2 * H, el = document.elementFromPoint(sx, sy); if (el !== renderer.domElement) continue;'
      + '  pointerNDC.set(p.x, p.y); raycaster.setFromCamera(pointerNDC, camera); if (ketukPemain()) continue; var hit = raycaster.intersectObjects(daftar, false)[0]; if (hit && hit.object === m) return { x: sx, y: sy }; }'
      + ' return null; })()');
    if (!titik) return false;
    await H.page.mouse.click(titik.x, titik.y);
    return true;
  }
  const baru = async (H, n) => H.ev('[window.__toast.slice(' + n.t + '), window.__bunyi.slice(' + n.b + ')]');
  const tanda = (H) => H.ev('({ t: window.__toast.length, b: window.__bunyi.length })');
  async function jalanSampai(H, kunci, syarat, ms) { /* tahan tombol gerak sampai syarat (alam berganti) */
    await H.page.keyboard.down(kunci);
    const t0 = Date.now(); let ok = false;
    while (Date.now() - t0 < ms) { if (await H.ev(syarat)) { ok = true; break; } await H.page.waitForTimeout(120); }
    await H.page.keyboard.up(kunci);
    return ok;
  }

  try {
    /* ================= SIANG (jam 10 WIB) ================= */
    const S = await halaman('?jam=10');
    const ms = await keKota(S);
    metrik.masukKotaMs = ms;
    cek('Pergi ke -> KOTA: masuk alam Kota (aset dibangun saat masuk)', await S.ev("myRealm === 'kota' && KOTA_SIAP && kotaScene.children.length > 20"), ms + ' ms');
    cek('Tombol keluar tampil di Kota', await S.ev("document.getElementById('exitBtn').style.display === 'inline-block'"));
    await bingkai(S.page, 3);
    metrik.siangSpawn = await info(S);
    await pandang(S, -22, 3, -1.35, 0.22, 16); await bingkai(S.page, 3);
    metrik.siangPlaza = await info(S);
    await pandang(S, 0, 40, 0, 0.05, 14); await bingkai(S.page, 3);
    metrik.siangRaya = await info(S);
    cek('Anggaran siang: draw call <= 70, segitiga <= 450k (termasuk bayangan)', [metrik.siangSpawn, metrik.siangPlaza, metrik.siangRaya].every((q) => q.calls <= 70 && q.tri <= 450000), JSON.stringify([metrik.siangSpawn, metrik.siangPlaza, metrik.siangRaya]));

    /* tinggi NPC vs avatar pemain (kotak batas verteks terkulit vs mesh avatar) */
    const tinggi = await S.ev('(function(){ avatar.updateMatrixWorld(true); var bA = new THREE.Box3(); avatar.traverse(function (o) { if (o.isMesh && !o.isSprite && o.geometry && o.geometry.attributes.position) { o.geometry.computeBoundingBox(); bA.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });'
      + ' var M = KOTA_NPC_MESH; M.updateMatrixWorld(true); M.skeleton.update(); var si = M.geometry.attributes.skinIndex, v = new THREE.Vector3(), hasil = [];'
      + ' KOTA_NPC.forEach(function (n, i) { if (n.jenis !== "ngobrol" && n.jenis !== "jaga") return; var lo = Infinity, hi = -Infinity; for (var k = 0; k < si.count; k++) { var b = si.getX(k); if (b < i * 6 || b >= i * 6 + 6) continue; M.getVertexPosition(k, v); v.applyMatrix4(M.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } hasil.push(hi - lo); });'
      + ' return { pemain: bA.max.y - bA.min.y, npc: hasil }; })()');
    const rata = tinggi.npc.reduce((a, b) => a + b, 0) / tinggi.npc.length, maks = Math.max(...tinggi.npc.map((h) => Math.abs(h - tinggi.pemain) / tinggi.pemain));
    metrik.tinggi = { pemain: +tinggi.pemain.toFixed(3), npcRata: +rata.toFixed(3), npcMin: +Math.min(...tinggi.npc).toFixed(3), npcMaks: +Math.max(...tinggi.npc).toFixed(3), n: tinggi.npc.length };
    cek('Tinggi NPC = tinggi avatar pemain (selisih <= 6%)', maks <= 0.06, JSON.stringify(metrik.tinggi));
    cek('NPC >= 25 (jalan, duduk, ngobrol)', await S.ev("KOTA_NPC.length >= 25 && KOTA_NPC.some(function (n) { return n.jenis === 'jalan'; }) && KOTA_NPC.some(function (n) { return n.jenis === 'duduk'; }) && KOTA_NPC.some(function (n) { return n.jenis === 'ngobrol'; })"));

    /* objek jalan: berdiri di titik bebas dekat objek, ketuk kanvas di atasnya */
    const objek = await S.ev('KOTA_OBJEK.map(function (o) { return { id: o.id, x: o.x, z: o.z, jarak: o.jarak }; })');
    for (const o of objek) {
      const titik = await S.ev('(function(){ var o = kotaObjekCari("' + o.id + '"), L = o.id === "lampu" ? KOTA_LAMPU_PLAZA[0] : o, best = null; for (var r = 1.2; r < o.jarak * 0.9 && !best; r += 0.4) for (var a = 0; a < 6.283; a += 0.2) { var x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r; if (kotaBebas(x, z, 0.45) && !kotaZonaPintu(x, z)) { best = { x: x, z: z, yaw: Math.atan2(x - L.x, z - L.z) }; break; } } return best; })()');
      if (!titik) { cek('Objek ' + o.id + ': titik berdiri bebas', false); continue; }
      const jauh = o.id === 'led' ? 22 : 6;
      await pandang(S, titik.x, titik.z, titik.yaw, o.id === 'led' ? 0.05 : 0.2, jauh); await bingkai(S.page, 3);
      const n0 = await tanda(S);
      const kena = await ketukSasaran(S, 'u.kota === "objek" && u.id === "' + o.id + '"');
      await S.page.waitForTimeout(o.id === 'capit' ? 3600 : (o.id === 'foto' ? 2600 : 500));
      const [toast, bunyi] = await baru(S, n0);
      if (o.id === 'stasiun') {
        const kartu = await S.ev("document.getElementById('cardTitle').textContent");
        cek('Objek stasiun: ketuk kanvas -> kartu MRT pulang', kena && /Stasiun/.test(kartu), kartu);
        await S.ev('closeCard(); 1');
      } else cek('Objek ' + o.id + ': ketuk kanvas -> reaksi + toast + bunyi', kena && toast.length > 0 && bunyi.length > 0, (kena ? 'raycast kena' : 'TIDAK KENA') + ' | ' + toast.join(' / ') + ' | ' + bunyi.join(','));
    }
    /* bangku: duduk lalu bangun */
    const bangku = await S.ev('(function(){ var k = KOTA_KURSI.filter(function (q) { return q.bangku.indexOf("bak") !== 0; })[0]; return { id: k.bangku, x: k.bangun.x, z: k.bangun.z }; })()');
    await pandang(S, bangku.x, bangku.z, 0, 0.3, 8);
    await S.ev('kotaKetuk({ kota: "bangku", id: "' + bangku.id + '" }); 1'); await bingkai(S.page, 2);
    const duduk = await S.ev("roomPose === 'sit' && document.getElementById('wakeBtn').style.display === 'inline-block'");
    await S.page.click('#wakeBtn'); await S.page.waitForTimeout(300);
    cek('Bangku Kota: duduk + tombol Bangun berdiri lagi', duduk && await S.ev('!roomPose'));

    /* 4 interior: jalan masuk lewat pintu, ketuk objek di dalam, jalan keluar */
    const pintu = await S.ev('KOTA_PINTU.map(function (p) { var d = kotaDepanPintu(p, 2.4); return { id: p.id, x: d.x, z: d.z, nx: p.nx, nz: p.nz }; })');
    for (const p of pintu) {
      await pandang(S, p.x, p.z, Math.atan2(p.nx, p.nz), 0.22, 6); /* kamera di belakang pemain, maju (W) = menuju pintu */
      await S.ev('avatar.rotation.y = ' + Math.atan2(-p.nx, -p.nz) + '; 1');
      const masuk = await jalanSampai(S, 'KeyW', "myRealm === 'kota-" + p.id + "'", 6000);
      cek('Pintu ' + p.id + ': jalan masuk -> interior', masuk, await S.ev('myRealm'));
      if (!masuk) continue;
      await S.page.waitForTimeout(600); await bingkai(S.page, 3);
      const isi = await S.ev("(function(){ var S = kotaRuangScene['" + p.id + "'], n = 0, t = 0; S.traverse(function (o) { if (o.isMesh && o.geometry && o.geometry.index) { n++; t += o.geometry.index.count / 3; } }); return { mesh: n, tri: Math.round(t), staf: !!KOTA_RUANG_WARGA['" + p.id + "'] }; })()");
      metrik['ruang_' + p.id] = Object.assign(isi, await info(S));
      cek('Interior ' + p.id + ': dibangun lengkap (perabot + staf)', isi.mesh >= 10 && isi.tri > 15000 && isi.staf, JSON.stringify(metrik['ruang_' + p.id]));
      if (process.env.FOTO_DIR) await S.page.screenshot({ path: path.join(process.env.FOTO_DIR, 'interior-' + p.id + '.png') });
      const benda = await S.ev("KOTA_RUANG_OBJEK['" + p.id + "'].map(function (o) { return { id: o.id, x: o.x, z: o.z }; })");
      for (const o of benda) {
        const q = await S.ev('KOTA_RUANG_SASARAN["' + o.id + '"]');
        await pandang(S, o.x, o.z, Math.atan2(o.x - q[0], o.z - q[2]) + 0.55, 0.35, 3.6); await bingkai(S.page, 3); /* kamera agak ke samping: avatar tidak menutupi benda */
        const n0 = await tanda(S);
        const kena = await ketukSasaran(S, 'u.kota === "ruang" && u.id === "' + o.id + '"');
        await S.page.waitForTimeout(o.id === 'capitDalam' ? 3900 : 500);
        const [toast, bunyi] = await baru(S, n0);
        cek('Interior ' + p.id + ' objek ' + o.id + ': ketuk -> reaksi + toast + bunyi', kena && toast.length > 0 && bunyi.length > 0, (kena ? 'raycast kena' : 'TIDAK KENA') + ' | ' + toast.join(' / '));
      }
      const D = await S.ev("KOTA_RUANG['" + p.id + "'].D");
      await pandang(S, 0, D / 2 - 1.8, Math.PI, 0.25, 3.4); /* menghadap pintu (+z), kamera di belakang */
      const keluar = await jalanSampai(S, 'KeyW', "myRealm === 'kota'", 6000);
      const luar = await S.ev("(function(){ var p = kotaPintuCari('" + p.id + "'); return { jarak: Math.hypot(avatarPos.x - p.x, avatarPos.z - p.z), zona: !!kotaZonaPintu(avatarPos.x, avatarPos.z) }; })()");
      cek('Pintu ' + p.id + ': jalan keluar -> kembali ke jalan Kota di depan pintu', keluar && luar.jarak < 3 && !luar.zona, JSON.stringify(luar));
    }
    /* keluar Kota -> kembali ke tempat asal (halaman) */
    await S.page.click('#menuBtn'); await S.page.waitForTimeout(300); /* tombol Keluar ada di menu kanan atas */
    await S.page.click('#exitBtn'); await S.page.waitForTimeout(600);
    cek('Keluar Kota -> kembali ke halaman asal', await S.ev("myRealm === 'yard' && avatar.parent === scene"), await S.ev('myRealm'));
    cek('Siang: 0 pageerror', S.err.length === 0, S.err.slice(0, 3).join(' | '));
    await S.ctx.close();

    /* ================= MALAM (jam 20 WIB) ================= */
    const M = await halaman('?jam=20');
    await keKota(M);
    await bingkai(M.page, 4);
    metrik.malamSpawn = await info(M);
    await pandang(M, -22, 3, -1.35, 0.22, 16); await bingkai(M.page, 3);
    metrik.malamPlaza = await info(M);
    await pandang(M, 0, 40, 0, 0.05, 14); await bingkai(M.page, 3);
    metrik.malamRaya = await info(M);
    const malam = await M.ev('({ malam: KOTA_U.malam.value, jendela: !!KOTA_U.kacaMalam.value, peta: !!KOTA_U.peta.value })');
    cek('Malam: Suasana WIB -> Kota malam (jendela + genangan lampu aktif)', malam.malam > 0.9 && malam.jendela && malam.peta, JSON.stringify(malam));
    cek('Anggaran malam: draw call <= 70, segitiga <= 450k', [metrik.malamSpawn, metrik.malamPlaza, metrik.malamRaya].every((q) => q.calls <= 70 && q.tri <= 450000), JSON.stringify([metrik.malamSpawn, metrik.malamPlaza, metrik.malamRaya]));
    await M.ev("kotaMasukRuang('hotel'); 1"); await bingkai(M.page, 3);
    metrik.malamHotel = await info(M);
    cek('Malam: masuk interior + keluar', (await M.ev("myRealm === 'kota-hotel'")) && (await M.ev("kotaKeluarRuang(), myRealm === 'kota'")));
    cek('Malam: 0 pageerror', M.err.length === 0, M.err.slice(0, 3).join(' | '));
    await M.ctx.close();
  } catch (e) {
    cek('tanpa pengecualian', false, e.message);
  }
  console.log('METRIK ' + JSON.stringify(metrik));
  const gagal = hasil.filter((h) => !h.ok).length;
  console.log('\n' + (hasil.length - gagal) + '/' + hasil.length + ' lulus');
  await browser.close(); srv.server.close();
  process.exit(gagal ? 1 : 0);
})();
