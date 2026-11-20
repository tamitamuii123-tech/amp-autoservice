/*
 * DATA PERUSAHAAN & BENGKEL YANG DIISI MANUAL
 * ------------------------------------------------------------------
 * File ini TIDAK ditimpa oleh tools/export_ams_data.py.
 * Ubah isinya, simpan, lalu refresh browser.
 * Biarkan string kosong ("") untuk menyembunyikan baris tersebut.
 */
window.AMP_CONFIG = {
  // ===== Perusahaan induk (sumber: Company Profile CV Arshaka Mandiri Perkasa) =====
  company: {
    legalName: "CV. Arshaka Mandiri Perkasa",
    brand: "CV AMP",
    positioning: "General Supplier & Engineering Services",
    address: "Jl. Setia Perumahan Purnama Mandiri Blok B No. 24 Rt. 036 Rw. 004, Kel. Pemurus Dalam, Kec. Banjarmasin Selatan, Kota Banjarmasin, Provinsi Kalimantan Selatan",
    email: "cvarshakamandiriperkasa@gmail.com",
    contactPerson: "Vivi",
    contactPhone: "0896 8971 7257",      // nomor contact person di company profile (telepon)
    // Lokasi Google Maps resmi CV Arshaka Mandiri Perkasa
    mapsUrl: "https://www.google.com/maps/place/Cv+Arshaka+Mandiri+Perkasa/@-3.3621382,114.6176836,656m/data=!3m2!1e3!4b1!4m6!3m5!1s0x2de423ff54210a8f:0xee7abca479c2da28!8m2!3d-3.3621436!4d114.6202585!16s%2Fg%2F11v0n5z6m0",
    lat: -3.3621436,
    lng: 114.6202585
  },

  businessName: "AMP Auto Service",
  legalName: "CV Arshaka Mandiri Perkasa",
  tagline: "Drive Better, Go Further",

  // WhatsApp resmi (format internasional tanpa +). Semua tombol WhatsApp memakai nomor ini.
  whatsapp: "6282247200453",
  whatsappDisplay: "0822-4720-0453",
  // Opsional: nomor WhatsApp terpisah untuk RFQ/pengadaan & industrial. Kosong = pakai nomor di atas.
  rfqWhatsapp: "",
  industrialWhatsapp: "",

  // Pesan otomatis WhatsApp per layanan
  waMessages: {
    general: "Halo CV AMP / AMP Auto Service, saya ingin berkonsultasi mengenai kebutuhan perusahaan saya.",
    procurement: "Halo CV AMP, saya ingin menanyakan pengadaan barang/sparepart.",
    industrial: "Halo AMP Auto Service, saya ingin berkonsultasi mengenai jasa perbaikan dan pemeliharaan peralatan mekanikal industri.",
    genset: "Halo AMP Auto Service, saya ingin berkonsultasi mengenai jasa perbaikan dan perawatan genset/generator.",
    pump: "Halo AMP Auto Service, saya ingin berkonsultasi mengenai jasa perbaikan pompa industri.",
    valve: "Halo AMP Auto Service, saya ingin berkonsultasi mengenai perbaikan dan maintenance industrial valve.",
    piping: "Halo AMP Auto Service, saya ingin berkonsultasi mengenai penanganan fitting dan sambungan pipa (piping).",
    konsultasiServis: "Halo AMP Auto Service, saya ingin berkonsultasi mengenai kondisi kendaraan saya.",
    garansi: "Halo AMP Auto Service, saya ingin menanyakan garansi servis. Nomor nota: "
  },

  // Jam operasional bengkel AMP Auto Service (WITA = UTC+8)
  // Hari: 0=Minggu 1=Senin 2=Selasa 3=Rabu 4=Kamis 5=Jumat 6=Sabtu
  schedule: {
    closedDays: [5],          // Jumat libur
    open: "08:00",
    close: "17:00",
    utcOffset: 8,
    zone: "WITA"
  },
  hours: ["Senin – Kamis, Sabtu – Minggu: 08.00 – 17.00 WITA", "Jumat: Libur"],

  // ====== Lokasi bengkel (isi bila berbeda dari alamat kantor) ======
  address: "",
  city: "Banjarmasin",
  mapsUrl: "",
  email: "",
  instagram: "",
  facebook: "",
  tiktok: "",

  // ===== Integrasi AMP Server =====
  // Kosong = same-origin: halaman memanggil /v1/customer/... di alamat yang sama
  // (serve_local.py meneruskan ke AMP_API_BASE; Caddy meneruskan ke container api).
  // Isi hanya bila website dan API berada di domain berbeda (perlu CORS di backend).
  apiBase: "https://eugene-answered-beverage-meaning.trycloudflare.com",
  portalRefreshSeconds: 20,     // jeda cek status booking/notifikasi di portal

  // Status website
  previewMode: false,           // true = tampilkan label "Pratinjau lokal"
  refreshSeconds: 60           // cek promo baru dari AMS tiap N detik (saat dibuka lewat Start-Website)
};
