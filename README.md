# e-Surat Gizi

Aplikasi PWA pembuat naskah dinas Jurusan Gizi Poltekkes Kemenkes Makassar.
Pengguna mengisi form, aplikasi menghasilkan file **.docx dari template resmi** yang siap diunggah ke **SRIKANDI**.

Tujuh jenis naskah: Surat Dinas, Nota Dinas, Surat Tugas, Surat Keterangan, Surat Pengantar, Surat Keputusan, Notula Rapat.

## Cara kerja singkat

- Variabel SRIKANDI di template (`${nomor_naskah}`, `${tanggal_naskah}`, `${hal}`, `${sifat}`, `${jabatan_tujuan}`,
  `${jabatan_pengirim}`, `${ttd_pengirim}`, `${nama_pengirim}`, `${nip_pengirim}`) **tidak diisi** oleh aplikasi.
  SRIKANDI yang mengisinya saat naskah diproses dan ditandatangani.
- Aplikasi mengisi isi surat, menghapus semua petunjuk berwarna kuning, dan menerapkan aturan template secara otomatis:
  baris Sifat hilang bila "Biasa", baris Lampiran/Tembusan hilang bila kosong, satu tembusan tanpa nomor,
  baris NIP hanya muncul bila penanda tangan Plt./Plh./a.n./u.b., halaman lampiran hanya ada bila diperlukan.
- File .docx dibuat di browser. Yang disimpan di Google Sheet hanya **isian form** (arsip), sehingga surat bisa dibuka,
  diedit, lalu dibuat ulang tanpa mengetik dari awal.
- Login lewat Gizi-Link. Hanya staf dengan kode **Kajur, Sekjur, Kaprodi, KaLab** di kolom `Jabatan` sheet Staf yang bisa masuk.

## Cara pasang

### 1. GitHub
1. Buat repo baru di akun `jurusan-gizi`, misalnya `e-surat`.
2. Unggah seluruh isi folder ini (kecuali folder `apps-script`, boleh ikut diunggah sebagai cadangan).
3. Settings → Pages → Branch `main`, folder `/ (root)` → Save.
   Alamat aplikasi: `https://jurusan-gizi.github.io/e-surat/`

Selama `API_URL` di `config.js` masih kosong, aplikasi berjalan dalam **mode coba**: bisa membuat surat,
tetapi tanpa login, tanpa daftar pegawai, dan arsip hanya tersimpan di perangkat.

### 2. Google Sheet + Apps Script
1. Buat Google Sheet baru, beri nama **e-Surat Gizi - Arsip** (pakai akun yang punya akses edit ke sheet *Gizi Link*).
2. Ekstensi → Apps Script → hapus isi `Code.gs` → tempel isi `apps-script/Code.gs` → Simpan.
3. Setelan Project (ikon roda gigi) → Properti Skrip → tambahkan `SSO_SECRET`
   (nilainya sama dengan di Apps Script portal Gizi-Link / aplikasi Gizi-Link lain).
4. Pilih fungsi **`setup`** → Jalankan → izinkan akses. Terbentuk tab `Arsip` dan `Pengaturan`.
5. Pilih fungsi **`lengkapiStaf`** → Jalankan **sekali**. Sheet `Staf` di Gizi Link dilengkapi (lihat bagian di bawah).
6. Terapkan → Deployment baru → Jenis: Aplikasi web → Jalankan sebagai: **Saya** → Yang memiliki akses: **Siapa saja** → Terapkan.
7. Salin URL berakhiran `/exec` → tempel ke `API_URL` di `config.js` → unggah ulang `config.js` ke GitHub.

### 3. Tampilkan di Gizi-Link
Tambahkan satu baris di tab `Aplikasi` sheet Gizi Link:

| urutan | id | nama | deskripsi | url | ikon | warna | aktif | sso | prodi | staf |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 | esurat | e-Surat Gizi | Buat naskah dinas (.docx) siap unggah SRIKANDI | https://jurusan-gizi.github.io/e-surat/ | 📄 | #00807E | YA | YA | TIDAK | Kajur, Sekjur, Kaprodi, KaLab |

## Yang dilakukan `lengkapiStaf`

Menambah lima kolom **di ujung kanan** sheet `Staf` (kolom lama tidak digeser, jadi aplikasi Gizi-Link lain tidak terpengaruh):

| Kolom | Isi | Dipakai untuk |
|---|---|---|
| Nama Surat | Nama dengan penulisan gelar yang sudah dirapikan | Nama di surat |
| Gol | mis. `III/d` | pangkat/gol. |
| Pangkat | mis. `Penata Tk. I` | pangkat/gol. |
| Jabatan Fungsional | mis. `Lektor` | jabatan di surat |
| Jabatan Struktural | mis. `Ketua Jurusan Gizi` | jabatan di surat (didahulukan bila terisi) |

Sumber data: Daftar Urut Kepangkatan Pegawai Jurusan Gizi 2026. Sel yang sudah berisi tidak ditimpa, jadi aman dijalankan ulang.
Tiga pegawai yang ada di DUK tetapi belum ada di sheet Staf (Elsy Premiwati, Sanuddin, Amirullah) ikut ditambahkan
dengan **PIN acak** — mereka belum bisa login Gizi-Link sampai PIN-nya diganti.

Setelah itu, perubahan pangkat/jabatan cukup diedit langsung di sheet Staf.

## Mengubah sesuatu

| Ingin mengubah | Caranya |
|---|---|
| Nama Direktur, no. telepon | Tab `Pengaturan` di sheet arsip |
| Siapa yang boleh masuk | Kolom `Jabatan` di sheet Staf (kode Kajur/Sekjur/Kaprodi/KaLab) |
| Isian form, pola siap pakai, kalimat baku | `jenis.js` |
| Tata letak surat | `templates/*.docx` (tanda `[[...]]` adalah isian aplikasi; `${...}` milik SRIKANDI, jangan diubah) |

Setiap kali file di GitHub diganti, naikkan angka `VERSION` di `sw.js` (mis. `esurat-v2`) supaya pembaruan langsung terlihat.

## Menulis isi naskah

- **Enter** = alinea baru (otomatis menjorok satu tab).
- **`Label : isi`** (pakai spasi sebelum titik dua) = rincian sejajar, mis. `Hari/tanggal : Senin, 3 Maret 2027`.
- **`1. ...`**, **`a. ...`**, **`- ...`** = butir.
- Daftar (tembusan, lampiran, tugas, menimbang, dst.): satu baris satu butir, nomor diatur otomatis.

## Struktur file

```
index.html, style.css, app.js   tampilan & logika
jenis.js                        definisi 7 jenis naskah, pola siap pakai, penyusun data
config.js                       API_URL (satu-satunya yang diubah setelah deploy)
templates/                      template .docx bertanda isian
vendor/                         PizZip + docxtemplater (pembuat .docx di browser)
sw.js, manifest.webmanifest     PWA
apps-script/Code.gs             server: login, daftar pegawai, arsip
```
