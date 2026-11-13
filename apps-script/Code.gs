/**
 * e-SURAT GIZI — server (Google Apps Script) untuk aplikasi pembuat naskah dinas
 * Jurusan Gizi Poltekkes Kemenkes Makassar.
 *
 * Tugas server ini:
 *   1. Memeriksa login Gizi-Link (hanya Kajur, Sekjur, Kaprodi, KaLab).
 *   2. Mengirim daftar pegawai (nama, NIP, pangkat/gol., jabatan) dari sheet "Staf" Gizi Link.
 *   3. Menyimpan ARSIP isian surat di Google Sheet ini, supaya surat bisa dibuka & diedit lagi
 *      tanpa mengetik dari awal.
 *   File .docx sendiri dibuat di browser — tidak ada file surat yang disimpan di server.
 *
 * CARA PASANG (lengkapnya di README.md):
 *  1. Buat Google Sheet baru, beri nama "e-Surat Gizi - Arsip" → Ekstensi → Apps Script
 *     → hapus isi Code.gs → tempel file ini → Simpan.
 *  2. Setelan Project (ikon roda gigi) → Properti Skrip → tambahkan
 *        SSO_SECRET = (salin dari Apps Script portal Gizi-Link — sama dengan aplikasi lain)
 *  3. Pilih fungsi `setup` → Jalankan → izinkan akses. Terbentuk tab "Arsip" dan "Pengaturan".
 *  4. Pilih fungsi `lengkapiStaf` → Jalankan SEKALI. Sheet "Staf" di Gizi Link dilengkapi kolom
 *     Nama Surat, Gol, Pangkat, Jabatan Fungsional, Jabatan Struktural (data DUK 2026).
 *  5. Terapkan → Deployment baru → Aplikasi web → Jalankan sebagai: Saya,
 *     Yang memiliki akses: Siapa saja → salin URL /exec ke config.js (API_URL).
 */

var CONFIG = {
  ZONA: 'Asia/Makassar',
  // Spreadsheet "Gizi Link" (tab Staf & Mahasiswa)
  GIZI_LINK_ID: '1iYaqOG-6C0n0uSjMGSiUU1YZrqOn48wkOptZMBphYdQ',
  // Kode di kolom "Jabatan" sheet Staf yang boleh memakai aplikasi
  JABATAN_BOLEH: ['kajur', 'sekjur', 'kaprodi', 'kalab'],
  MAKS_DATA: 45000            // batas aman panjang data per naskah (1 sel Google Sheet = 50.000 karakter)
};

var KOLOM_ARSIP = ['ID', 'Dibuat', 'Diubah', 'Kode', 'Jenis', 'Hal', 'Pembuat', 'ID Pembuat', 'Diubah Oleh', 'Data'];
var KOLOM_STAF_BARU = ['Nama Surat', 'Gol', 'Pangkat', 'Jabatan Fungsional', 'Jabatan Struktural'];

/* ===================== PASANG ===================== */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Arsip') || ss.insertSheet('Arsip');
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, KOLOM_ARSIP.length).setValues([KOLOM_ARSIP]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), KOLOM_ARSIP.length).setNumberFormat('@');   // semua teks polos
    sh.setColumnWidth(6, 360);
    sh.setColumnWidth(10, 220);
  }
  var pg = ss.getSheetByName('Pengaturan') || ss.insertSheet('Pengaturan');
  if (pg.getLastRow() === 0) {
    pg.getRange(1, 1, 3, 3).setValues([
      ['kunci', 'nilai', 'keterangan'],
      ['direktur', 'ADDI MARDI HARNANTO', 'Nama Direktur pada Surat Keputusan (boleh dengan gelar)'],
      ['telepon', '', 'No. telepon pengirim pada Surat Pengantar']
    ]);
    pg.getRange(1, 1, 1, 3).setFontWeight('bold');
    pg.getRange(1, 1, pg.getMaxRows(), 3).setNumberFormat('@');
    pg.setColumnWidth(2, 280); pg.setColumnWidth(3, 420);
  }
  var kosong = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (kosong && kosong.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(kosong);

  if (!PropertiesService.getScriptProperties().getProperty('SSO_SECRET')) {
    Logger.log('PERHATIAN: Properti Skrip SSO_SECRET belum diisi. Salin dari Apps Script portal Gizi-Link.');
  }
  try {
    var staf = SpreadsheetApp.openById(CONFIG.GIZI_LINK_ID).getSheetByName('Staf');
    Logger.log('Sheet Staf Gizi Link terbaca: ' + (staf.getLastRow() - 1) + ' baris.');
  } catch (e) {
    Logger.log('PERHATIAN: Sheet Gizi Link tidak bisa dibuka (' + e.message + '). Jalankan dengan akun yang punya akses edit ke sheet itu.');
  }
  Logger.log('Setup selesai.');
}

