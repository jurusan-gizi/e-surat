/* e-Surat Gizi — antarmuka: beranda, form 7 jenis naskah, arsip, dan pembuatan .docx di browser. */
(() => {
  'use strict';

  const CFG = window.ESURAT_CONFIG || {};
  const SSO = window.GiziSSO || null;
  const S = window.SURAT;
  const U = S.util;
  const $isi = document.getElementById('isi');
  const COBA = !CFG.API_URL;                 // belum tersambung server → mode coba (arsip lokal)
  const KUNCI_LOKAL = 'esurat_arsip_lokal';

  let sesi = null;                            // token Gizi-Link dosen/staf
  let DATA = { profil: null, staf: [], pengaturan: {}, arsip: [] };
  let F = null;                               // form aktif: { j, v, id, kotor, hasil }
  let cariArsip = '';

  mulai();

  /* ===================== MULAI & LOGIN ===================== */
  async function mulai() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('hashchange', arah);
    window.addEventListener('beforeunload', (e) => { if (F && F.kotor) { e.preventDefault(); e.returnValue = ''; } });

    if (COBA) {
      DATA.profil = { id: '', nama: 'Mode coba', jabatan: '' };
      DATA.pengaturan = { direktur: CFG.DIREKTUR || '', telepon: CFG.TELEPON || '' };
      DATA.arsip = bacaLokal();
      return arah();
    }
    if (!SSO) return tampilPesan('Gizi-Link tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.');
    sesi = SSO.getStaf && SSO.getStaf();
    if (!sesi) return tampilMasuk();
    tampilMuat();
    try {
      const res = await api({ aksi: 'muat' });
      if (!res.ok) return gagalServer(res);
      DATA = { profil: res.profil, staf: res.staf || [], pengaturan: res.pengaturan || {}, arsip: res.arsip || [] };
      if (!DATA.pengaturan.direktur) DATA.pengaturan.direktur = CFG.DIREKTUR || '';
      if (!DATA.pengaturan.telepon) DATA.pengaturan.telepon = CFG.TELEPON || '';
      arah();
    } catch (e) {
      tampilPesan(navigator.onLine ? 'Server tidak merespons. Coba muat ulang halaman sebentar lagi.' : 'Tidak ada koneksi internet.');
    }
  }

  function gagalServer(res) {
    if (res.kode === 'AUTH') { if (SSO) SSO.keluar(false); return tampilMasuk('Sesi Gizi-Link berakhir. Silakan masuk lagi.'); }
    if (res.kode === 'AKSES') {
      $isi.innerHTML = `<section class="kartu"><h2>Akses terbatas</h2>
        <p class="bantu" style="font-size:14px">${esc(res.pesan || 'Aplikasi ini khusus Ketua Jurusan, Sekretaris Jurusan, Ketua Program Studi, dan Kepala Unit Laboratorium.')}</p>
        <a class="btn kedua" style="margin-top:16px" href="https://jurusan-gizi.github.io/">← Kembali ke Gizi-Link</a></section>`;
      return;
    }
    tampilPesan(esc(res.pesan || 'Gagal memuat data.'));
  }

  function tampilMasuk(catatan) {
    const mhs = SSO && SSO.get && SSO.get();
    $isi.innerHTML = `
      <section class="kartu">
        <h2>Masuk dulu lewat Gizi-Link</h2>
        <p class="bantu" style="font-size:14px">${mhs ? 'Aplikasi ini khusus pejabat jurusan. Anda sedang masuk sebagai mahasiswa.'
          : 'Khusus Ketua Jurusan, Sekretaris Jurusan, Ketua Program Studi, dan Kepala Unit Laboratorium.'}</p>
        ${catatan ? `<p class="pesan">${esc(catatan)}</p>` : ''}
        <button class="btn utama lebar" id="btn-masuk" style="margin-top:18px">Masuk sebagai Dosen/Staf</button>
      </section>`;
    document.getElementById('btn-masuk').onclick = () => {
      if (mhs) SSO.keluar(false);
      SSO.masuk(location.href.split('#')[0], 'staf');
    };
  }

  /* ===================== ARAH HALAMAN ===================== */
  function arah() {
    const h = location.hash.replace(/^#\/?/, '');
    const [bagian, arg] = h.split('/');
    if (bagian === 'buat' && S.cari(arg)) {
      if (!F || F.id || F.j.kode !== arg) F = formBaru(S.cari(arg));
      return tampilForm();
    }
    if (bagian === 'arsip' && arg) {
      if (F && F.id === arg) return tampilForm();
      return bukaArsip(arg);
    }
    F = null;
    beranda();
  }
  function ke(hash) { if (location.hash === hash) arah(); else location.hash = hash; }

  /* ===================== BERANDA ===================== */
  function beranda() {
    const p = DATA.profil || {};
    $isi.innerHTML = `
      ${COBA ? `<div class="pita"><b>Mode coba.</b> Aplikasi belum tersambung ke server (isi <code>API_URL</code> di <code>config.js</code>). Surat tetap bisa dibuat; arsip hanya tersimpan di perangkat ini dan daftar pegawai belum tersedia.</div>` : ''}
      <section class="kartu">
        <div class="profil">
          <div class="avatar">${esc(inisial(p.nama))}</div>
          <div class="profil-teks">
            <p class="salam">${COBA ? 'Belum tersambung server' : 'Masuk sebagai'}</p>
            <p class="nama">${esc(p.nama || '')}</p>
            ${p.jabatan ? `<p class="bantu" style="margin-top:2px">${esc(p.jabatan)}</p>` : ''}
          </div>
          <a class="btn kedua kecil" href="${esc(CFG.SRIKANDI_URL || 'https://srikandi.arsip.go.id/beranda')}" target="_blank" rel="noopener">Buka SRIKANDI ↗</a>
        </div>
      </section>

      <h2 class="judul-bagian">Buat naskah baru</h2>
      <ul class="grid-jenis">
        ${S.JENIS.map((j) => `
          <li><button type="button" class="jenis" style="--warna:${j.warna}" data-kode="${j.kode}">
            <span class="jenis-ikon" aria-hidden="true">${j.ikon}</span>
            <span class="jenis-teks"><span class="jenis-nama">${esc(j.nama)}</span><span class="jenis-ket">${esc(j.ket)}</span></span>
          </button></li>`).join('')}
      </ul>

      <h2 class="judul-bagian"><span>Arsip naskah</span><span style="text-transform:none;letter-spacing:0;font-weight:600">${DATA.arsip.length} naskah</span></h2>
      ${DATA.arsip.length > 5 ? `<input type="search" class="cari" id="cari-arsip" placeholder="Cari hal, jenis, atau pembuat…" value="${esc(cariArsip)}">` : ''}
      <div id="arsip"></div>`;

    $isi.querySelectorAll('.jenis').forEach((b) => { b.onclick = () => ke('#/buat/' + b.dataset.kode); });
    const c = document.getElementById('cari-arsip');
    if (c) c.oninput = () => { cariArsip = c.value; daftarArsip(); };
    daftarArsip();
  }

  function daftarArsip() {
    const el = document.getElementById('arsip');
    if (!el) return;
    const q = cariArsip.trim().toLowerCase();
    const list = DATA.arsip.filter((a) => !q || [a.hal, a.jenis, a.pembuat].join(' ').toLowerCase().includes(q));
    if (!list.length) {
      el.innerHTML = `<p class="kosong">${DATA.arsip.length ? 'Tidak ada naskah yang cocok.' : 'Belum ada naskah. Naskah yang dibuat atau disimpan sebagai draf akan muncul di sini — tinggal dibuka lagi bila perlu diedit.'}</p>`;
      return;
    }
    el.innerHTML = `<ul class="daftar-arsip">${list.map((a) => `
      <li class="arsip">
        <button type="button" class="arsip-buka" data-id="${esc(a.id)}">
          <span class="arsip-hal">${esc(a.hal || '(tanpa hal)')}</span>
          <span class="arsip-meta"><span class="lencana">${esc(a.jenis)}</span>${esc(tglWaktu(a.diubah || a.dibuat))}${a.pembuat ? ' · ' + esc(a.pembuat) : ''}</span>
        </button>
        <span class="arsip-aksi">
          <button type="button" class="ikon-btn" data-salin="${esc(a.id)}" title="Buat salinan" aria-label="Buat salinan">⧉</button>
          <button type="button" class="ikon-btn" data-hapus="${esc(a.id)}" title="Hapus" aria-label="Hapus">🗑</button>
        </span>
      </li>`).join('')}</ul>`;
    el.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => ke('#/arsip/' + b.dataset.id); });
    el.querySelectorAll('[data-salin]').forEach((b) => { b.onclick = () => salinArsip(b.dataset.salin); });
    el.querySelectorAll('[data-hapus]').forEach((b) => { b.onclick = () => hapusArsip(b.dataset.hapus); });
  }

  /* ===================== ARSIP: buka / salin / hapus / simpan ===================== */
  async function ambilArsip(id) {
    if (COBA) {
      const a = bacaLokal().find((x) => x.id === id);
      if (!a) throw new Error('Naskah tidak ditemukan.');
      return a;
    }
    const res = await api({ aksi: 'ambil', id });
    if (!res.ok) throw new Error(res.pesan || 'Naskah tidak ditemukan.');
    return res.naskah;
  }

  async function bukaArsip(id, sebagaiSalinan) {
    tampilMuat();
    try {
      const a = await ambilArsip(id);
      const j = S.cari(a.kode);
      if (!j) throw new Error('Jenis naskah tidak dikenal.');
      F = { j, v: Object.assign(S.nilaiAwal(j), a.data || {}), id: sebagaiSalinan ? null : a.id, kotor: !!sebagaiSalinan, hasil: null };
      if (sebagaiSalinan) { history.replaceState(null, '', '#/buat/' + j.kode); }
      tampilForm();
    } catch (e) {
      toast(e.message || 'Gagal membuka naskah.');
      ke('#/');
    }
  }
  function salinArsip(id) { F = null; bukaArsip(id, true); }

  async function hapusArsip(id) {
    const a = DATA.arsip.find((x) => x.id === id);
    if (!a || !confirm(`Hapus “${a.hal || a.jenis}” dari arsip?`)) return;
    try {
      if (COBA) tulisLokal(bacaLokal().filter((x) => x.id !== id));
      else { const res = await api({ aksi: 'hapus', id }); if (!res.ok) throw new Error(res.pesan); }
      DATA.arsip = DATA.arsip.filter((x) => x.id !== id);
      daftarArsip();
      toast('Naskah dihapus.');
    } catch (e) { toast(e.message || 'Gagal menghapus.'); }
  }

  async function simpanArsip() {
    const hal = U.baris(F.v.hal).join(' ');
    if (COBA) {
      const list = bacaLokal();
      const now = new Date().toISOString();
      let a = F.id && list.find((x) => x.id === F.id);
      if (a) { a.hal = hal; a.diubah = now; a.data = F.v; }
      else { a = { id: 'L' + Date.now().toString(36), kode: F.j.kode, jenis: F.j.nama, hal, dibuat: now, diubah: now, pembuat: '', data: F.v }; list.unshift(a); }
      tulisLokal(list);
      F.id = a.id;
      DATA.arsip = bacaLokal();
    } else {
      const res = await api({ aksi: 'simpan', id: F.id || '', kode: F.j.kode, jenis: F.j.nama, hal, data: F.v });
      if (!res.ok) throw new Error(res.pesan || 'Gagal menyimpan ke arsip.');
      F.id = res.id;
      DATA.arsip = res.arsip || DATA.arsip;
    }
    F.kotor = false;
    history.replaceState(null, '', '#/arsip/' + F.id);
  }

  function bacaLokal() { try { return JSON.parse(localStorage.getItem(KUNCI_LOKAL) || '[]'); } catch (e) { return []; } }
  function tulisLokal(list) { try { localStorage.setItem(KUNCI_LOKAL, JSON.stringify(list)); } catch (e) { toast('Penyimpanan perangkat penuh/tidak tersedia.'); } }

  /* ===================== FORM ===================== */
  function formBaru(j) {
    const v = S.nilaiAwal(j);
    j.isian.forEach((f) => { if (f.bawaan) { const x = bawaan(f.bawaan); if (x) v[f.id] = x; } });
    return { j, v, id: null, kotor: false, hasil: null };
  }

  function stafKode(kode) { return DATA.staf.find((s) => String(s.kode || '').toLowerCase().split(/[,;]\s*/).includes(kode)); }
  function teksTtd(s) { return `nama : ${s.nama}\nNIP : ${U.nipRapat(s.nip)}\njabatan : ${s.jabatan || ''}`; }
  function teksSubjek(s) { return `nama : ${s.nama}\nNIP : ${U.nipRapat(s.nip)}\npangkat/gol. : ${U.pangkatGol(s)}\njabatan : ${s.jabatan || ''}`; }
  function bawaan(apa) {
    const kajur = stafKode('kajur');
    if (apa === 'kajur') return kajur ? teksTtd(kajur) : '';
    if (apa === 'kajurNama') return kajur ? kajur.nama : '';
    if (apa === 'saya') return COBA ? '' : ((DATA.staf.find((s) => s.id === (DATA.profil || {}).id) || {}).nama || (DATA.profil || {}).nama || '');
    if (apa === 'telepon') return DATA.pengaturan.telepon || '';
    if (apa === 'direktur') return DATA.pengaturan.direktur || '';
    return '';
  }

  function tampilForm() {
    const j = F.j;
    window.scrollTo(0, 0);
    $isi.innerHTML = `
      <section class="kartu">
        <div class="form-kop">
          <span class="jenis-ikon" style="--warna:${j.warna}" aria-hidden="true">${j.ikon}</span>
          <div style="flex:1;min-width:0">
            <h2>${esc(j.nama)}${F.id ? ' <span class="lencana" style="vertical-align:middle">dari arsip</span>' : ''}</h2>
            <p>${esc(j.ket)} Kertas ${j.kertas}.</p>
          </div>
          <button type="button" class="btn teks" id="btn-kembali">← Kembali</button>
        </div>
        ${j.pola && j.pola.length ? `
          <p class="label-kecil">Pola siap pakai</p>
          <div class="pola">${j.pola.map((p, i) => `<button type="button" class="chip" data-pola="${i}">${esc(p.nama)}</button>`).join('')}</div>
          <p class="bantu">Pilih pola, lalu ganti bagian dalam [kurung siku] dengan data sebenarnya.</p>` : ''}

        ${DATA.staf.length ? `<datalist id="dl-staf">${DATA.staf.map((x) => `<option value="${esc(x.nama)}">`).join('')}</datalist>` : ''}
        <form id="form" novalidate>
          ${j.isian.map(htmlIsian).join('')}
          <p class="pesan" id="pesan-form" hidden></p>
          <div class="aksi">
            <button type="submit" class="btn utama" id="btn-buat">📄 Buat & unduh .docx</button>
            <button type="button" class="btn kedua" id="btn-draf">Simpan draf</button>
          </div>
        </form>
      </section>
      <div id="hasil"></div>`;

    document.getElementById('btn-kembali').onclick = () => { if (!F.kotor || confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')) { F = null; ke('#/'); } };
    $isi.querySelectorAll('[data-pola]').forEach((b) => { b.onclick = () => pakaiPola(j.pola[Number(b.dataset.pola)]); });
    j.isian.forEach(pasangIsian);
    aturTampil();
    document.getElementById('form').onsubmit = (e) => { e.preventDefault(); buat(); };
    document.getElementById('btn-draf').onclick = simpanDraf;
    if (F.hasil) tampilHasil();
  }

  function pakaiPola(p) {
    const terisi = ['isi', 'untuk', 'menimbang', 'diktum'].some((k) => F.v[k] && F.v[k] !== (S.nilaiAwal(F.j)[k] || ''));
    if (terisi && !confirm(`Isian yang sudah ada akan diganti dengan pola “${p.nama}”. Lanjutkan?`)) return;
    const dasar = formBaru(F.j).v;
    F.v = Object.assign(dasar, JSON.parse(JSON.stringify(p.isi)));
    F.kotor = true;
    tampilForm();
    toast('Pola diterapkan — ganti bagian [kurung siku].');
  }

  function htmlIsian(f) {
    const v = F.v[f.id];
    const id = 'f-' + f.id;
    const label = f.label ? `${esc(f.label)}${f.wajib ? ' <span class="wajib" aria-hidden="true">*</span>' : ''}` : '';
    const bantu = f.bantu ? `<p class="bantu">${esc(f.bantu)}</p>` : '';
    let badan = '';
    if (f.tipe === 'info') return `<div class="isian" data-isian="${f.id}"><p class="info">${esc(f.teks)}</p></div>`;
    if (f.tipe === 'cek') {
      return `<div class="isian" data-isian="${f.id}"><label class="cek"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span></label>${bantu}</div>`;
    }
    if (f.tipe === 'teks') {
      const dl = f.saran ? `<datalist id="${id}-dl">${f.saran.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>` : '';
      badan = `<input type="text" id="${id}" value="${esc(v)}" ${f.saran ? `list="${id}-dl"` : ''} autocomplete="off">${dl}`;
    } else if (f.tipe === 'tanggal') {
      badan = `<input type="date" id="${id}" value="${esc(v)}">`;
    } else if (f.tipe === 'pilih') {
      badan = `<select id="${id}">${f.opsi.map((o) => { const [val, teks] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${v === val ? 'selected' : ''}>${esc(teks)}</option>`; }).join('')}</select>`;
    } else if (f.tipe === 'area' || f.tipe === 'daftar' || f.tipe === 'rinci') {
      badan = `<textarea id="${id}" rows="${f.baris || 4}" spellcheck="false">${esc(v)}</textarea>`;
    } else if (f.tipe === 'tabel') {
      badan = `<div class="tabel-isian" id="${id}"></div><div class="alat"><button type="button" class="btn kedua kecil" data-tambah="${f.id}">+ Tambah baris</button></div>`;
    }
    return `<div class="isian" data-isian="${f.id}"><label for="${id}">${label}</label>${badan}${alatBantu(f)}${bantu}</div>`;
  }

  function opsiStaf(judul) {
    return `<option value="">${esc(judul)}</option>` + DATA.staf.map((s, i) => `<option value="${i}">${esc(s.nama)}</option>`).join('');
  }
  function alatBantu(f) {
    if (!DATA.staf.length && !f.cariMhs) return '';
    let h = '';
    const pakai = f.pilihPegawai || f.bantuPegawai;
    if (pakai && DATA.staf.length) {
      const judul = f.tipe === 'tabel' ? '＋ Tambah dari daftar pegawai…' : (f.bantuPegawai === 'nama' ? '＋ Tambah nama pegawai…' : 'Isi dari daftar pegawai…');
      h += `<div class="alat"><select data-pegawai="${f.id}" aria-label="${esc(judul)}">${opsiStaf(judul)}</select></div>`;
    }
    if (f.cariMhs && !COBA) {
      h += `<div class="alat"><input type="search" data-carimhs="${f.id}" placeholder="Cari mahasiswa (nama atau NIM), lalu Enter" aria-label="Cari mahasiswa">
        <button type="button" class="btn kedua kecil" data-carimhs-btn="${f.id}">Cari</button></div><ul class="hasil-cari" data-hasilmhs="${f.id}"></ul>`;
    }
    return h;
  }

  function pasangIsian(f) {
    if (f.tipe === 'info') return;
    const el = document.getElementById('f-' + f.id);
    const ubah = () => { F.kotor = true; F.hasil = null; bersihSalah(f.id); };
    if (f.tipe === 'tabel') {
      gambarTabel(f);
      $isi.querySelector(`[data-tambah="${f.id}"]`).onclick = () => { F.v[f.id].push({}); ubah(); gambarTabel(f, true); };
    } else if (f.tipe === 'cek') {
      el.onchange = () => { F.v[f.id] = el.checked; ubah(); aturTampil(); };
    } else {
      el.oninput = () => { F.v[f.id] = el.value; ubah(); if (f.tipe === 'pilih') aturTampil(); };
      if (f.tipe === 'pilih') el.onchange = el.oninput;
    }
    const sel = $isi.querySelector(`[data-pegawai="${f.id}"]`);
    if (sel) sel.onchange = () => {
      const s = DATA.staf[Number(sel.value)];
      sel.value = '';
      if (!s) return;
      pilihPegawai(f, s);
      ubah();
    };
    const cari = $isi.querySelector(`[data-carimhs="${f.id}"]`);
    if (cari) {
      const jalan = () => cariMahasiswa(f, cari.value);
      $isi.querySelector(`[data-carimhs-btn="${f.id}"]`).onclick = jalan;
      cari.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); jalan(); } };
    }
  }

  function setNilai(f, nilai) {
    F.v[f.id] = nilai;
    const el = document.getElementById('f-' + f.id);
    if (el && 'value' in el) el.value = nilai;
  }

  function pilihPegawai(f, s) {
    if (f.tipe === 'tabel') {
      const kosong = F.v[f.id].findIndex((r) => !Object.values(r).some((x) => U.rapi(x)));
      const baris = f.pilihPegawai === 'namaSaja' ? { a: s.nama, b: '' }
        : { nama: s.nama, nip: U.nipRapat(s.nip), pangkat: U.pangkatGol(s), jabatan: s.jabatan || '' };
      if (kosong >= 0) F.v[f.id][kosong] = baris; else F.v[f.id].push(baris);
      return gambarTabel(f);
    }
    if (f.pilihPegawai === 'ttd') return setNilai(f, teksTtd(s));
    if (f.pilihPegawai === 'subjek') return setNilai(f, teksSubjek(s));
    if (f.bantuPegawai === 'nama') return setNilai(f, (F.v[f.id] ? F.v[f.id].replace(/\s+$/, '') + '\n' : '') + s.nama);
    if (f.bantuPegawai === 'namaJabatan') return setNilai(f, s.nama + (s.jabatan ? ' (' + s.jabatan + ')' : ''));
    setNilai(f, s.nama);
  }

  async function cariMahasiswa(f, q) {
    const ul = $isi.querySelector(`[data-hasilmhs="${f.id}"]`);
    q = U.rapi(q);
    if (q.length < 3) { ul.innerHTML = '<li class="bantu">Ketik minimal 3 huruf/angka.</li>'; return; }
    ul.innerHTML = '<li class="bantu">Mencari…</li>';
    try {
      const res = await api({ aksi: 'cariMhs', q });
      if (!res.ok) throw new Error(res.pesan);
      if (!res.hasil.length) { ul.innerHTML = '<li class="bantu">Tidak ditemukan.</li>'; return; }
      ul.innerHTML = res.hasil.map((m, i) => `<li><button type="button" data-i="${i}"><b>${esc(m.nama)}</b> · ${esc(m.nim)} · ${esc(m.prodi)}${m.kelas ? ' · ' + esc(m.kelas) : ''}</button></li>`).join('');
      ul.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          const m = res.hasil[Number(b.dataset.i)];
          setNilai(f, `nama : ${m.nama}\nNIM : ${m.nim}\nprogram studi : ${m.prodiPanjang || m.prodi}\nsemester : `);
          F.kotor = true; F.hasil = null; ul.innerHTML = '';
        };
      });
    } catch (e) { ul.innerHTML = `<li class="bantu">${esc(e.message || 'Gagal mencari.')}</li>`; }
  }

  function gambarTabel(f, fokusAkhir) {
    const el = document.getElementById('f-' + f.id);
    const rows = F.v[f.id] || (F.v[f.id] = []);
    if (!rows.length) { el.innerHTML = '<p class="tabel-kosong">Belum ada baris.</p>'; return; }
    el.innerHTML = rows.map((r, i) => `
      <div class="baris-tabel" style="--kol:${f.kolom.length}">
        ${f.kolom.map(([k, lab]) => `<input type="text" data-r="${i}" data-k="${k}" value="${esc(r[k])}" placeholder="${esc(lab)}" aria-label="${esc(lab)} baris ${i + 1}" autocomplete="off">`).join('')}
        <button type="button" class="ikon-btn hapus-baris" data-hapusbaris="${i}" title="Hapus baris" aria-label="Hapus baris ${i + 1}">✕</button>
      </div>`).join('');
    const kolNama = f.kolom[0][0];
    const pakaiStaf = !!(f.pilihPegawai && DATA.staf.length);
    el.querySelectorAll('input').forEach((inp) => {
      const namaPegawai = pakaiStaf && inp.dataset.k === kolNama;
      if (namaPegawai) inp.setAttribute('list', 'dl-staf');     // ketik beberapa huruf → muncul saran nama pegawai
      inp.oninput = () => {
        const r = rows[Number(inp.dataset.r)];
        r[inp.dataset.k] = inp.value;
        F.kotor = true; F.hasil = null; bersihSalah(f.id);
        if (!namaPegawai || f.pilihPegawai === 'namaSaja') return;
        // nama cocok dengan daftar pegawai → NIP, pangkat/gol., jabatan terisi sendiri
        const s = DATA.staf.find((x) => x.nama.toLowerCase() === inp.value.trim().toLowerCase());
        if (!s) return;
        Object.assign(r, { nama: s.nama, nip: U.nipRapat(s.nip), pangkat: U.pangkatGol(s), jabatan: s.jabatan || '' });
        inp.closest('.baris-tabel').querySelectorAll('input').forEach((x) => { x.value = r[x.dataset.k] || ''; });
      };
    });
    el.querySelectorAll('[data-hapusbaris]').forEach((b) => {
      b.onclick = () => { rows.splice(Number(b.dataset.hapusbaris), 1); F.kotor = true; F.hasil = null; gambarTabel(f); };
    });
    if (fokusAkhir) { const all = el.querySelectorAll('.baris-tabel:last-child input'); if (all[0]) all[0].focus(); }
  }

  function aturTampil() {
    F.j.isian.forEach((f) => {
      const w = $isi.querySelector(`[data-isian="${f.id}"]`);
      if (w) w.hidden = !S.tampil(f, F.v);
    });
  }
  function bersihSalah(id) {
    const w = $isi.querySelector(`[data-isian="${id}"]`);
    if (w) w.classList.remove('salah');
    const p = document.getElementById('pesan-form');
    if (p) p.hidden = true;
  }
  function pesanForm(t) { const p = document.getElementById('pesan-form'); p.textContent = t; p.hidden = false; p.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

  /* ===================== BUAT .DOCX ===================== */
  function periksaForm(ketat) {
    $isi.querySelectorAll('.isian.salah').forEach((w) => w.classList.remove('salah'));
    const kurang = ketat ? S.periksa(F.j, F.v) : (U.rapi(F.v.hal) ? [] : [F.j.isian.find((f) => f.id === 'hal').label]);
    if (!kurang.length) return true;
    F.j.isian.forEach((f) => { if (kurang.includes(f.label)) { const w = $isi.querySelector(`[data-isian="${f.id}"]`); if (w) w.classList.add('salah'); } });
    pesanForm('Mohon lengkapi: ' + kurang.join(', ') + '.');
    return false;
  }

  async function simpanDraf() {
    if (!periksaForm(false)) return;
    const btn = document.getElementById('btn-draf');
    const label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try { await simpanArsip(); toast('Draf tersimpan di arsip.'); }
    catch (e) { toast(e.message || 'Gagal menyimpan draf.'); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  }

  async function buat() {
    if (!periksaForm(true)) return;
    const sisa = S.sisaKurung(F.v);
    if (sisa.length && !confirm('Masih ada bagian dalam kurung siku yang belum diganti:\n\n' + sisa.slice(0, 8).join('\n') + (sisa.length > 8 ? '\n…' : '') + '\n\nTetap buat suratnya?')) return;
    const btn = document.getElementById('btn-buat');
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="putar kecil"></span> Menyusun…';
    try {
      const j = F.j;
      const data = j.susun(F.v, { tahun: new Date().getFullYear() });
      const blob = await renderDocx(j.templat(F.v), data);
      unduh(blob, S.namaFile(j, F.v));
      let tersimpan = true;
      try { await simpanArsip(); } catch (e) { tersimpan = false; }
      F.hasil = { tersimpan, blob, nama: S.namaFile(j, F.v) };
      tampilHasil();
    } catch (e) {
      pesanForm('Gagal membuat surat: ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  }

  async function renderDocx(templat, data) {
    const r = await fetch('templates/' + templat, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Template ' + templat + ' tidak ditemukan.');
    const zip = new window.PizZip(await r.arrayBuffer());
    const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: '[[', end: ']]' }, nullGetter: () => '' });
    doc.render(data);
    return doc.getZip().generate({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function unduh(blob, nama) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  function tampilHasil() {
    const el = document.getElementById('hasil');
    if (!el || !F.hasil) return;
    const j = F.j;
    const meta = j.srikandi ? j.srikandi(F.v).filter((x) => x[1]) : null;
    el.innerHTML = `
      <section class="kartu hasil" style="margin-top:14px">
        <h2>✅ Surat sudah diunduh</h2>
        <p class="bantu" style="font-size:13.5px">File: <b>${esc(F.hasil.nama)}</b>. ${F.hasil.tersimpan ? 'Isian tersimpan di arsip — bila perlu diedit, buka dari arsip, ubah, lalu buat lagi.' : '<span style="color:var(--merah)">Belum tersimpan ke arsip (koneksi bermasalah) — tekan “Simpan draf” untuk mencoba lagi.</span>'}</p>
        ${meta ? `
          <p class="label-kecil">Langkah di SRIKANDI</p>
          <ol class="langkah">
            <li>Buka SRIKANDI → buat naskah keluar → pilih jenis naskah yang sesuai.</li>
            <li>Isi data naskah di SRIKANDI dengan nilai di bawah ini (tinggal salin).</li>
            <li>Unggah file .docx ini sebagai draf naskah. Nomor, tanggal, dan tanda tangan elektronik akan terisi otomatis saat diproses.</li>
          </ol>
          <ul class="salin-daftar">${meta.map(([k, val], i) => `
            <li><div><span class="k">${esc(k)}</span><span class="v">${esc(val)}</span></div>
            <button type="button" class="btn kedua kecil" data-salinteks="${i}">Salin</button></li>`).join('')}</ul>` : `
          <p class="bantu" style="font-size:13.5px">Notula tidak memakai variabel SRIKANDI — file langsung siap dicetak atau dilampirkan.</p>`}
        <div class="aksi">
          <button type="button" class="btn kedua" id="btn-unduh-lagi">Unduh lagi</button>
          <a class="btn utama" href="${esc(CFG.SRIKANDI_URL || 'https://srikandi.arsip.go.id/beranda')}" target="_blank" rel="noopener">Buka SRIKANDI ↗</a>
        </div>
      </section>`;
    el.querySelectorAll('[data-salinteks]').forEach((b) => {
      b.onclick = async () => {
        const teks = meta[Number(b.dataset.salinteks)][1];
        try { await navigator.clipboard.writeText(teks); toast('Disalin.'); }
        catch (e) { toast('Tidak bisa menyalin otomatis — salin manual.'); }
      };
    });
    document.getElementById('btn-unduh-lagi').onclick = () => unduh(F.hasil.blob, F.hasil.nama);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ===================== UTILITAS ===================== */
  async function api(data) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ token: sesi && sesi.token }, data)),
        signal: ctrl.signal
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  let tToast = null;
  function toast(t) {
    const el = document.getElementById('toast');
    el.textContent = t; el.classList.add('tampil');
    clearTimeout(tToast);
    tToast = setTimeout(() => el.classList.remove('tampil'), 2600);
  }
  function tampilMuat() { $isi.innerHTML = '<section class="muat"><span class="putar"></span></section>'; }
  function tampilPesan(html) { $isi.innerHTML = `<section class="kartu"><p class="pesan" style="margin:0">${html}</p></section>`; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function inisial(n) { return String(n || '?').replace(/^(prof|dr|ir|hj?|drs|dra)\.?\s+/gi, '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'; }
  function tglWaktu(s) {
    const d = new Date(s);
    if (isNaN(d)) return String(s || '');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
})();
