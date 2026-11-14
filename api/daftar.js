'use strict';
/* POST /api/daftar — daftar penghuni baru (PIN != username dicek di server) */
module.exports = require('./_lib/jalankan').jalankan('daftar', 'POST');
