# Tutorial Rumah Karya v2

## Isi paket
**Masukkan ke Google Apps Script** (folder `1_AppsScript`):
- `Code.gs` -> buat file bernama **Code.gs**
- `Admin.gs` -> buat file baru (tombol +) bernama **Admin**

**Upload ke GitHub** (folder `2_GitHub`), semua di root repository:
- `index.html`, `style.css`, `app.js`, `config.js`

## Langkah 1 - Backend
1. Buat Google Sheets baru ("Rumah Karya DB"). Menu **Extensions > Apps Script**.
2. Tempel `Code.gs` ke file Code.gs, buat file baru `Admin` lalu tempel `Admin.gs`. Save.
3. Pilih fungsi **setup** > **Run** > beri izin (Advanced > Go to project). Ini membuat semua sheet (Works, Likes, Comments, Ratings, Popups, Settings) dan folder Drive `RumahKarya_PDF`.
4. **Password admin** ada di sheet **Settings**, baris `admin_password`. Ganti `ganti-password-ini` dengan password barumu. Saat kamu login pertama kali, sistem otomatis mengubahnya menjadi hash (`sha256:...`) sehingga password asli tidak tersimpan terbaca. Lupa password? Ketik password baru (teks biasa) di sel itu, lalu login lagi.
5. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Salin URL `/exec`.
6. Setiap mengubah kode backend: Deploy > Manage deployments > edit > **New version**.

## Langkah 2 - Frontend
1. Buka `config.js`, ganti `GANTI_DENGAN_URL_WEB_APP` dengan URL tadi.
2. Buat repository GitHub (public), upload keempat file.
3. Settings > Pages > Deploy from branch > main / root. Situs aktif di `https://username.github.io/nama-repo/`.

## Cara memakai
- **Admin**: buka `situsmu/#/admin`.
- **Karya baru**: pilih jenis, isi data, upload PDF. Sampul otomatis dari halaman PDF (bisa pilih halaman lain, lalu "Buat ulang sampul"). Kategori dipisah koma, misalnya `Romansa, Fiksi`.
- **Status karya**: *Terbit*, *Disembunyikan sementara* (hilang dari publik, tidak terhapus), atau *Draf*. Admin tetap bisa melihat semuanya lewat tombol "Lihat".
- **Saklar fitur** (Like, Komentar, Dibaca, Rating, Bagikan) di dasbor per karya. Data tetap tersimpan. Jumlah dibaca dan "selesai dibaca" selalu dihitung. Karya ilmiah hanya punya Rating, Bagikan, Dibaca.
- **Pengumuman & popup**: atur tampilan (popup atau banner), tempat (beranda, semua karya, karya tertentu), pemicu (saat dibuka atau saat pembaca sampai halaman terakhir), frekuensi, rentang tanggal, jam (WIB), dan hari tayang. Semua bisa dikombinasikan. Tombol "Pratinjau" menampilkan hasilnya langsung.
- **Pengaturan**: nama situs, tagline, footer, teks watermark, mode pemeliharaan, ganti password.
- Pembaca: cari judul/penulis, filter kategori dan jenis, lanjut membaca dari halaman terakhir.

## Batasan & keamanan
- PDF disimpan privat di Drive dan hanya dikirim lewat backend untuk karya berstatus Terbit. Pembaca melihat halaman sebagai **gambar canvas** (bukan teks), jadi tidak bisa diseleksi atau di-copy. Ada watermark di dalam gambar, klik kanan dan pintasan salin/cetak diblokir, dan layar kabur saat pindah tab.
- **Screenshot tidak bisa diblokir total oleh website mana pun.** Watermark tertanam di gambar sehingga hasil screenshot tetap membawa tandamu.
- Pembaca yang teknis tetap bisa mengambil data PDF dari jaringan browser. Anti-copy ini penghalang untuk pembaca umum, bukan DRM.
- Batas praktis: PDF sebaiknya di bawah ~20 MB (kompres bila perlu). Memuat PDF besar di HP butuh beberapa detik.
- Kuota Apps Script gratis cukup untuk situs pribadi, tapi ribuan pembaca per hari bisa kena batas.
