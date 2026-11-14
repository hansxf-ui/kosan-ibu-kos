'use strict';
/* POST /api/setup/pin — alias /api/masuk (username + PIN -> sesi langsung) */
module.exports = require('../_lib/jalankan').jalankan('setupPin', 'POST');
