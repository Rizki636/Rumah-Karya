/* RUMAH KARYA v2 - app.js (seluruh logika tampilan: pembaca, beranda, admin, popup) */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const $ = s => document.querySelector(s), app = $('#app');
const vid = localStorage.vid || (localStorage.vid = crypto.randomUUID());
let tok = sessionStorage.tok || '', S = {}, POP = [], ALL = [], F = { type: 'all', cat: '', q: '', sort: 'new' }, tab = 'karya';
var foc = false;
const VER = '5', arr = x => Array.isArray(x) ? x : [];
try { if (localStorage.rkv !== VER) { localStorage.removeItem('LIST'); localStorage.removeItem('S'); localStorage.rkv = VER; if (window.caches) caches.delete('pdf'); } } catch (e) {}
const resetC = () => { try { localStorage.removeItem('LIST'); localStorage.removeItem('S'); if (window.caches) caches.delete('pdf'); } catch (e) {} location.reload(); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2600); };
const IDEM=new Set(['boot','list','get','pdf','adminList','adminGet','popupList','getSettings']);
async function api(action, data = {}, left = 1) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), action === 'pdf' ? 90000 : 35000);
  try {
    const r = await fetch(API, { method: 'POST', body: JSON.stringify({ action, token: tok, visitor: vid, ...data }), signal: ctl.signal });
    const j = await r.json(); if (!j.ok) throw new Error(j.error); return j.data;
  } catch (e) {
    if (left > 0 && IDEM.has(action) && (e.name === 'AbortError' || e.name === 'TypeError' || e instanceof SyntaxError)) return api(action, data, left - 1);
    throw new Error(e.name === 'AbortError' ? 'Koneksi lambat, waktu habis' : e.name === 'TypeError' ? 'Koneksi terputus' : e.message);
  } finally { clearTimeout(t); }
}
const fail = (m, retry) => { app.innerHTML = `<div class="err"><h2>Gagal memuat</h2><p>${esc(m)}</p><p class="meta">Server gratis kadang butuh beberapa detik untuk bangun. Coba lagi ya.</p><button class="pri btn" id="rt">Coba lagi</button> <button onclick="resetC()">Bersihkan data tersimpan</button></div>`; $('#rt').onclick = retry; };
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const stars = (n, on) => [1,2,3,4,5].map(i => `<button class="${i <= n ? 'f' : ''}" ${on ? `onclick="rate(${i})"` : 'disabled'} aria-label="${i} bintang">★</button>`).join('');
const rtx = r => r.count ? `★ ${r.avg} (${r.count})` : '★ belum ada';
const cats = w => String(w.category || '').split(',').map(x => x.trim()).filter(Boolean);