/* ===================== LENGKAPI SHEET STAF (jalankan SEKALI) ===================== */
var PANGKAT = {
  'II/c': 'Pengatur', 'II/d': 'Pengatur Tk. I',
  'III/a': 'Penata Muda', 'III/b': 'Penata Muda Tk. I', 'III/c': 'Penata', 'III/d': 'Penata Tk. I',
  'IV/a': 'Pembina', 'IV/b': 'Pembina Tk. I', 'IV/c': 'Pembina Utama Muda', 'IV/d': 'Pembina Utama Madya', 'IV/e': 'Pembina Utama'
};

/** Sumber: Daftar Urut Kepangkatan Pegawai Jurusan Gizi Tahun 2026. [NIP, nama rapi, gol, jabatan fungsional, jabatan struktural] */
var DUK_2026 = [
  ['19620817 198503 1 004', 'Dr. Ir. H. Agustian Ipa, M.Kes', 'IV/c', 'Lektor Kepala', ''],
  ['19640126 198603 2 002', "Dr. Ir. Hj. Hikmawati Mas'ud, M.Kes", 'IV/c', 'Lektor Kepala', ''],
  ['19661231 198703 1 008', 'Dr. Nadimin, SKM, M.Kes', 'IV/c', 'Lektor Kepala', ''],
  ['19681117 199203 2 001', 'Dr. Lydia Fanny, DCN, M.Kes, Dietisien', 'IV/c', 'Lektor Kepala', ''],
  ['19640305 198603 1 004', 'Dr. H. Zakaria, STP, M.Kes', 'IV/c', 'Lektor Kepala', ''],
  ['19670619 199203 1 002', 'Dr. H. Mustamin, SP, M.Kes', 'IV/b', 'Lektor Kepala', ''],
  ['19700613 199803 1 002', 'Prof. Dr. Rudy Hartono, SKM, M.Kes', 'IV/b', 'Guru Besar', ''],
  ['19651116 198603 2 001', 'Dr. Hj. Sukmawati, SKM, M.Kes', 'IV/a', 'Lektor Kepala', ''],
  ['19700117 200604 2 002', 'Retno Sri Lestari, S.Pd, M.Kes', 'IV/a', 'Asisten Ahli', ''],
  ['19690203 199303 1 004', 'Dr. Sirajuddin, SP, M.Kes', 'IV/a', 'Lektor Kepala', 'Ketua Program Studi Pendidikan Profesi Dietisien'],
  ['19720613 199803 2 001', 'Elsy Premiwati, SS, S.Hum', 'IV/a', 'Pustakawan Ahli Madya', ''],
  ['19671126 199203 2 003', 'Dr. Hendrayati, DCN, M.Kes', 'III/d', 'Lektor', ''],
  ['19791221 201212 2 001', 'Adriyani Adam, SKM, M.Kes', 'III/d', 'Lektor Kepala', ''],
  ['19770116 200112 2 003', 'Aswita Amir, DCN, M.Si', 'III/d', 'Lektor', 'Sekretaris Jurusan Gizi'],
  ['19761120 200112 1 003', 'Nursalim, S.Gz, M.Si', 'III/d', 'Asisten Ahli', 'Kepala Unit Laboratorium Jurusan Gizi'],
  ['19851108 200912 2 002', 'Hijrah Asikin, SST, M.Biomed', 'III/d', 'Asisten Ahli', ''],
  ['19720420 199603 2 001', 'Thresia Dewi Kartini B, SKM, M.Si', 'III/d', 'Lektor', 'Ketua Program Studi Sarjana Terapan Gizi dan Dietetika'],
  ['19881105 201012 2 001', 'Mira Andini, S.Gz, M.Gz', 'III/d', 'Dosen', ''],
  ['19651108 198603 2 001', 'Sitti Sahariah Rowa, S.SiT, M.Kes', 'III/d', 'Lektor', ''],
  ['19680707 199203 1 002', 'Abdullah Tamrin, DCN, M.Kes', 'III/d', 'Lektor', ''],
  ['19660715 198903 2 001', 'Suriani Rauf, S.SiT, M.Si', 'III/d', 'Lektor', ''],
  ['19771009 200604 1 010', 'Manjilala, S.Gz, M.Gizi', 'III/d', 'Lektor', 'Ketua Jurusan Gizi'],
  ['19690410 198903 2 001', 'Andi Toewo Titi ZA, SKM', 'III/d', 'Penata Layanan Operasional', ''],
  ['19750503 200604 2 024', 'Chaerunnimah, SKM, M.Kes', 'III/c', 'Lektor', 'Ketua Program Studi Diploma Tiga Gizi'],
  ['19880523 201012 2 001', 'Faramitha, S.SiT, M.T.P', 'III/b', 'Pengelola Keuangan', ''],
  ['19630318 199103 1 003', 'Sunarto, S.SiT, M.Kes', 'III/b', 'Lektor', ''],
  ['19741013 201412 1 001', 'Sanuddin', 'II/c', 'Pramubakti', ''],
  ['19710202 201412 1 001', 'Amirullah', 'II/c', 'Pramubakti', '']
];

