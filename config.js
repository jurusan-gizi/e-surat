// Satu-satunya file yang perlu diubah setelah Apps Script di-deploy.
window.ESURAT_CONFIG = {
  // Tempel URL Web App Apps Script "e-Surat Gizi" (berakhiran /exec).
  // Selama masih kosong, aplikasi berjalan dalam MODE COBA: tanpa login,
  // tanpa daftar pegawai, dan arsip hanya tersimpan di perangkat ini.
  API_URL: 'https://script.google.com/macros/s/AKfycbwfqfB36Te-FTNCgDevdtwvQW4ncoZXyfpyB8pG95Ed9njx6FN0FL-sW3sTkYtDpjZctg/exec',

  // Dipakai bila tab "Pengaturan" di Google Sheet belum diisi.
  DIREKTUR: 'ADDI MARDI HARNANTO',
  TELEPON: '',

  SRIKANDI_URL: 'https://srikandi.arsip.go.id/beranda'
};
