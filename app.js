/* Kosan Ibu Kos — ketik nama, lihat preview nomor kamarmu (SEPENUHNYA STATIS)
   Situs ini TIDAK punya backend, database, atau jalur tulis apa pun.
   Semua yang tampil dihitung lokal di HP pengunjung dari kode di bawah.
   (Keputusan desain 7 Nov 19:16 — perintah pemilik: klaim publik dengan nama
   ngasal DILARANG, "rusak nanti jadinya".) */
(function () {
  'use strict';

  /* ---------- penghuni BERSAMA = data baked-in (BACA ATURANNYA) ----------
     Denah bersama HANYA menampilkan nama yang ada di objek RESIDENTS ini.
     Aturan (akar masalah yang diperbaiki 7 Nov: shared state TIDAK BOLEH
     dipercayakan pada tulis publik tanpa autentikasi — model kepercayaan
     format ini cuma punya SATU penulis terpercaya: cerita, yaitu pemilik/Vesper
     lewat episode. Pengunjung jadi penghuni LEWAT cerita (follow + komen di
     episode), BUKAN dengan menulis langsung ke database):
     - Penghuni HANYA ditambahkan Vesper lewat deploy, SETELAH orangnya
       tampil di episode (komen/follow) atas perintah pemilik. Lihat
       ~/workspace/kosan-ibu-kos/PENGHUNI.md untuk runbook-nya.
     - JANGAN PERNAH isi nama dari form pengunjung, dari deep link, atau
       nama ngasal / tanpa episode. Form di situs ini TIDAK menulis apa pun
       ke mana pun — preview dihitung lokal di HP pengunjung saja.
     - Isi kamar TETAP kosong sampai episode membangunnya (fasilitas hanya
       muncul di web SETELAH dibangun di episode).
     - Tempatkan penghuni di kamar hash-nya (lihat roomFor) kalau masih
       kosong; kalau sudah ditempati penghuni lain, pakai kamar kosong
       berikutnya (1..10). Jangan pernah menimpa penghuni lain.
     Format: nomor kamar (1..10) -> nama penghuni persis seperti di episode. */
  var RESIDENTS = {
    /* KOSONG — belum ada penghuni beneran. */
  };

  /* ---------- data 10 kamar: KOSONG SEMUA (aturan pemilik 6 Nov 21:24) ----------
     Kosan beneran kosong dulu — tidak ada nama/perk/fasilitas yang sudah
     jadi. Isi kamar HANYA muncul setelah penonton komen + vote di episode
     dan Ibu membangunnya di episode berikut. Jangan tambahkan nama/perk di
     sini tanpa perintah pemilik. ---------- */
  var EMPTY_ROOM = { name: 'Masih kosong', icon: '🚪', resident: false, perk: 'Belum ada apa-apa di sini. Komen di episode mau kamarmu diisi apa — like terbanyak langsung Ibu bangun!' };

  /* Isi kamar menurut data baked-in: kamar yang ada penghuninya menampilkan
     nama penghuninya; yang belum tetap "Masih kosong". */
  function roomView(n) {
    var name = RESIDENTS[n];
    if (name) {
      return { name: name, icon: '👤', resident: true, perk: 'Kamar ini dihuni ' + name + '. Isinya masih kosong — komen di episode mau diisi apa, like terbanyak Ibu bangun!' };
    }
    return EMPTY_ROOM;
  }

  function firstName(name) {
    return String(name).split(' ')[0].slice(0, 10);
  }

  /* ---------- elemen ---------- */
  var form = document.getElementById('nameForm');
  var input = document.getElementById('nama');
  var hint = document.getElementById('nameHint');
  var cardWrap = document.getElementById('cardWrap');
  var card = document.getElementById('residentCard');
  var toastEl = document.getElementById('toast');
  var currentRoom = 0;
  var currentName = '';
  var currentIsResident = false;

  /* ---------- hash deterministik (FNV-1a) ---------- */
  function normalize(nama) {
    return nama.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function roomFor(nama) {
    var s = normalize(nama), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h % 10) + 1;
  }
  function makeId(nama, room) {
    var clean = normalize(nama).replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase();
    while (clean.length < 4) clean += 'X';
    return 'KOSAN-' + String(room).padStart(2, '0') + '-' + clean;
  }

  /* ---------- preview kamar (LOKAL SAJA — tidak menulis apa pun) ----------
     SATU kebenaran untuk preview (hash murni), SATU kebenaran untuk denah
     bersama (RESIDENTS) — keduanya tidak pernah bisa bertentangan, karena
     dihitung dari masukan yang berbeda dan eksplisit.
     (a) nama penghuni beneran -> kamar yang tercatat di RESIDENTS;
     (b) belum -> kamar hash FNV-1a kalau masih kosong;
     (c) kamar hash sudah dihuni orang lain -> kamar kosong berikutnya (1..10);
     (d) 10 kamar penuh -> null (tidak ada kamar untuk di-preview). */
  function previewFor(nama) {
    var key = normalize(nama);
    for (var n = 1; n <= 10; n++) {
      if (RESIDENTS[n] && normalize(RESIDENTS[n]) === key) {
        return { room: n, resident: true, moved: false };
      }
    }
    var hashRoom = roomFor(nama);
    if (!RESIDENTS[hashRoom]) {
      return { room: hashRoom, resident: false, moved: false };
    }
    for (var i = 1; i <= 10; i++) {
      if (!RESIDENTS[i]) {
        return { room: i, resident: false, moved: true, hashRoom: hashRoom };
      }
    }
    return null; /* kosan penuh */
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, lama) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, lama || 2600);
  }

  /* ---------- confetti ---------- */
  function celebrate() {
    if (typeof confetti !== 'function') return;
    var colors = ['#FFD11A', '#2E7FD6', '#E86A33', '#3FA34D', '#F4845F'];
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: colors });
    setTimeout(function () {
      confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: colors });
      confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: colors });
    }, 250);
  }

  /* ---------- denah ---------- */
  function buildDenah() {
    [['roomsL1', [1, 2, 3, 4, 5]], ['roomsL2', [6, 7, 8, 9, 10]]].forEach(function (pair) {
      var box = document.getElementById(pair[0]);
      pair[1].forEach(function (n) {
        var r = roomView(n);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'room' + (r.resident ? ' taken' : '');
        b.dataset.room = n;
        b.setAttribute('aria-label', 'Kamar ' + n + ' ' + r.name);
        var num = document.createElement('span');
        num.className = 'room-num';
        num.textContent = n;
        var ico = document.createElement('span');
        ico.className = 'room-ico';
        ico.textContent = r.icon;
        var nm = document.createElement('span');
        nm.className = 'room-name';
        nm.textContent = r.resident ? firstName(r.name) : '';
        b.appendChild(num);
        b.appendChild(ico);
        b.appendChild(nm);
        b.addEventListener('click', function () { showRoomDetail(n, false, false); });
        box.appendChild(b);
      });
    });
  }

  function showRoomDetail(n, isMine, isResident) {
    document.querySelectorAll('.room').forEach(function (el) {
      el.classList.toggle('sel', +el.dataset.room === n && !isMine);
    });
    var r = roomView(n);
    var kicker = document.getElementById('detailKicker');
    kicker.textContent = 'KAMAR ';
    var num = document.createElement('span');
    num.id = 'detailNum';
    num.textContent = n;
    kicker.appendChild(num);
    document.getElementById('detailName').textContent = 'Kamar ' + n + ' — ' + r.name;
    document.getElementById('detailPerk').textContent = r.perk;
    var old = document.querySelector('.room-detail .mine-tag');
    if (old) old.remove();
    if (isMine) {
      var tag = document.createElement('span');
      tag.className = 'mine-tag';
      tag.textContent = isResident ? '⭐ Ini kamarmu!' : '⭐ Preview kamarmu';
      document.getElementById('roomDetail').appendChild(tag);
    }
  }

  /* ---------- ruang tamu (ruang bersama, bukan kamar) ----------
     Ruang tamu = ruang bersama semua penghuni — tempat router WiFi dipasang
     (Episode 2). BUKAN kamar: tidak masuk hitungan 10 kamar, tidak bisa jadi
     kamar siapa pun (tidak ada data-room, tidak ada di RESIDENTS, roomFor
     hanya mengembalikan 1..10). WiFi DIBANGUN di Episode 2 (v6, tayang
     7 Nov 20:17 WITA) — router + sinyal penuh muncul di sini sesudah
     episode itu tayang. ---------- */
  var RUANG_TAMU_PERK = 'Tempat kumpul semua penghuni — nonton bareng, ngobrol, numpang WiFi. 📶 Router baru terpasang di sini, sinyal penuh, internetnya ngebut! WiFi kenceng — request terbanyak di Episode 2, Ibu bangun buat semua penghuni.';
  function showSharedDetail() {
    document.querySelectorAll('.room').forEach(function (el) { el.classList.remove('sel'); });
    document.getElementById('ruangTamu').classList.add('sel');
    var kicker = document.getElementById('detailKicker');
    kicker.textContent = 'RUANG BERSAMA ';
    var ico = document.createElement('span');
    ico.id = 'detailNum';
    ico.textContent = '🛋️';
    kicker.appendChild(ico);
    document.getElementById('detailName').textContent = 'Ruang Tamu — tempat kumpul penghuni';
    document.getElementById('detailPerk').textContent = RUANG_TAMU_PERK;
    var old = document.querySelector('.room-detail .mine-tag');
    if (old) old.remove();
  }

  function markMyRoom(n, isResident) {
    document.querySelectorAll('.room').forEach(function (el) {
      el.classList.toggle('mine', +el.dataset.room === n);
      el.classList.remove('sel');
    });
    showRoomDetail(n, true, isResident);
  }

  /* ---------- kartu penghuni ----------
     Kartu adalah SNAPSHOT preview di HP pengunjung — bukan bukti tercatat di
     denah bersama. Makanya kepala kartu JUJUR: penghuni beneran dapat
     "KARTU PENGHUNI RESMI", preview dapat "KARTU PREVIEW KAMAR". Semua nama
     dimasukkan HANYA lewat textContent (tidak pernah innerHTML). ---------- */
  function showCard(nama, room, isResident, withConfetti) {
    var r = roomView(room);
    currentName = nama;
    currentRoom = room;
    currentIsResident = !!isResident;
    document.getElementById('cardRoomNum').textContent = room;
    document.getElementById('cardRoomName').textContent = 'Kamar ' + room + ' — ' + r.name;
    document.getElementById('cardRoomPerk').textContent = r.perk;
    document.getElementById('cardName').textContent = nama;
    document.getElementById('cardNameLabel').textContent = isResident ? 'Nama Penghuni' : 'Namamu (preview)';
    document.getElementById('cardKicker').textContent = isResident ? 'KARTU PENGHUNI RESMI' : 'KARTU PREVIEW KAMAR';
    document.getElementById('cardStamp').textContent = isResident ? 'RESMI PENGHUNI' : 'PREVIEW';
    document.getElementById('cardNote').textContent = isResident
      ? 'Kamar ditentukan dari namamu — jadi nama yang sama selalu dapat kamar yang sama. Cocok buat absen Episode 3 nanti.'
      : 'Ini preview — namamu belum tercatat di denah. Biar tercatat, komen di episode dan tunggu Ibu absen!';
    document.getElementById('cardId').textContent = 'ID: ' + makeId(nama, room);
    cardWrap.hidden = false;
    card.classList.remove('capturing');
    void card.offsetWidth; /* restart animasi pop */
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    markMyRoom(room, isResident);
    if (withConfetti) celebrate();
  }

  function assign(nama, opts) {
    opts = opts || {};
    var hasil = previewFor(nama);
    if (!hasil) {
      cardWrap.hidden = true;
      toast('Kosan penuh! Semua kamar udah ada penghuninya. Tunggu episode berikutnya ya.', 5000);
      hint.textContent = 'Kosan penuh — semua kamar sudah ada penghuninya. Tunggu ada yang pindah di episode berikutnya!';
      hint.classList.remove('err');
      return null;
    }
    if (hasil.resident) {
      hint.textContent = 'Kamu penghuni Kamar ' + hasil.room + ' — namamu sudah tercatat di denah. Nama yang sama = kamar yang sama.';
    } else if (hasil.moved) {
      hint.textContent = 'Kamar ' + hasil.hashRoom + ' udah dihuni ' + RESIDENTS[hasil.hashRoom] + ' — preview-mu Kamar ' + hasil.room + '. Ini baru preview, belum tercatat di denah.';
      toast('Kamar ' + hasil.hashRoom + ' udah ada penghuninya — preview-mu Kamar ' + hasil.room + '.', 5000);
    } else {
      hint.textContent = 'Ini preview saja — kamarmu belum tercatat di denah. Nama yang sama = kamar yang sama.';
    }
    hint.classList.remove('err');
    showCard(nama, hasil.room, hasil.resident, opts.confetti !== false);
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('nama', nama);
      window.history.replaceState(null, '', url.toString());
    } catch (e) { /* abaikan */ }
    if (opts.scroll !== false) {
      setTimeout(function () {
        cardWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
    return hasil.room;
  }

  /* ---------- form ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nama = input.value.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!nama) {
      hint.textContent = 'Isi dulu namamu, masa Ibu nggak kenal penghuninya?';
      hint.classList.add('err');
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      input.focus();
      return;
    }
    assign(nama, {});
  });

  document.getElementById('btnAgain').addEventListener('click', function () {
    cardWrap.hidden = true;
    input.value = '';
    input.focus();
    document.getElementById('cek-kamar').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- download kartu ---------- */
  document.getElementById('btnDownload').addEventListener('click', function () {
    if (typeof html2canvas !== 'function') { toast('Ups, gagal simpan kartu. Coba lagi ya.'); return; }
    var btn = this;
    btn.textContent = '⏳ Lagi digambar...';
    btn.disabled = true;
    card.classList.add('capturing');
    html2canvas(card, { scale: 2, backgroundColor: '#FFF6E5', useCORS: true }).then(function (canvas) {
      var a = document.createElement('a');
      a.download = 'kartu-penghuni-kosan-ibu-kos.png';
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Kartu tersimpan. Pamerin di komen episode terbaru ya!');
    }).catch(function () {
      toast('Ups, gagal simpan kartu. Coba lagi ya.');
    }).finally(function () {
      card.classList.remove('capturing');
      btn.textContent = '💾 Simpan Kartu (PNG)';
      btn.disabled = false;
    });
  });

  /* ---------- bagikan ---------- */
  document.getElementById('btnShare').addEventListener('click', function () {
    var url = window.location.href;
    var text = currentIsResident
      ? 'Aku penghuni Kamar ' + currentRoom + ' di Kosan Ibu Kos! Kamarku masih kosong — komen di episode terbaru mau diisi apa:'
      : 'Aku dapat preview Kamar ' + currentRoom + ' di Kosan Ibu Kos! (baru preview, belum tercatat) Kamarku masih kosong — komen di episode terbaru mau diisi apa:';
    function copyFallback() {
      var done = function () { toast('Link kamarmu disalin. Kirim ke temanmu!'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { toast('Link: ' + url); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast('Link: ' + url); }
        ta.remove();
      }
    }
    if (navigator.share) {
      navigator.share({ title: 'Kosan Ibu Kos', text: text, url: url }).catch(function () { /* batal = diam */ });
    } else {
      copyFallback();
    }
  });

  /* ---------- reveal saat scroll ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- init ---------- */
  buildDenah();
  document.getElementById('ruangTamu').addEventListener('click', showSharedDetail);
  showRoomDetail(5, false, false); /* default: kamar 5 */
  var params = new URLSearchParams(window.location.search);
  var deep = params.get('nama');
  if (deep) {
    var nama = deep.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (nama) {
      input.value = nama;
      assign(nama, { confetti: true, scroll: false });
      setTimeout(function () {
        cardWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }
})();