/**
 * Melengkapi sheet "Staf" di Gizi Link:
 *  - menambah kolom Nama Surat, Gol, Pangkat, Jabatan Fungsional, Jabatan Struktural (di ujung kanan,
 *    kolom lama tidak digeser sehingga aplikasi Gizi-Link lain tidak terpengaruh);
 *  - mengisi kolom itu dari DUK 2026 (sel yang sudah berisi TIDAK ditimpa);
 *  - menambah pegawai yang ada di DUK tetapi belum ada di sheet Staf.
 * Aman dijalankan ulang.
 */
function lengkapiStaf() {
  var sh = SpreadsheetApp.openById(CONFIG.GIZI_LINK_ID).getSheetByName('Staf');
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  KOLOM_STAF_BARU.forEach(function (k) {
    if (head.indexOf(k) < 0) {
      head.push(k);
      sh.getRange(1, head.length).setValue(k).setFontWeight('bold');
    }
  });
  var cID = head.indexOf('ID'), cNama = head.indexOf('Nama'), cPin = head.indexOf('PIN');
  var cBaru = KOLOM_STAF_BARU.map(function (k) { return head.indexOf(k); });
  sh.getRange(1, cBaru[0] + 1, sh.getMaxRows(), KOLOM_STAF_BARU.length).setNumberFormat('@');

  var data = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), head.length).getValues();
  var barisID = {};
  data.forEach(function (r, i) { barisID[normId_(r[cID])] = i; });

  var diisi = 0, ditambah = [];
  DUK_2026.forEach(function (d) {
    var nilai = [d[1], d[2], PANGKAT[d[2]] || '', d[3], d[4]];
    var i = barisID[normId_(d[0])];
    if (i == null) {
      // pegawai belum ada di sheet Staf → sisipkan sebelum baris akun "admin"
      var posisi = data.length + 2;
      for (var k = 0; k < data.length; k++) { if (String(data[k][cID]).trim().toLowerCase() === 'admin') { posisi = k + 2; break; } }
      sh.insertRowBefore(posisi);
      var baris = head.map(function () { return ''; });
      baris[cID] = d[0]; baris[cNama] = d[1];
      // PIN acak supaya akun ini tidak bisa dimasuki dengan PIN kosong; ganti bila pegawai ini perlu login Gizi-Link
      if (cPin >= 0) baris[cPin] = String(Math.floor(100000 + Math.random() * 900000));
      cBaru.forEach(function (c, n) { baris[c] = nilai[n]; });
      sh.getRange(posisi, 1, 1, head.length).setNumberFormat('@').setValues([baris]);
      data.splice(posisi - 2, 0, baris);
      barisID = {};
      data.forEach(function (r, x) { barisID[normId_(r[cID])] = x; });
      ditambah.push(d[1]);
      return;
    }
    cBaru.forEach(function (c, n) {
      if (String(data[i][c] == null ? '' : data[i][c]).trim() === '' && nilai[n] !== '') {
        sh.getRange(i + 2, c + 1).setValue(nilai[n]);
        data[i][c] = nilai[n];
        diisi++;
      }
    });
  });
  Logger.log('Sheet Staf dilengkapi. Sel terisi: ' + diisi + '. Pegawai ditambahkan: ' + (ditambah.length ? ditambah.join('; ') : '-'));
  Logger.log('Catatan: pegawai baru diberi PIN acak (belum bisa login Gizi-Link). Ubah PIN-nya di sheet bila perlu.');
}

