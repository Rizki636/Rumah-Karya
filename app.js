/* RUMAH KARYA v2 - app.js (seluruh logika tampilan: pembaca, beranda, admin, popup) */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const $ = s => document.querySelector(s), app = $('#app');
const vid = localStorage.vid || (localStorage.vid = crypto.randomUUID());
let tok = sessionStorage.tok || '', S = {}, POP = [], ALL = [], F = { type: 'all', cat: '', q: '', sort: 'new' }, tab = 'karya';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2600); };
async function api(action, data = {}) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify({ action, token: tok, visitor: vid, ...data }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error); return j.data;
}
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
(async () => {
  try { const r = await api('boot'); S = r.settings; POP = r.popups; document.title = S.site_name; $('#brand').textContent = S.site_name; $('#foot').textContent = S.footer; }
  catch (e) { app.innerHTML = `<p>Gagal terhubung: ${esc(e.message)}. Cek URL API di config.js.</p>`; return; }
  onhashchange = route; route();
})();
function route() {
  const h = location.hash.slice(1) || '/'; $('#who').textContent = tok ? 'Mode admin' : '';
  if (h.startsWith('/admin')) return tok ? admin(h) : login();
  if (S.maintenance && !tok) { app.innerHTML = `<h1>Sedang pemeliharaan</h1><p>${br(S.maintenance_msg)}</p><p><a href="#/admin">Masuk admin</a></p>`; return; }
  if (h.startsWith('/w/')) return read(h.slice(3));
  home();
}

