/* Service worker e-Surat Gizi – menyimpan aplikasi & template agar tetap bisa dibuka saat sinyal lemah */
var VERSION = 'esurat-v1';
var SHELL = [
  './', 'index.html', 'style.css', 'config.js', 'jenis.js', 'app.js', 'manifest.webmanifest',
  'vendor/pizzip.min.js', 'vendor/docxtemplater.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'templates/surat-dinas.docx', 'templates/nota-dinas.docx', 'templates/surat-tugas.docx',
  'templates/surat-keterangan.docx', 'templates/surat-pengantar.docx',
  'templates/surat-keputusan.docx', 'templates/surat-keputusan-tanpa-lampiran.docx', 'templates/notula-rapat.docx'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // panggilan API (POST) selalu ke jaringan
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;             // Google, font, sso.js: biarkan browser
  // network-first agar pembaruan cepat terlihat; cache dipakai saat offline
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});