// ===== Anti salin (penghalang, bukan jaminan mutlak) =====
['copy','cut','contextmenu','dragstart','selectstart'].forEach(ev => document.addEventListener(ev, e => {
  if (e.target.closest && !e.target.closest('.admin') && !/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault();
}));
document.addEventListener('keydown', e => {
  if ($('.admin') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1);
  if (e.key === 'F12' || e.key === 'PrintScreen' || ((e.ctrlKey || e.metaKey) && ['c','s','p','u','a'].includes(k)) || (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(k))) { e.preventDefault(); if (e.key === 'PrintScreen') navigator.clipboard?.writeText(''); }
});
const blur = on => $('#stage')?.classList.toggle('blur', on);
document.addEventListener('visibilitychange', () => blur(document.hidden));
addEventListener('blur', () => blur(true)); addEventListener('focus', () => blur(false));

// ===== Awal & router =====
let started = false;
const applyS = () => { document.title = S.site_name || 'Rumah Karya'; $('#brand').textContent = S.site_name || 'Rumah Karya'; $('#foot').textContent = S.footer || ''; };
const start = () => { if (started) return; started = true; onhashchange = route; try { route(); } catch (e) { fail(e.message, () => location.reload()); } };
try { S = JSON.parse(localStorage.S || '{}'); if (S.site_name) { applyS(); setTimeout(start, 0); } } catch (e) {}
const bootP = api('boot').then(r => { S = r.settings; POP = r.popups; localStorage.S = JSON.stringify(S); applyS(); if (!started) start(); else if (S.maintenance && !tok) route(); })
  .catch(e => { if (!started) fail(e.message, () => location.reload()); throw e; });
bootP.catch(() => {});
function route() {
  if (foc) { foc = false; document.body.classList.remove('foc', 'nobar'); if (document.fullscreenElement) document.exitFullscreen(); }
  const h = location.hash.slice(1) || '/'; $('#who').textContent = tok ? 'Mode admin' : '';
  if (h.startsWith('/admin')) return tok ? admin(h) : login();
  if (S.maintenance && !tok) { app.innerHTML = `<h1>Sedang pemeliharaan</h1><p>${br(S.maintenance_msg)}</p><p><a href="#/admin">Masuk admin</a></p>`; return; }
  if (h.startsWith('/w/')) return read(h.slice(3));
  home();
}

// ===== Popup / pengumuman (muncul satu per satu, ukuran seragam) =====
const nu = u => { u = String(u || '').trim(); return u && !/^(https?:|mailto:|tel:)/i.test(u) ? 'https://' + u.replace(/^\/+/, '') : u; };
function freqOk(p) {
  const k = 'pp_' + p.id, f = p.frequency, today = new Date().toISOString().slice(0, 10);
  if (f === 'session') return !sessionStorage[k]; if (f === 'once') return !localStorage[k]; if (f === 'daily') return localStorage[k] !== today; return true;
}
let pq = [], ptot = 0;
async function showPopups(c) {
  try { await bootP; } catch (e) { return; }
  const L = POP.filter(p => {
    if (p.trigger !== c.event) return false;
    if (p.trigger === 'finish' && c.page !== 'work') return false;
    if (p.placement === 'home' && c.page !== 'home') return false;
    if (p.placement === 'works' && (c.page !== 'work' || (p.workIds && !p.workIds.split(',').includes(c.id)))) return false;
    return freqOk(p);
  });
  L.forEach(p => { sessionStorage['pp_' + p.id] = 1; localStorage['pp_' + p.id] = new Date().toISOString().slice(0, 10); });
  L.filter(p => p.style === 'banner').forEach(drawBanner);
  pq = L.filter(p => p.style !== 'banner'); ptot = pq.length; nextPop();
}
const pbtn = p => p.btnUrl ? `<a class="btn pri" href="${esc(nu(p.btnUrl))}" target="_blank" rel="noopener">${esc(p.btnText || 'Buka')}</a>` : '';
function drawBanner(p) { const d = document.createElement('div'); d.className = 'banner'; d.innerHTML = `<div><b>${esc(p.title)}</b> ${br(p.body)} ${pbtn(p)}</div><button onclick="this.parentNode.remove()" aria-label="Tutup">✕</button>`; app.prepend(d); }
function nextPop() {
  document.querySelector('.ov')?.remove(); const p = pq.shift(); if (!p) return;
  const o = document.createElement('div'); o.className = 'ov';
  o.innerHTML = `<div class="pop" role="dialog" aria-modal="true">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="">` : ''}<div class="pb">${p.title ? `<h2>${esc(p.title)}</h2>` : ''}<p>${br(p.body)}</p></div>
  <div class="pf"><span class="meta">${ptot > 1 ? (ptot - pq.length) + ' / ' + ptot : ''}</span><span>${pbtn(p)} <button onclick="nextPop()">${pq.length ? 'Berikutnya' : 'Tutup'}</button></span></div></div>`;
  document.body.append(o);
}

// ===== Beranda =====
const cvu = (c, w = 420) => !c ? '' : String(c).startsWith('data:') ? c : `https://lh3.googleusercontent.com/d/${c}=w${w}`;
const sk = n => `<div class="grid">${'<div class="sk"></div>'.repeat(n)}</div>`;
const catBtns = () => { const cs = [...new Set(arr(ALL).flatMap(cats))].sort(); return cs.length ? `<button class="${!F.cat ? 'on' : ''}" onclick="F.cat='';grid()">Semua kategori</button>${cs.map(c => `<button class="${F.cat === c ? 'on' : ''}" onclick="F.cat=this.textContent;grid()">${esc(c)}</button>`).join('')}` : ''; };
const home0 = async () => {
  try { ALL = arr(JSON.parse(localStorage.LIST || '[]')); } catch (e) { ALL = []; }
  app.innerHTML = `<section class="hero"><h1>${esc(S.site_name)}</h1><p>${esc(S.tagline)}</p></section>
  <div class="tools"><input id="q" type="search" placeholder="Cari judul, penulis, atau kata kunci..." aria-label="Cari" value="${esc(F.q)}"><select id="so" aria-label="Urutkan"><option value="new">Terbaru</option><option value="az">Judul A-Z</option></select></div>
  <div class="tabs">${[['all', 'Semua'], ['sastra', 'Karya sastra'], ['ilmiah', 'Jurnal']].map(([k, t]) => `<button class="${F.type === k ? 'on' : ''}" onclick="F.type='${k}';home()">${t}</button>`).join('')}</div>
  <div class="tabs" id="cats">${catBtns()}</div><div id="gr"></div><p style="margin-top:50px"><a href="#/admin" style="color:var(--mute);font-size:13px">Masuk admin</a></p>`;
  $('#so').value = F.sort; $('#q').oninput = e => { F.q = e.target.value; grid(); }; $('#so').onchange = e => { F.sort = e.target.value; grid(); };
  if (ALL.length) grid(); else $('#gr').innerHTML = `<p class="ld">Memuat karya</p>${sk(6)}`;
  try { ALL = arr(await api('list')); try { localStorage.LIST = JSON.stringify(ALL); } catch (e) {} } catch (e) { if (!ALL.length) return fail(e.message, home); toast('Menampilkan data tersimpan: ' + e.message); }
  if (!$('#gr')) return; $('#cats').innerHTML = catBtns(); grid(); showPopups({ page: 'home', event: 'load' });
};
const home = async () => { try { await home0(); } catch (e) { fail(e.message, home); } };
function grid() {
  const q = F.q.toLowerCase(); document.querySelectorAll('#cats button').forEach(x => x.classList.toggle('on', (x.textContent === F.cat) || (!F.cat && x.textContent === 'Semua kategori')));
  let L = ALL.filter(w => (F.type === 'all' || w.type === F.type) && (!F.cat || cats(w).includes(F.cat)) && (!q || [w.title, w.author, w.synopsis, w.category].join(' ').toLowerCase().includes(q)));
  if (F.sort === 'az') L = [...L].sort((a, b) => a.title.localeCompare(b.title));
  $('#gr').innerHTML = `<div class="grid">${L.map(w => `<div class="card" tabindex="0" onclick="location.hash='/w/${w.id}'" onkeydown="if(event.key==='Enter')this.click()">
    ${w.cover ? `<img class="cv" loading="lazy" src="${cvu(w.cover)}" alt="Sampul ${esc(w.title)}" draggable="false">` : `<div class="cv">${esc(w.title)}</div>`}
    <span class="tag">${w.type === 'ilmiah' ? 'Jurnal' : 'Sastra'}</span><h3>${esc(w.title)}</h3><div class="meta">${esc(w.author)}</div>
    <div class="meta">${w.likes !== undefined ? `<span>♥ ${w.likes}</span>` : ''}${w.comments !== undefined ? `<span>💬 ${w.comments}</span>` : ''}${w.views !== undefined ? `<span>👁 ${w.views}</span>` : ''}${w.rating ? `<span>${rtx(w.rating)}</span>` : ''}</div></div>`).join('') || '<p>Tidak ada karya yang cocok. Coba kata kunci atau kategori lain.</p>'}</div>`;
}

// ===== Pembaca PDF (canvas tajam, zoom, loncat halaman, komentar di laci) =====
let W = null, DOC = null, pg = 0, fin = false, zoom = 1, busy = 0, AL = [];
const b64u8 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const cget = async id => { try { const r = await (await caches.open('pdf')).match('/' + id); return r ? await r.json() : null; } catch (e) { return null; } };
const cput = async (id, o) => { try { await (await caches.open('pdf')).put('/' + id, new Response(JSON.stringify(o))); } catch (e) {} };
async function read(id) {
  app.innerHTML = `<a href="#/">← Semua karya</a><h1 class="ld">Membuka karya</h1><div id="stage"><p class="ld">Menyiapkan halaman</p></div>`;
  try {
    const cached = await cget(id), gP = api('get', { id }), pP = cached ? null : api('pdf', { id }); if (pP) pP.catch(() => {});
    W = await gP; let data;
    if (cached && cached.ver === W.updated) data = cached.data; else { data = await (pP || api('pdf', { id })); cput(id, { ver: W.updated, data }); }
    DOC = null; fin = false; zoom = 1; pg = Math.max(0, (+localStorage['pg_' + id] || 1) - 1);
    app.innerHTML = `<a href="#/">← Semua karya</a><h1>${esc(W.title)}</h1><div class="meta"><span>${esc(W.author)}</span>${cats(W).map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div><div id="mt"></div>
    <div id="vw"><div id="stage"><p class="ld">Menyiapkan halaman</p></div></div><div class="tb" id="tb"></div><div class="dr" id="dr"></div>`;
    drawMeta(); drawCm(); showPopups({ page: 'work', id, event: 'load' });
    DOC = await pdfjsLib.getDocument({ data: b64u8(data) }).promise; pg = Math.min(pg, DOC.numPages - 1);
    let x0 = 0; const vw = $('#vw'); vw.ontouchstart = e => x0 = e.touches[0].clientX; vw.ontouchend = e => { const d = e.changedTouches[0].clientX - x0; if (zoom === 1 && Math.abs(d) > 70) go(d < 0 ? 1 : -1); };
    await draw(false);
    if (!sessionStorage['h' + id]) { sessionStorage['h' + id] = 1; api('hit', { id }).catch(() => {}); }
  } catch (e) { fail(e.message, () => read(id)); }
}
function drawMeta() {
  const w = W; $('#mt').innerHTML = `<div class="bar"><button class="pri btn" onclick="fcs(true)">📖 Mode baca</button>${w.views !== undefined ? `<span class="meta">👁 ${w.views}x dibaca</span>` : ''}
  ${w.likes !== undefined ? `<button onclick="like()">${w.likedByMe ? '♥' : '♡'} ${w.likes}</button>` : ''}
  ${w.rating ? `<span class="stars">${stars(w.myRating, true)}</span><span class="meta">${rtx(w.rating)}</span>` : ''}
  ${w.share ? `<button onclick="share()">Bagikan</button>` : ''}</div>`;
}
function drawCm() {
  const w = W; $('#dr').innerHTML = w.comments === undefined ? '' : `<div class="drh"><h2>Komentar (${w.comments})</h2><button onclick="cdr()" aria-label="Tutup">✕</button></div><div class="drb">
  <label for="cn">Nama</label><input id="cn" maxlength="40"><label for="ct">Komentar</label><textarea id="ct" maxlength="1000" rows="3"></textarea><p><button class="pri btn" id="cb" onclick="comment()">Kirim komentar</button></p>
  <div id="cl">${(w.commentList || []).map(c => `<div class="cm"><b>${esc(c.name)}</b> <span class="meta">${new Date(c.ts).toLocaleDateString('id-ID')}</span><br>${br(c.text)}</div>`).join('') || '<p class="meta">Belum ada komentar. Jadilah yang pertama.</p>'}</div></div>`;
}
const cdr = () => $('#dr').classList.toggle('open');
function tbar() {
  const n = DOC.numPages;
  $('#tb').innerHTML = `<button onclick="go(-1)" ${pg < 1 ? 'disabled' : ''} aria-label="Sebelumnya">‹</button><span class="pn"><input id="pi" type="number" min="1" max="${n}" value="${pg + 1}" aria-label="Nomor halaman"> / ${n}</span><button onclick="go(1)" ${pg >= n - 1 ? 'disabled' : ''} aria-label="Berikutnya">›</button><span class="sp"></span>
  <button onclick="zm(-.25)" aria-label="Perkecil">−</button><span class="meta">${Math.round(zoom * 100)}%</span><button onclick="zm(.25)" aria-label="Perbesar">+</button><button onclick="fcs(!foc)" aria-label="Mode baca">${foc ? '✕ Keluar' : '📖'}</button>${W.comments !== undefined ? `<button onclick="cdr()" aria-label="Komentar">💬 ${W.comments}</button>` : ''}`;
  const i = $('#pi'); i.onchange = () => setPage((+i.value || 1) - 1, true); i.onkeydown = e => { if (e.key === 'Enter') i.blur(); };
}
// Mode baca: layar penuh, halaman pas di layar, ketuk tepi kiri/kanan untuk balik halaman, ketuk tengah untuk sembunyikan kontrol
function fcs(on) {
  foc = on; document.body.classList.toggle('foc', on); document.body.classList.remove('nobar'); zoom = 1;
  if (on) { document.documentElement.requestFullscreen?.().catch(() => {}); scrollTo(0, 0); } else if (document.fullscreenElement) document.exitFullscreen();
  draw(false);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && foc) fcs(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && foc) fcs(false); });