/* ===================== WEB APP ===================== */
function doGet() {
  return json_({ ok: true, layanan: 'e-Surat Gizi', status: 'aktif' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var sesi = verifikasiStafSSO_(req.token);
    if (!sesi) return json_({ ok: false, kode: 'AUTH', pesan: 'Sesi Gizi-Link berakhir. Silakan masuk lagi.' });

    var semua = bacaStaf_();
    var saya = semua.filter(function (s) { return normId_(s.id) === normId_(sesi.id); })[0];
    if (!saya || !boleh_(saya.kode)) {
      return json_({ ok: false, kode: 'AKSES', pesan: 'Aplikasi ini khusus Ketua Jurusan, Sekretaris Jurusan, Ketua Program Studi, dan Kepala Unit Laboratorium. Hubungi admin jurusan bila Anda seharusnya punya akses.' });
    }

    if (req.aksi === 'muat') {
      return json_({
        ok: true,
        profil: { id: saya.id, nama: saya.nama, jabatan: saya.jabatan },
        staf: semua.filter(function (s) { return s.pegawai; }).map(publikStaf_),
        pengaturan: pengaturan_(),
        arsip: daftarArsip_()
      });
    }
    if (req.aksi === 'simpan') return json_(simpan_(saya, req));
    if (req.aksi === 'ambil') return json_(ambil_(req));
    if (req.aksi === 'hapus') return json_(hapus_(req));
    if (req.aksi === 'cariMhs') return json_(cariMhs_(req));
    return json_({ ok: false, pesan: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ ok: false, pesan: 'Terjadi gangguan di server: ' + (err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== STAF ===================== */
function normId_(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toLowerCase(); }
function boleh_(kode) {
  var k = String(kode || '').toLowerCase();
  return CONFIG.JABATAN_BOLEH.some(function (j) { return k.indexOf(j) >= 0; });
}

/** Semua baris sheet Staf (tanpa PIN). pegawai=true bila ID berupa NIP. */
function bacaStaf_() {
  var sh = SpreadsheetApp.openById(CONFIG.GIZI_LINK_ID).getSheetByName('Staf');
  var v = sh.getDataRange().getDisplayValues();
  var h = v[0].map(function (x) { return String(x).trim(); });
  function kol(nama) { return h.indexOf(nama); }
  var c = { id: kol('ID'), nama: kol('Nama'), kode: kol('Jabatan'), ns: kol('Nama Surat'), gol: kol('Gol'), pangkat: kol('Pangkat'), jf: kol('Jabatan Fungsional'), js: kol('Jabatan Struktural') };
  function sel(r, i) { return i >= 0 ? String(r[i] || '').trim() : ''; }
  return v.slice(1).filter(function (r) { return sel(r, c.id); }).map(function (r) {
    var id = sel(r, c.id);
    return {
      id: id,
      nama: sel(r, c.ns) || sel(r, c.nama),
      kode: sel(r, c.kode),
      nip: /^\d{8}\s?\d{6}\s?\d\s?\d{3}$/.test(id) ? id : '',
      gol: sel(r, c.gol), pangkat: sel(r, c.pangkat),
      jabatan: sel(r, c.js) || sel(r, c.jf),
      pegawai: /^\d{8}/.test(id)
    };
  });
}
function publikStaf_(s) {
  return { id: s.id, nama: s.nama, nip: s.nip, gol: s.gol, pangkat: s.pangkat, jabatan: s.jabatan, kode: s.kode };
}

/* ===================== PENGATURAN ===================== */
function pengaturan_() {
  var out = {};
  var sh = SpreadsheetApp.getActive().getSheetByName('Pengaturan');
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    if (r[0]) out[String(r[0]).trim().toLowerCase()] = String(r[1] || '').trim();
  });
  return out;
}

/* ===================== ARSIP ===================== */
function shArsip_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Arsip');
  if (!sh) throw new Error('Tab "Arsip" belum ada. Jalankan fungsi setup.');
  return sh;
}
function now_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, "yyyy-MM-dd'T'HH:mm:ss"); }
/** Cegah teks dianggap rumus oleh Google Sheet. */
function aman_(s, maks) {
  s = String(s == null ? '' : s).slice(0, maks || 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function daftarArsip_() {
  var sh = shArsip_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getDisplayValues().filter(function (r) { return r[0]; }).map(function (r) {
    return { id: r[0], dibuat: r[1], diubah: r[2], kode: r[3], jenis: r[4], hal: r[5], pembuat: r[6] };
  }).sort(function (a, b) { return String(b.diubah).localeCompare(String(a.diubah)); });
}

function barisArsip_(sh, id) {
  if (!id || sh.getLastRow() < 2) return 0;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}

function simpan_(saya, req) {
  var data = JSON.stringify(req.data || {});
  if (data.length > CONFIG.MAKS_DATA) return { ok: false, pesan: 'Isi naskah terlalu panjang untuk disimpan di arsip. Ringkas isi atau lampiran.' };
  var kode = String(req.kode || '').replace(/[^A-Z]/g, '').slice(0, 3);
  if (!kode) return { ok: false, pesan: 'Jenis naskah tidak dikenal.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = shArsip_(), now = now_();
    var baris = barisArsip_(sh, String(req.id || ''));
    var id = String(req.id || '');
    if (baris) {
      sh.getRange(baris, 3).setValue(now);
      sh.getRange(baris, 6).setValue(aman_(req.hal));
      sh.getRange(baris, 9, 1, 2).setValues([[saya.nama, data]]);
    } else {
      id = 'S' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 5).toUpperCase();
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, KOLOM_ARSIP.length).setNumberFormat('@')
        .setValues([[id, now, now, kode, aman_(req.jenis, 60), aman_(req.hal), saya.nama, saya.id, saya.nama, data]]);
    }
    SpreadsheetApp.flush();
    return { ok: true, id: id, arsip: daftarArsip_() };
  } finally {
    lock.releaseLock();
  }
}

function ambil_(req) {
  var sh = shArsip_();
  var baris = barisArsip_(sh, String(req.id || ''));
  if (!baris) return { ok: false, pesan: 'Naskah tidak ditemukan di arsip.' };
  var r = sh.getRange(baris, 1, 1, KOLOM_ARSIP.length).getDisplayValues()[0];
  var data = {};
  try { data = JSON.parse(r[9] || '{}'); } catch (e) { return { ok: false, pesan: 'Data naskah di arsip rusak (kolom Data berubah).' }; }
  return { ok: true, naskah: { id: r[0], dibuat: r[1], diubah: r[2], kode: r[3], jenis: r[4], hal: r[5], pembuat: r[6], data: data } };
}

function hapus_(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = shArsip_();
    var baris = barisArsip_(sh, String(req.id || ''));
    if (!baris) return { ok: false, pesan: 'Naskah tidak ditemukan di arsip.' };
    sh.deleteRow(baris);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ===================== CARI MAHASISWA (untuk Surat Keterangan) ===================== */
function cariMhs_(req) {
  var q = String(req.q || '').trim().toLowerCase();
  if (q.length < 3) return { ok: true, hasil: [] };
  var sh = SpreadsheetApp.openById(CONFIG.GIZI_LINK_ID).getSheetByName('Mahasiswa');
  var v = sh.getDataRange().getDisplayValues();
  var h = v[0].map(function (x) { return String(x).trim(); });
  var cNim = h.indexOf('NIM'), cNama = h.indexOf('Nama'), cProdi = h.indexOf('Program Studi'), cKelas = h.indexOf('Kelas');
  var qNim = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  var hasil = [];
  for (var i = 1; i < v.length && hasil.length < 8; i++) {
    var nim = String(v[i][cNim] || '').replace(/^'/, '').trim(), nama = String(v[i][cNama] || '').trim();
    if (!nim) continue;
    if (nama.toLowerCase().indexOf(q) >= 0 || (qNim.length >= 3 && nim.toUpperCase().indexOf(qNim) >= 0)) {
      var prodi = String(v[i][cProdi] || '').trim();
      hasil.push({ nim: nim, nama: nama, prodi: prodi, prodiPanjang: prodiPanjang_(prodi), kelas: cKelas >= 0 ? String(v[i][cKelas] || '').trim() : '' });
    }
  }
  return { ok: true, hasil: hasil };
}
function prodiPanjang_(p) {
  var s = String(p || '').toLowerCase();
  if (s.indexOf('d3') === 0) return 'Diploma Tiga Gizi';
  if (s.indexOf('d4') === 0) return 'Sarjana Terapan Gizi dan Dietetika';
  if (s.indexOf('prof') === 0) return 'Pendidikan Profesi Dietisien';
  return p;
}

/* ===================== LOGIN GIZI-LINK ===================== */
/** Verifikasi token Gizi-Link DOSEN/STAF (sama dengan aplikasi Gizi-Link lain). */
function verifikasiStafSSO_(token) {
  try {
    var rahasia = PropertiesService.getScriptProperties().getProperty('SSO_SECRET');
    var bagian = String(token || '').split('.');
    if (!rahasia || bagian.length !== 2) return null;
    var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], rahasia));
    if (sig !== bagian[1]) return null;
    var p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8'));
    if (!p || p.jenis !== 'staf' || !p.id || !p.exp || Date.now() > Number(p.exp)) return null;
    return p;
  } catch (e) {
    return null;
  }
}
