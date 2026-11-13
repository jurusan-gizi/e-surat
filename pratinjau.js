/*!
 * e-Surat Gizi — pratinjau isi surat (HTML) sebelum diunduh.
 * Dibangun dari data yang SAMA dengan yang dikirim ke template .docx, jadi isinya pasti sama.
 * Tata letak akhir (margin, jenis huruf, jarak) tetap mengikuti template Word.
 */
(function (root) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** Teks biasa → HTML; ${variabel} SRIKANDI ditandai; baris baru dipertahankan. */
  function T(s) {
    return esc(s).replace(/\$\{([a-z_]+)\}/g, '<span class="pv-var" title="Diisi otomatis oleh SRIKANDI">${$1}</span>').replace(/\n/g, '<br>');
  }
  function V(nama) { return T('${' + nama + '}'); }

  var KOP = '<img class="pv-kop" src="icons/kop.png" alt="Kop Kementerian Kesehatan – Poltekkes Makassar">';

  function isi(list) {
    return (list || []).map(function (x) {
      if (x.rinci) return '<div class="pv-rinci"><span>' + T(x.k) + '</span><span>:</span><span>' + T(x.v) + '</span></div>';
      if (x.butir) return '<div class="pv-butir"><span>' + T(x.no) + '</span><span>' + T(x.t) + '</span></div>';
      return '<p class="pv-alinea">' + T(x.t) + '</p>';
    }).join('');
  }
  function daftar(list, kelas) {
    return (list || []).map(function (x) { return '<div class="pv-butir ' + (kelas || '') + '"><span>' + T(x.no) + '</span><span>' + T(x.t) + '</span></div>'; }).join('');
  }
  function baris(k, v) { return '<div class="pv-rinci rapat"><span>' + T(k) + '</span><span>:</span><span>' + (v == null ? '' : v) + '</span></div>'; }

  /** Blok tanda tangan di kanan. */
  function ttd(o) {
    o = o || {};
    return '<div class="pv-ttd">' +
      (o.atas ? '<div>' + o.atas + '</div>' : '') +
      (o.jabatan === false ? '' : '<div>' + (o.jabatan || V('jabatan_pengirim') + ',') + '</div>') +
      '<div class="pv-ttd-ruang">' + V('ttd_pengirim') + '</div>' +
      '<div><b>' + (o.nama || V('nama_pengirim')) + '</b></div>' +
      (o.nip ? '<div>NIP ' + V('nip_pengirim') + '</div>' : '') +
      '</div>';
  }
  function tembusan(d) {
    if (!d.ada_tembusan) return '';
    return '<div class="pv-tembusan"><div>Tembusan:</div>' +
      (d.tembusan_tunggal ? '<div>' + T(d.tembusan_tunggal.t) + '</div>' : daftar(d.tembusan)) + '</div>';
  }
  function kepalaLampiran(judul, tanggal) {
    return '<div class="pv-lamp-kepala"><div>' + judul + '</div>' +
      '<div class="pv-rinci rapat sempit"><span>Nomor</span><span>:</span><span>' + V('nomor_naskah') + '</span></div>' +
      (tanggal === false ? '' : '<div class="pv-rinci rapat sempit"><span>Tanggal</span><span>:</span><span>' + V('tanggal_naskah') + '</span></div>') + '</div>';
  }
  function tabel(kepala, rows, lebar) {
    return '<table class="pv-tabel"><thead><tr>' + kepala.map(function (h, i) { return '<th' + (lebar && lebar[i] ? ' style="width:' + lebar[i] + '"' : '') + '>' + T(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + T(c) + '</td>'; }).join('') + '</tr>'; }).join('')
        : '<tr><td colspan="' + kepala.length + '" class="pv-kosong">(belum ada baris)</td></tr>') + '</tbody></table>';
  }
  function hal(isiHtml, kelas) { return '<section class="pv-hal ' + (kelas || '') + '">' + isiHtml + '</section>'; }

  var BUAT = {
    /* ---------- Surat Dinas ---------- */
    SD: function (d) {
      var h = KOP +
        '<div class="pv-nomor"><div class="pv-rinci rapat sempit"><span>Nomor</span><span>:</span><span>' + V('nomor_naskah') + '</span></div><div>' + V('tanggal_naskah') + '</div></div>' +
        (d.ada_sifat ? '<div class="pv-rinci rapat sempit"><span>Sifat</span><span>:</span><span>' + V('sifat') + '</span></div>' : '') +
        (d.ada_lampiran_ket ? '<div class="pv-rinci rapat sempit"><span>Lampiran</span><span>:</span><span>' + T(d.lampiran_ket) + '</span></div>' : '') +
        '<div class="pv-rinci rapat sempit"><span>Hal</span><span>:</span><span>' + V('hal') + '</span></div>' +
        '<div class="pv-yth">Yth. ' + T(d.yth) + (d.ada_alamat ? '<br>' + T(d.alamat) : '') + '</div>' +
        isi(d.isi) + ttd({ nip: d.pakai_nip }) + tembusan(d);
      var out = hal(h);
      if (d.ada_lampiran) {
        out += hal(kepalaLampiran('Lampiran Surat Dinas') +
          (d.ada_lampiran_judul ? '<div class="pv-judul">' + T(d.lampiran_judul) + '</div>' : '') +
          daftar(d.lampiran) + ttd({ nip: d.pakai_nip }));
      }
      return out;
    },

    /* ---------- Nota Dinas ---------- */
    ND: function (d) {
      var out = hal(KOP + '<div class="pv-judul">NOTA DINAS<br><span class="pv-tipis">NOMOR ' + V('nomor_naskah') + '</span></div>' +
        baris('Yth.', V('jabatan_tujuan')) + baris('Dari', V('jabatan_pengirim')) + baris('Hal', V('hal')) + baris('Tanggal', V('tanggal_naskah')) +
        '<hr class="pv-garis">' + isi(d.isi) + ttd({ jabatan: false }) + tembusan(d));
      if (d.ada_lampiran) {
        out += hal(kepalaLampiran('Lampiran Nota Dinas') + '<div class="pv-judul">' + T(d.lampiran_judul) + '</div>' + daftar(d.lampiran) + ttd({ jabatan: false }));
      }
      return out;
    },

    /* ---------- Surat Tugas ---------- */
    ST: function (d) {
      var kepada = d.satu
        ? '<div class="pv-indent">' + baris('nama', T(d.satu.nama)) + baris('NIP', T(d.satu.nip)) + baris('pangkat/gol.', T(d.satu.pangkat)) + baris('jabatan', T(d.satu.jabatan)) + '</div>'
        : '<div class="pv-indent">pegawai/pejabat yang namanya tercantum dalam lampiran surat tugas ini</div>';
      var untuk = (d.untuk || []).map(function (x) {
        return '<div class="pv-untuk"><span>' + T(x.label) + '</span><span>' + T(x.tt) + '</span><span>' + T(x.no) + '</span><span>' + T(x.t) + '</span></div>';
      }).join('');
      var out = hal(KOP + '<div class="pv-judul">SURAT TUGAS<br><span class="pv-tipis">NOMOR ' + V('nomor_naskah') + '</span></div>' +
        '<p class="pv-alinea">' + T(d.pembuka) + '</p>' + kepada + '<div class="pv-jarak"></div>' + untuk +
        '<p class="pv-alinea pv-jarak-atas">' + T(d.penutup) + '</p>' + ttd({ atas: V('tanggal_naskah'), nip: d.pakai_nip }), 'f4');
      if (d.banyak) {
        out += hal(kepalaLampiran('Lampiran Surat Tugas') + '<div class="pv-judul">DAFTAR PEGAWAI/PEJABAT YANG DITUGASKAN</div>' +
          tabel(['No', 'Nama', 'NIP', 'Pangkat', 'Jabatan'], d.pegawai.map(function (p) { return [p.no, p.nama, p.nip, p.pangkat, p.jabatan]; }), ['2.2em']) +
          ttd({ nip: d.pakai_nip }), 'f4');
      }
      return out;
    },

    /* ---------- Surat Keterangan ---------- */
    SK: function (d) {
      return hal(KOP + '<div class="pv-judul">SURAT KETERANGAN<br><span class="pv-tipis">NOMOR ' + V('nomor_naskah') + '</span></div>' +
        '<div>Yang bertanda tangan di bawah ini</div>' +
        baris('nama', T(d.ttd_nama)) + baris('NIP', T(d.ttd_nip)) + baris('jabatan', T(d.ttd_jabatan)) +
        '<div class="pv-jarak-atas">dengan ini menerangkan bahwa</div>' +
        (d.subjek || []).map(function (r) { return baris(r.k, T(r.v)); }).join('') +
        '<div class="pv-jarak"></div>' + isi(d.isi) + ttd({ atas: 'Makassar, ' + V('tanggal_naskah'), nip: d.pakai_nip }));
    },

    /* ---------- Surat Pengantar ---------- */
    SP: function (d) {
      return hal(KOP + '<div class="pv-kanan">' + V('tanggal_naskah') + '</div>' +
        '<div class="pv-yth">Yth. ' + T(d.yth) + (d.ada_alamat ? '<br>' + T(d.alamat) : '') + '</div>' +
        '<div class="pv-judul">SURAT PENGANTAR<br><span class="pv-tipis">NOMOR ' + V('nomor_naskah') + '</span></div>' +
        tabel(['No.', 'Naskah Dinas yang Dikirimkan', 'Banyaknya', 'Keterangan'], (d.naskah || []).map(function (r) { return [r.no, r.nama, r.banyak, r.ket]; }), ['2.6em', '', '22%', '26%']) +
        '<div class="pv-jarak-atas">Diterima tanggal : ………………………</div>' +
        '<div class="pv-dua"><div><div>Penerima</div><div>Jabatan Penerima</div><div class="pv-ttd-ruang"></div><div>Nama Lengkap</div><div>NIP.</div></div>' +
        '<div><div>Pengirim</div><div>' + V('jabatan_pengirim') + ',</div><div class="pv-ttd-ruang">' + V('ttd_pengirim') + '</div><div><b>' + V('nama_pengirim') + '</b></div>' +
        (d.pakai_nip ? '<div>NIP ' + V('nip_pengirim') + '</div>' : '') + '</div></div>' +
        (d.ada_telepon ? '<div>No. Telepon ' + T(d.telepon) + '</div>' : '') + tembusan(d));
    },

    /* ---------- Surat Keputusan ---------- */
    KP: function (d, v) {
      function blok(list, kunciNo) {
        return (list || []).map(function (x) {
          return '<div class="pv-sk"><span>' + T(x.label) + '</span><span>' + T(x.tt) + '</span><span class="pv-butir"><span>' + T(x[kunciNo]) + '</span><span>' + T(x.t) + '</span></span></div>';
        }).join('');
      }
      var tt = '<div class="pv-ttd lebar"><div>Ditetapkan di Makassar</div><div>Pada tanggal ' + V('tanggal_naskah') + '</div>' +
        '<div class="pv-jarak-atas">DIREKTUR POLTEKKES KEMENKES MAKASSAR,</div><div class="pv-ttd-ruang">' + V('ttd_pengirim') + '</div><div>' + T(d.DIREKTUR) + '</div></div>';
      var out = hal(KOP + '<div class="pv-judul tipis">KEPUTUSAN DIREKTUR POLTEKKES KEMENKES MAKASSAR<br>NOMOR ' + V('nomor_naskah') + '<br>TENTANG<br>' + T(d.JUDUL) +
        '<br><br>DENGAN RAHMAT TUHAN YANG MAHA ESA<br>DIREKTUR POLTEKKES KEMENKES MAKASSAR,</div>' +
        blok(d.menimbang, 'huruf') + '<div class="pv-jarak"></div>' + blok(d.mengingat, 'no') +
        '<div class="pv-judul tipis">MEMUTUSKAN</div>' +
        '<div class="pv-sk"><span>Menetapkan</span><span>:</span><span>KEPUTUSAN DIREKTUR POLTEKKES KEMENKES MAKASSAR TENTANG ' + T(d.JUDUL) + '.</span></div>' +
        (d.diktum || []).map(function (x) { return '<div class="pv-sk"><span>' + T(x.ke) + '</span><span>:</span><span>' + T(x.t) + '</span></div>'; }).join('') +
        tt + tembusan(d), 'f4 serif');
      if (v.pakai_lampiran) {
        out += hal('<div class="pv-lamp-kepala lebar">LAMPIRAN<br>KEPUTUSAN DIREKTUR POLTEKKES KEMENKES MAKASSAR<br>NOMOR ' + V('nomor_naskah') + '<br>TENTANG ' + T(d.JUDUL) + '</div>' +
          '<div class="pv-judul">' + T(d.lampiran_judul) + '</div>' +
          (d.lamp_tabel ? tabel(['No', d.lamp_kol2, d.lamp_kol3], d.lamp_baris.map(function (r) { return [r.no, r.a, r.b]; }), ['2.6em']) : daftar(d.lampiran)) +
          '<div class="pv-ttd lebar"><div>DIREKTUR POLTEKKES KEMENKES MAKASSAR,</div><div class="pv-ttd-ruang">' + V('ttd_pengirim') + '</div><div>' + T(d.DIREKTUR) + '</div></div>', 'f4 serif');
      }
      return out;
    },

    /* ---------- Notula Rapat ---------- */
    NR: function (d) {
      function kol(list) {
        return (list || []).map(function (x) {
          return '<div class="pv-untuk lebar"><span>' + T(x.label) + '</span><span>' + T(x.tt) + '</span><span>' + T(x.no) + '</span><span>' + T(x.t) + '</span></div>';
        }).join('');
      }
      function satu(k, v) { return '<div class="pv-untuk lebar"><span>' + k + '</span><span>:</span><span></span><span>' + T(v) + '</span></div>'; }
      return hal('<div class="pv-judul tipis">NOTULA RAPAT<br>TENTANG<br>' + T(d.JUDUL) + '</div>' +
        satu('Dasar', d.dasar) + satu('Waktu dan tempat', d.waktu_tempat) + satu('Pimpinan', d.pimpinan) + kol(d.agenda) + kol(d.peserta) +
        '<div class="pv-jarak-atas">Poin-poin penting dan relevan:</div>' +
        (d.poin || []).map(function (x) { return '<div class="pv-butir"><span>•</span><span>' + T(x.t) + '</span></div>'; }).join('') +
        '<div class="pv-jarak"></div>' +
        tabel(['No', 'Arahan/Rencana TL', 'Unit Penanggung Jawab', 'Tenggat Waktu'], (d.rtl || []).map(function (r) { return [r.no, r.arahan, r.unit, r.tenggat]; }), ['2.6em', '', '26%', '20%']) +
        '<div class="pv-ttd"><div>Dibuat di ' + T(d.tempat_buat) + '</div><div>Pada tanggal ' + T(d.tanggal_buat) + '</div></div>' +
        '<div class="pv-dua"><div><div>Mengetahui,</div><div>' + T(d.pj_jabatan) + '</div><div class="pv-ttd-ruang"></div><div>' + T(d.pj_nama) + '</div></div>' +
        '<div><div>&nbsp;</div><div>Notulis,</div><div class="pv-ttd-ruang"></div><div>' + T(d.notulis) + '</div></div></div>');
    }
  };

  /** HTML pratinjau untuk jenis `kode`, dari data hasil susun() dan nilai form v. */
  function buat(kode, data, v) {
    return BUAT[kode] ? BUAT[kode](data, v || {}) : '';
  }

  var API = { buat: buat };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PRATINJAU = API;
})(typeof window !== 'undefined' ? window : this);