document.addEventListener('click', e => {
  if (!foc || zoom !== 1) return; const v = e.target.closest && e.target.closest('#vw'); if (!v) return;
  const r = v.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; if (x < .3) go(-1); else if (x > .7) go(1); else document.body.classList.toggle('nobar');
});
let rzW = 0, rzT; addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (DOC && innerWidth !== rzW) { rzW = innerWidth; draw(false); } }, 300); }); rzW = innerWidth;
async function draw(nav) {
  if (!DOC || !$('#stage')) return; const my = ++busy, st = $('#stage'), vw = $('#vw'); st.style.minHeight = st.offsetHeight + 'px';
  const p = await DOC.getPage(pg + 1), v0 = p.getViewport({ scale: 1 }), w = (foc ? Math.min(vw.clientWidth, (innerHeight - 72) * v0.width / v0.height) : Math.min(vw.clientWidth, 820)) * zoom, dpr = Math.min(devicePixelRatio || 1, 3);
  const pxw = Math.min(Math.max(w * dpr, 1500), 3400), vp = p.getViewport({ scale: pxw / v0.width }), c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; c.style.height = (w * vp.height / vp.width) + 'px';
  await p.render({ canvasContext: x, viewport: vp }).promise; if (my !== busy) return;
  x.save(); x.globalAlpha = .07; x.fillStyle = '#000'; x.font = `bold ${vp.width / 26}px sans-serif`; x.rotate(-.5);
  for (let yy = -vp.height; yy < vp.height * 1.5; yy += vp.width / 5) for (let xx = -vp.width; xx < vp.width * 1.5; xx += vp.width / 1.6) x.fillText(S.watermark || '', xx, yy); x.restore();
  st.replaceChildren(c); st.style.minHeight = ''; localStorage['pg_' + W.id] = pg + 1; tbar();
  if (nav) { const r = vw.getBoundingClientRect(); if (r.top < 60) scrollTo({ top: scrollY + r.top - 64 }); } // hanya naik bila bagian atas halaman sudah terlewat
  const n = DOC.numPages;
  if (pg === n - 1 && !fin) { fin = true; if (!sessionStorage['f' + W.id]) { sessionStorage['f' + W.id] = 1; api('finish', { id: W.id }).catch(() => {}); } showPopups({ page: 'work', id: W.id, event: 'finish' }); }
}
function setPage(n, nav) { if (!DOC) return; n = Math.min(Math.max(0, Math.round(n)), DOC.numPages - 1); if (n === pg && nav) { tbar(); return; } pg = n; draw(nav); }
const go = d => setPage(pg + d, true);
const zm = d => { zoom = Math.min(3, Math.max(.5, zoom + d)); draw(false); };
let lk = 0, rtb = 0, csb = 0;
const like = async () => { // tampilan langsung berubah, server menyusul
  if (lk) return; lk = 1; const was = W.likedByMe; W.likedByMe = !was; W.likes += was ? -1 : 1; drawMeta();
  try { const r = await api('like', { id: W.id }); W.likedByMe = r.liked; W.likes = r.likes; } catch (e) { W.likedByMe = was; W.likes += was ? 1 : -1; toast(e.message); }
  lk = 0; drawMeta();
};
const rate = async n => {
  if (rtb) return; rtb = 1; const old = W.myRating, r0 = { ...W.rating }; let cnt = r0.count, sum = r0.avg * cnt;
  if (old) sum += n - old; else { sum += n; cnt++; } W.rating = { avg: Math.round(sum / cnt * 10) / 10, count: cnt }; W.myRating = n; drawMeta();
  try { W.rating = await api('rate', { id: W.id, value: n }); toast('Terima kasih atas ratingnya'); } catch (e) { W.rating = r0; W.myRating = old; toast(e.message); }
  rtb = 0; drawMeta();
};
const comment = async () => {
  if (csb) return; const name = $('#cn').value.trim(), text = $('#ct').value.trim(); if (!name || !text) return toast('Nama dan komentar wajib diisi');
  csb = 1; const bt = $('#cb'); bt.disabled = true; bt.textContent = 'Mengirim...';
  const el = document.createElement('div'); el.className = 'cm'; el.innerHTML = `<b>${esc(name)}</b> <span class="meta">baru saja</span><br>${br(text)}`; $('#cl').prepend(el);
  try { await api('comment', { id: W.id, name, text }); W.commentList = [{ name, text, ts: new Date().toISOString() }, ...(W.commentList || [])]; W.comments++; drawCm(); $('#dr').classList.add('open'); tbar(); toast('Komentar terkirim'); }
  catch (e) { el.remove(); bt.disabled = false; bt.textContent = 'Kirim komentar'; toast(e.message); }
  csb = 0;
};
const share = async () => {
  const base = location.origin + location.pathname.replace(/[^/]*$/, ''); let u = location.href;
  try { const r = await fetch(base + 'k/' + W.id + '.html', { method: 'HEAD' }); if (r.ok) u = base + 'k/' + W.id + '.html'; } catch (e) {}
  try { if (navigator.share) await navigator.share({ title: W.title, url: u }); else { await navigator.clipboard.writeText(u); toast('Link disalin'); } } catch (e) {}
};

