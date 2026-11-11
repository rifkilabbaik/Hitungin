# Hitungin

PWA untuk menghitung kendaraan yang lewat dengan kamera HP. Deteksi AI berjalan di perangkat. Video tidak direkam dan tidak dikirim ke mana pun. Tampilannya mengikuti [Loyalin](https://github.com/rifkilabbaik/Loyalin) dan [Loyalin Dasbor](https://github.com/rifkilabbaik/Loyalin-Dasbor).

## Fitur

- **Hitung otomatis dengan kamera**: Motor, Mobil, Bus, Truk, Sepeda, dan Orang (opsional, mati secara bawaan).
- **Garis hitung**: geser ujung atau badan garis langsung di layar kamera, atau putar 90° dengan tombol garis. Sisi garis diberi label **A** dan **B**.
  - Kendaraan dihitung per arah: **A→B** dan **B→A**. Bisa juga hanya satu arah (Pengaturan → Arah yang dihitung).
  - Setiap kendaraan dihitung sekali. Kendaraan yang berhenti atau bergetar di atas garis tidak dihitung berulang.
  - Pengendara motor/sepeda tidak ikut dihitung sebagai orang. Kotak ganda (misalnya mobil sekaligus truk) dihitung satu.
- **Mode Manual**: tap kartu jenis kendaraan, dengan pilihan arah (–, A→B, B→A).
- **Koreksi**: di mode kamera, tap kartu untuk menambah kendaraan yang terlewat. Tombol ↶ membatalkan hitungan terakhir.
- **Sesi**:
  - Lokasi, dengan saran dari sesi sebelumnya, dan titik GPS opsional.
  - **Berhenti otomatis** setelah 5, 15, 30, atau 60 menit.
  - **Jeda / Lanjut / Selesai**.
  - Tersimpan otomatis. Jika aplikasi tertutup, sesi bisa dilanjutkan.
  - Jika aplikasi ditinggal saat menghitung dengan kamera, sesi otomatis dijeda karena kamera berhenti.
- **Buka video**: hitung dari rekaman di HP. Video berhenti di frame pertama (untuk mengatur garis) dan diputar saat **Mulai**.
- **Layar penuh** dengan HUD (total, per jenis, tombol Mulai/Jeda). Layar tetap menyala selama kamera atau sesi aktif.
- Suara dan getar saat kendaraan terhitung. Kotak deteksi bisa disembunyikan.
- **Beranda**:
  - Total kendaraan dibanding periode sebelumnya, Sesi, Durasi, Per jam, dan SMP/jam.
  - Komposisi jenis kendaraan.
  - Grafik per jam/hari/minggu/bulan, Jam ramai, Lokasi teratas, dan Sesi terbaru.
- **Filter** periode (Hari ini, 7 hari, 30 hari, Bulan ini, 90 hari, Semua) dan lokasi.
- **Riwayat**: sesi dikelompokkan per hari, bisa dicari berdasarkan lokasi atau catatan.
- **Detail sesi**:
  - Pembagian arah, Durasi, Per jam, SMP/jam, dan Puncak per interval.
  - Grafik per interval 1/5/15/60 menit dan komposisi jenis.
  - Catatan, titik GPS (buka di peta), **Bagikan** ringkasan teks, dan **CSV** per interval.
- **Lokasi**: total, pangsa (%), perubahan, jumlah sesi, per jam, dan jenis terbanyak per lokasi.
- **Pengaturan**:
  - Warna (Oranye, Peach, Mint, Lavender) dan tema (Terang, Gelap, Otomatis), sama dengan Dasbor.
  - Model **Cepat** (EfficientDet-Lite0, ±7 MB) atau **Akurat** (Lite2, ±12 MB).
  - Kecepatan deteksi (Hemat/Normal/Maks) dan keyakinan minimal.
  - Jenis dan arah yang dihitung, serta faktor SMP.
  - Unduh CSV ringkasan semua sesi dan detail per kendaraan, Hapus semua data, dan Install.
- **Keyboard** (desktop): `1`–`6` menambah jenis, `Spasi` mulai/jeda, `Z` atau `Backspace` membatalkan.
- **Offline**: setelah AI dimuat sekali (butuh internet), aplikasi dan model bisa dipakai tanpa internet.

## Tips agar akurat

- Pasang HP di tripod atau tempat yang tidak goyang, sebaiknya dari atas (jembatan penyeberangan, lantai 2).
- Buat garis melintang tegak lurus arah kendaraan, di bagian jalan yang terlihat jelas dan tidak tertutup pohon.
- Hindari kamera menghadap matahari. Malam hari, hujan deras, dan kendaraan yang saling menutupi menurunkan akurasi.
- HP lama: pakai model **Cepat** dan kecepatan **Normal** atau **Hemat**. HP baru: model **Akurat**.

## SMP

SMP/jam = Σ (jumlah per jenis × emp) ÷ durasi. Nilai emp bawaan: mobil 1, bus 1,2, truk 1,2, motor 0,25, sepeda dan orang 0. Ubah di **Pengaturan → Faktor SMP** sesuai pedoman yang dipakai (MKJI/PKJI).

## Teknis

- File statis tanpa build:
  - `js/engine.js`: kamera, deteksi, pelacak kendaraan, dan garis hitung.
  - `js/app.js`: tampilan dan data.
  - `js/config.js`: alamat library dan model.
- Deteksi memakai [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) 0.10.14 (dari jsDelivr) dengan model EfficientDet (COCO) dari `storage.googleapis.com`. GPU dipakai jika tersedia, jika tidak otomatis CPU. Untuk self-host, ganti URL di `js/config.js`.
- Data tersimpan di IndexedDB browser (`hitungin`) di HP itu saja. Tidak ada server.
- CSV memakai UTF-8 dengan BOM dan pemisah koma, sama dengan Dasbor.

## Hosting & install

File statis, bisa memakai **GitHub Pages** (Settings → Pages → Deploy from branch). Kamera dan PWA butuh HTTPS.

- **Android / Chrome**: Pengaturan → **Install**, atau menu browser → *Install app*.
- **iPhone / Safari**: Share → *Add to Home Screen*.

Service worker Hitungin hanya menghapus cache miliknya sendiri (`hitungin-*`). Ini penting karena Loyalin, Dasbor, dan Hitungin berbagi domain `rifkilabbaik.github.io`.

## Batasan

- Menghitung hanya saat aplikasi terbuka di layar.
- Video dari file diputar dengan kecepatan normal. Di HP yang lambat, kendaraan yang sangat cepat bisa terlewat.
- Model COCO tidak membedakan angkot, pikap, atau bajaj secara khusus. Biasanya terbaca sebagai Mobil atau Truk.
