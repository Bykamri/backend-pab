// src/seed-nim-random.ts
import { executeQuery } from './db';

const prodiCodes: Record<string, string> = {
    'Teknik Informatika': '146',
    'Sistem Informasi': '147',
    'Sains Data': '148',
    'Teknik Komputer': '149',
    'Bisnis Digital': '150',
    'Teknik Elektro': '151',
    'Teknik Sipil': '152',
    'Teknik Mesin': '153'
};

// Array pilihan angkatan
const pilihanAngkatan = ['23', '24', '25'];

async function updateNimRandomTahun() {
    console.log("⏳ Memulai pembaruan NBI dengan angkatan acak (23, 24, 25)...");

    try {
        const mahasiswa = await executeQuery('SELECT id, nama, prodi FROM mahasiswa ORDER BY id ASC');
        console.log(`🔍 Ditemukan ${mahasiswa.length} data mahasiswa.`);

        // Counter sekarang melacak kombinasi "Nama Prodi + Tahun" 
        // Contoh key: "Teknik Informatika-25"
        const sequenceCounter: Record<string, number> = {};

        for (const mhs of mahasiswa) {
            const namaProdi = mhs.prodi;
            const kodeProdi = prodiCodes[namaProdi] || '999';

            // Mengambil satu tahun secara acak dari array [23, 24, 25]
            const randomTahun = pilihanAngkatan[Math.floor(Math.random() * pilihanAngkatan.length)];

            // Buat kunci unik untuk penghitung urutan
            const counterKey = `${namaProdi}-${randomTahun}`;

            // Inisialisasi nomor urut jika kombinasi prodi+tahun ini baru muncul
            if (!sequenceCounter[counterKey]) {
                sequenceCounter[counterKey] = 1;
            }

            // Memformat nomor urut menjadi 5 digit agar NBI pas 10 digit (Contoh: 1462500044)
            // Jika Anda tetap ingin 3 digit (xxx), ubah angka 5 menjadi 3.
            const noUrut = sequenceCounter[counterKey].toString().padStart(3, '0');

            // Rangkai NBI Baru
            const newNim = `${kodeProdi}${randomTahun}${noUrut}`;

            // Naikkan counter untuk mahasiswa berikutnya di prodi & tahun yang sama
            sequenceCounter[counterKey]++;

            try {
                await executeQuery(
                    'UPDATE mahasiswa SET nim = ? WHERE id = ?', 
                    [newNim, mhs.id]
                );
                // Menampilkan log agar terlihat jelas sebaran angkatannya
                console.log(`✅ [${randomTahun}] ${namaProdi.padEnd(20)} | ${mhs.nama.padEnd(18)} -> NBI: ${newNim}`);
            } catch (err: any) {
                console.error(`⚠️ Gagal update NBI untuk ${mhs.nama} (ID: ${mhs.id}). Duplikat?`);
            }
        }

        console.log("\n🎉 Selesai! Seluruh data mahasiswa telah menggunakan NBI terstruktur dengan angkatan acak.");
    } catch (error) {
        console.error("❌ Terjadi kesalahan database:", error);
    }

    process.exit(0); 
}

updateNimRandomTahun();