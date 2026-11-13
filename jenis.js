/*!
 * e-Surat Gizi — definisi 7 jenis naskah: isian form, pola siap pakai, dan
 * cara menyusun data untuk template .docx.
 *
 * PENTING: variabel ${nomor_naskah}, ${tanggal_naskah}, ${hal}, ${sifat},
 * ${jabatan_tujuan}, ${jabatan_pengirim}, ${ttd_pengirim}, ${nama_pengirim},
 * ${nip_pengirim} adalah milik SRIKANDI. Aplikasi ini TIDAK mengisinya —
 * SRIKANDI yang mengisi saat naskah diproses/ditandatangani.
 */
(function (root) {
  'use strict';

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var URUT = ['KESATU', 'KEDUA', 'KETIGA', 'KEEMPAT', 'KELIMA', 'KEENAM', 'KETUJUH', 'KEDELAPAN', 'KESEMBILAN', 'KESEPULUH',
    'KESEBELAS', 'KEDUA BELAS', 'KETIGA BELAS', 'KEEMPAT BELAS', 'KELIMA BELAS', 'KEENAM BELAS', 'KETUJUH BELAS', 'KEDELAPAN BELAS', 'KESEMBILAN BELAS', 'KEDUA PULUH'];

  /* ===================== UTILITAS TEKS ===================== */
  function rapi(s) { return String(s == null ? '' : s).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim(); }
  function baris(s) {
    return String(s == null ? '' : s).replace(/\r/g, '').split('\n').map(function (x) { return x.replace(/[ \t]+/g, ' ').trim(); }).filter(Boolean);
  }
  /** Buang nomor/bullet yang terlanjur diketik di awal baris daftar. */
  function tanpaNomor(s) { return s.replace(/^(\d{1,2}[.)]|[a-zA-Z][.)]|[-–•*])\s+/, ''); }
  function daftar(s) { return baris(s).map(tanpaNomor).filter(Boolean); }
  function bernomor(arr) { return arr.map(function (t, i) { return { no: (i + 1) + '.', t: t }; }); }
  function huruf(i) { return String.fromCharCode(97 + (i % 26)) + '.'; }
  function tglIndo(iso, denganHari) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return rapi(iso);
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var t = Number(m[3]) + ' ' + BULAN[Number(m[2]) - 1] + ' ' + m[1];
    return denganHari ? HARI[d.getDay()] + ', ' + t : t;
  }
  function nipRapat(v) { return String(v || '').replace(/\s+/g, ''); }
  function pangkatGol(p) {
    var a = rapi(p.pangkat), b = rapi(p.gol);
    return a && b ? a + ' (' + b + ')' : (a || b);
  }
  function titikAkhir(s) { s = rapi(s); return !s || /[.!?:;]$/.test(s) ? s : s + '.'; }

  /**
   * Isi naskah → daftar alinea untuk template.
   *  - Enter            = alinea baru (otomatis menjorok 1 tab)
   *  - "Label : isi"    = rincian sejajar (spasi sebelum titik dua), mis. "Hari/tanggal : Senin, 3 Maret 2027"
   *  - "1. ..." "a. ..." "- ..." = butir
   */
  function uraiIsi(teks) {
    var out = [];
    String(teks == null ? '' : teks).replace(/\r/g, '').split('\n').forEach(function (l) {
      l = l.replace(/[ \t]+/g, ' ').trim();
      if (!l) return;
      var m = l.match(/^(\d{1,2}[.)]|[a-zA-Z][.)]|[-–•*])\s+(.+)$/);
      if (m) { out.push({ butir: true, no: /^[-–•*]$/.test(m[1]) ? '-' : m[1], t: m[2] }); return; }
      m = l.match(/^([^:]{1,30}?)\s+:\s+(.+)$/);
      if (m) { out.push({ rinci: true, k: m[1], v: m[2] }); return; }
      out.push({ biasa: true, t: l });
    });
    return out;
  }

  /** Baris "label : nilai" → [{k, v}] */
  function uraiRinci(teks) {
    return baris(teks).map(function (l) {
      var m = l.match(/^([^:]+?)\s*:\s*(.*)$/);
      return m ? { k: rapi(m[1]), v: rapi(m[2]) } : { k: l, v: '' };
    });
  }

  function tembusan(v) {
    var t = daftar(v.tembusan);
    return {
      ada_tembusan: t.length > 0,
      tembusan: t.length > 1 ? bernomor(t) : [],
      tembusan_tunggal: t.length === 1 ? { t: t[0] } : false
    };
  }

  function gabung(a, b) { for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }

  /* ===================== ISIAN YANG DIPAKAI BERULANG ===================== */
  var PETUNJUK_ISI = 'Enter = alinea baru (otomatis menjorok). Tulis “Label : isi” (pakai spasi sebelum titik dua) untuk rincian sejajar, ' +
    'mis. “Hari/tanggal : Senin, 3 Maret 2027”. Awali dengan “1.” atau “a.” untuk butir.';

  var F_HAL = {
    id: 'hal', label: 'Hal / perihal', tipe: 'teks', wajib: true,
    bantu: 'Dipakai untuk arsip & nama file. Di SRIKANDI, ketik hal yang sama pada kolom Hal — nanti muncul otomatis di surat.'
  };
  var F_SIFAT = {
    id: 'sifat', label: 'Sifat naskah', tipe: 'pilih', opsi: ['Biasa', 'Segera', 'Sangat Segera', 'Terbatas', 'Rahasia'], nilai: 'Biasa',
    bantu: 'Bila “Biasa”, baris Sifat otomatis dihapus dari surat (sesuai petunjuk template).'
  };
  var F_PLT = {
    id: 'plt', label: 'Penanda tangan berstatus Plt./Plh./a.n./u.b.', tipe: 'cek',
    bantu: 'Centang hanya bila demikian — baris NIP di bawah nama akan ditampilkan. Bila tidak, baris NIP dihapus.'
  };
  var F_TEMBUSAN = {
    id: 'tembusan', label: 'Tembusan', tipe: 'daftar', baris: 3,
    bantu: 'Satu baris satu tembusan. Kosongkan bila tidak ada. Nomor urut diatur otomatis (satu tembusan = tanpa nomor).'
  };
  var F_ISI = { id: 'isi', label: 'Isi naskah', tipe: 'area', baris: 10, wajib: true, bantu: PETUNJUK_ISI };

  /* ===================== 7 JENIS NASKAH ===================== */
  var JENIS = [

    /* ---------- 1. SURAT DINAS ---------- */
    {
      kode: 'SD', nama: 'Surat Dinas', ikon: '✉️', warna: '#00807e', kertas: 'A4',
      ket: 'Surat resmi ke pihak luar atau unit lain (permohonan, undangan, pemberitahuan).',
      templat: function () { return 'surat-dinas.docx'; },
      isian: [
        F_HAL, F_SIFAT,
        { id: 'lampiran_ket', label: 'Lampiran', tipe: 'teks', saran: ['satu lembar', 'dua lembar', 'tiga lembar', 'satu berkas', 'satu eksemplar'],
          bantu: 'Mis. “satu lembar”. Kosongkan bila tidak ada lampiran — baris Lampiran otomatis dihapus.' },
        { id: 'tujuan', label: 'Tujuan surat', tipe: 'pilih', nilai: 'eksternal', opsi: [
          ['eksternal', 'Pihak luar (eksternal) — diketik'], ['internal', 'Internal Kemenkes — diisi SRIKANDI'], ['banyak', 'Lebih dari satu tujuan (daftar terlampir)']] },
        { id: 'yth', label: 'Yth. (nama jabatan tujuan)', tipe: 'teks', tampil: { tujuan: 'eksternal' }, wajib: true,
          bantu: 'Tanpa “Yth.” — mis. “Kepala Dinas Kesehatan Kota Makassar”.' },
        { id: 'alamat', label: 'Alamat tujuan', tipe: 'area', baris: 2, tampil: { tujuan: 'eksternal' },
          bantu: 'Alamat penerima ditulis lengkap. Boleh lebih dari satu baris.' },
        { id: 'daftar_tujuan', label: 'Daftar tujuan', tipe: 'daftar', baris: 4, tampil: { tujuan: 'banyak' }, wajib: true,
          bantu: 'Satu baris satu tujuan. Di surat tertulis “Yth. Terlampir” dan daftar ini masuk ke halaman lampiran.' },
        F_ISI,
        { id: 'lampiran_judul', label: 'Judul halaman lampiran (opsional)', tipe: 'teks', tampil: { tujuan: ['eksternal', 'internal'] } },
        { id: 'lampiran_isi', label: 'Isi halaman lampiran (opsional)', tipe: 'daftar', baris: 3, tampil: { tujuan: ['eksternal', 'internal'] },
          bantu: 'Satu baris satu butir. Kosongkan bila surat tidak punya halaman lampiran.' },
        F_TEMBUSAN, F_PLT
      ],
      pola: [
        { nama: 'Undangan kegiatan', isi: {
          hal: 'Undangan [nama kegiatan]', tujuan: 'eksternal',
          isi: 'Sehubungan dengan akan dilaksanakannya kegiatan [nama kegiatan] oleh Jurusan Gizi Poltekkes Kemenkes Makassar, bersama ini kami mengundang Bapak/Ibu untuk hadir pada:\n' +
            'Hari/tanggal : [hari, tanggal]\nWaktu : [pukul] WITA – selesai\nTempat : [tempat]\nAcara : [acara]\n' +
            'Demikian undangan ini kami sampaikan. Atas perhatian dan kehadiran Bapak/Ibu, kami ucapkan terima kasih.' } },
        { nama: 'Permohonan narasumber', isi: {
          hal: 'Permohonan Narasumber', tujuan: 'eksternal',
          isi: 'Sehubungan dengan akan dilaksanakannya kegiatan [nama kegiatan] oleh Jurusan Gizi Poltekkes Kemenkes Makassar, bersama ini kami mohon kesediaan Bapak/Ibu menugaskan [nama/jabatan] sebagai narasumber pada kegiatan tersebut, yang akan dilaksanakan pada:\n' +
            'Hari/tanggal : [hari, tanggal]\nWaktu : [pukul] WITA – selesai\nTempat : [tempat]\nMateri : [judul materi]\n' +
            'Demikian permohonan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.' } },
        { nama: 'Permohonan izin praktik / PKL', isi: {
          hal: 'Permohonan Izin Praktik Kerja Lapangan', tujuan: 'eksternal',
          isi: 'Dalam rangka pencapaian kompetensi mahasiswa Program Studi [nama prodi] Jurusan Gizi Poltekkes Kemenkes Makassar, bersama ini kami mohon izin agar mahasiswa kami dapat melaksanakan [nama praktik] di instansi yang Bapak/Ibu pimpin, dengan rincian sebagai berikut:\n' +
            'Waktu pelaksanaan : [tanggal mulai] s.d. [tanggal selesai]\nJumlah mahasiswa : [jumlah] orang\nPembimbing : [nama pembimbing]\n' +
            'Daftar nama mahasiswa terlampir.\n' +
            'Demikian permohonan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.',
          lampiran_ket: 'satu lembar', lampiran_judul: 'DAFTAR NAMA MAHASISWA' } },
        { nama: 'Permohonan data', isi: {
          hal: 'Permohonan Data', tujuan: 'eksternal',
          isi: 'Sehubungan dengan [keperluan], bersama ini kami mohon bantuan Bapak/Ibu untuk dapat memberikan data sebagai berikut:\n1. [data pertama]\n2. [data kedua]\n' +
            'Data tersebut akan digunakan untuk [tujuan penggunaan data].\n' +
            'Demikian permohonan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.' } },
        { nama: 'Pemberitahuan / penyampaian', isi: {
          hal: 'Penyampaian [hal yang disampaikan]', tujuan: 'eksternal',
          isi: 'Sehubungan dengan [dasar/latar belakang], bersama ini kami sampaikan bahwa [isi pemberitahuan].\n' +
            'Demikian kami sampaikan. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.' } }
      ],
      susun: function (v) {
        var banyak = v.tujuan === 'banyak';
        var lamp = banyak ? daftar(v.daftar_tujuan) : daftar(v.lampiran_isi);
        var judul = banyak ? '' : rapi(v.lampiran_judul);
        var ket = rapi(v.lampiran_ket) || (lamp.length ? 'satu lembar' : '');
        return gabung({
          ada_sifat: !!v.sifat && v.sifat !== 'Biasa',
          ada_lampiran_ket: !!ket, lampiran_ket: ket,
          yth: banyak ? 'Terlampir' : (v.tujuan === 'internal' ? '${jabatan_tujuan}' : rapi(v.yth)),
          ada_alamat: v.tujuan === 'eksternal' && baris(v.alamat).length > 0,
          alamat: baris(v.alamat).join('\n'),
          isi: uraiIsi(v.isi),
          pakai_nip: !!v.plt,
          ada_lampiran: lamp.length > 0,
          ada_lampiran_judul: !!judul, lampiran_judul: judul,
          lampiran: bernomor(lamp)
        }, tembusan(v));
      },
      srikandi: function (v) {
        return [['Jenis naskah', 'Surat Dinas'], ['Hal', rapi(v.hal)], ['Sifat', v.sifat || 'Biasa'],
          ['Tujuan', v.tujuan === 'internal' ? 'pilih pejabat tujuan di SRIKANDI' : (v.tujuan === 'banyak' ? daftar(v.daftar_tujuan).join('; ') : rapi(v.yth))]];
      }
    },

    /* ---------- 2. NOTA DINAS ---------- */
    {
      kode: 'ND', nama: 'Nota Dinas', ikon: '📝', warna: '#0284c7', kertas: 'A4',
      ket: 'Komunikasi internal antarpejabat/unit di Poltekkes (usulan, laporan, undangan rapat).',
      templat: function () { return 'nota-dinas.docx'; },
      isian: [
        F_HAL,
        { id: 'catatan_tujuan', tipe: 'info', teks: 'Baris Yth., Dari, Hal, dan Tanggal diisi otomatis oleh SRIKANDI sesuai pejabat tujuan yang Anda pilih di sana.' },
        F_ISI,
        { id: 'pakai_lampiran', label: 'Sertakan halaman lampiran (daftar nama/butir)', tipe: 'cek' },
        { id: 'lampiran_judul', label: 'Judul lampiran', tipe: 'teks', nilai: 'DAFTAR NAMA YANG DIUNDANG', tampil: { pakai_lampiran: true } },
        { id: 'lampiran_isi', label: 'Isi lampiran', tipe: 'daftar', baris: 5, tampil: { pakai_lampiran: true }, bantuPegawai: 'nama',
          bantu: 'Satu baris satu nama/butir. Nomor urut diatur otomatis.' },
        F_TEMBUSAN
      ],
      pola: [
        { nama: 'Undangan rapat', isi: {
          hal: 'Undangan Rapat [nama rapat]',
          isi: 'Sehubungan dengan [dasar/agenda rapat], bersama ini kami mengundang Bapak/Ibu untuk hadir pada rapat yang akan dilaksanakan pada:\n' +
            'Hari/tanggal : [hari, tanggal]\nWaktu : [pukul] WITA – selesai\nTempat : Ruang Rapat Jurusan Gizi\nAgenda : [agenda rapat]\n' +
            'Mengingat pentingnya rapat ini, diharapkan kehadiran Bapak/Ibu tepat waktu.\n' +
            'Demikian kami sampaikan. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.',
          pakai_lampiran: true, lampiran_judul: 'DAFTAR NAMA YANG DIUNDANG' } },
        { nama: 'Usulan / permohonan ke Direktur', isi: {
          hal: 'Usulan [hal yang diusulkan]',
          isi: 'Sehubungan dengan [dasar/latar belakang], bersama ini kami mengusulkan [isi usulan] dengan rincian sebagai berikut:\n1. [rincian pertama]\n2. [rincian kedua]\n' +
            'Demikian usulan ini kami sampaikan. Atas perhatian dan persetujuan Bapak, kami ucapkan terima kasih.' } },
        { nama: 'Laporan kegiatan', isi: {
          hal: 'Laporan Pelaksanaan [nama kegiatan]',
          isi: 'Menindaklanjuti [dasar pelaksanaan kegiatan], bersama ini kami laporkan bahwa kegiatan [nama kegiatan] telah dilaksanakan dengan rincian sebagai berikut:\n' +
            'Hari/tanggal : [hari, tanggal]\nTempat : [tempat]\nPeserta : [jumlah dan asal peserta]\nHasil : [ringkasan hasil]\n' +
            'Demikian laporan ini kami sampaikan. Atas perhatian Bapak, kami ucapkan terima kasih.' } },
        { nama: 'Permohonan penerbitan surat tugas', isi: {
          hal: 'Permohonan Penerbitan Surat Tugas',
          isi: 'Sehubungan dengan [dasar: undangan/kegiatan, nomor dan tanggal surat], bersama ini kami mohon diterbitkan surat tugas bagi pegawai yang namanya terlampir untuk [tugas yang dilaksanakan] pada:\n' +
            'Hari/tanggal : [hari, tanggal]\nTempat : [tempat]\n' +
            'Demikian permohonan ini kami sampaikan. Atas perhatian dan persetujuan Bapak, kami ucapkan terima kasih.',
          pakai_lampiran: true, lampiran_judul: 'DAFTAR NAMA PEGAWAI YANG DITUGASKAN' } }
      ],
      susun: function (v) {
        var lamp = v.pakai_lampiran ? daftar(v.lampiran_isi) : [];
        return gabung({
          isi: uraiIsi(v.isi),
          ada_lampiran: lamp.length > 0,
          lampiran_judul: rapi(v.lampiran_judul).toUpperCase(),
          lampiran: bernomor(lamp)
        }, tembusan(v));
      },
      srikandi: function (v) { return [['Jenis naskah', 'Nota Dinas'], ['Hal', rapi(v.hal)], ['Tujuan', 'pilih pejabat tujuan di SRIKANDI']]; }
    },

    /* ---------- 3. SURAT TUGAS ---------- */
    {
      kode: 'ST', nama: 'Surat Tugas', ikon: '🧳', warna: '#7c3aed', kertas: 'F4',
      ket: 'Penugasan pegawai. Satu orang → data di badan surat; lebih dari satu → daftar di lampiran.',
      templat: function () { return 'surat-tugas.docx'; },
      isian: [
        F_HAL,
        { id: 'pembuka', label: 'Kalimat pembuka (dasar penugasan)', tipe: 'area', baris: 3, wajib: true,
          nilai: 'Sehubungan dengan surat [pengirim] nomor [nomor surat] tanggal [tanggal] hal [perihal], dengan ini kami menugaskan kepada:' },
        { id: 'pegawai', label: 'Pegawai yang ditugaskan', tipe: 'tabel', wajib: true, pilihPegawai: true,
          kolom: [['nama', 'Nama'], ['nip', 'NIP'], ['pangkat', 'Pangkat/gol.'], ['jabatan', 'Jabatan']],
          bantu: 'Ketik beberapa huruf nama lalu pilih dari saran — NIP, pangkat/gol., dan jabatan terisi sendiri. Bisa juga lewat pilihan “Tambah dari daftar pegawai”, atau ketik manual. Lebih dari satu orang → otomatis dibuat halaman lampiran.' },
        { id: 'untuk', label: 'Untuk (tugas yang dilaksanakan)', tipe: 'daftar', baris: 4, wajib: true,
          bantu: 'Satu baris satu butir tugas. Nomor urut diatur otomatis.' },
        { id: 'absen', label: 'Tambahkan butir “tidak melakukan rekam absensi datang dan/atau pulang”', tipe: 'cek', nilai: true },
        { id: 'biaya', label: 'Butir pembiayaan', tipe: 'teks',
          nilai: 'Biaya yang dikeluarkan sebagai akibat surat tugas ini menggunakan DIPA Poltekkes Kemenkes Makassar TA {tahun}.',
          bantu: 'Ubah sesuai sumber biaya, atau kosongkan bila tidak perlu.' },
        { id: 'penutup', label: 'Kalimat penutup', tipe: 'teks', nilai: 'Agar yang bersangkutan melaksanakan tugas dengan baik dan penuh tanggung jawab.' },
        F_PLT
      ],
      pola: [
        { nama: 'Narasumber / menghadiri undangan', isi: {
          hal: 'Surat Tugas [nama kegiatan]',
          pembuka: 'Sehubungan dengan surat [pengirim] nomor [nomor surat] tanggal [tanggal] hal [perihal], dengan ini kami menugaskan kepada:',
          untuk: 'Menjadi narasumber pada kegiatan [nama kegiatan] yang dilaksanakan pada hari [hari], tanggal [tanggal], bertempat di [tempat].\nMelaporkan hasil pelaksanaan tugas kepada Ketua Jurusan Gizi.' } },
        { nama: 'Pembimbing / supervisi PKL', isi: {
          hal: 'Surat Tugas Supervisi [nama praktik]',
          pembuka: 'Dalam rangka pelaksanaan [nama praktik] mahasiswa Program Studi [nama prodi] Jurusan Gizi Poltekkes Kemenkes Makassar Tahun Akademik [tahun akademik], dengan ini kami menugaskan kepada:',
          untuk: 'Melaksanakan supervisi dan pembimbingan mahasiswa pada [nama praktik] di [lokasi] pada tanggal [tanggal mulai] s.d. [tanggal selesai].\nMelaporkan hasil pelaksanaan tugas kepada Ketua Jurusan Gizi.' } },
        { nama: 'Penguji / pembimbing tugas akhir', isi: {
          hal: 'Surat Tugas Penguji [jenis ujian]',
          pembuka: 'Dalam rangka pelaksanaan [jenis ujian] mahasiswa Program Studi [nama prodi] Jurusan Gizi Poltekkes Kemenkes Makassar Tahun Akademik [tahun akademik], dengan ini kami menugaskan kepada:',
          untuk: 'Menjadi penguji pada [jenis ujian] yang dilaksanakan pada tanggal [tanggal] di Jurusan Gizi Poltekkes Kemenkes Makassar.',
          absen: false, biaya: '' } }
      ],
      susun: function (v, ctx) {
        var org = (v.pegawai || []).filter(function (p) { return rapi(p.nama); }).map(function (p, i) {
          return { no: (i + 1) + '.', nama: rapi(p.nama), nip: nipRapat(p.nip), pangkat: rapi(p.pangkat), jabatan: rapi(p.jabatan) };
        });
        var tugas = daftar(v.untuk).map(titikAkhir);
        if (v.absen) tugas.push('Tidak melakukan rekam absensi datang dan/atau pulang.');
        var biaya = rapi(v.biaya).replace('{tahun}', String((ctx && ctx.tahun) || new Date().getFullYear()));
        if (biaya) tugas.push(titikAkhir(biaya));
        var satu = org.length === 1;
        return {
          pembuka: rapi(v.pembuka),
          satu: satu ? org[0] : false,
          banyak: org.length > 1,
          pegawai: org.length > 1 ? org : [],
          untuk: tugas.map(function (t, i) { return { label: i ? '' : 'untuk', tt: i ? '' : ':', no: tugas.length > 1 ? (i + 1) + '.' : '', t: t }; }),
          penutup: rapi(v.penutup),
          pakai_nip: !!v.plt
        };
      },
      srikandi: function (v) { return [['Jenis naskah', 'Surat Tugas'], ['Hal', rapi(v.hal)]]; }
    },

    /* ---------- 4. SURAT KETERANGAN ---------- */
    {
      kode: 'SK', nama: 'Surat Keterangan', ikon: '📄', warna: '#0e7490', kertas: 'A4',
      ket: 'Keterangan tentang pegawai, mahasiswa, atau hal lain yang ditandatangani pejabat jurusan.',
      templat: function () { return 'surat-keterangan.docx'; },
      isian: [
        F_HAL,
        { id: 'ttd', label: 'Yang bertanda tangan', tipe: 'rinci', baris: 3, wajib: true, pilihPegawai: 'ttd', bawaan: 'kajur',
          nilai: 'nama : \nNIP : \njabatan : ',
          bantu: 'Tiga baris: nama, NIP, jabatan. Terisi otomatis dengan Ketua Jurusan; ganti lewat pilihan pegawai bila perlu.' },
        { id: 'subjek', label: 'Menerangkan bahwa', tipe: 'rinci', baris: 4, wajib: true, pilihPegawai: 'subjek', cariMhs: true,
          nilai: 'nama : \nNIP : \npangkat/gol. : \njabatan : ',
          bantu: 'Satu baris satu data, format “label : isi”. Pilih pegawai / cari mahasiswa agar terisi otomatis. Baris boleh ditambah atau dikurangi.' },
        F_ISI, F_PLT
      ],
      pola: [
        { nama: 'Keterangan pegawai (umum)', isi: {
          hal: 'Surat Keterangan [keperluan]',
          subjek: 'nama : \nNIP : \npangkat/gol. : \njabatan : ',
          isi: 'adalah benar dosen tetap pada Jurusan Gizi Poltekkes Kemenkes Makassar dan sampai saat ini masih aktif melaksanakan tugas.\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.' } },
        { nama: 'Keterangan mahasiswa (umum)', isi: {
          hal: 'Surat Keterangan [keperluan]',
          subjek: 'nama : \nNIM : \nprogram studi : \nsemester : ',
          isi: 'adalah benar mahasiswa Jurusan Gizi Poltekkes Kemenkes Makassar yang [keterangan].\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.' } },
        { nama: 'Keterangan telah melaksanakan kegiatan', isi: {
          hal: 'Surat Keterangan Telah Melaksanakan [kegiatan]',
          subjek: 'nama : \nNIP : \npangkat/gol. : \njabatan : ',
          isi: 'telah melaksanakan [nama kegiatan] pada tanggal [tanggal] di [tempat] dengan hasil [hasil/keterangan].\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.' } }
      ],
      susun: function (v) {
        var t = {};
        uraiRinci(v.ttd).forEach(function (r) { t[r.k.toLowerCase()] = r.v; });
        return {
          ttd_nama: t.nama || '', ttd_nip: nipRapat(t.nip || ''), ttd_jabatan: t.jabatan || '',
          subjek: uraiRinci(v.subjek).filter(function (r) { return r.k; }).map(function (r) {
            return { k: r.k, v: /^(nip|nim)$/i.test(r.k) ? nipRapat(r.v) : r.v };
          }),
          isi: uraiIsi(v.isi),
          pakai_nip: !!v.plt
        };
      },
      srikandi: function (v) { return [['Jenis naskah', 'Surat Keterangan'], ['Hal', rapi(v.hal)]]; }
    },

    /* ---------- 5. SURAT PENGANTAR ---------- */
    {
      kode: 'SP', nama: 'Surat Pengantar', ikon: '📦', warna: '#b45309', kertas: 'A4',
      ket: 'Pengantar pengiriman naskah/dokumen/barang, lengkap dengan tanda terima.',
      templat: function () { return 'surat-pengantar.docx'; },
      isian: [
        F_HAL,
        { id: 'tujuan', label: 'Tujuan surat', tipe: 'pilih', nilai: 'eksternal', opsi: [
          ['eksternal', 'Pihak luar (eksternal) — diketik'], ['internal', 'Internal Kemenkes — diisi SRIKANDI']] },
        { id: 'yth', label: 'Yth. (nama jabatan tujuan)', tipe: 'teks', tampil: { tujuan: 'eksternal' }, wajib: true, bantu: 'Tanpa “Yth.”' },
        { id: 'alamat', label: 'Alamat tujuan', tipe: 'area', baris: 2 },
        { id: 'naskah', label: 'Naskah dinas / barang yang dikirimkan', tipe: 'tabel', wajib: true,
          kolom: [['nama', 'Naskah dinas yang dikirimkan'], ['banyak', 'Banyaknya'], ['ket', 'Keterangan']],
          bantu: 'Mis. “Laporan PKL Mahasiswa Prodi D-III Gizi” · “1 (satu) berkas” · “Disampaikan dengan hormat untuk diketahui”.' },
        { id: 'telepon', label: 'No. telepon pengirim', tipe: 'teks', bawaan: 'telepon' },
        F_TEMBUSAN,
        { id: 'plt', label: 'Tampilkan baris NIP di bawah nama penanda tangan', tipe: 'cek', nilai: true,
          bantu: 'Untuk surat pengantar, baris NIP tetap ditampilkan (sesuai petunjuk template).' }
      ],
      pola: [
        { nama: 'Pengantar dokumen', isi: {
          hal: 'Pengantar [nama dokumen]', tujuan: 'eksternal',
          naskah: [{ nama: '[nama dokumen]', banyak: '1 (satu) berkas', ket: 'Disampaikan dengan hormat untuk dipergunakan sebagaimana mestinya.' }] } }
      ],
      susun: function (v) {
        var rows = (v.naskah || []).filter(function (r) { return rapi(r.nama); }).map(function (r, i) {
          return { no: (i + 1) + '.', nama: rapi(r.nama), banyak: rapi(r.banyak), ket: rapi(r.ket) };
        });
        return gabung({
          yth: v.tujuan === 'internal' ? '${jabatan_tujuan}' : rapi(v.yth),
          ada_alamat: baris(v.alamat).length > 0, alamat: baris(v.alamat).join('\n'),
          naskah: rows,
          ada_telepon: !!rapi(v.telepon), telepon: rapi(v.telepon),
          pakai_nip: !!v.plt
        }, tembusan(v));
      },
      srikandi: function (v) {
        return [['Jenis naskah', 'Surat Pengantar'], ['Hal', rapi(v.hal)], ['Tujuan', v.tujuan === 'internal' ? 'pilih pejabat tujuan di SRIKANDI' : rapi(v.yth)]];
      }
    },

    /* ---------- 6. SURAT KEPUTUSAN ---------- */
    {
      kode: 'KP', nama: 'Surat Keputusan', ikon: '⚖️', warna: '#b91c1c', kertas: 'F4',
      ket: 'Draf Keputusan Direktur (mis. pembentukan panitia/tim) untuk diusulkan ke Direktorat.',
      templat: function (v) { return v.pakai_lampiran ? 'surat-keputusan.docx' : 'surat-keputusan-tanpa-lampiran.docx'; },
      isian: [
        { id: 'hal', label: 'Judul keputusan (TENTANG …)', tipe: 'area', baris: 2, wajib: true,
          bantu: 'Tanpa kata “TENTANG”. Otomatis ditulis huruf kapital, mis. “Pembentukan Panitia Seminar Nasional Gizi Tahun 2027”.' },
        { id: 'menimbang', label: 'Menimbang', tipe: 'daftar', baris: 4, wajib: true,
          nilai: 'bahwa dalam rangka [tujuan/latar belakang], perlu [tindakan];\nbahwa pegawai yang namanya tercantum dalam Keputusan ini dipandang layak dan memenuhi syarat untuk ditunjuk sebagai [kedudukan];\nbahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a dan huruf b, perlu menetapkan Keputusan Direktur Poltekkes Kemenkes Makassar tentang [judul keputusan];',
          bantu: 'Satu baris satu butir. Huruf a, b, c diatur otomatis.' },
        { id: 'mengingat', label: 'Mengingat', tipe: 'daftar', baris: 4, wajib: true,
          bantu: 'Satu baris satu peraturan, akhiri dengan titik koma. Nomor diatur otomatis. Pastikan peraturan yang dicantumkan masih berlaku.' },
        { id: 'diktum', label: 'Diktum (KESATU, KEDUA, …)', tipe: 'daftar', baris: 4, wajib: true,
          bantu: 'Satu baris satu diktum. Urutan KESATU, KEDUA, dst. diatur otomatis.' },
        { id: 'diktum_akhir', label: 'Tambahkan diktum penutup baku (“Keputusan ini berlaku sejak tanggal ditetapkan …”)', tipe: 'cek', nilai: true },
        { id: 'direktur', label: 'Nama Direktur (penanda tangan)', tipe: 'teks', wajib: true, bawaan: 'direktur' },
        F_TEMBUSAN,
        { id: 'pakai_lampiran', label: 'Sertakan lampiran keputusan', tipe: 'cek' },
        { id: 'lampiran_judul', label: 'Judul lampiran', tipe: 'area', baris: 2, tampil: { pakai_lampiran: true },
          bantu: 'Mis. “SUSUNAN PANITIA SEMINAR NASIONAL GIZI TAHUN 2027”.' },
        { id: 'lampiran_bentuk', label: 'Bentuk lampiran', tipe: 'pilih', nilai: 'tabel', tampil: { pakai_lampiran: true },
          opsi: [['tabel', 'Tabel (No · Nama · Kedudukan)'], ['daftar', 'Daftar bernomor']] },
        { id: 'lamp_kol2', label: 'Judul kolom 2', tipe: 'teks', nilai: 'Nama', tampil: { pakai_lampiran: true, lampiran_bentuk: 'tabel' } },
        { id: 'lamp_kol3', label: 'Judul kolom 3', tipe: 'teks', nilai: 'Kedudukan dalam Tim', tampil: { pakai_lampiran: true, lampiran_bentuk: 'tabel' } },
        { id: 'lamp_baris', label: 'Isi tabel lampiran', tipe: 'tabel', tampil: { pakai_lampiran: true, lampiran_bentuk: 'tabel' }, pilihPegawai: 'namaSaja',
          kolom: [['a', 'Kolom 2 (mis. nama)'], ['b', 'Kolom 3 (mis. kedudukan)']] },
        { id: 'lampiran_isi', label: 'Isi daftar lampiran', tipe: 'daftar', baris: 5, tampil: { pakai_lampiran: true, lampiran_bentuk: 'daftar' } }
      ],
      pola: [
        { nama: 'SK panitia / tim kegiatan', isi: {
          hal: 'Pembentukan Panitia [nama kegiatan] Jurusan Gizi Poltekkes Kemenkes Makassar Tahun [tahun]',
          menimbang: 'bahwa dalam rangka kelancaran pelaksanaan [nama kegiatan] Jurusan Gizi Poltekkes Kemenkes Makassar Tahun [tahun], perlu dibentuk panitia pelaksana;\nbahwa pegawai yang namanya tercantum dalam Keputusan ini dipandang layak dan memenuhi syarat untuk ditunjuk sebagai panitia pelaksana;\nbahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a dan huruf b, perlu menetapkan Keputusan Direktur Poltekkes Kemenkes Makassar tentang Pembentukan Panitia [nama kegiatan] Jurusan Gizi Poltekkes Kemenkes Makassar Tahun [tahun];',
          mengingat: '[Undang-Undang/Peraturan pertama — periksa yang masih berlaku];\n[Peraturan kedua];',
          diktum: 'Membentuk Panitia [nama kegiatan] Jurusan Gizi Poltekkes Kemenkes Makassar Tahun [tahun] dengan susunan sebagaimana tercantum dalam Lampiran yang merupakan bagian tidak terpisahkan dari Keputusan ini.\nPanitia sebagaimana dimaksud dalam Diktum KESATU bertugas [uraian tugas] dan bertanggung jawab kepada Direktur melalui Ketua Jurusan Gizi.\nSegala biaya yang timbul akibat ditetapkannya Keputusan ini dibebankan pada DIPA Poltekkes Kemenkes Makassar Tahun Anggaran [tahun].',
          pakai_lampiran: true, lampiran_bentuk: 'tabel', lampiran_judul: 'SUSUNAN PANITIA [NAMA KEGIATAN]\nJURUSAN GIZI POLTEKKES KEMENKES MAKASSAR TAHUN [TAHUN]',
          lamp_kol2: 'Nama', lamp_kol3: 'Kedudukan dalam Panitia' } }
      ],
      susun: function (v) {
        var judul = baris(v.hal).join(' ').toUpperCase();
        var mb = daftar(v.menimbang), mg = daftar(v.mengingat), dk = daftar(v.diktum);
        if (v.diktum_akhir) dk.push('Keputusan ini berlaku sejak tanggal ditetapkan dengan ketentuan apabila di kemudian hari terdapat kekeliruan dalam penetapan ini akan dilakukan perbaikan sebagaimana mestinya.');
        var tabel = v.pakai_lampiran && v.lampiran_bentuk !== 'daftar';
        var brs = (v.lamp_baris || []).filter(function (r) { return rapi(r.a) || rapi(r.b); });
        return gabung({
          JUDUL: judul,
          menimbang: mb.map(function (t, i) { return { label: i ? '' : 'Menimbang', tt: i ? '' : ':', huruf: mb.length > 1 ? huruf(i) : '', t: t }; }),
          mengingat: mg.map(function (t, i) { return { label: i ? '' : 'Mengingat', tt: i ? '' : ':', no: mg.length > 1 ? (i + 1) + '.' : '', t: t }; }),
          diktum: dk.map(function (t, i) { return { ke: URUT[i] || ('KE-' + (i + 1)), t: t }; }),
          DIREKTUR: rapi(v.direktur).toUpperCase(),
          lampiran_judul: baris(v.lampiran_judul).join('\n').toUpperCase(),
          lamp_tabel: tabel && brs.length > 0,
          lamp_kol2: rapi(v.lamp_kol2) || 'Nama', lamp_kol3: rapi(v.lamp_kol3) || 'Keterangan',
          lamp_baris: tabel ? brs.map(function (r, i) { return { no: (i + 1) + '.', a: rapi(r.a), b: rapi(r.b) }; }) : [],
          lampiran: v.pakai_lampiran && !tabel ? bernomor(daftar(v.lampiran_isi)) : []
        }, tembusan(v));
      },
      srikandi: function (v) { return [['Jenis naskah', 'Keputusan'], ['Hal / tentang', baris(v.hal).join(' ')]]; }
    },

    /* ---------- 7. NOTULA RAPAT ---------- */
    {
      kode: 'NR', nama: 'Notula Rapat', ikon: '🗒️', warna: '#4f46e5', kertas: 'A4',
      ket: 'Catatan rapat: dasar, agenda, peserta, poin penting, dan rencana tindak lanjut.',
      templat: function () { return 'notula-rapat.docx'; },
      isian: [
        { id: 'hal', label: 'Rapat tentang', tipe: 'area', baris: 2, wajib: true, bantu: 'Otomatis ditulis huruf kapital.' },
        { id: 'dasar', label: 'Dasar', tipe: 'teks', bantu: 'Mis. “Nota Dinas Ketua Jurusan Gizi nomor … tanggal …”.' },
        { id: 'tanggal', label: 'Tanggal rapat', tipe: 'tanggal', wajib: true },
        { id: 'waktu', label: 'Waktu', tipe: 'teks', nilai: '09.00 WITA – selesai' },
        { id: 'tempat', label: 'Tempat', tipe: 'teks', nilai: 'Ruang Rapat Jurusan Gizi' },
        { id: 'pimpinan', label: 'Pimpinan rapat', tipe: 'teks', wajib: true, bantuPegawai: 'namaJabatan' },
        { id: 'agenda', label: 'Agenda', tipe: 'daftar', baris: 3, wajib: true },
        { id: 'peserta', label: 'Peserta', tipe: 'daftar', baris: 5, bantuPegawai: 'nama', bantu: 'Satu baris satu nama, atau tulis “Daftar hadir terlampir”.' },
        { id: 'poin', label: 'Poin-poin penting dan relevan', tipe: 'daftar', baris: 6, wajib: true },
        { id: 'rtl', label: 'Arahan / rencana tindak lanjut', tipe: 'tabel',
          kolom: [['arahan', 'Arahan/Rencana TL'], ['unit', 'Unit penanggung jawab'], ['tenggat', 'Tenggat waktu']] },
        { id: 'tempat_buat', label: 'Dibuat di', tipe: 'teks', nilai: 'Makassar' },
        { id: 'pj_jabatan', label: 'Jabatan penanggung jawab kegiatan', tipe: 'teks', nilai: 'Ketua Jurusan Gizi' },
        { id: 'pj_nama', label: 'Nama penanggung jawab kegiatan', tipe: 'teks', bawaan: 'kajurNama', bantuPegawai: 'ganti' },
        { id: 'notulis', label: 'Nama notulis', tipe: 'teks', bawaan: 'saya', bantuPegawai: 'ganti' }
      ],
      pola: [],
      susun: function (v) {
        function kolom(label, arr) {
          return arr.map(function (t, i) { return { label: i ? '' : label, tt: i ? '' : ':', no: arr.length > 1 ? (i + 1) + '.' : '', t: t }; });
        }
        var ag = daftar(v.agenda), ps = daftar(v.peserta);
        var wt = [tglIndo(v.tanggal, true), rapi(v.waktu) ? 'pukul ' + rapi(v.waktu) : '', rapi(v.tempat) ? 'di ' + rapi(v.tempat) : ''].filter(Boolean).join(', ');
        return {
          JUDUL: baris(v.hal).join(' ').toUpperCase(),
          dasar: rapi(v.dasar) || '-', waktu_tempat: wt, pimpinan: rapi(v.pimpinan),
          agenda: kolom('Agenda', ag.length ? ag : ['-']),
          peserta: kolom('Peserta', ps.length ? ps : ['Daftar hadir terlampir']),
          poin: daftar(v.poin).map(function (t) { return { t: t }; }),
          rtl: (v.rtl || []).filter(function (r) { return rapi(r.arahan); }).map(function (r, i) {
            return { no: (i + 1) + '.', arahan: rapi(r.arahan), unit: rapi(r.unit), tenggat: rapi(r.tenggat) };
          }),
          tempat_buat: rapi(v.tempat_buat) || 'Makassar', tanggal_buat: tglIndo(v.tanggal),
          pj_jabatan: rapi(v.pj_jabatan), pj_nama: rapi(v.pj_nama), notulis: rapi(v.notulis)
        };
      },
      srikandi: null
    }
  ];

  function cari(kode) {
    for (var i = 0; i < JENIS.length; i++) if (JENIS[i].kode === kode) return JENIS[i];
    return null;
  }

  /** Nilai awal form sebuah jenis. */
  function nilaiAwal(j) {
    var v = {};
    j.isian.forEach(function (f) {
      if (f.tipe === 'info') return;
      if (f.tipe === 'tabel') v[f.id] = [];
      else if (f.tipe === 'cek') v[f.id] = !!f.nilai;
      else v[f.id] = f.nilai == null ? '' : f.nilai;
    });
    return v;
  }

  /** Isian tampil atau tidak, berdasarkan nilai isian lain. */
  function tampil(f, v) {
    if (!f.tampil) return true;
    for (var k in f.tampil) {
      var mau = f.tampil[k], ada = v[k];
      if (Array.isArray(mau)) { if (mau.indexOf(ada) < 0) return false; }
      else if (mau === true) { if (!ada) return false; }
      else if (ada !== mau) return false;
    }
    return true;
  }

  /** Periksa isian wajib. Mengembalikan daftar label yang belum diisi. */
  function periksa(j, v) {
    var kurang = [];
    j.isian.forEach(function (f) {
      if (!f.wajib || !tampil(f, v)) return;
      var x = v[f.id], kosong;
      if (f.tipe === 'tabel') kosong = !(x || []).some(function (r) { return rapi(r[f.kolom[0][0]]); });
      else if (f.tipe === 'rinci') kosong = !uraiRinci(x).some(function (r) { return r.v; });
      else kosong = !rapi(x);
      if (kosong) kurang.push(f.label);
    });
    return kurang;
  }

  /** Tanda kurung siku [ ... ] yang belum diganti (sisa pola siap pakai). */
  function sisaKurung(v) {
    var out = [];
    (function jalan(x) {
      if (typeof x === 'string') { (x.match(/\[[^\[\]\n]{1,80}\]/g) || []).forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); }); }
      else if (Array.isArray(x)) x.forEach(jalan);
      else if (x && typeof x === 'object') Object.keys(x).forEach(function (k) { jalan(x[k]); });
    })(v);
    return out;
  }

  function namaFile(j, v) {
    var hal = baris(v.hal).join(' ').replace(/[\\/:*?"<>|\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return (j.nama + (hal ? ' - ' + hal : '') + '.docx');
  }

  var API = {
    JENIS: JENIS, cari: cari, nilaiAwal: nilaiAwal, tampil: tampil, periksa: periksa, sisaKurung: sisaKurung, namaFile: namaFile,
    util: { rapi: rapi, baris: baris, daftar: daftar, uraiIsi: uraiIsi, uraiRinci: uraiRinci, tglIndo: tglIndo, nipRapat: nipRapat, pangkatGol: pangkatGol }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SURAT = API;
})(typeof window !== 'undefined' ? window : this);
