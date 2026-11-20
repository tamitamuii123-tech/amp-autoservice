/* Portal pelanggan CV AMP / AMP Auto Service
 * ---------------------------------------------------------------------------
 * Semua data berasal dari AMP Backend API (AMP-Server/backend, FastAPI + PostgreSQL),
 * memakai endpoint yang sama dengan aplikasi Android:
 *   /v1/customer/auth/*            akun & sesi (Bearer token)
 *   /v1/customer/submissions       kendaraan, booking, konsultasi, saran/komplain
 *   /v1/customer/vehicles/*        ubah/arsip kendaraan, odometer
 *   /v1/customer/service-invoices  tagihan resmi dari AMS + bukti transfer
 *   /v1/customer/consultations/*   percakapan dua arah
 *   /v1/customer/notifications/*   notifikasi
 *   /v1/customer/catalog/{kind}    sparepart, promo, artikel, model kendaraan
 * Tidak ada data contoh / simulasi. Jika server tidak bisa dihubungi, portal
 * menampilkan pesan kesalahan apa adanya.
 */
(function () {
  'use strict';

  const CFG = Object.assign({ apiBase: '', schedule: {} }, window.AMP_CONFIG || {});
  const SCH = Object.assign({ closedDays: [], open: '08:00', close: '17:00', utcOffset: 8, zone: 'WITA' }, CFG.schedule || {});
  const API = String(CFG.apiBase || '').replace(/\/+$/, '');
  const TOKEN_KEY = 'amp_customer_token';
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const fmtTime = (iso) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return esc(iso);
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const shopNow = () => { const d = new Date(Date.now() + SCH.utcOffset * 3600e3); return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), iso: d.toISOString().slice(0, 10) }; };
  const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
  const dayOf = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
  const uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  /* ------------------------------ token ------------------------------ */
  const store = {
    get() { try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return mem; } },
    set(t, remember) { mem = t; try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t); } catch (_) { /* privat */ } },
    clear() { mem = ''; try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (_) { /* */ } },
  };
  let mem = '';

  /* ------------------------------ API -------------------------------- */
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  function detailText(data, status) {
    const d = data && data.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => {
      const field = Array.isArray(x.loc) ? x.loc[x.loc.length - 1] : '';
      const label = { email: 'Email', password: 'Password', full_name: 'Nama', whatsapp: 'WhatsApp' }[field] || field;
      return (label ? label + ': ' : '') + (field === 'email' ? 'format email tidak valid' : (x.msg || 'tidak valid'));
    }).join('; ');
    return status === 502 ? 'Sistem AMP tidak dapat dihubungi.' : `Permintaan gagal (${status}).`;
  }
  async function api(method, path, body, opts = {}) {
    const headers = { Accept: 'application/json' };
    const token = store.get();
    if (token && !opts.anon) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    } catch (_) {
      setApiState(false);
      throw new ApiError(0, 'Tidak dapat terhubung ke sistem AMP. Periksa koneksi internet lalu coba lagi.');
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (_) { data = null; } }
    if (res.status === 401 && token && !opts.anon) { onSessionExpired(detailText(data, 401)); throw new ApiError(401, detailText(data, 401)); }
    if (!res.ok) throw new ApiError(res.status, detailText(data, res.status));
    return data;
  }
  const C = (path) => '/v1/customer' + path;

  /* ------------------------------ UI utils --------------------------- */
  function toast(msg, kind = 'ok') {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast-p ' + kind; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3800);
  }
  function formError(form, msg) { const e = $('.form-error', form); if (!e) return; e.textContent = msg || ''; e.hidden = !msg; }
  async function busy(btn, fn) {
    if (btn.disabled) return;
    const label = btn.innerHTML; btn.disabled = true; btn.classList.add('loading');
    try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = label; }
  }
  const empty = (msg) => `<div class="empty-p">${msg}</div>`;
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('File tidak dapat dibaca.'));
      r.readAsDataURL(file);
    });
  }
  // Foto konsultasi wajib JPEG ≤ 1 MB (aturan backend): perkecil & konversi di perangkat.
  function imageToJpegBase64(file, maxSide = 1600) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img; const s = Math.min(1, maxSide / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        let q = 0.85, data = cv.toDataURL('image/jpeg', q);
        while (data.length * 0.75 > 950000 && q > 0.35) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); }
        URL.revokeObjectURL(img.src);
        if (data.length * 0.75 > 1000000) return reject(new Error('Foto terlalu besar meski sudah diperkecil.'));
        resolve(data.split(',')[1]);
      };
      img.onerror = () => reject(new Error('Format foto tidak didukung.'));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ------------------------------ state ------------------------------ */
  const S = { account: null, submissions: [], invoices: [], consultations: [], notifications: [], feedback: [], activeConsult: null, tab: 'home', timers: [] };
  const vehicles = () => S.submissions.filter((s) => s.kind === 'vehicle' && !s.payload.deleted);
  const bookings = () => S.submissions.filter((s) => s.kind === 'booking');
  const vehicleById = (id) => S.submissions.find((s) => s.kind === 'vehicle' && s.id === id);
  const vehicleName = (v) => v ? `${v.payload.brand} ${v.payload.model} · ${v.payload.plate}` : 'Kendaraan tidak ditemukan';

  /* ------------------------------ health ----------------------------- */
  function setApiState(ok, msg) {
    const chip = $('#apiChip'); chip.classList.toggle('on', !!ok); chip.classList.toggle('off', !ok);
    $('span', chip).textContent = ok ? 'Terhubung' : 'Tidak terhubung';
    const b = $('#apiBanner');
    if (b) { b.hidden = !!ok; if (!ok) b.textContent = msg || 'Sistem AMP sedang tidak dapat dihubungi. Silakan coba lagi beberapa saat lagi.'; }
  }
  async function checkHealth() {
    try { const h = await api('GET', '/health', undefined, { anon: true }); setApiState(h && h.status === 'ok'); return true; }
    catch (e) { setApiState(false, e.message); return false; }
  }

  /* ------------------------------ auth ------------------------------- */
  function showAuth() { $('#authView').hidden = false; $('#appView').hidden = true; $('#bellBtn').hidden = true; stopTimers(); }
  function showApp() { $('#authView').hidden = true; $('#appView').hidden = false; $('#bellBtn').hidden = false; }
  function onSessionExpired(msg) { store.clear(); S.account = null; showAuth(); formError($('#loginForm'), msg || 'Sesi berakhir. Silakan masuk kembali.'); }

  function initAuth() {
    $$('[data-auth]').forEach((b) => b.addEventListener('click', () => {
      $$('[data-auth]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      $('#loginForm').hidden = b.dataset.auth !== 'login'; $('#registerForm').hidden = b.dataset.auth !== 'register';
    }));
    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault(); const f = e.target;
      busy($('button[type=submit]', f), async () => {
        formError(f, '');
        if (!f.email.value.trim() || !f.password.value) return formError(f, 'Isi email dan password.');
        try {
          const r = await api('POST', C('/auth/login'), { email: f.email.value.trim(), password: f.password.value }, { anon: true });
          store.set(r.access_token, f.remember.checked); f.password.value = '';
          await enterApp(r.account);
        } catch (err) { formError(f, err.message); }
      });
    });
    $('#registerForm').addEventListener('submit', (e) => {
      e.preventDefault(); const f = e.target;
      busy($('button[type=submit]', f), async () => {
        formError(f, '');
        const data = { full_name: f.full_name.value.trim(), email: f.email.value.trim(), whatsapp: f.whatsapp.value.replace(/[\s-]/g, ''),
          password: f.password.value, confirm_password: f.confirm_password.value };
        if (!data.full_name || !data.email || !data.whatsapp || !data.password) return formError(f, 'Lengkapi semua kolom.');
        if (!/^\+?[0-9]{9,15}$/.test(data.whatsapp)) return formError(f, 'Nomor WhatsApp harus 9–15 angka.');
        if (data.password.length < 8) return formError(f, 'Password minimal 8 karakter.');
        if (data.password !== data.confirm_password) return formError(f, 'Konfirmasi password tidak sama.');
        try {
          const reg = await api('POST', C('/auth/register'), data, { anon: true });
          const r = await api('POST', C('/auth/login'), { email: data.email, password: data.password }, { anon: true });
          store.set(r.access_token, false); f.reset();
          await enterApp(r.account);
          toast(reg.verification_sent ? 'Akun dibuat. Kode verifikasi dikirim ke email Anda.' : 'Akun berhasil dibuat.');
        } catch (err) { formError(f, err.message); }
      });
    });
    $('#logoutBtn').addEventListener('click', async () => {
      try { await api('POST', C('/auth/logout')); } catch (_) { /* tetap keluar */ }
      store.clear(); S.account = null; showAuth(); toast('Anda telah keluar.');
    });
  }

  async function enterApp(account) {
    S.account = account || await api('GET', C('/auth/me'));
    showApp(); renderWho(); renderVerify();
    await refreshAll();
    switchTab(location.hash.replace('#', '') || 'home');
    startTimers();
  }
  function renderWho() {
    const a = S.account; $('#whoName').textContent = a.full_name; $('#whoEmail').textContent = a.email;
    $('#avatar').textContent = (a.full_name || '?').trim().charAt(0).toUpperCase();
    $('#hello').textContent = 'Halo, ' + a.full_name.split(' ')[0];
  }

  /* ------------------------------ data ------------------------------- */
  async function loadSubmissions() { S.submissions = (await api('GET', C('/submissions'))).items || []; }
  async function loadInvoices() { S.invoices = (await api('GET', C('/service-invoices'))).items || []; }
  async function loadConsultations() { S.consultations = (await api('GET', C('/consultations'))).items || []; }
  async function loadNotifications() { S.notifications = (await api('GET', C('/notifications'))).items || []; renderBell(); }
  async function loadFeedback() { S.feedback = (await api('GET', C('/feedback'))).items || []; }
  async function refreshAll() {
    const results = await Promise.allSettled([loadSubmissions(), loadInvoices(), loadConsultations(), loadNotifications(), loadFeedback()]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed && failed.reason && failed.reason.status !== 401) setApiState(false, failed.reason.message); else if (!failed) setApiState(true);
    renderAll();
  }
  function renderAll() { renderHome(); renderVehicles(); renderBookings(); renderInvoices(); renderConsultList(); renderNotifs(); renderFeedback(); renderProfile(); }

  /* ------------------------------ tabs ------------------------------- */
  function switchTab(tab) {
    if (!$(`[data-pane="${tab}"]`)) tab = 'home';
    S.tab = tab;
    $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $$('.tabpane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    if (tab === 'catalog' && !catState.loaded) loadCatalog(true);
    if (tab === 'vehicles') loadVehicleModels();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function initTabs() {
    $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('#bellBtn').addEventListener('click', () => switchTab('notifs'));
    document.addEventListener('click', (e) => { const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); switchTab(go.dataset.go); } });
  }

  /* ------------------------------ status --------------------------- */
  function bookingStatus(p) {
    if (p.work_order_status) return p.work_order_status;
    if (p.ams_status) return p.ams_status;
    return 'Terkirim';
  }
  function statusClass(s) {
    s = String(s).toLowerCase();
    if (/(selesai|lunas|verified|terverifikasi)/.test(s)) return 'st-ok';
    if (/(batal|tolak|rejected)/.test(s)) return 'st-bad';
    if (/(terkirim|baru|booking|menunggu)/.test(s)) return 'st-wait';
    return 'st-run';
  }

  /* ------------------------------ home ------------------------------- */
  function renderHome() {
    const unpaid = S.invoices.filter((i) => i.issued_at && i.invoice.paid_amount < i.invoice.total - 0.01).length;
    const active = bookings().filter((b) => !['Selesai', 'Dibatalkan'].includes(bookingStatus(b.payload))).length;
    const unread = S.notifications.filter((n) => !n.read_at).length;
    const stats = [['Kendaraan', vehicles().length, 'vehicles'], ['Booking aktif', active, 'bookings'], ['Tagihan belum lunas', unpaid, 'invoices'], ['Notifikasi baru', unread, 'notifs']];
    $('#statGrid').innerHTML = stats.map(([l, v, t]) => `<a href="#${t}" class="stat-card" data-go="${t}"><b>${v}</b><span>${l}</span></a>`).join('');
    const latest = bookings()[0];
    $('#homeLatest').innerHTML = latest ? bookingCard(latest) : empty(vehicles().length
      ? 'Belum ada booking. <a href="#bookings" data-go="bookings">Buat booking</a>.'
      : 'Mulai dengan <a href="#vehicles" data-go="vehicles">menambahkan kendaraan</a>, lalu buat booking.');
  }

  /* ------------------------------ vehicles --------------------------- */
  let modelCatalog = null;
  async function loadVehicleModels() {
    if (modelCatalog) return;
    try {
      const all = []; let offset = 0;
      for (let i = 0; i < 5; i++) { const r = await api('GET', C(`/catalog/vehicle_models?limit=100&offset=${offset}`)); all.push(...r.items); if (r.next_offset == null) break; offset = r.next_offset; }
      modelCatalog = all;
      $('#brandList').innerHTML = all.map((b) => `<option value="${esc(b.brand)}">`).join('');
    } catch (_) { modelCatalog = []; }
  }
  function syncModelList() {
    const brand = $('#vehicleForm').brand.value.trim().toLowerCase();
    const row = (modelCatalog || []).find((b) => String(b.brand).toLowerCase() === brand);
    $('#modelList').innerHTML = row ? row.models.map((m) => `<option value="${esc(m)}">`).join('') : '';
  }
  function renderVehicles() {
    const list = vehicles();
    $('#vehicleList').innerHTML = list.length ? list.map((v) => {
      const p = v.payload;
      return `<article class="card vcard">
        <div class="vhead"><span class="plate">${esc(p.plate)}</span><span class="pill">${esc(p.vehicle_type)}</span></div>
        <h3>${esc(p.brand)} ${esc(p.model)}${p.year ? ' · ' + esc(p.year) : ''}</h3>
        <p class="muted small">Odometer: <b>${p.odometer != null ? Number(p.odometer).toLocaleString('id-ID') + ' km' : 'belum diisi'}</b>${p.odometer_updated_at ? ' · ' + esc(fmtTime(p.odometer_updated_at)) : ''}</p>
        <form class="odo" data-odo="${esc(v.id)}"><input name="km" type="number" min="0" max="9999999" placeholder="km terbaru" required><input name="reason" placeholder="alasan koreksi (jika lebih kecil)" maxlength="500"><button class="btn btn-ghost-dark" type="submit">Perbarui km</button></form>
        <div class="row-actions"><button class="btn btn-ghost-dark" type="button" data-edit-v="${esc(v.id)}">Ubah</button><button class="btn btn-ghost-dark danger" type="button" data-del-v="${esc(v.id)}">Arsipkan</button></div>
      </article>`;
    }).join('') : empty('Belum ada kendaraan. Tambahkan kendaraan agar bisa booking.');
  }
  function initVehicles() {
    const form = $('#vehicleForm');
    const open = (v) => {
      form.reset(); form.id.value = v ? v.id : ''; formError(form, '');
      $('#vehicleFormTitle').textContent = v ? 'Ubah kendaraan' : 'Tambah kendaraan';
      if (v) { const p = v.payload; form.plate.value = p.plate; form.vehicle_type.value = p.vehicle_type; form.brand.value = p.brand; form.model.value = p.model; form.year.value = p.year || ''; }
      form.hidden = false; syncModelList(); form.plate.focus();
    };
    $('#addVehicleBtn').addEventListener('click', () => open(null));
    $('[data-cancel]', form).addEventListener('click', () => { form.hidden = true; });
    form.brand.addEventListener('input', syncModelList);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', form), async () => {
        formError(form, '');
        const year = form.year.value ? parseInt(form.year.value, 10) : null;
        const data = { plate: form.plate.value.trim().toUpperCase(), brand: form.brand.value.trim(), model: form.model.value.trim(), vehicle_type: form.vehicle_type.value, year };
        if (!data.plate || !data.brand || !data.model) return formError(form, 'Nomor polisi, merek, dan model wajib diisi.');
        try {
          if (form.id.value) {
            const old = vehicleById(form.id.value);
            await api('PUT', C('/vehicles/' + encodeURIComponent(form.id.value)), { ...data, catalog_source: (old && old.payload.catalog_source) || 'CUSTOM' });
            toast('Kendaraan diperbarui.');
          } else {
            await api('POST', C('/submissions'), { id: uuid(), kind: 'vehicle', payload: data });
            toast('Kendaraan tersimpan.');
          }
          form.hidden = true; await loadSubmissions(); renderAll();
        } catch (err) { formError(form, err.message); }
      });
    });
    $('#vehicleList').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit-v]'); if (ed) return open(vehicleById(ed.dataset.editV));
      const del = e.target.closest('[data-del-v]');
      if (del) {
        if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'Yakin arsipkan?'; setTimeout(() => { del.dataset.confirm = ''; del.textContent = 'Arsipkan'; }, 4000); return; }
        busy(del, async () => {
          try { await api('DELETE', C('/vehicles/' + encodeURIComponent(del.dataset.delV))); toast('Kendaraan diarsipkan.'); await loadSubmissions(); renderAll(); }
          catch (err) { toast(err.message, 'err'); }
        });
      }
    });
    $('#vehicleList').addEventListener('submit', (e) => {
      const f = e.target.closest('[data-odo]'); if (!f) return; e.preventDefault();
      busy($('button', f), async () => {
        const km = parseInt(f.km.value, 10); if (isNaN(km)) return toast('Isi kilometer.', 'err');
        try {
          await api('POST', C(`/vehicles/${encodeURIComponent(f.dataset.odo)}/odometer`), { kilometer: km, correction_reason: f.reason.value.trim() || null });
          toast('Odometer diperbarui.'); await loadSubmissions(); renderVehicles();
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  /* ------------------------------ bookings --------------------------- */
  function bookingCard(b) {
    const p = b.payload; const st = bookingStatus(p); const v = vehicleById(p.vehicle_id);
    const hist = (p.status_history || []).slice().reverse();
    const inv = S.invoices.find((i) => i.id === b.id);
    return `<article class="card bcard">
      <div class="bhead"><div><h3>${esc(p.service)} — ${esc(vehicleName(v))}</h3>
        <p class="muted small">${esc(DAYS[dayOf(p.date)] || '')}, ${esc(fmtDate(p.date))} · ${esc(p.time)} ${esc(SCH.zone)} · ${esc(p.visit_mode || 'Datang ke bengkel')}</p></div>
        <span class="status ${statusClass(st)}">${esc(st)}</span></div>
      ${p.complaint ? `<p class="small">Keluhan: ${esc(p.complaint)}</p>` : ''}
      ${p.location ? `<p class="small">Lokasi: ${esc(p.location)}</p>` : ''}
      <ol class="timeline">
        ${hist.map((h) => `<li><b>${esc(h.work_order_status || h.booking_status)}</b>${h.work_order_status && h.booking_status ? ` <span class="muted">(booking: ${esc(h.booking_status)})</span>` : ''}<time>${esc(fmtTime(h.changed_at))}</time></li>`).join('')}
        <li><b>Booking terkirim ke bengkel</b><time>${esc(fmtTime(b.created_at))}</time></li>
      </ol>
      ${hist.length ? '' : '<p class="muted small">Menunggu diproses admin bengkel di AMP Management System.</p>'}
      ${inv ? `<a class="btn btn-ghost-dark" href="#invoices" data-go="invoices">Lihat tagihan ${esc(inv.invoice.invoice_number || '')}</a>` : ''}
    </article>`;
  }
  function renderBookings() {
    const list = bookings();
    $('#bookingList').innerHTML = list.length ? list.map(bookingCard).join('') : empty('Belum ada booking.');
    const sel = $('#bookingFormP').vehicle_id;
    sel.innerHTML = vehicles().map((v) => `<option value="${esc(v.id)}">${esc(vehicleName(v))}</option>`).join('') || '<option value="">Tambahkan kendaraan terlebih dahulu</option>';
  }
  function initBookings() {
    const form = $('#bookingFormP');
    const closed = SCH.closedDays.map((d) => DAYS[d]).join(', ');
    $('#pHoursHint').textContent = `Jam booking ${SCH.open.replace(':', '.')}–${SCH.close.replace(':', '.')} ${SCH.zone}${closed ? `, ${closed} libur` : ''}.`;
    form.time.min = SCH.open; form.time.max = SCH.close;
    const syncLoc = () => { const call = form.visit_mode.value === 'Panggilan'; $('[data-loc]', form).hidden = !call; };
    $$('input[name=visit_mode]', form).forEach((r) => r.addEventListener('change', syncLoc));
    $('#newBookingBtn').addEventListener('click', () => {
      if (!vehicles().length) { toast('Tambahkan kendaraan terlebih dahulu.', 'err'); return switchTab('vehicles'); }
      form.reset(); syncLoc(); form.date.min = shopNow().iso; formError(form, ''); form.hidden = false; form.vehicle_id.focus();
    });
    $('[data-cancel]', form).addEventListener('click', () => { form.hidden = true; });
    $('#geoBtn').addEventListener('click', () => {
      if (!navigator.geolocation) return toast('Perangkat tidak mendukung lokasi.', 'err');
      navigator.geolocation.getCurrentPosition((pos) => {
        form.location.value = `https://maps.google.com/?q=${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
      }, () => toast('Izin lokasi ditolak. Tulis alamat secara manual.', 'err'), { enableHighAccuracy: true, timeout: 10000 });
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', form), async () => {
        formError(form, '');
        const d = { vehicle_id: form.vehicle_id.value, service: form.service.value, date: form.date.value, time: form.time.value,
          visit_mode: form.visit_mode.value, location: form.location.value.trim(), complaint: form.complaint.value.trim() };
        if (!d.vehicle_id || !d.service || !d.date || !d.time) return formError(form, 'Lengkapi kendaraan, kebutuhan, tanggal, dan jam.');
        const now = shopNow();
        if (d.date < now.iso) return formError(form, 'Tanggal tidak boleh sebelum hari ini.');
        if (SCH.closedDays.includes(dayOf(d.date))) return formError(form, `Hari ${DAYS[dayOf(d.date)]} bengkel libur.`);
        const t = toMin(d.time);
        if (t < toMin(SCH.open) || t > toMin(SCH.close)) return formError(form, `Jam booking ${SCH.open}–${SCH.close} ${SCH.zone}.`);
        if (d.date === now.iso && t < now.min) return formError(form, 'Jam tersebut sudah lewat untuk hari ini.');
        if (d.visit_mode === 'Panggilan' && !d.location) return formError(form, 'Isi lokasi untuk layanan panggilan.');
        if (d.visit_mode !== 'Panggilan') d.location = '';
        try {
          await api('POST', C('/submissions'), { id: uuid(), kind: 'booking', payload: d });
          form.hidden = true; toast('Booking terkirim. Admin bengkel akan memprosesnya di AMP MS.');
          await loadSubmissions(); renderAll();
        } catch (err) { formError(form, err.message); }
      });
    });
  }

  /* ------------------------------ invoices --------------------------- */
  function renderInvoices() {
    const list = S.invoices;
    $('#invoiceList').innerHTML = list.length ? list.map((row) => {
      const i = row.invoice || {}; const remaining = Math.max(0, (i.total || 0) - (i.paid_amount || 0));
      const paid = remaining <= 0.01; const issued = !!row.issued_at && i.work_order_status === 'Selesai';
      const pending = (row.proofs || []).some((p) => ['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(p.status));
      const proofLabel = { PROOF_SUBMITTED: 'Menunggu pemeriksaan', UNDER_REVIEW: 'Sedang diperiksa', VERIFIED: 'Terverifikasi', REJECTED: 'Ditolak' };
      return `<article class="card icard">
        <div class="bhead"><div><h3>${esc(i.invoice_number || '')} · ${esc(i.work_order_number || '')}</h3>
          <p class="muted small">${esc(i.vehicle_name || '')}${i.service_date ? ' · ' + esc(fmtDate(i.service_date)) : ''}</p></div>
          <span class="status ${issued ? (paid ? 'st-ok' : 'st-wait') : statusClass(i.work_order_status)}">${issued ? (paid ? 'Lunas' : 'Belum lunas') : esc(i.work_order_status || '')}</span></div>
        ${issued ? '' : '<p class="muted small">Rincian sementara — tagihan resmi terbit setelah Work Order selesai.</p>'}
        <table class="lines"><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>
          ${(i.lines || []).map((l) => `<tr><td>${esc(l.name)}<small>${esc(l.kind || '')}</small></td><td>${esc(l.quantity)}</td><td>${rupiah(l.unit_price)}</td><td>${rupiah((l.quantity || 0) * (l.unit_price || 0))}</td></tr>`).join('')}
        </tbody></table>
        <dl class="totals"><div><dt>Subtotal</dt><dd>${rupiah(i.subtotal)}</dd></div>${i.discount ? `<div><dt>Diskon</dt><dd>− ${rupiah(i.discount)}</dd></div>` : ''}${i.tax ? `<div><dt>Pajak</dt><dd>${rupiah(i.tax)}</dd></div>` : ''}
          <div class="tot"><dt>Total</dt><dd>${rupiah(i.total)}</dd></div><div><dt>Sudah dibayar</dt><dd>${rupiah(i.paid_amount)}</dd></div><div class="tot"><dt>Sisa</dt><dd>${rupiah(remaining)}</dd></div></dl>
        ${issued && !paid && (i.payment_accounts || []).length ? `<div class="bank"><b>Rekening pembayaran resmi</b>${i.payment_accounts.map((a) => `<span>${esc(a.bank_name || '')} · ${esc(a.account_number || '')} · a.n. ${esc(a.account_name || '')}</span>`).join('')}</div>` : ''}
        ${(row.proofs || []).length ? `<div class="proofs"><b>Bukti transfer</b>${row.proofs.map((p) => `<div><span class="status ${p.status === 'VERIFIED' ? 'st-ok' : p.status === 'REJECTED' ? 'st-bad' : 'st-wait'}">${esc(proofLabel[p.status] || p.status)}</span><small>${esc(p.filename)} · ${esc(fmtTime(p.submitted_at))}${p.rejection_reason ? ' · ' + esc(p.rejection_reason) : ''}</small></div>`).join('')}</div>` : ''}
        ${issued && !paid && !pending ? `<form class="proof-form" data-proof="${esc(row.id)}"><label class="f">Unggah bukti transfer (JPG/PNG/PDF, maks. 3 MB)<input type="file" name="file" accept="image/jpeg,image/png,application/pdf" required></label><button class="btn btn-primary" type="submit">Kirim bukti</button></form>` : ''}
      </article>`;
    }).join('') : empty('Belum ada tagihan. Tagihan muncul setelah booking Anda dibuatkan Work Order di bengkel.');
  }
  function initInvoices() {
    $('#invoiceList').addEventListener('submit', (e) => {
      const f = e.target.closest('[data-proof]'); if (!f) return; e.preventDefault();
      busy($('button', f), async () => {
        const file = f.file.files[0]; if (!file) return toast('Pilih file bukti.', 'err');
        if (file.size > 3000000) return toast('File maksimal 3 MB.', 'err');
        if (!/\.(jpe?g|png|pdf)$/i.test(file.name)) return toast('Gunakan JPG, PNG, atau PDF.', 'err');
        try {
          await api('POST', C(`/service-invoices/${encodeURIComponent(f.dataset.proof)}/proofs`), { id: uuid(), filename: file.name, data_base64: await fileToBase64(file) });
          toast('Bukti transfer terkirim. Kasir akan memeriksanya.'); await loadInvoices(); renderInvoices(); renderHome();
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  /* ------------------------------ consultations ---------------------- */
  const consultLabel = { BARU: 'Menunggu balasan', DIBACA: 'Dibaca admin', DIPROSES: 'Sedang diproses', 'MENUNGGU PELANGGAN': 'Dibalas admin', DITUTUP: 'Ditutup',
    'MENUNGGU BALASAN': 'Menunggu balasan', AKTIF: 'Dibalas admin', SELESAI: 'Selesai' };
  function renderConsultList() {
    const list = S.consultations;
    $('#consultList').innerHTML = list.length ? list.map((c) => {
      const last = c.messages[c.messages.length - 1] || {};
      return `<button type="button" class="thread-item ${S.activeConsult === c.id ? 'on' : ''}" data-thread="${esc(c.id)}">
        <b>${esc((c.messages[0] && c.messages[0].body) || 'Konsultasi foto').slice(0, 60)}</b>
        <small>${esc(consultLabel[c.status] || c.status)} · ${esc(fmtTime(last.created_at))}</small></button>`;
    }).join('') : empty('Belum ada konsultasi.');
    renderThread();
  }
  function renderThread() {
    const c = S.consultations.find((x) => x.id === S.activeConsult);
    const box = $('#consultThread');
    if (!c) { box.innerHTML = '<p class="muted">Pilih percakapan atau buat konsultasi baru.</p>'; return; }
    const closed = c.status === 'DITUTUP' || c.status === 'SELESAI';
    box.innerHTML = `<div class="thread-head"><b>Konsultasi</b><span class="status ${statusClass(consultLabel[c.status] || c.status)}">${esc(consultLabel[c.status] || c.status)}</span></div>
      <div class="msgs">${c.messages.map((m) => `<div class="msg ${m.sender === 'customer' ? 'me' : 'them'}"><small>${esc(m.sender === 'customer' ? 'Anda' : (m.sender_name || 'Admin AMP'))} · ${esc(fmtTime(m.created_at))}</small><p>${esc(m.body || '')}</p>${m.has_photo ? '<em>📷 Foto terlampir</em>' : ''}</div>`).join('')}</div>
      ${closed ? '<p class="muted small">Konsultasi ditutup oleh bengkel. Buat konsultasi baru bila perlu.</p>' :
      `<form class="reply" data-reply="${esc(c.id)}"><textarea name="body" rows="2" maxlength="4000" placeholder="Tulis balasan…" required></textarea><button class="btn btn-primary" type="submit">Kirim</button></form>`}`;
    const msgs = $('.msgs', box); if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
  function initConsult() {
    const form = $('#consultForm');
    $('#newConsultBtn').addEventListener('click', () => { form.reset(); formError(form, ''); form.hidden = false; form.message.focus(); });
    $('[data-cancel]', form).addEventListener('click', () => { form.hidden = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', form), async () => {
        formError(form, '');
        const message = form.message.value.trim(); const file = form.photo.files[0];
        if (!message && !file) return formError(form, 'Isi pertanyaan atau lampirkan foto.');
        try {
          const photo = file ? await imageToJpegBase64(file) : '';
          const id = uuid();
          await api('POST', C('/submissions'), { id, kind: 'consultation', payload: { message, photo_base64: photo } });
          form.hidden = true; S.activeConsult = id; toast('Konsultasi terkirim ke admin AMP.');
          await loadConsultations(); renderConsultList();
        } catch (err) { formError(form, err.message); }
      });
    });
    $('#consultList').addEventListener('click', (e) => { const t = e.target.closest('[data-thread]'); if (t) { S.activeConsult = t.dataset.thread; renderConsultList(); } });
    $('#consultThread').addEventListener('submit', (e) => {
      const f = e.target.closest('[data-reply]'); if (!f) return; e.preventDefault();
      busy($('button', f), async () => {
        const body = f.body.value.trim(); if (!body) return;
        try {
          const updated = await api('POST', C(`/consultations/${encodeURIComponent(f.dataset.reply)}/messages`), { id: uuid(), body });
          const idx = S.consultations.findIndex((c) => c.id === updated.id); if (idx >= 0) S.consultations[idx] = updated;
          renderConsultList();
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  /* ------------------------------ notifications ---------------------- */
  function renderBell() {
    const n = S.notifications.filter((x) => !x.read_at).length;
    const b = $('#bellCount'); b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n;
    const t = $('#tabBadge'); t.textContent = String(n); t.hidden = !n;
  }
  function renderNotifs() {
    const list = S.notifications;
    $('#notifList').innerHTML = list.length ? list.map((n) => `<button type="button" class="notif ${n.read_at ? '' : 'unread'}" data-notif="${esc(n.id)}" data-kind="${esc(n.kind)}">
      <b>${esc((n.payload && n.payload.title) || n.kind)}</b><span>${esc((n.payload && n.payload.message) || '')}</span>
      <small>${esc(fmtTime(n.created_at))}${n.payload && n.payload.work_order_number ? ' · ' + esc(n.payload.work_order_number) : ''}</small></button>`).join('')
      : empty('Belum ada notifikasi.');
    renderBell();
  }
  function initNotifs() {
    $('#notifList').addEventListener('click', async (e) => {
      const el = e.target.closest('[data-notif]'); if (!el) return;
      const n = S.notifications.find((x) => x.id === el.dataset.notif);
      if (n && !n.read_at) { try { const r = await api('POST', C(`/notifications/${encodeURIComponent(n.id)}/read`)); n.read_at = r.read_at; renderNotifs(); } catch (err) { toast(err.message, 'err'); } }
      const kind = el.dataset.kind;
      const go = /CONSULT/.test(kind) ? 'consult' : /(INVOICE|PROOF|PAYMENT)/.test(kind) ? 'invoices' : /WORK_ORDER/.test(kind) ? 'bookings' : /FEEDBACK/.test(kind) ? 'feedback' : /PROMO/.test(kind) ? 'catalog' : null;
      if (n && /CONSULT/.test(kind) && n.payload && n.payload.consultation_id) S.activeConsult = n.payload.consultation_id;
      if (go) { if (go === 'catalog') catState.kind = 'promotions'; switchTab(go); renderConsultList(); }
    });
    $('#readAllBtn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try { await api('POST', C('/notifications/read-all')); await loadNotifications(); renderNotifs(); renderHome(); } catch (err) { toast(err.message, 'err'); }
    }));
  }

  /* ------------------------------ catalog --------------------------- */
  const catState = { kind: 'parts', q: '', offset: 0, items: [], loaded: false };
  async function loadCatalog(reset) {
    if (reset) { catState.offset = 0; catState.items = []; }
    $$('#catTabs [data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === catState.kind));
    $('#catSearch').hidden = catState.kind !== 'parts';
    const list = $('#catList');
    if (reset) list.innerHTML = '<p class="muted">Memuat…</p>';
    try {
      const q = catState.kind === 'parts' && catState.q ? '&q=' + encodeURIComponent(catState.q) : '';
      const r = await api('GET', C(`/catalog/${catState.kind}?limit=24&offset=${catState.offset}${q}`));
      catState.items.push(...r.items); catState.offset = r.next_offset ?? catState.offset; catState.loaded = true;
      $('#catMore').hidden = r.next_offset == null;
      list.innerHTML = catState.items.length ? catState.items.map(catCard).join('') : empty(catState.kind === 'parts' ? 'Sparepart tidak ditemukan.' : 'Belum ada data.');
    } catch (err) { list.innerHTML = empty(esc(err.message)); $('#catMore').hidden = true; }
  }
  function catCard(it) {
    if (catState.kind === 'parts') return `<article class="cat-card"><small>${esc(it.sku || '')}${it.system ? ' · ' + esc(it.system) : ''}</small><h4>${esc(it.name)}</h4>
      <p class="muted small">${esc(it.brand || '')}${it.compatible ? ' · Cocok: ' + esc(it.compatible) : ''}</p>
      <div class="cat-foot"><b>${it.price > 0 ? rupiah(it.price) : 'Hubungi admin'}</b><span class="status ${it.stock > 0 ? 'st-ok' : 'st-bad'}">${it.stock > 0 ? 'Tersedia' : 'Stok habis'}</span></div></article>`;
    if (catState.kind === 'promotions') return `<article class="cat-card promo"><small>${esc(fmtDate(it.start_date))} – ${esc(fmtDate(it.end_date))}${it.code ? ' · Kode ' + esc(it.code) : ''}</small><h4>${esc(it.name)}</h4>
      <p class="small pre">${esc(it.description || '')}</p>${it.promo_price ? `<div class="cat-foot"><b>${rupiah(it.promo_price)}</b></div>` : ''}</article>`;
    return `<article class="cat-card"><small>${esc(it.category || '')}${it.published_at ? ' · ' + esc(fmtDate(it.published_at)) : ''}</small><h4>${esc(it.title || '')}</h4><p class="small pre">${esc(it.body || '')}</p></article>`;
  }
  function initCatalog() {
    $('#catTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; catState.kind = b.dataset.cat; loadCatalog(true); });
    $('#catSearch').addEventListener('submit', (e) => { e.preventDefault(); catState.q = e.target.q.value.trim(); loadCatalog(true); });
    $('#catMore').addEventListener('click', () => loadCatalog(false));
  }

  /* ------------------------------ feedback --------------------------- */
  function renderFeedback() {
    $('#feedbackList').innerHTML = S.feedback.length ? S.feedback.map((f) => { const p = f.payload || {};
      return `<article class="card"><div class="bhead"><div><h3>${esc(p.type)}: ${esc(p.subject)}</h3><p class="muted small">${esc(fmtTime(f.created_at))}</p></div>
        <span class="status ${p.reply ? 'st-ok' : 'st-wait'}">${esc(p.ticket_status || '')}</span></div><p class="small pre">${esc(p.message)}</p>
        ${p.reply ? `<div class="reply-box"><b>Balasan AMP</b><p class="small pre">${esc(p.reply)}</p><small class="muted">${esc(fmtTime(p.reply_at))}</small></div>` : ''}</article>`; }).join('')
      : empty('Belum ada saran atau komplain.');
  }
  function initFeedback() {
    const form = $('#feedbackForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', form), async () => {
        formError(form, '');
        const d = { type: form.type.value, subject: form.subject.value.trim(), message: form.message.value.trim(), contact: form.contact.value.trim() };
        if (!d.subject || !d.message) return formError(form, 'Judul dan pesan wajib diisi.');
        try { await api('POST', C('/submissions'), { id: uuid(), kind: 'feedback', payload: d }); form.reset(); toast('Terima kasih. Masukan Anda tercatat.'); await loadFeedback(); renderFeedback(); }
        catch (err) { formError(form, err.message); }
      });
    });
  }

  /* ------------------------------ profile ---------------------------- */
  function renderProfile() {
    const a = S.account; if (!a) return; const f = $('#profileForm');
    f.full_name.value = a.full_name; f.email.value = a.email; f.whatsapp.value = a.whatsapp; f.address.value = a.address || ''; f.birth_date.value = a.birth_date || '';
  }
  function renderVerify() {
    const a = S.account; const banner = $('#verifyBanner'); const card = $('#verifyCard');
    if (a.email_verified) { banner.hidden = true; card.innerHTML = '<p class="small"><span class="status st-ok">Email terverifikasi</span></p>'; return; }
    banner.hidden = false;
    banner.innerHTML = a.verification_available ? 'Email Anda belum terverifikasi. <a href="#profile" data-go="profile">Verifikasi sekarang</a>.' : 'Email belum terverifikasi. Layanan verifikasi email belum diaktifkan di server bengkel.';
    card.innerHTML = a.verification_available ? `<h3>Verifikasi email</h3><p class="small muted">Kode 8 angka dikirim ke ${esc(a.email)}.</p>
      <form id="verifyForm" class="verify-row"><input name="code" inputmode="numeric" maxlength="8" placeholder="8 angka"><button class="btn btn-primary" type="submit">Konfirmasi</button><button class="btn btn-ghost-dark" type="button" id="resendBtn">Kirim ulang kode</button></form>`
      : '<p class="small muted">Verifikasi email belum tersedia.</p>';
    const vf = $('#verifyForm'); if (!vf) return;
    vf.addEventListener('submit', (e) => { e.preventDefault(); busy($('button[type=submit]', vf), async () => {
      try { S.account = await api('POST', C('/auth/verification/confirm'), { code: vf.code.value.trim() }); renderVerify(); toast('Email terverifikasi.'); } catch (err) { toast(err.message, 'err'); } }); });
    $('#resendBtn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try { await api('POST', C('/auth/verification/resend')); toast('Kode verifikasi dikirim.'); } catch (err) { toast(err.message, 'err'); } }));
  }
  function initProfile() {
    const f = $('#profileForm');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', f), async () => {
        formError(f, ''); $('.form-ok', f).hidden = true;
        try {
          S.account = await api('PATCH', C('/auth/me'), { full_name: f.full_name.value.trim(), address: f.address.value.trim(), birth_date: f.birth_date.value || null });
          renderWho(); $('.form-ok', f).hidden = false;
        } catch (err) { formError(f, err.message); }
      });
    });
  }

  /* ------------------------------ polling ---------------------------- */
  function stopTimers() { S.timers.forEach(clearInterval); S.timers = []; }
  function startTimers() {
    stopTimers();
    // Status booking, tagihan, & notifikasi diperbarui oleh AMS lewat agen sinkronisasi (±5 detik).
    S.timers.push(setInterval(async () => {
      if (document.hidden || !S.account) return;
      try {
        const before = JSON.stringify([S.notifications.map((n) => n.id + n.read_at), S.submissions.map((s) => s.id + JSON.stringify(s.payload.status_history || []))]);
        await Promise.all([loadNotifications(), loadSubmissions(), loadInvoices()]);
        if (S.tab === 'consult') await loadConsultations();
        const after = JSON.stringify([S.notifications.map((n) => n.id + n.read_at), S.submissions.map((s) => s.id + JSON.stringify(s.payload.status_history || []))]);
        if (before !== after || S.tab === 'consult') { renderHome(); renderBookings(); renderInvoices(); renderNotifs(); if (S.tab === 'consult') renderConsultList(); }
        setApiState(true);
      } catch (_) { /* pesan ditampilkan lewat chip status */ }
    }, Number(CFG.portalRefreshSeconds || 20) * 1000));
  }

  /* ------------------------------ start ------------------------------ */
  async function start() {
    initAuth(); initTabs(); initVehicles(); initBookings(); initInvoices(); initConsult(); initNotifs(); initCatalog(); initFeedback(); initProfile();
    await checkHealth();
    if (!store.get()) return showAuth();
    try { await enterApp(null); } catch (err) { if (err.status !== 401) { showAuth(); formError($('#loginForm'), err.message); } }
  }
  start();
})();
