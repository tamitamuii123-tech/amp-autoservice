/* AMP Auto Service — website lokal v2.1
 * Data: window.AMP_CONFIG (data/config.js, diisi manual)
 *       data/site-data.json (hasil tools/export_ams_data.py, diperbarui otomatis oleh serve_local.py)
 * Booking: menyusun pesan WhatsApp. Promo diarahkan ke aplikasi Android.
 */
(function () {
  'use strict';

  const CFG = Object.assign({ whatsapp: '6282247200453', whatsappDisplay: '0822-4720-0453', hours: [], refreshSeconds: 60 }, window.AMP_CONFIG || {});
  const SCH = Object.assign({ closedDays: [], open: '08:00', close: '17:00', utcOffset: 8, zone: 'WITA' }, CFG.schedule || {});
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const dot = (t) => String(t).replace(':', '.');
  const waLink = (text, number) => `https://wa.me/${number || CFG.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  const CO = Object.assign({ legalName: 'CV. Arshaka Mandiri Perkasa', address: '', email: '', contactPerson: '', contactPhone: '', mapsUrl: '' }, CFG.company || {});
  const WA_NUM = { procurement: CFG.rfqWhatsapp, rfq: CFG.rfqWhatsapp, industrial: CFG.industrialWhatsapp, genset: CFG.industrialWhatsapp, pump: CFG.industrialWhatsapp, valve: CFG.industrialWhatsapp, piping: CFG.industrialWhatsapp };
  const isHttp = location.protocol.startsWith('http');

  // Waktu bengkel (WITA) terlepas dari zona waktu perangkat pengunjung
  const shopNow = () => { const d = new Date(Date.now() + SCH.utcOffset * 3600e3); return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), iso: d.toISOString().slice(0, 10) }; };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const dayOf = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();

  const PROMO_SYSTEM = { 'Pencucian': 'Cuci Motor', 'Service Tune Up': 'Mesin', 'Kaki-kaki': 'Kaki-kaki / Suspensi', 'Sistem Pelumas': 'Pelumasan', 'Sistem Pembakaran': 'Bahan Bakar', 'Filter Mobil': 'Mesin' };

  let DATA = { promotions: [], services: [], service_item_total: 0, apk: { available: false } };

  async function fetchJson() {
    try { const r = await fetch('data/site-data.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (_) { /* file:// atau offline */ }
    return null;
  }
  async function loadData() {
    if (isHttp) { const j = await fetchJson(); if (j) return j; }
    return window.AMP_SITE_DATA || DATA;
  }

  /* ---------- Promo ---------- */
  function parsePromo(desc) {
    const lines = String(desc || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const intro = [], items = [];
    const re = /^(.*?)\s*(?:[-–:]\s*)?(?:hanya\s+)?rp\.?\s*([\d.,]+)\s*$/i;
    lines.forEach((l) => {
      const m = l.match(re);
      if (m && m[1]) items.push({ label: m[1].replace(/[-–:]\s*$/, '').trim(), price: Number(m[2].replace(/[.,]/g, '')) });
      else intro.push(l);
    });
    return { intro, items };
  }

  function appButton(label, cls = 'btn-primary') {
    const apk = DATA.apk || {};
    const href = apk.available ? esc(apk.file) : '#aplikasi';
    const dl = apk.available ? ' download="AMP-Customer.apk"' : '';
    return `<a class="btn ${cls}" href="${href}"${dl}><svg class="i" aria-hidden="true"><use href="#i-android"/></svg> ${label}</a>`;
  }

  function renderPromos() {
    const promos = DATA.promotions;
    const grid = $('#promoGrid');
    if (!promos.length) {
      grid.innerHTML = `<div class="empty">Belum ada promo aktif. Promo berstatus <b>Aktif</b> di AMP Management System otomatis tampil di sini dan di aplikasi.</div>`;
      return;
    }
    grid.innerHTML = promos.map((p) => {
      const { intro, items } = parsePromo(p.description);
      return `<article class="promo-card">
        <img src="${esc(p.image)}" alt="Foto promo ${esc(p.category)}" loading="lazy">
        <div class="promo-body">
          <span class="tag">${esc(p.category)}</span>
          <h3>${esc(p.title)}</h3>
          ${intro.length ? `<p class="muted" style="margin:0">${intro.map(esc).join('<br>')}</p>` : ''}
          ${items.length ? `<ul class="promo-lines">${items.map((it) => `<li><span>${esc(it.label)}</span><b>${rupiah(it.price)}</b></li>`).join('')}</ul>`
            : (p.price ? `<div class="price" style="color:var(--blue)"><small>Mulai</small>${rupiah(p.price)}</div>` : '')}
          <div class="promo-meta">
            <span>Berlaku <b>${esc(fmtDate(p.start))} – ${esc(fmtDate(p.end))}</b></span>
            ${p.code ? `<span>Kode <span class="code">${esc(p.code)}</span></span>` : ''}
          </div>
          <div class="promo-claim">
            ${appButton('Klaim lewat Aplikasi AMP')}
            <span class="small muted">Buka menu <b>Promo</b> di aplikasi, lalu booking.</span>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function renderHeroPromo() {
    const p = DATA.promotions[0];
    const box = $('#heroPromo');
    if (!box) return; // kartu promo di hero Automotive dihapus; promo cukup di bagian #promo
    if (!p) { box.hidden = true; return; }
    const { items } = parsePromo(p.description);
    const from = items.length ? Math.min(...items.map((i) => i.price)) : p.price;
    box.innerHTML = `<img src="${esc(p.image)}" alt="" loading="eager">
      <div class="hero-card-body">
        <span class="tag">Promo · ${esc(p.category)}</span>
        <h3>${esc(p.title)}</h3>
        ${from ? `<div class="price"><small>Mulai</small>${rupiah(from)}</div>` : ''}
        <p class="small" style="color:#8fb0d3;margin:6px 0 14px">s.d. ${esc(fmtDate(p.end))} · klaim di aplikasi</p>
        <div class="hero-card-actions">${appButton('Unduh aplikasi')}<a class="btn btn-ghost" href="#promo">Detail</a></div>
      </div>`;
    box.hidden = false;
  }

  /* ---------- Layanan ---------- */
  function renderServices() {
    const services = DATA.services;
    const grid = $('#svcGrid');
    if (!services.length) { grid.innerHTML = '<div class="empty">Katalog layanan belum diekspor dari AMS.</div>'; return; }
    const card = (s) => {
      const priced = s.prices && s.prices.length;
      const img = s.image ? `<div class="svc-img"><img src="${esc(s.image)}" alt="Komponen ${esc(s.name)}" loading="lazy" width="560" height="280"></div>` : '';
      const head = `<div class="svc-head"><h3>${esc(s.name)}</h3><span class="count">${s.count} item pekerjaan</span></div>`;
      const btn = `<button class="svc-book" type="button" data-system="${esc(s.name)}">Booking<span class="hide-sm"> layanan ini</span> →</button>`;
      if (priced) {
        return `<article class="svc feature">${img}
          <div class="svc-body">${head}${s.summary ? `<p>${esc(s.summary)}</p>` : ''}
            <ul class="svc-prices">${s.prices.map((x) => `<li><span>${esc(x.label)}</span><b>${rupiah(x.price)}</b></li>`).join('')}</ul>
            ${btn}</div></article>`;
      }
      return `<article class="svc">${img}<div class="svc-body">${head}
        ${s.summary ? `<p>${esc(s.summary)}</p>` : ''}
        <div class="chips">${(s.components || []).slice(0, 4).map((c) => `<span>${esc(c)}</span>`).join('')}</div>
        ${btn}</div></article>`;
    };
    grid.innerHTML = services.filter((s) => !(s.prices && s.prices.length)).map(card).join('')
      + services.filter((s) => s.prices && s.prices.length).map(card).join('');
    const sel = $('#systemSelect');
    sel.querySelectorAll('option:not([value=""])').forEach((o) => o.remove());
    services.forEach((s) => sel.insertAdjacentHTML('beforeend', `<option>${esc(s.name)}</option>`));
  }

  function renderStats() {
    const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
    set('systems', DATA.services.length || '–');
    set('items', DATA.service_item_total || '–');
    set('promos', DATA.promotions.length);
  }

  function renderApk() {
    const apk = DATA.apk || {};
    const box = $('#apkBox');
    if (apk.available) {
      box.innerHTML = `<span class="badge-test">Aplikasi Android</span>
        <div class="row">
          ${appButton(`Unduh APK (${esc(apk.size_mb)} MB)`)}
          <span class="small muted">${apk.version ? `Versi ${esc(apk.version)} · ` : ''}Build ${esc(fmtDate(apk.built_at))}</span>
        </div>
        <p class="note">Android saja. Saat memasang, izinkan "Instal aplikasi tidak dikenal". Masuk dengan akun yang sama
          seperti di website untuk booking, konsultasi, dan pembayaran.</p>`;
    } else {
      box.innerHTML = `<span class="badge-test">Booking via WhatsApp</span>
        <p class="note" style="margin:0">Booking dan konsultasi dapat dilakukan langsung lewat WhatsApp bengkel.</p>`;
    }
  }

  /* ---------- Jam operasional ---------- */
  function openState() {
    const n = shopNow();
    const closedToday = SCH.closedDays.includes(n.day);
    const open = !closedToday && n.min >= toMin(SCH.open) && n.min < toMin(SCH.close);
    return { open, closedToday, day: n.day };
  }
  function renderHours() {
    const st = openState();
    const el = $('#heroHours');
    const closedNames = SCH.closedDays.map((d) => DAYS[d]).join(', ');
    const label = st.open ? 'Buka sekarang' : (st.closedToday ? `Hari ${DAYS[st.day]} libur` : 'Sedang tutup');
    el.innerHTML = `<span class="status ${st.open ? 'on' : 'off'}"><i></i>${label}</span>
      <span>${dot(SCH.open)} – ${dot(SCH.close)} ${esc(SCH.zone)}${closedNames ? ` · ${esc(closedNames)} libur` : ''}</span>`;
    el.hidden = false;
    $('#hoursHint').textContent = `Jam booking ${dot(SCH.open)}–${dot(SCH.close)} ${SCH.zone}${closedNames ? `, ${closedNames} libur` : ''}.`;
  }

  function renderContact() {
    const pend = '<span class="pending">Menyusul</span>';
    const st = openState();
    const maps = CO.mapsUrl || (CO.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CO.address) : '');
    const rows = [
      ['i-building', 'Kantor ' + esc(CO.legalName), CO.address ? esc(CO.address) + (maps ? `<br><a href="${esc(maps)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : '') : pend],
      ['i-wa', 'WhatsApp admin', `<a href="${waLink(CFG.waMessages && CFG.waMessages.general)}" target="_blank" rel="noopener">${esc(CFG.whatsappDisplay)}</a>`],
    ];
    if (CO.contactPhone) rows.push(['i-phone', 'Contact person' + (CO.contactPerson ? ' — ' + esc(CO.contactPerson) : ''), `<a href="tel:${esc(CO.contactPhone.replace(/[^0-9+]/g, ''))}">${esc(CO.contactPhone)}</a>`]);
    if (CO.email) rows.push(['i-mail', 'Email', `<a href="mailto:${esc(CO.email)}">${esc(CO.email)}</a>`]);
    rows.push(['i-clock', 'Jam bengkel AMP Auto Service', (CFG.hours && CFG.hours.length ? CFG.hours.map(esc).join('<br>') : pend)
        + `<br><span class="status ${st.open ? 'on' : 'off'}"><i></i>${st.open ? 'Buka sekarang' : 'Sedang tutup'}</span>`]);
    rows.push(['i-pin', 'Lokasi bengkel', CFG.address ? esc(CFG.address) + (CFG.mapsUrl ? `<br><a href="${esc(CFG.mapsUrl)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : '') : pend]);
    const socials = [['Instagram', CFG.instagram], ['Facebook', CFG.facebook], ['TikTok', CFG.tiktok]].filter((x) => x[1]);
    if (socials.length) rows.push(['i-share', 'Media sosial', socials.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join(' · ')]);
    $('#contactList').innerHTML = rows.map(([ic, label, val]) =>
      `<li><svg class="i" aria-hidden="true"><use href="#${ic}"/></svg><div><b>${label}</b>${val}</div></li>`).join('');
  }

  /* ---------- Peta lokasi kantor ---------- */
  function renderMap() {
    const box = $('#mapFrame'); if (!box) return;
    const link = CO.mapsUrl || (CO.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CO.address) : '');
    $('#mapLink').href = link || '#'; $('#mapLink2').href = link || '#';
    $('#mapAddr').textContent = CO.address || '';
    if (typeof CO.lat === 'number' && typeof CO.lng === 'number') {
      const src = `https://maps.google.com/maps?q=${CO.lat},${CO.lng}&z=17&output=embed`;
      const f = document.createElement('iframe');
      f.src = src; f.loading = 'lazy'; f.title = 'Peta lokasi ' + CO.legalName;
      f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
      box.appendChild(f);
    }
  }

  /* ---------- Tombol WhatsApp per layanan ---------- */
  function initWaButtons() {
    const msgs = CFG.waMessages || {};
    $$('[data-wa]').forEach((el) => {
      const key = el.dataset.wa;
      el.href = waLink(msgs[key] || msgs.general || '', WA_NUM[key]);
    });
  }

  /* ---------- Request for Quotation ---------- */
  function initRfq() {
    const form = $('#rfqForm'); if (!form) return;
    const err = $('#rfqError');
    const collect = () => {
      const f = form.elements; let msg = '';
      ['company', 'pic', 'phone', 'sector', 'product', 'qty', 'location'].forEach((k) => {
        const ok = String(f[k].value || '').trim() !== '';
        if (ok) f[k].removeAttribute('aria-invalid'); else { f[k].setAttribute('aria-invalid', 'true'); msg = msg || 'Lengkapi kolom bertanda * terlebih dahulu.'; }
      });
      const digits = f.phone.value.replace(/\D/g, '');
      if (!msg && (digits.length < 9 || digits.length > 15)) { f.phone.setAttribute('aria-invalid', 'true'); msg = 'Nomor WhatsApp tidak valid.'; }
      if (!msg && f.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) { f.email.setAttribute('aria-invalid', 'true'); msg = 'Format email tidak valid.'; }
      if (msg) { err.textContent = msg; err.hidden = false; const first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return null; }
      err.hidden = true;
      const files = Array.from(f.files.files || []).map((x) => x.name);
      const lines = [
        '*REQUEST FOR QUOTATION — CV AMP*', '',
        `Perusahaan: ${f.company.value.trim()}`,
        `PIC: ${f.pic.value.trim()}`,
        `WhatsApp: ${f.phone.value.trim()}`,
      ];
      if (f.email.value.trim()) lines.push(`Email: ${f.email.value.trim()}`);
      lines.push(`Sektor: ${f.sector.value}`, '', `Barang: ${f.product.value.trim()}`);
      if (f.spec.value.trim()) lines.push(`Part number / spesifikasi: ${f.spec.value.trim()}`);
      lines.push(`Jumlah: ${f.qty.value.trim()}`, `Lokasi pengiriman: ${f.location.value.trim()}`);
      if (files.length) lines.push(`Lampiran (akan dikirim di chat): ${files.join(', ')}`);
      if (f.notes.value.trim()) lines.push(`Catatan: ${f.notes.value.trim()}`);
      lines.push('', 'Mohon penawaran harga dan ketersediaan. Terima kasih.');
      return { text: lines.join('\n'), subject: `RFQ — ${f.company.value.trim()} — ${f.product.value.trim()}`.slice(0, 120) };
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = collect(); if (!r) return;
      window.open(waLink(r.text, WA_NUM.rfq), '_blank', 'noopener');
    });
    $('#rfqEmail').addEventListener('click', () => {
      const r = collect(); if (!r) return;
      if (!CO.email) { err.textContent = 'Email perusahaan belum diatur di data/config.js.'; err.hidden = false; return; }
      location.href = `mailto:${CO.email}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.text.replace(/\*/g, ''))}`;
    });
    form.elements.files.addEventListener('change', () => {
      const n = form.elements.files.files.length;
      $('#rfqFilesHint').textContent = n ? `${n} file dipilih — lampirkan manual di chat WhatsApp/email setelah pesan terbuka.` : 'File tidak terkirim otomatis — lampirkan manual di WhatsApp setelah pesan terbuka.';
    });
  }

  function renderFooter() {
    $('#footLegal').textContent = `© ${new Date().getFullYear()} ${CO.legalName} · AMP Auto Service`;
    const parts = [];
    if (CFG.previewMode) parts.push('<span class="preview-pill">Pratinjau lokal</span>');
    if (DATA.generated_at) parts.push('Data AMS: ' + esc(fmtDate(DATA.generated_at.slice(0, 10))) + ' ' + esc(DATA.generated_at.slice(11, 16)));
    $('#footMeta').innerHTML = parts.join('');
  }

  function renderAll() {
    DATA.promotions = DATA.promotions || []; DATA.services = DATA.services || [];
    renderStats(); renderHeroPromo(); renderPromos(); renderServices(); renderApk(); renderHours(); renderContact(); renderFooter();
  }

  /* ---------- Navbar ---------- */
  function initNav() {
    const toggle = $('#navToggle'), menu = $('#navMenu');
    const drop = $('.nav-drop', menu);
    const close = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); drop && drop.classList.remove('open'); };
    toggle.addEventListener('click', () => { const open = menu.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
    $$('a', menu).forEach((a) => a.addEventListener('click', close));
    document.addEventListener('click', (e) => { if (!menu.contains(e.target) && !toggle.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    if ('IntersectionObserver' in window) {
      const links = $$(':scope > a, .nav-drop-btn', menu);
      const autoIds = ['automotive', 'promo', 'layanan', 'booking', 'aplikasi', 'faq'];
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = autoIds.includes(en.target.id) ? 'automotive' : en.target.id;
        links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
      }), { rootMargin: '-45% 0px -50% 0px' });
      ['home', 'about', 'procurement', 'industrial', ...autoIds, 'products', 'rfq', 'contact'].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ---------- Booking dialog ---------- */
  function initBooking() {
    const dlg = $('#bookingDialog'), form = $('#bookingForm'), err = $('#formError');
    const locField = $('#locField');
    form.elements.time.min = SCH.open; form.elements.time.max = SCH.close;

    const syncVisit = () => {
      const call = form.elements.visit_mode.value === 'Panggilan';
      locField.hidden = !call; form.elements.location.required = call;
    };
    const syncType = () => {
      form.elements.vehicle.placeholder = form.elements.vehicle_type.value === 'Motor' ? 'cth. Honda Vario 125' : 'cth. Toyota Avanza 1.3 G';
    };
    $$('input[name="visit_mode"]', form).forEach((r) => r.addEventListener('change', syncVisit));
    $$('input[name="vehicle_type"]', form).forEach((r) => r.addEventListener('change', syncType));

    const open = (preset = {}) => {
      err.hidden = true;
      form.elements.date.min = shopNow().iso;
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      if (preset.system !== undefined) form.elements.system.value = preset.system;
      if (preset.service) form.elements.service.value = preset.service;
      if (preset.vehicle_type) $$('input[name="vehicle_type"]', form).forEach((r) => { r.checked = r.value === preset.vehicle_type; });
      syncVisit(); syncType();
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      setTimeout(() => form.elements.name.focus(), 30);
    };
    const close = () => { if (dlg.open) dlg.close(); };

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open-booking],[data-system],[data-close]');
      if (!t) return;
      if (t.hasAttribute('data-close')) { close(); return; }
      e.preventDefault();
      if (t.hasAttribute('data-system')) {
        const sys = t.dataset.system;
        open(sys === 'Cuci Motor' ? { system: sys, service: 'Pencucian', vehicle_type: 'Motor' } : { system: sys });
      } else open();
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      let msg = '';
      ['name', 'vehicle', 'plate', 'service', 'date', 'time'].forEach((k) => {
        const ok = String(f[k].value || '').trim() !== '';
        if (ok) f[k].removeAttribute('aria-invalid'); else { f[k].setAttribute('aria-invalid', 'true'); msg = msg || 'Lengkapi kolom bertanda * terlebih dahulu.'; }
      });
      if (f.visit_mode.value === 'Panggilan' && !f.location.value.trim()) { f.location.setAttribute('aria-invalid', 'true'); msg = msg || 'Isi lokasi untuk layanan panggilan.'; }
      if (!msg && f.date.value) {
        const today = shopNow();
        if (f.date.value < today.iso) msg = 'Tanggal booking tidak boleh sebelum hari ini.';
        else if (SCH.closedDays.includes(dayOf(f.date.value))) msg = `Hari ${DAYS[dayOf(f.date.value)]} bengkel libur. Pilih hari lain.`;
        if (msg) f.date.setAttribute('aria-invalid', 'true');
      }
      if (!msg && f.time.value) {
        const t = toMin(f.time.value);
        if (t < toMin(SCH.open) || t > toMin(SCH.close)) { msg = `Jam booking ${dot(SCH.open)}–${dot(SCH.close)} ${SCH.zone}.`; f.time.setAttribute('aria-invalid', 'true'); }
        else if (f.date.value === shopNow().iso && t < shopNow().min) { msg = 'Jam tersebut sudah lewat untuk hari ini.'; f.time.setAttribute('aria-invalid', 'true'); }
      }
      if (msg) {
        err.textContent = msg; err.hidden = false;
        const first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus();
        return;
      }
      err.hidden = true;
      const lines = [
        '*BOOKING SERVIS — AMP Auto Service*',
        '',
        `Nama: ${f.name.value.trim()}`,
        `Kendaraan: ${f.vehicle_type.value} — ${f.vehicle.value.trim()}`,
        `No. polisi: ${f.plate.value.trim().toUpperCase()}`,
        `Kebutuhan: ${f.service.value}${f.system.value ? ' (' + f.system.value + ')' : ''}`,
        `Jadwal: ${DAYS[dayOf(f.date.value)]}, ${fmtDate(f.date.value)}, ${f.time.value} ${SCH.zone}`,
        `Metode: ${f.visit_mode.value}`,
      ];
      if (f.visit_mode.value === 'Panggilan') lines.push(`Lokasi: ${f.location.value.trim()}`);
      if (f.complaint.value.trim()) lines.push(`Keluhan: ${f.complaint.value.trim()}`);
      lines.push('', 'Mohon konfirmasi ketersediaan jadwal. Terima kasih.');
      window.open(waLink(lines.join('\n')), '_blank', 'noopener');
      close();
    });
  }

  /* ---------- Sinkron promo otomatis dari AMS ---------- */
  function startAutoRefresh() {
    if (!isHttp || !(CFG.refreshSeconds > 0)) return;
    setInterval(async () => {
      const j = await fetchJson();
      if (!j || j.generated_at === DATA.generated_at) return;
      const before = JSON.stringify([DATA.promotions, DATA.services]);
      DATA = j;
      if (JSON.stringify([DATA.promotions, DATA.services]) !== before) renderAll(); else renderFooter();
    }, CFG.refreshSeconds * 1000);
    setInterval(() => { renderHours(); }, 60 * 1000);
  }

  loadData().then((d) => {
    DATA = d || DATA;
    renderAll();
    initNav();
    renderMap();
    initWaButtons();
    initRfq();
    initBooking();
    startAutoRefresh();
  });
})();