// ===== Popup / pengumuman =====
function freqOk(p) {
  const k = 'pp_' + p.id, f = p.frequency, today = new Date().toISOString().slice(0, 10);
  if (f === 'session') return !sessionStorage[k]; if (f === 'once') return !localStorage[k]; if (f === 'daily') return localStorage[k] !== today; return true;
}
function showPopups(c) {
  POP.filter(p => {
    if (p.trigger !== c.event) return false;
    if (p.trigger === 'finish' && c.page !== 'work') return false;
    if (p.placement === 'home' && c.page !== 'home') return false;
    if (p.placement === 'works' && (c.page !== 'work' || (p.workIds && !p.workIds.split(',').includes(c.id)))) return false;
    return freqOk(p);
  }).forEach(p => { const k = 'pp_' + p.id; sessionStorage[k] = 1; localStorage[k] = new Date().toISOString().slice(0, 10); drawPop(p); });
}
function drawPop(p) {
  const btn = p.btnUrl ? `<a class="btn pri" href="${esc(p.btnUrl)}" target="_blank" rel="noopener">${esc(p.btnText || 'Buka')}</a>` : '';
  const body = `${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="">` : ''}${p.title ? `<h2>${esc(p.title)}</h2>` : ''}<p>${br(p.body)}</p>`;
  if (p.style === 'banner') { const d = document.createElement('div'); d.className = 'banner'; d.innerHTML = `<div><b>${esc(p.title)}</b> ${br(p.body)} ${btn}</div><button onclick="this.parentNode.remove()" aria-label="Tutup">✕</button>`; app.prepend(d); return; }
  const o = document.createElement('div'); o.className = 'ov'; o.innerHTML = `<div class="pop" role="dialog">${body}<p>${btn} <button onclick="this.closest('.ov').remove()">Tutup</button></p></div>`; o.onclick = e => e.target === o && o.remove(); document.body.append(o);
}

// ===== Beranda =====
const home = guard(async () => {
  app.innerHTML = '<p>Memuat karya...</p>'; ALL = await api('list');
  const cs = [...new Set(ALL.flatMap(cats))].sort();
  app.innerHTML = `<h1>${esc(S.site_name)}</h1><p class="meta">${esc(S.tagline)}</p>
  <div class="tools"><input id="q" type="search" placeholder="Cari judul, penulis, atau kata kunci..." aria-label="Cari" value="${esc(F.q)}"><select id="so" aria-label="Urutkan"><option value="new">Terbaru</option><option value="az">Judul A-Z</option></select></div>
  <div class="tabs">${[['all','Semua'],['sastra','Karya sastra'],['ilmiah','Jurnal']].map(([k, t]) => `<button class="${F.type === k ? 'on' : ''}" onclick="F.type='${k}';home()">${t}</button>`).join('')}</div>
  ${cs.length ? `<div class="tabs" id="cats"><button class="${!F.cat ? 'on' : ''}" onclick="F.cat='';grid()">Semua kategori</button>${cs.map(c => `<button class="${F.cat === c ? 'on' : ''}" onclick="F.cat=this.textContent;grid()">${esc(c)}</button>`).join('')}</div>` : ''}
  <div id="gr"></div><p style="margin-top:50px"><a href="#/admin" style="color:var(--mute);font-size:13px">Masuk admin</a></p>`;
  $('#so').value = F.sort; $('#q').oninput = e => { F.q = e.target.value; grid(); }; $('#so').onchange = e => { F.sort = e.target.value; grid(); };
  grid(); showPopups({ page: 'home', event: 'load' });
});
function grid() {
  const q = F.q.toLowerCase(); document.querySelectorAll('#cats button').forEach(x => x.classList.toggle('on', (x.textContent === F.cat) || (!F.cat && x.textContent === 'Semua kategori')));
  let L = ALL.filter(w => (F.type === 'all' || w.type === F.type) && (!F.cat || cats(w).includes(F.cat)) && (!q || [w.title, w.author, w.synopsis, w.category].join(' ').toLowerCase().includes(q)));
  if (F.sort === 'az') L = [...L].sort((a, b) => a.title.localeCompare(b.title));
  $('#gr').innerHTML = `<div class="grid">${L.map(w => `<div class="card" tabindex="0" onclick="location.hash='/w/${w.id}'" onkeydown="if(event.key==='Enter')this.click()">
    ${w.cover ? `<img class="cv" src="${w.cover}" alt="Sampul ${esc(w.title)}" draggable="false">` : `<div class="cv">${esc(w.title)}</div>`}
    <span class="tag">${w.type === 'ilmiah' ? 'Jurnal' : 'Sastra'}</span><h3>${esc(w.title)}</h3><div class="meta">${esc(w.author)}</div>
    <div class="meta">${w.likes !== undefined ? `<span>♥ ${w.likes}</span>` : ''}${w.comments !== undefined ? `<span>💬 ${w.comments}</span>` : ''}${w.views !== undefined ? `<span>👁 ${w.views}</span>` : ''}${w.rating ? `<span>${rtx(w.rating)}</span>` : ''}</div></div>`).join('') || '<p>Tidak ada karya yang cocok. Coba kata kunci atau kategori lain.</p>'}</div>`;
}

// ===== Pembaca PDF (digambar ke canvas, tanpa teks yang bisa diseleksi, dengan watermark) =====
let W = null, DOC = null, pg = 0, fin = false;
const b64u8 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const read = guard(async id => {
  app.innerHTML = '<p>Memuat...</p>'; W = await api('get', { id }); DOC = null; fin = false;
  pg = Math.max(0, (+localStorage['pg_' + id] || 1) - 1);
  app.innerHTML = `<a href="#/">← Semua karya</a><h1>${esc(W.title)}</h1><div class="meta"><span>${esc(W.author)}</span>${cats(W).map(c => `<span>${esc(c)}</span>`).join('')}</div><div id="mt"></div>
  <div id="stage"><p id="ld">Mengunduh karya... mohon tunggu.</p></div><div class="pager" id="pgr"></div><div id="cm"></div>`;
  drawMeta(); drawCm(); showPopups({ page: 'work', id, event: 'load' });
  if (!sessionStorage['h' + id]) { sessionStorage['h' + id] = 1; api('hit', { id }).catch(() => {}); }
  DOC = await pdfjsLib.getDocument({ data: b64u8(await api('pdf', { id })) }).promise; pg = Math.min(pg, DOC.numPages - 1); draw();
});
function drawMeta() {
  const w = W; $('#mt').innerHTML = `<div class="bar">${w.views !== undefined ? `<span class="meta">👁 ${w.views}x dibaca</span>` : ''}
  ${w.likes !== undefined ? `<button onclick="like()">${w.likedByMe ? '♥' : '♡'} ${w.likes}</button>` : ''}
  ${w.rating ? `<span class="stars">${stars(w.myRating, true)}</span><span class="meta">${rtx(w.rating)}</span>` : ''}
  ${w.share ? `<button onclick="share()">Bagikan</button>` : ''}</div>`;
}
function drawCm() {
  const w = W; $('#cm').innerHTML = w.comments === undefined ? '' : `<h2>Komentar (${w.comments})</h2><label for="cn">Nama</label><input id="cn" maxlength="40"><label for="ct">Komentar</label><textarea id="ct" maxlength="1000" rows="3"></textarea><p><button class="pri btn" onclick="comment()">Kirim komentar</button></p>
  ${(w.commentList || []).map(c => `<div class="cm"><b>${esc(c.name)}</b> <span class="meta">${new Date(c.ts).toLocaleDateString('id-ID')}</span><br>${br(c.text)}</div>`).join('')}`;
}
async function draw() {
  if (!DOC) return; const p = await DOC.getPage(pg + 1), w = Math.min($('#stage').clientWidth || 800, 900), v0 = p.getViewport({ scale: 1 });
  const vp = p.getViewport({ scale: w / v0.width * Math.min(devicePixelRatio || 1, 2) }), c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; await p.render({ canvasContext: x, viewport: vp }).promise;
  x.save(); x.globalAlpha = .09; x.fillStyle = '#000'; x.font = `bold ${vp.width / 26}px sans-serif`; x.rotate(-.5);
  for (let yy = -vp.height; yy < vp.height * 1.5; yy += vp.width / 5) for (let xx = -vp.width; xx < vp.width * 1.5; xx += vp.width / 1.6) x.fillText(S.watermark || '', xx, yy); x.restore();
  $('#stage').replaceChildren(c); const n = DOC.numPages; localStorage['pg_' + W.id] = pg + 1;
  $('#pgr').innerHTML = `<button onclick="go(-1)" ${pg === 0 ? 'disabled' : ''}>←</button><span>Halaman ${pg + 1} / ${n}</span><button onclick="go(1)" ${pg >= n - 1 ? 'disabled' : ''}>→</button>`;
  if (pg === n - 1 && !fin) { fin = true; if (!sessionStorage['f' + W.id]) { sessionStorage['f' + W.id] = 1; api('finish', { id: W.id }).catch(() => {}); } showPopups({ page: 'work', id: W.id, event: 'finish' }); }
}
function go(d) { if (!DOC || !$('#stage')) return; const n = pg + d; if (n < 0 || n >= DOC.numPages) return; pg = n; draw(); scrollTo(0, 0); }
const like = guard(async () => { const r = await api('like', { id: W.id }); W.likedByMe = r.liked; W.likes = r.likes; drawMeta(); });
const rate = guard(async n => { W.rating = await api('rate', { id: W.id, value: n }); W.myRating = n; drawMeta(); toast('Terima kasih atas ratingnya'); });
const comment = guard(async () => { await api('comment', { id: W.id, name: $('#cn').value, text: $('#ct').value }); toast('Komentar terkirim'); W = await api('get', { id: W.id }); drawMeta(); drawCm(); });
const share = async () => { const u = location.href; try { if (navigator.share) await navigator.share({ title: W.title, url: u }); else { await navigator.clipboard.writeText(u); toast('Link disalin'); } } catch (e) {} };

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
  app.innerHTML = '<p>Memuat...</p>';
  const nav = `<h1>Dasbor admin</h1><div class="tabs">${[['karya', 'Karya'], ['popup', 'Pengumuman & popup'], ['set', 'Pengaturan']].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" onclick="tab='${k}';dash()">${t}</button>`).join('')}<button onclick="logout()">Keluar</button></div>`;
  if (tab === 'karya') {
    const L = await api('adminList'), sm = k => L.reduce((a, w) => a + (+w.real[k] || 0), 0);
    app.innerHTML = `<div class="admin">${nav}<div class="sum"><div><b>${L.length}</b>karya</div><div><b>${sm('views')}</b>total dibaca</div><div><b>${sm('finished')}</b>selesai dibaca</div><div><b>${sm('likes')}</b>like</div><div><b>${sm('comments')}</b>komentar</div></div>
    <p><a class="btn pri" href="#/admin/new">+ Karya baru</a></p><p class="meta">Saklar hanya mengatur apa yang terlihat pembaca. Angka asli selalu tersimpan.</p>
    <div class="scroll"><table><tr><th>Karya</th><th>Status</th><th>Dibaca / selesai</th><th>Like</th><th>Komentar</th><th>Rating</th><th>Tampilkan ke publik</th><th></th></tr>
    ${L.map(w => `<tr><td>${w.cover ? `<img class="thumb" src="${w.cover}" alt=""><br>` : ''}<b>${esc(w.title)}</b><br><span class="meta">${w.type === 'ilmiah' ? 'Jurnal' : 'Sastra'} · ${w.pages || '?'} hal</span></td>
    <td><select onchange="setSt('${w.id}',this.value)"><option value="published" ${w.status === 'published' ? 'selected' : ''}>Terbit</option><option value="hidden" ${w.status === 'hidden' ? 'selected' : ''}>Disembunyikan sementara</option><option value="draft" ${w.status === 'draft' ? 'selected' : ''}>Draf</option></select></td>
    <td>${w.real.views} / ${w.real.finished}</td><td>${w.type === 'ilmiah' ? '-' : w.real.likes}</td><td>${w.type === 'ilmiah' ? '-' : w.real.comments}</td><td>${rtx(w.real.rating)}</td>
    <td>${FEAT.filter(([k]) => !(w.type === 'ilmiah' && ['sLikes', 'sComments'].includes(k))).map(([k, t]) => `<label class="i"><input type="checkbox" ${w[k] ? 'checked' : ''} onchange="tg('${w.id}','${k}',this.checked)">${t}</label>`).join('')}</td>
    <td><a class="btn" href="#/admin/edit/${w.id}">Edit</a> <a class="btn" href="#/w/${w.id}" target="_blank">Lihat</a></td></tr>`).join('') || '<tr><td colspan="8">Belum ada karya. Klik "Karya baru".</td></tr>'}</table></div></div>`;
  } else if (tab === 'popup') {
    const L = await api('popupList');
    app.innerHTML = `<div class="admin">${nav}<p><a class="btn pri" href="#/admin/popup">+ Pengumuman baru</a></p><div class="scroll"><table><tr><th>Judul</th><th>Tempat & pemicu</th><th>Jadwal</th><th>Aktif</th><th></th></tr>
    ${L.map(p => `<tr><td><b>${esc(p.title || p.body.slice(0, 40))}</b><br><span class="meta">${p.style === 'banner' ? 'Banner' : 'Popup'}</span></td><td>${{ home: 'Beranda', works: p.workIds ? 'Karya tertentu' : 'Semua karya', all: 'Semua halaman' }[p.placement]} · ${p.trigger === 'finish' ? 'selesai membaca' : 'saat dibuka'}</td>
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
const pdel = guard(async id => { if (confirm('Hapus pengumuman ini?')) { await api('popupDel', { id }); dash(); } });
const saveSet = guard(async () => { const s = {}; ['site_name', 'tagline', 'footer', 'watermark', 'maintenance_msg'].forEach(k => s[k] = $('#s_' + k).value); s.maintenance = $('#s_maintenance').checked; await api('saveSettings', { s }); toast('Tersimpan. Muat ulang halaman untuk melihat perubahan.'); });
const setPw = guard(async () => { await api('setPass', { password: $('#np').value }); toast('Password diganti'); });

// ---- Editor karya ----
let PDFB = null, COVER = null, PAGES = 0;
const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
async function mkCover(pn) {
  const d = await pdfjsLib.getDocument({ data: PDFB.slice(0) }).promise; PAGES = d.numPages;
  const p = await d.getPage(Math.min(Math.max(1, pn), d.numPages)), v = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: 300 / v.width }), c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height; await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  let q = .75, u; do { u = c.toDataURL('image/jpeg', q); q -= .1; } while (u.length > 45000 && q > .2); COVER = u; $('#cvp').src = u; $('#cvp').hidden = false;
}
const editor = guard(async id => {
  PDFB = null; COVER = null; PAGES = 0;
  const w = id ? await api('adminGet', { id }) : { type: 'sastra', status: 'draft', commentList: [] };
  app.innerHTML = `<div class="admin"><a href="#/admin">← Dasbor</a><h1>${id ? 'Edit karya' : 'Karya baru'}</h1>
  <div class="row2">${fld('Jenis', '<select id="f_type"><option value="sastra">Karya sastra (novel, cerpen, puisi)</option><option value="ilmiah">Artikel ilmiah (jurnal)</option></select>')}${fld('Status', '<select id="f_status"><option value="published">Terbit</option><option value="hidden">Disembunyikan sementara</option><option value="draft">Draf</option></select>')}</div>
  ${fld('Judul', `<input id="f_title" value="${esc(w.title)}">`)}<div class="row2">${fld('Penulis', `<input id="f_author" value="${esc(w.author)}">`)}${fld('Kategori (pisahkan dengan koma)', `<input id="f_category" value="${esc(w.category)}" placeholder="Romansa, Fiksi">`)}</div>
  ${fld('Sinopsis / abstrak', `<textarea id="f_synopsis" rows="4">${esc(w.synopsis)}</textarea>`)}
  ${fld(id ? 'Ganti file PDF (kosongkan jika tidak diganti)' : 'File PDF', '<input type="file" id="f_pdf" accept="application/pdf">')}
  <div class="row2">${fld('Halaman yang dijadikan sampul', '<input id="f_cp" type="number" min="1" value="1">')}<div><label>&nbsp;</label><button onclick="regen()">Buat ulang sampul</button></div></div>
  <img id="cvp" class="thumb" style="width:140px;margin-top:10px" ${w.cover ? `src="${w.cover}"` : 'hidden'} alt="Sampul"><p class="meta">Sampul otomatis diambil dari halaman PDF. Maksimal ukuran PDF sebaiknya di bawah 20 MB.</p>
  <p><button class="pri btn" onclick="saveW('${id}')">Simpan</button> ${id ? `<button class="bad" onclick="delW('${id}')">Hapus karya</button> <a href="${w.fileUrl}" target="_blank">Buka PDF di Drive</a>` : ''}</p>
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
  const [L, W2] = [await api('popupList'), await api('adminList')];
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
const popData = () => { const o = {}; ['title', 'body', 'imageUrl', 'style', 'placement', 'trigger', 'frequency', 'startDate', 'endDate', 'startTime', 'endTime', 'btnText', 'btnUrl'].forEach(k => o[k] = $('#p_' + k).value); o.workIds = [...document.querySelectorAll('.pw:checked')].map(x => x.value).join(','); o.days = [...document.querySelectorAll('.pd:checked')].map(x => x.value).join(','); o.active = $('#p_active').checked; return o; };
const prevPop = () => drawPop(popData());
const savePop = guard(async id => { const d = popData(); d.id = id; await api('popupSave', { popup: d }); toast('Tersimpan'); tab = 'popup'; location.hash = '/admin'; dash(); });