// ===== Admin =====
function login() {
  app.innerHTML = `<div class="admin" style="max-width:360px"><h1>Masuk admin</h1><label for="pw">Password</label><input id="pw" type="password"><p><button class="pri btn" onclick="doLogin()">Masuk</button></p></div>`;
  $('#pw').onkeydown = e => e.key === 'Enter' && doLogin();
}
const doLogin = guard(async () => { tok = await api('login', { password: $('#pw').value }); sessionStorage.tok = tok; route(); });
const logout = () => { tok = ''; sessionStorage.tok = ''; location.hash = '/'; };
const FEAT = [['sLikes', 'Like'], ['sComments', 'Komentar'], ['sViews', 'Dibaca'], ['sRating', 'Rating'], ['sShare', 'Bagikan']];
const fld = (l, h) => `<label>${l}</label>${h}`;
function admin(h) {
  if (h.startsWith('/admin/edit/')) return editor(h.slice(12)); if (h === '/admin/new') return editor('');
  if (h.startsWith('/admin/popup/')) return popEd(h.slice(13)); if (h === '/admin/popup') return popEd('');
  dash();
}
const dash = guard(async () => {
  app.innerHTML = '<p class="ld">Memuat</p>';
  const nav = `<h1>Dasbor admin</h1><div class="tabs">${[['karya', 'Karya'], ['popup', 'Pengumuman & popup'], ['set', 'Pengaturan']].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" onclick="tab='${k}';dash()">${t}</button>`).join('')}<button onclick="logout()">Keluar</button></div>`;
  if (tab === 'karya') {
    const L = AL = await api('adminList'), sm = k => L.reduce((a, w) => a + (+w.real[k] || 0), 0);
    app.innerHTML = `<div class="admin">${nav}<div class="sum"><div><b>${L.length}</b>karya</div><div><b>${sm('views')}</b>total dibaca</div><div><b>${sm('finished')}</b>selesai dibaca</div><div><b>${sm('likes')}</b>like</div><div><b>${sm('comments')}</b>komentar</div></div>
    <p><a class="btn pri" href="#/admin/new">+ Karya baru</a></p><p class="meta">Saklar hanya mengatur apa yang terlihat pembaca. Angka asli selalu tersimpan.</p>
    <div class="scroll"><table><tr><th>Karya</th><th>Status</th><th>Dibaca / selesai</th><th>Like</th><th>Komentar</th><th>Rating</th><th>Tampilkan ke publik</th><th></th></tr>
    ${L.map(w => `<tr><td>${w.cover ? `<img class="thumb" src="${cvu(w.cover, 300)}" alt=""><br>` : ''}<b>${esc(w.title)}</b><br><span class="meta">${w.type === 'ilmiah' ? 'Jurnal' : 'Sastra'} · ${w.pages || '?'} hal</span></td>
    <td><select onchange="setSt('${w.id}',this.value)"><option value="published" ${w.status === 'published' ? 'selected' : ''}>Terbit</option><option value="hidden" ${w.status === 'hidden' ? 'selected' : ''}>Disembunyikan sementara</option><option value="draft" ${w.status === 'draft' ? 'selected' : ''}>Draf</option></select></td>
    <td>${w.real.views} / ${w.real.finished}</td><td>${w.type === 'ilmiah' ? '-' : w.real.likes}</td><td>${w.type === 'ilmiah' ? '-' : w.real.comments}</td><td>${rtx(w.real.rating)}</td>
    <td>${FEAT.filter(([k]) => !(w.type === 'ilmiah' && ['sLikes', 'sComments'].includes(k))).map(([k, t]) => `<label class="i"><input type="checkbox" ${w[k] ? 'checked' : ''} onchange="tg('${w.id}','${k}',this.checked)">${t}</label>`).join('')}</td>
    <td><a class="btn" href="#/admin/edit/${w.id}">Edit</a> <button onclick="poster('${w.id}')">Poster</button> <a class="btn" href="#/w/${w.id}" target="_blank">Lihat</a></td></tr>`).join('') || '<tr><td colspan="8">Belum ada karya. Klik "Karya baru".</td></tr>'}</table></div></div>`;
  } else if (tab === 'popup') {
    const L = await api('popupList');
    app.innerHTML = `<div class="admin">${nav}<p><a class="btn pri" href="#/admin/popup">+ Pengumuman baru</a> <button onclick="pall()">Pilih semua</button> <button class="bad" onclick="pdelSel()">Hapus terpilih</button></p><div class="scroll"><table><tr><th>Judul</th><th>Tempat & pemicu</th><th>Jadwal</th><th>Aktif</th><th></th></tr>
    ${L.map(p => `<tr id="pr_${p.id}"><td><input type="checkbox" class="ps" value="${p.id}" style="width:auto" aria-label="Pilih"> <b>${esc(p.title || p.body.slice(0, 40))}</b><br><span class="meta">${p.style === 'banner' ? 'Banner' : 'Popup'}</span></td><td>${{ home: 'Beranda', works: p.workIds ? 'Karya tertentu' : 'Semua karya', all: 'Semua halaman' }[p.placement]} · ${p.trigger === 'finish' ? 'selesai membaca' : 'saat dibuka'}</td>
    <td>${p.startDate || '...'} s/d ${p.endDate || '...'}<br>${p.startTime || '00:00'}-${p.endTime || '23:59'}</td><td><input type="checkbox" style="width:auto" ${p.active ? 'checked' : ''} onchange="ptg('${p.id}',this.checked)"></td>
    <td><a class="btn" href="#/admin/popup/${p.id}">Edit</a> <button class="bad" onclick="pdel('${p.id}')">Hapus</button></td></tr>`).join('') || '<tr><td colspan="5">Belum ada pengumuman.</td></tr>'}</table></div></div>`;
  } else {
    const s = await api('getSettings');
    app.innerHTML = `<div class="admin">${nav}${fld('Nama situs', `<input id="s_site_name" value="${esc(s.site_name)}">`)}${fld('Tagline beranda', `<input id="s_tagline" value="${esc(s.tagline)}">`)}${fld('Teks footer', `<input id="s_footer" value="${esc(s.footer)}">`)}${fld('Teks watermark (menempel di gambar halaman)', `<input id="s_watermark" value="${esc(s.watermark)}">`)}
    <label class="i" style="margin-top:14px"><input type="checkbox" id="s_maintenance" ${s.maintenance ? 'checked' : ''}>Mode pemeliharaan (pembaca melihat pesan di bawah; admin tetap bisa masuk)</label>${fld('Pesan pemeliharaan', `<textarea id="s_maintenance_msg" rows="3">${esc(s.maintenance_msg)}</textarea>`)}
    <p><button class="pri btn" onclick="saveSet()">Simpan pengaturan</button></p><h2>Ganti password admin</h2>${fld('Password baru (min. 6 karakter)', '<input id="np" type="password">')}<p><button onclick="setPw()">Ganti password</button></p></div>`;
  }
});
const setSt = guard(async (id, status) => { await api('status', { id, status }); toast('Status diubah'); });
const tg = guard(async (id, key, value) => { await api('toggle', { id, key, value }); toast(value ? 'Ditampilkan' : 'Disembunyikan'); });
const ptg = guard(async (id, value) => { await api('popupToggle', { id, value }); toast(value ? 'Diaktifkan' : 'Dinonaktifkan'); });
const pdel = async id => { if (!confirm('Hapus pengumuman ini?')) return; document.getElementById('pr_' + id)?.remove(); try { await api('popupDel', { id }); toast('Dihapus'); } catch (e) { toast(e.message); dash(); } };
const pall = () => { const a = [...document.querySelectorAll('.ps')], all = a.every(x => x.checked); a.forEach(x => x.checked = !all); };
const pdelSel = async () => { const ids = [...document.querySelectorAll('.ps:checked')].map(x => x.value); if (!ids.length) return toast('Pilih pengumuman dulu'); if (!confirm('Hapus ' + ids.length + ' pengumuman?')) return; ids.forEach(id => document.getElementById('pr_' + id)?.remove()); try { await api('popupDelMany', { ids }); toast(ids.length + ' pengumuman dihapus'); } catch (e) { toast(e.message); dash(); } };
const saveSet = guard(async () => { const s = {}; ['site_name', 'tagline', 'footer', 'watermark', 'maintenance_msg'].forEach(k => s[k] = $('#s_' + k).value); s.maintenance = $('#s_maintenance').checked; await api('saveSettings', { s }); toast('Tersimpan. Muat ulang halaman untuk melihat perubahan.'); });
const setPw = guard(async () => { await api('setPass', { password: $('#np').value }); toast('Password diganti'); });

// ---- Editor karya ----
let PDFB = null, COVER = null, PAGES = 0;
const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
async function mkCover(pn) {
  const d = await pdfjsLib.getDocument({ data: PDFB.slice(0) }).promise; PAGES = d.numPages;
  const p = await d.getPage(Math.min(Math.max(1, pn), d.numPages)), v = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: 600 / v.width }), c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height; await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  COVER = c.toDataURL('image/jpeg', .88); $('#cvp').src = COVER; $('#cvp').hidden = false;
}
const editor = guard(async id => {
  PDFB = null; COVER = null; PAGES = 0; app.innerHTML = '<p class="ld">Memuat</p>';
  const w = id ? await api('adminGet', { id }) : { type: 'sastra', status: 'draft', commentList: [] };
  app.innerHTML = `<div class="admin"><a href="#/admin">← Dasbor</a><h1>${id ? 'Edit karya' : 'Karya baru'}</h1>
  <div class="row2">${fld('Jenis', '<select id="f_type"><option value="sastra">Karya sastra (novel, cerpen, puisi)</option><option value="ilmiah">Artikel ilmiah (jurnal)</option></select>')}${fld('Status', '<select id="f_status"><option value="published">Terbit</option><option value="hidden">Disembunyikan sementara</option><option value="draft">Draf</option></select>')}</div>
  ${fld('Judul', `<input id="f_title" value="${esc(w.title)}">`)}<div class="row2">${fld('Penulis', `<input id="f_author" value="${esc(w.author)}">`)}${fld('Kategori (pisahkan dengan koma)', `<input id="f_category" value="${esc(w.category)}" placeholder="Romansa, Fiksi">`)}</div>
  ${fld('Sinopsis / abstrak', `<textarea id="f_synopsis" rows="4">${esc(w.synopsis)}</textarea>`)}
  ${fld(id ? 'Ganti file PDF (kosongkan jika tidak diganti)' : 'File PDF', '<input type="file" id="f_pdf" accept="application/pdf">')}
  <div class="row2">${fld('Halaman yang dijadikan sampul', '<input id="f_cp" type="number" min="1" value="1">')}<div><label>&nbsp;</label><button onclick="regen()">Buat ulang sampul</button></div></div>
  <img id="cvp" class="thumb" style="width:140px;margin-top:10px" ${w.cover ? `src="${cvu(w.cover, 300)}"` : 'hidden'} alt="Sampul"><p class="meta">Sampul otomatis diambil dari halaman PDF. Maksimal ukuran PDF sebaiknya di bawah 20 MB.</p>
  <p><button class="pri btn" onclick="saveW('${id}')">Simpan</button> ${id ? `<button class="bad" onclick="delW('${id}')">Hapus karya</button> <a href="${w.fileUrl}" target="_blank">Buka PDF di Drive</a><br><br><button onclick="poster('${id}')">Unduh poster promosi</button> <button onclick="sharePage('${id}')">Unduh halaman share (preview WhatsApp)</button>` : ''}</p>
  ${id ? `<h2>Komentar (${w.commentList.length})</h2>${w.commentList.map(c => `<div class="cm" ${c.hidden ? 'style="opacity:.5"' : ''}><b>${esc(c.name)}</b> <span class="meta">${new Date(c.ts).toLocaleDateString('id-ID')}</span><br>${br(c.text)}<br><button onclick="cmt('cmtHide','${c.id}','${id}')">${c.hidden ? 'Tampilkan' : 'Sembunyikan'}</button> <button class="bad" onclick="cmt('cmtDel','${c.id}','${id}')">Hapus</button></div>`).join('') || '<p class="meta">Belum ada komentar.</p>'}` : ''}</div>`;
  $('#f_type').value = w.type; $('#f_status').value = w.status;
  $('#f_pdf').onchange = guard(async e => { const f = e.target.files[0]; if (!f) return; PDFB = new Uint8Array(await f.arrayBuffer()); await mkCover(+$('#f_cp').value || 1); toast('PDF dibaca: ' + PAGES + ' halaman'); });
});
const regen = guard(async () => { if (!PDFB) throw new Error('Pilih file PDF dulu'); await mkCover(+$('#f_cp').value || 1); });
const saveW = guard(async id => {
  const g = k => $('#f_' + k).value;
  const nid = await api('save', { work: { id, type: g('type'), title: g('title'), author: g('author'), category: g('category'), synopsis: g('synopsis'), status: g('status'), pdf: PDFB ? toB64(PDFB) : '', cover: COVER || '', pages: PAGES || '' } });
  toast('Tersimpan'); location.hash = '/admin/edit/' + nid; if (id) editor(id);
});
const delW = guard(async id => { if (!confirm('Hapus karya ini beserta file PDF-nya? Tidak bisa dibatalkan.')) return; await api('remove', { id }); location.hash = '/admin'; });
const cmt = guard(async (a, cid, id) => { await api(a, { cid }); editor(id); });

// ---- Editor popup ----
const popEd = guard(async id => {
  app.innerHTML = '<p class="ld">Memuat</p>'; const [L, W2] = [await api('popupList'), await api('adminList')];
  const p = L.find(x => x.id === id) || { style: 'popup', placement: 'home', trigger: 'load', frequency: 'session', active: true, workIds: '', days: '' };
  const ids = p.workIds.split(','), dy = p.days.split(',');
  app.innerHTML = `<div class="admin"><a href="#/admin">← Dasbor</a><h1>${id ? 'Edit' : 'Buat'} pengumuman</h1>
  ${fld('Judul', `<input id="p_title" value="${esc(p.title)}">`)}${fld('Isi pengumuman', `<textarea id="p_body" rows="4">${esc(p.body)}</textarea>`)}${fld('URL gambar (opsional)', `<input id="p_imageUrl" value="${esc(p.imageUrl)}">`)}
  <div class="row2">${fld('Tampilan', `<select id="p_style"><option value="popup">Popup (jendela)</option><option value="banner">Banner di atas halaman</option></select>`)}${fld('Muncul di', `<select id="p_placement"><option value="home">Beranda</option><option value="works">Halaman karya</option><option value="all">Semua halaman</option></select>`)}</div>
  ${fld('Khusus karya tertentu (kosong = semua karya; berlaku bila "Halaman karya")', W2.map(w => `<label class="i"><input type="checkbox" class="pw" value="${w.id}" ${ids.includes(w.id) ? 'checked' : ''}>${esc(w.title)}</label>`).join('') || '<span class="meta">Belum ada karya</span>')}
  <div class="row2">${fld('Pemicu', `<select id="p_trigger"><option value="load">Saat halaman dibuka</option><option value="finish">Saat pembaca selesai membaca (halaman terakhir)</option></select>`)}${fld('Seberapa sering muncul', `<select id="p_frequency"><option value="always">Setiap kali</option><option value="session">Sekali per kunjungan</option><option value="daily">Sekali per hari</option><option value="once">Sekali saja per pembaca</option></select>`)}</div>
  <div class="row2">${fld('Tanggal mulai', `<input type="date" id="p_startDate" value="${esc(p.startDate)}">`)}${fld('Tanggal selesai', `<input type="date" id="p_endDate" value="${esc(p.endDate)}">`)}</div>
  <div class="row2">${fld('Jam mulai (WIB)', `<input type="time" id="p_startTime" value="${esc(p.startTime)}">`)}${fld('Jam selesai (WIB)', `<input type="time" id="p_endTime" value="${esc(p.endTime)}">`)}</div>
  ${fld('Hari tayang (kosong = setiap hari)', ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((n, i) => `<label class="i"><input type="checkbox" class="pd" value="${i + 1}" ${dy.includes(String(i + 1)) ? 'checked' : ''}>${n}</label>`).join(''))}
  <div class="row2">${fld('Teks tombol (opsional)', `<input id="p_btnText" value="${esc(p.btnText)}">`)}${fld('Link tombol (opsional)', `<input id="p_btnUrl" value="${esc(p.btnUrl)}">`)}</div>
  <label class="i" style="margin-top:12px"><input type="checkbox" id="p_active" ${p.active ? 'checked' : ''}>Aktif</label>
  <p><button class="pri btn" onclick="savePop('${id}')">Simpan</button> <button onclick="prevPop()">Pratinjau</button></p></div>`;
  ['style', 'placement', 'trigger', 'frequency'].forEach(k => $('#p_' + k).value = p[k]);
});
const popData = () => { const o = {}; ['title', 'body', 'imageUrl', 'style', 'placement', 'trigger', 'frequency', 'startDate', 'endDate', 'startTime', 'endTime', 'btnText', 'btnUrl'].forEach(k => o[k] = $('#p_' + k).value); o.workIds = [...document.querySelectorAll('.pw:checked')].map(x => x.value).join(','); o.days = [...document.querySelectorAll('.pd:checked')].map(x => x.value).join(','); o.active = $('#p_active').checked; o.btnUrl = nu(o.btnUrl); return o; };
const prevPop = () => { pq = [popData()]; ptot = 1; nextPop(); };
const savePop = guard(async id => { const d = popData(); d.id = id; await api('popupSave', { popup: d }); toast('Tersimpan'); tab = 'popup'; location.hash = '/admin'; dash(); });

// ---- Poster promosi (1080x1920, cocok untuk status WhatsApp) & halaman share ----
const lines = (x, t, mw) => { const o = []; let l = ''; for (const w of String(t).split(/\s+/)) { const q = l ? l + ' ' + w : w; if (x.measureText(q).width > mw && l) { o.push(l); l = w; } else l = q; } if (l) o.push(l); return o; };
const para = (x, t, y, mw, lh, max) => { let L = lines(x, t, mw); if (L.length > max) { L = L.slice(0, max); L[max - 1] = L[max - 1].replace(/\s*\S*$/, '') + '…'; } L.forEach(l => { x.fillText(l, 540, y); y += lh; }); return y; };
const getW = async id => AL.find(x => x.id === id) || await api('adminGet', { id });
const poster = guard(async id => {
  const w = await getW(id); if (!w.cover) throw new Error('Karya belum punya sampul'); toast('Membuat poster...');
  const src = String(w.cover).startsWith('data:') ? w.cover : await api('coverData', { id });
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
  const t = document.createElement('canvas'); t.width = t.height = 1; const tx = t.getContext('2d'); tx.drawImage(img, 0, 0, 1, 1); const [r, g, b] = tx.getImageData(0, 0, 1, 1).data;
  const gr = x.createLinearGradient(0, 0, 0, 1920); gr.addColorStop(0, `rgb(${r * .6 | 0},${g * .6 | 0},${b * .6 | 0})`); gr.addColorStop(1, '#0b1418'); x.fillStyle = gr; x.fillRect(0, 0, 1080, 1920);
  x.textAlign = 'center'; x.fillStyle = '#f0b43a'; x.font = '700 40px Figtree,sans-serif'; x.fillText('✦  RILIS BARU  ✦', 540, 130);
  const cw = 620, ch = cw * img.height / img.width, cy = 190; x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 70; x.shadowOffsetY = 30; x.drawImage(img, (1080 - cw) / 2, cy, cw, ch); x.shadowColor = 'transparent';
  let y = cy + ch + 100; x.fillStyle = '#fff'; x.font = '700 68px Literata,Georgia,serif'; y = para(x, w.title, y, 900, 80, 3);
  x.fillStyle = '#f0b43a'; x.font = '600 38px Figtree,sans-serif'; x.fillText('oleh ' + (w.author || ''), 540, y + 4); y += 70;
  x.fillStyle = 'rgba(255,255,255,.82)'; x.font = '400 34px Figtree,sans-serif'; para(x, w.synopsis || '', y, 860, 48, 4);
  x.fillStyle = '#f0b43a'; const bw = 820, bx = (1080 - bw) / 2; x.beginPath(); x.roundRect ? x.roundRect(bx, 1700, bw, 120, 60) : x.rect(bx, 1700, bw, 120); x.fill();
  x.fillStyle = '#241a00'; x.font = '700 40px Figtree,sans-serif'; x.fillText('Baca gratis sekarang', 540, 1752); x.font = '500 30px Figtree,sans-serif'; x.fillText(location.host + location.pathname.replace(/\/$/, ''), 540, 1796);
  c.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'poster-' + String(w.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.png'; a.click(); toast('Poster diunduh'); }, 'image/png');
});
const sharePage = guard(async id => {
  const w = await getW(id), base = location.origin + location.pathname.replace(/[^/]*$/, ''), u = base + '#/w/' + id;
  const img = w.cover && !String(w.cover).startsWith('data:') ? `https://lh3.googleusercontent.com/d/${w.cover}=w800` : '';
  const t = esc(w.title), d = esc(String(w.synopsis || 'Baca karya ini gratis.').slice(0, 180));
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${t}</title><meta name="viewport" content="width=device-width,initial-scale=1"><meta property="og:type" content="book"><meta property="og:site_name" content="${esc(S.site_name)}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}">${img ? `<meta property="og:image" content="${img}"><meta name="twitter:card" content="summary_large_image">` : ''}<meta property="og:url" content="${base}k/${id}.html"><meta http-equiv="refresh" content="0;url=${u}"></head><body><p>Membuka karya... <a href="${u}">klik di sini</a></p><script>location.replace(${JSON.stringify(u)})<\/script></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = id + '.html'; a.click();
  toast(img ? 'Upload file ' + id + '.html ke folder k/ di GitHub' : 'Sampul belum tersimpan di Drive: simpan ulang karya dulu agar gambar preview muncul');
});
