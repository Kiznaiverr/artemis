Artemis

Artemis adalah layanan kecil berbasiskan TypeScript yang menganalisis replay chat langsung YouTube untuk mendeteksi momen dengan aktivitas tinggi ("peak") dan mengembalikannya dalam format JSON. Layanan ini berjalan sebagai API pekerjaan asinkron sehingga pemrosesan panjang dilakukan di latar belakang dan hasil dapat diambil melalui ID pekerjaan.

Ringkasan

- Mengajukan pekerjaan analisis lewat `POST /peaks` dan menerima `jobId` secara instan.
- Memeriksa progres pekerjaan dengan `GET /peaks/:jobId` dan mengambil hasil akhir di `GET /peaks/:jobId/result`.
- Melihat daftar job selesai lewat `GET /jobs/completed`, yang dibaca dari file JSON di `output/jobs`.
- Setiap response job membawa `videoTitle` supaya judul video bisa langsung dipakai oleh client.
- Menggunakan analisis jendela waktu bergulir untuk memberi skor aktivitas chat, lalu menerapkan heuristik dan opsi peringkat ulang AI untuk memilih klip terbaik.
- Spesifikasi OpenAPI tersedia di `/openapi.json` dan playground interaktif di `/docs`.

Mulai cepat

1. Pasang dependensi:

```bash
npm install
```

2. Konfigurasikan variabel lingkungan (lihat `.env.example`). Variabel penting termasuk kunci API untuk penyedia AI dan nilai tuning seperti `TOP_N`, `WINDOW_SIZE`, dan `WINDOW_STEP`.

3. Hasil job disimpan selama 3 hari sebelum proses cleanup menghapusnya dari `output/jobs`.

4. Jalankan dalam mode pengembangan:

```bash
npm run dev
```

Atau bangun dan jalankan:

```bash
npm run build
npm start
```

Script berguna

- `npm run dev` — jalankan pengembangan (menggunakan `tsx`)
- `npm run build` — build TypeScript
- `npm start` — jalankan output terkompilasi
- `npm run lint` / `npm run format` — alat kualitas kode

Lokasi konfigurasi dan kode

- Default runtime dan pemrosesan env: `src/config/constant.ts` dan `src/config/env.ts`.
- Server HTTP utama: `src/server.ts`.
- Titik masuk pipeline: `src/modules/pipeline.ts`.
- Windowing time-series dan normalisasi: `src/core/window.ts` dan `src/core/normalizer.ts`.
- Peringkat AI dan penyedia: `src/ai/*` (integrasi OpenRouter dan Sumopod).
- File output ditulis di bawah folder `output/` secara default.

Catatan perilaku

- API mengembalikan envelope JSON konsisten untuk kasus sukses dan error.
- Parameter tuning dibaca dari variabel lingkungan dan divalidasi saat pembuatan pekerjaan.
- Job selesai dibaca dari filesystem, jadi `GET /jobs/completed` hanya menampilkan job yang file hasilnya masih ada.
- Peringkat ulang AI dikendalikan oleh `ENABLE_AI`. Jika `false`, AI dilewati sepenuhnya dan layanan langsung memakai heuristik. Jika `true`, kunci API penyedia diperlukan; jika tidak ada, layanan kembali menggunakan heuristik.

Kontribusi

- Buka isu atau ajukan PR; jaga perubahan seminimal mungkin dan jalankan `npm run lint` dan `npm run format` sebelum commit.

Lisensi

Proyek ini dilisensikan di bawah MIT License — lihat file [LICENSE](LICENSE) untuk detail.
