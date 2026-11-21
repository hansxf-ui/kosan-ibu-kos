'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const html = readFileSync(require.resolve('../index.html'), 'utf8');
let kota;
before(async () => {
  // Buat scene dan matriks Three.js asli. Hanya kanvas tekstur dan HUD yang memerlukan browser.
  const THREE = await import('../vendor/three/three.module.js');
  const blok = html.slice(html.indexOf('/* ==== KOTA:'), html.indexOf('/* ==== KOTA END'));
  const menu = { addEventListener: (event, fn) => assert.equal(fn.name, 'enterKota') };
  kota = Function(
    'THREE',
    'scene',
    'document',
    'teksturLukis',
    'lukisKain',
    html.slice(html.indexOf('function krGabung(list)'), html.indexOf('var krM4')) +
      blok +
      `
    kotaBangunJalan();
    const interior = KOTA_GEDUNG.filter(g => g[6]);
    interior.forEach(kotaBangunRuang);
    return { street: kotaScenes.kota, gedung: KOTA_GEDUNG, interior, scenes: kotaScenes, area: kotaArea,
      npc: KOTA_NPC, langkah: kotaLangkah, gambar: kotaKerumunan, aksi: KOTA_AKSI,
      gerak: kotaBatasGerak, jalan: KOTA_JALAN, ruang: KOTA_RUANG };
  `
  )(
    THREE,
    new THREE.Scene(),
    {
      getElementById: (id) => {
        assert.equal(id, 'kotaBtn');
        return menu;
      }
    },
    () => new THREE.Texture(),
    () => {}
  );
});
test('Kota terdaftar di Pergi ke, delapan fasad berbeda dan tiga pintu ke interior', () => {
  const menu = html.match(/<div id="masukMenu">([\s\S]*?)<\/div>/)[1];
  assert.match(menu, /id="kotaBtn"/);
  assert.ok(new Set(kota.gedung.map((g) => g[3])).size >= 8);
  assert.deepEqual(kota.interior.map((g) => g[6]).sort(), ['kafe', 'lobi', 'toko']);
  assert.equal(kota.area.get(kota.street).taps.length, kota.interior.length + kota.aksi.length);
  assert.ok(kota.aksi.length >= 5);
  for (const { taps } of kota.area.values())
    for (const mesh of taps) {
      assert.equal(mesh.material.visible, false);
      for (let node = mesh; node; node = node.parent) assert.equal(node.visible, true);
    }
  for (const g of kota.interior) {
    const area = kota.area.get(kota.scenes['kota-' + g[6]]);
    assert.equal(area.taps.length, 1);
    assert.ok(area.solids.length >= 3);
  }
});
test('Pejalan kaki bergerak dalam kedua arah di jalur berbeda dan geometri dirender secara instans', () => {
  assert.ok(kota.npc.length >= 15);
  assert.ok(new Set(kota.npc.map((p) => p.laju)).size >= 4);
  assert.ok(new Set(kota.npc.map((p) => p.x)).size >= 6);
  const arah = new Set();
  for (const p of kota.npc) {
    const a = kota.langkah(p, 0),
      b = kota.langkah(p, 0.1);
    assert.notEqual(a.z, b.z);
    arah.add(a.arah);
    for (let t = 0; t < 135; t += 1.7) {
      const { z } = kota.langkah(p, t);
      assert.ok(z >= p.awal && z <= p.akhir);
      const wx = p.melintang ? z : p.x,
        wz = p.melintang ? -p.x : z;
      assert.ok(
        kota.area
          .get(kota.street)
          .solids.every((s) => wx < s.minX - 0.23 || wx > s.maxX + 0.23 || wz < s.minZ - 0.23 || wz > s.maxZ + 0.23)
      );
    }
  }
  assert.equal(arah.size, 2);
  kota.gambar(10);
  assert.ok(kota.street.children.filter((o) => o.isInstancedMesh).length < 100);
});
test('Halangan jalan dan perabot interior menahan sapuan panjang dari keempat sisi', () => {
  for (const [scene, area] of kota.area) {
    const bounds = scene === kota.street ? kota.jalan : kota.ruang;
    for (const box of area.solids) {
      const x = (box.minX + box.maxX) / 2,
        z = (box.minZ + box.maxZ) / 2;
      const gerak = (a, b, c, d) => kota.gerak(a, b, c, d, bounds, area.solids);
      if (bounds.minX <= box.minX - 0.4) assert.ok(gerak(bounds.minX, z, bounds.maxX, z).x <= box.minX - 0.4);
      if (bounds.maxX >= box.maxX + 0.4) assert.ok(gerak(bounds.maxX, z, bounds.minX, z).x >= box.maxX + 0.4);
      // Billboard ujung utara menempel pada batas, jadi hanya sisi dalam yang dapat didekati.
      if (bounds.minZ <= box.minZ - 0.4) assert.ok(gerak(x, bounds.minZ, x, bounds.maxZ).z <= box.minZ - 0.4);
      if (bounds.maxZ >= box.maxZ + 0.4) assert.ok(gerak(x, bounds.maxZ, x, bounds.minZ).z >= box.maxZ + 0.4);
    }
    const pos = kota.gerak(0, 0, 1000, -1000, bounds, area.solids);
    assert.ok(pos.x <= bounds.maxX && pos.z >= bounds.minZ);
  }
});

test('Promenade dapat dilintasi dari terminal ke terminal dan seluruh pintu terhubung ke plaza', () => {
  const area = kota.area.get(kota.street);
  const langkah = (a, b, x, z) => kota.gerak(a, b, x, z, kota.jalan, area.solids);
  const z = 6.8;
  assert.deepEqual(langkah(-46, z, 34, z), { x: 34, z });
  assert.deepEqual(langkah(34, z, -46, z), { x: -46, z });
  // Koridor menyempit di kedua ujung. Swept collision juga menahan langkah besar.
  for (const x of [-40, 30]) {
    assert.ok(langkah(x, z, x, 25).z < 8.2);
    assert.ok(langkah(x, z, x, -16).z > -0.18);
  }
  const queue = [[0, 25]],
    seen = new Set(['0,25']);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nx = x + dx,
        nz = z + dz,
        key = nx + ',' + nz;
      if (seen.has(key)) continue;
      const pos = langkah(x, z, nx, nz);
      if (pos.x === nx && pos.z === nz) {
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
  }
  for (const obj of area.taps)
    assert.ok(
      queue.some(([x, z]) => Math.hypot(x - obj.position.x, z - obj.position.z) < 4),
      'area ketuk dapat didekati'
    );
  for (const key of ['-46,4', '33,4', '-17,5', '17,5', '0,-16']) assert.ok(seen.has(key), key);
});
