/* ─── API endpoints ─────────────────────────────── */
const API = {
  throw:   '/api/bottle/throw',
  random:  '/api/bottle/random',
  find:    '/api/bottle/find',
  reply:   '/api/bottle/reply',
  report:  '/api/bottle/report',
  replies: '/api/bottle/replies',
};

/* ─── Anonymous user ID ─────────────────────────── */
function uid() {
  let id = localStorage.getItem('bcm_uid');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('bcm_uid', id);
  }
  return id;
}

/* ─── Replied-bottles tracker (localStorage) ────── */
function getReplied() {
  try { return JSON.parse(localStorage.getItem('bcm_replied') || '[]'); } catch { return []; }
}
function markReplied(id) {
  const list = getReplied();
  if (!list.includes(id)) {
    list.push(id);
    if (list.length > 200) list.splice(0, list.length - 200);
    localStorage.setItem('bcm_replied', JSON.stringify(list));
  }
}

/* ─── Session-seen tracker (sessionStorage, resets on tab close) ── */
function getSeenSession() {
  try { return JSON.parse(sessionStorage.getItem('bcm_seen') || '[]'); } catch { return []; }
}
function addSeenSession(id) {
  try {
    const list = getSeenSession();
    if (!list.includes(id)) {
      list.push(id);
      if (list.length > 20) list.shift();
      sessionStorage.setItem('bcm_seen', JSON.stringify(list));
    }
  } catch {}
}
function clearSeenSession() {
  try { sessionStorage.removeItem('bcm_seen'); } catch {}
}

/* ─── Phase 2: Tabs with atmosphere shift ────────── */
let randomLoaded = false;
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
    document.body.dataset.tab = btn.dataset.panel;
    if (btn.dataset.panel === 'random') {
      const isEmpty = document.getElementById('rnd-empty').style.display !== 'none';
      if (!randomLoaded || isEmpty) {
        randomLoaded = true;
        nextRandomAt = 0;
        loadRandom();
      }
    }
  });
});

/* ─── Char counters ─────────────────────────────── */
document.getElementById('throw-content').addEventListener('input', function () {
  if (this.value.length > 200) this.value = this.value.slice(0, 200);
  const n = this.value.length;
  const el = document.getElementById('throw-count');
  el.textContent = n + ' / 200';
  el.classList.toggle('warn', n >= 180 && n < 200);
  el.classList.toggle('limit', n >= 200);
});
document.getElementById('reply-content').addEventListener('input', function () {
  if (this.value.length > 100) this.value = this.value.slice(0, 100);
  const n = this.value.length;
  const el = document.getElementById('reply-count');
  el.textContent = n + ' / 100';
  el.classList.toggle('warn', n >= 90 && n < 100);
  el.classList.toggle('limit', n >= 100);
});
document.getElementById('find-reply-content').addEventListener('input', function () {
  if (this.value.length > 100) this.value = this.value.slice(0, 100);
  const n = this.value.length;
  const el = document.getElementById('find-reply-count');
  el.textContent = n + ' / 100';
  el.classList.toggle('warn', n >= 90 && n < 100);
  el.classList.toggle('limit', n >= 100);
});
document.addEventListener('input', function(e) {
  const id = e.target.dataset.subreplyFor;
  if (!id) return;
  if (e.target.value.length > 100) e.target.value = e.target.value.slice(0, 100);
  const n = e.target.value.length;
  const el = document.getElementById('subreply-count-' + id);
  if (el) { el.textContent = n + ' / 100'; el.classList.toggle('warn', n >= 90 && n < 100); el.classList.toggle('limit', n >= 100); }
  // auto-expand
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';
});
(function () {
  const boxes = Array.from(document.querySelectorAll('.key-box'));
  function syncFilled(box) { box.classList.toggle('filled', box.value.length > 0); }
  boxes.forEach(function (box, i) {
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace') {
        if (this.value) { this.value = ''; syncFilled(this); }
        else if (i > 0) { boxes[i-1].focus(); boxes[i-1].value = ''; syncFilled(boxes[i-1]); }
        e.preventDefault();
      } else if (e.key === 'ArrowLeft'  && i > 0) { boxes[i-1].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowRight' && i < 5) { boxes[i+1].focus(); e.preventDefault(); }
        else if (e.key === 'Enter') { findBottle(); }
    });
    box.addEventListener('input', function () {
      const v = this.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(-1);
      this.value = v; syncFilled(this);
      if (v && i < 5) setTimeout(function(){ boxes[i+1].focus(); }, 0);
    });
    box.addEventListener('paste', function (e) {
      e.preventDefault();
      const text = (e.clipboardData||window.clipboardData).getData('text')
        .replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,6);
      text.split('').forEach(function(ch,j){ if(boxes[j]){boxes[j].value=ch;syncFilled(boxes[j]);} });
      boxes[Math.min(text.length,5)].focus();
      if (text.length === 6) setTimeout(findBottle, 80);
    });
    box.addEventListener('focus', function () { this.select(); });
  });
})();

/* ─── Phase 4+5: Wizard state ───────────────────── */
let selectedMood = '';
let isMission    = false;
let throwContent = '';
let currentStep  = 1;

/* Phase 4: Mood chips */
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function () {
    const isCustom = this.classList.contains('chip-custom');
    const input    = document.getElementById('chip-custom-input');
    if (this.classList.contains('chip-selected') && !isCustom) {
      this.classList.remove('chip-selected');
      selectedMood = '';
      return;
    }
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-selected'));
    this.classList.add('chip-selected');
    if (isCustom) {
      input.classList.add('show');
      input.focus();
      selectedMood = input.value.trim();
    } else {
      input.classList.remove('show');
      selectedMood = this.dataset.mood;
    }
  });
});
document.getElementById('chip-custom-input').addEventListener('input', function () {
  if (this.value.length > 20) this.value = this.value.slice(0, 20);
  selectedMood = this.value.trim();
});

/* Phase 8: Mission toggle */
let _missionHintTimer = null;
function toggleMission() {
  isMission = !isMission;
  document.getElementById('mission-toggle').classList.toggle('active', isMission);
  const hint = document.getElementById('mission-hint-text');
  if (_missionHintTimer) { clearTimeout(_missionHintTimer); _missionHintTimer = null; }
  if (isMission) {
    hint.classList.remove('hiding');
    hint.classList.add('show');
    _missionHintTimer = setTimeout(() => {
      hint.classList.add('hiding');
      setTimeout(() => hint.classList.remove('show', 'hiding'), 450);
      _missionHintTimer = null;
    }, 30000);
  } else {
    hint.classList.add('hiding');
    setTimeout(() => hint.classList.remove('show', 'hiding'), 450);
  }
}

/* ─── Phase 5: Wizard navigation ────────────────── */
function goStep(n) {
  if (n === 2) {
    throwContent = document.getElementById('throw-content').value.trim();
    if (!throwContent) {
      document.getElementById('throw-content').focus();
      return;
    }
  }
  if (n === 3) {
    document.getElementById('wp-content').textContent = throwContent;
    const moodEl    = document.getElementById('wp-mood');
    const missionEl = document.getElementById('wp-mission');
    moodEl.textContent   = selectedMood ? '心情：' + selectedMood : '';
    moodEl.style.display = selectedMood ? '' : 'none';
    missionEl.style.display = isMission ? '' : 'none';
  }
  currentStep = n;
  document.querySelectorAll('.wizard-step').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === n);
  });
  const segs = document.querySelectorAll('.wstep-segment');
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById('wd' + i);
    const seg = segs[i - 1];
    dot.classList.toggle('done',   i < n);
    dot.classList.toggle('active', i === n);
    if (seg) { seg.classList.toggle('done', i < n); seg.classList.toggle('active', i === n); }
  }
}

/* ─── Helpers ───────────────────────────────────── */
let currentBottleId = null;
function showMsg(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'msg' + (type === 'err' ? ' msg-err' : type === 'ok' ? ' msg-ok' : '');
  if (msg) el.classList.add('show');
}

/* ─── Cooldown countdown hint ───────────────────── */
var _cdTimers = {};
function startCooldownHint(errElId, btnEl, ms) {
  if (_cdTimers[errElId]) clearInterval(_cdTimers[errElId]);
  var remaining = Math.ceil(ms / 1000);
  function tick() {
    var el = document.getElementById(errElId);
    if (!el) { clearInterval(_cdTimers[errElId]); return; }
    if (remaining <= 0) {
      clearInterval(_cdTimers[errElId]);
      el.textContent = ''; el.className = 'msg';
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = SEND_ICON; }
      return;
    }
    el.textContent = '⏱ ' + remaining + ' 秒後可再留言';
    el.className = 'msg msg-cd show';
    remaining--;
  }
  tick();
  _cdTimers[errElId] = setInterval(tick, 1000);
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}
function daysUntil(iso) {
  try {
    const diff = new Date(iso) - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  } catch { return null; }
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Phase 7+8: Render bottle card ─────────────── */
function renderBottleCard(data, ids) {
  const card = document.getElementById(ids.card);
  const isMissionBottle = data.is_mission_bottle === true || data.bottle_type === 'mission';
  card.classList.toggle('mission', isMissionBottle);

  const moonEl = document.getElementById(ids.moonlight);
  if (moonEl) moonEl.classList.toggle('show', data.bottle_type === 'moonlight');

  const moodEl = document.getElementById(ids.mood);
  moodEl.textContent   = data.mood_tag || '';
  moodEl.style.display = data.mood_tag ? '' : 'none';

  document.getElementById(ids.body).textContent = data.content;
  if (ids.time) document.getElementById(ids.time).textContent = fmtDate(data.created_at);

  if (ids.expires && data.expires_at) {
    const days = daysUntil(data.expires_at);
    document.getElementById(ids.expires).textContent =
      days !== null ? (days > 0 ? '🌊 ' + days + ' 日後沉沒' : '瓶子已沉入海底') : '';
  }
  if (ids.replies) {
    document.getElementById(ids.replies).textContent =
      '💬 已收到 ' + (data.reply_count || 0) + ' 個回應';
  }
}

/* ─── Phase 5: 4-stage post-submit animation ─────── */
function runSubmitAnimation() {
  // Stage 1 (t=0ms): Cork seal
  const em = document.getElementById('ov-bottle');
  em.classList.remove('cork-seal', 'bottle-fly');
  void em.offsetWidth;
  em.classList.add('cork-seal');

  // Stage 2 (t=300ms): Sea ripple
  setTimeout(() => {
    const ripple = document.getElementById('sea-ripple');
    ripple.classList.remove('expand');
    void ripple.offsetWidth;
    ripple.classList.add('expand');
  }, 300);

  // Stage 3 (t=900ms): Show overlay + bottle drift
  setTimeout(() => {
    document.getElementById('overlay').classList.add('show');
    em.classList.remove('cork-seal');
    void em.offsetWidth;
    em.classList.add('bottle-fly');
    setTimeout(() => em.classList.remove('bottle-fly'), 1400);
  }, 900);

  // Stage 4 (t=2500ms): Key floats in
  setTimeout(() => {
    const keyBox = document.getElementById('ov-key-box');
    keyBox.classList.remove('key-float-anim');
    void keyBox.offsetWidth;
    keyBox.classList.add('key-float-anim');
  }, 2500);
}

/* ─── Panel A: Throw bottle ─────────────────────── */
let currentKey = '';
async function throwBottle() {
  showMsg('throw-err', '');
  const btn = document.getElementById('btn-throw');
  btn.disabled = true; btn.textContent = '🌊 投放中…';
  try {
    const res  = await fetch(API.throw, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content:           throwContent,
        mood_tag:          selectedMood || null,
        user_id:           uid(),
        is_mission_bottle: isMission,
        turnstile_token:   (window.turnstile?.getResponse('#throw-turnstile') ?? '') || '',
      }),
    });
    const data = await res.json();
    if (res.status === 451) { showCrisisBanner(); return; }
    if (!res.ok) { showMsg('throw-err', data.error || '發生錯誤，請重試。', 'err'); return; }
    window.posthog?.capture('bottle_thrown', {
      mood_tag:       selectedMood || null,
      is_mission:     isMission,
      content_length: (throwContent || '').trim().length,
    });

    // Reset state
    document.getElementById('throw-content').value = '';
    document.getElementById('throw-count').textContent = '0 / 200';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-selected'));
    document.getElementById('chip-custom-input').classList.remove('show');
    document.getElementById('chip-custom-input').value = '';
    if (isMission) toggleMission();
    selectedMood = ''; throwContent = '';

    currentKey = data.view_key;
    document.getElementById('ov-key').textContent = data.view_key;
    document.getElementById('btn-copy').textContent = '📋 一鍵複製鑰匙';
    document.getElementById('btn-copy').classList.remove('copied');
    document.getElementById('ov-key-box').classList.remove('key-float-anim');

    runSubmitAnimation();
    window.turnstile?.reset('#throw-turnstile');
    goStep(1);
  } catch { showMsg('throw-err', '網路錯誤，請稍後再試。', 'err'); }
  finally { btn.disabled = false; btn.textContent = '🌙 將話語封進瓶中'; }
}

/* ─── Panel B: Load random bottle ───────────────── */
const SEND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:block"><path transform="rotate(-30,12,12) translate(2.6,0)" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
const BOTTLE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" style="display:block"><rect x="9.5" y="1.5" width="5" height="2.5" rx="1.2" fill="currentColor" opacity=".6"/><rect x="10.2" y="4" width="3.6" height="3.5" rx=".7" fill="currentColor" opacity=".9"/><path d="M9 8.5C7.5 9.8 7 11.5 7 13.5v5.5C7 20.1 9.2 21 12 21s5-.9 5-2v-5.5c0-2-.5-3.7-2-5H9z" fill="currentColor" opacity=".8"/><line x1="9.5" y1="13" x2="9.5" y2="18" stroke="rgba(255,255,255,.5)" stroke-width="1.2" stroke-linecap="round"/></svg>';
const SEND_SMALL = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="display:block"><path transform="rotate(-30,12,12) translate(2.6,0)" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
let nextRandomAt = 0;
let randomSkipCount = 0;
let repliesOpen = false;
let prefetchedReplies = null;
function retryRandom() { nextRandomAt = 0; loadRandom(); }
async function loadRandom() {
  const now = Date.now();
  if (now < nextRandomAt) return;
  nextRandomAt = now + 1000;

  const nextBtn = document.getElementById('btn-next');
  nextBtn.disabled = true;
  currentBottleId = null;
  document.getElementById('rnd-loading').style.display = 'block';
  document.getElementById('rnd-empty').style.display   = 'none';
  document.getElementById('rnd-content').style.display = 'none';
  showMsg('reply-err', ''); showMsg('reply-ok', ''); showMsg('report-ok', '');
  document.getElementById('reply-content').value = '';
  document.getElementById('reply-count').textContent = '0 / 100';
  const replyBtn = document.getElementById('btn-reply');
  replyBtn.disabled = false;
  replyBtn.innerHTML = SEND_ICON;
  replyBtn.classList.remove('btn-success');
  document.getElementById('btn-report').disabled = false;
  document.getElementById('btn-report').textContent = '⚑';
  document.getElementById('btn-report').style.color = 'rgba(255,255,255,.18)';
  // Reset replies panel
  repliesOpen = false;
  prefetchedReplies = null;
  document.getElementById('rnd-replies-expanded').style.display = 'none';
  document.getElementById('rnd-replies-list').innerHTML = '';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const seen = getSeenSession();
    const url  = seen.length ? API.random + '?exclude=' + seen.join(',') : API.random;
    const res  = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();

    // If DB exhausted seen list, clear it and retry once
    if (res.status === 404 && seen.length > 0 && randomSkipCount === 0) {
      clearSeenSession();
      nextRandomAt = 0;
      randomSkipCount++;
      setTimeout(loadRandom, 200);
      return;
    }

    // Check retry BEFORE hiding loading so the screen stays stable during retries
    if (res.ok && getReplied().includes(data.id) && randomSkipCount < 8) {
      randomSkipCount++;
      nextRandomAt = 0; // bypass rate limit for retry
      setTimeout(loadRandom, 350);
      return;
    }

    document.getElementById('rnd-loading').style.display = 'none';
    if (!res.ok) {
      document.getElementById('rnd-empty-icon').textContent = '🍾';
      document.getElementById('rnd-empty-msg').textContent = '大海上還沒有瓶子，快去投一個！';
      document.getElementById('btn-retry').style.display = 'none';
      document.getElementById('rnd-empty').style.display = 'block';
      randomSkipCount = 0; return;
    }
    randomSkipCount = 0;

    currentBottleId = data.id;
    addSeenSession(data.id);
    renderBottleCard(data, {
      card: 'rnd-card', moonlight: 'rnd-moonlight', mood: 'rnd-mood',
      body: 'rnd-body', time: 'rnd-time', expires: 'rnd-expires',
    });
    window.posthog?.capture('bottle_found', {
      bottle_type: data.bottle_type || 'normal',
      mood_tag:    data.mood_tag || null,
    });

    // If still showing a replied bottle (exhausted retries), lock reply form
    if (getReplied().includes(data.id)) {
      const rb = document.getElementById('btn-reply');
      rb.disabled = true; rb.textContent = '✓';
      rb.classList.add('btn-success');
    }

    // Always show toggle; label reflects reply count
    document.getElementById('rnd-toggle-label').textContent =
      data.reply_count > 0 ? `💬 查看留言 (${data.reply_count})` : '💬 留下第一條留言';

    document.getElementById('rnd-content').style.display = 'block';

    // Pre-fetch replies in background so toggle is instant
    if (data.reply_count > 0) {
      const prefetchId = data.id;
      fetch(`${API.replies}?id=${prefetchId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.replies && currentBottleId === prefetchId) prefetchedReplies = d.replies; })
        .catch(() => {});
    }
  } catch {
    document.getElementById('rnd-loading').style.display = 'none';
    document.getElementById('rnd-empty-icon').textContent = '⚠️';
    document.getElementById('rnd-empty-msg').textContent = '載入失敗，請稍後再試。';
    document.getElementById('btn-retry').style.display = 'block';
    document.getElementById('rnd-empty').style.display   = 'block';
    randomSkipCount = 0;
  } finally {
    const remaining = nextRandomAt - Date.now();
    if (remaining > 0) setTimeout(() => { nextBtn.disabled = false; }, remaining);
    else nextBtn.disabled = false;
  }
}

/* ─── Panel B: Send reply ────────────────────────── */
async function sendReply() {
  if (!currentBottleId) return;
  const content = document.getElementById('reply-content').value.trim();
  showMsg('reply-err', ''); showMsg('reply-ok', '');
  if (!content) { showMsg('reply-err', '請寫點什麼再送出。', 'err'); return; }

  const cdMs = getReplyCooldownMs(currentBottleId);
  if (cdMs > 0) { startCooldownHint('reply-err', document.getElementById('btn-reply'), cdMs); return; }

  const btn = document.getElementById('btn-reply');
  btn.disabled = true; btn.textContent = '⏳';
  let replied = false;
  try {
    const res  = await fetch(API.reply, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bottle_id: currentBottleId,
        content,
        user_id: uid(),
        turnstile_token: (window.turnstile?.getResponse('#reply-turnstile') ?? '') || '',
      }),
    });
    const data = await res.json();
    if (res.status === 451) { showCrisisBanner(); return; }
    if (!res.ok) { showMsg('reply-err', data.error || '發生錯誤。', 'err'); return; }
    replied = true;
    setReplyTime(currentBottleId);
    markReplied(currentBottleId);
    showMsg('reply-ok', '留言已送出 ✨', 'ok');
    window.posthog?.capture('reply_sent');
    window.turnstile?.reset('#reply-turnstile');
    document.getElementById('reply-content').value = '';
    document.getElementById('reply-count').textContent = '0 / 100';
    btn.innerHTML = SEND_ICON;
    startCooldownHint('reply-err', btn, 30000);
    const lbl = document.getElementById('rnd-toggle-label');
    const prevNum = parseInt(lbl.textContent.match(/\d+/)?.[0] ?? '0', 10);
    lbl.textContent = '💬 收起留言 (' + (prevNum + 1) + ')';
    const newReply = { id: 'local-' + Date.now(), content, created_at: new Date().toISOString(), sub_replies: [] };
    prefetchedReplies = prefetchedReplies ? [...prefetchedReplies, newReply] : [newReply];
    if (repliesOpen) { renderReplyList(prefetchedReplies, currentBottleId, 'rnd-replies-list'); }
  } catch {
    showMsg('reply-err', '網路錯誤，請稍後再試。', 'err');
  } finally {
    if (!replied) { btn.disabled = false; if (btn.textContent === '⏳') btn.innerHTML = SEND_ICON; }
  }
}

/* ─── Panel B: View replies ──────────────────────── */
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function toggleReplies() {
  const expanded = document.getElementById('rnd-replies-expanded');
  const list     = document.getElementById('rnd-replies-list');
  const label    = document.getElementById('rnd-toggle-label');
  repliesOpen = !repliesOpen;
  if (!repliesOpen) {
    expanded.style.display = 'none';
    const n = label.textContent.match(/\d+/)?.[0];
    label.textContent = n ? '💬 查看留言 (' + n + ')' : '💬 留下第一條留言';
    return;
  }
  expanded.style.display = 'block';
  list.innerHTML = '';
  if (prefetchedReplies) {
    const replies = prefetchedReplies;
    renderReplyList(replies, currentBottleId, 'rnd-replies-list');
    const total = replies.length + replies.reduce((s, r) => s + (r.sub_replies || []).length, 0);
    label.textContent = '💬 收起留言 (' + total + ')';
    return;
  }
  label.textContent = '⏳ 載入中…';
  try {
    const res  = await fetch(API.replies + '?id=' + currentBottleId);
    const data = await res.json();
    if (!res.ok || !data.replies?.length) {
      list.innerHTML = '<div class="no-replies">還沒有人留言，再等等看吧 🌙</div>';
      label.textContent = '💬 收起';
      return;
    }
    const replies = data.replies;
    prefetchedReplies = replies;
    renderReplyList(replies, currentBottleId, 'rnd-replies-list');
    const total = replies.length + replies.reduce((s, r) => s + (r.sub_replies || []).length, 0);
    label.textContent = '💬 收起留言 (' + total + ')';
  } catch {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-dim)">載入失敗，請重試</p>';
    label.textContent = '💬 查看留言';
    repliesOpen = false;
  }
}
function renderReplyList(replies, bottleId, listElId) {
  const listEl = document.getElementById(listElId);
  if (!listEl) return;
  listEl.innerHTML = replies.map(function(r) {
    const isLocal = r.id && r.id.startsWith('local-');
    const subs = (r.sub_replies || []).map(function(s) {
      const isLocalSub = s.id && s.id.startsWith('local-');
      const subReport = isLocalSub ? '' :
        '<div class="reply-actions" style="margin-top:3px">'
        + '<button class="btn-report-reply" data-rid="' + s.id + '" title="檢舉留言">⚑</button>'
        + '</div>';
      return '<div class="reply-subitem">'
        + '<span class="reply-time">' + fmtDate(s.created_at) + '</span>'
        + '<span class="reply-body">' + esc(s.content) + '</span>'
        + subReport
        + '</div>';
    }).join('');
    const subForm = isLocal ? '' :
      '<div class="subreply-form" id="subreply-form-' + r.id + '" style="display:none">'
      + '<div class="ta-wrap">'
      + '<textarea id="subreply-ta-' + r.id + '" data-subreply-for="' + r.id + '" class="reply-ta" maxlength="100" placeholder="回覆這條留言…" rows="1"></textarea>'
      + '<span class="char-count" id="subreply-count-' + r.id + '">0 / 100</span>'
      + '<button class="btn-round-send btn-subreply-send"'
      + ' data-reply-id="' + r.id + '" data-bottle-id="' + bottleId + '" data-list-id="' + listElId + '"'
      + ' onclick="sendSubReply(this.dataset.replyId,this.dataset.bottleId,this.dataset.listId)">'
      + SEND_SMALL + '</button>'
      + '</div>'
      + '<span class="msg msg-err" id="subreply-err-' + r.id + '"></span>'
      + '</div>';
    const replyBtn = isLocal ? '' :
      '<button class="btn-text-reply"'
      + ' data-toggle-id="' + r.id + '">↩ 回覆</button>';
    const reportBtn = isLocal ? '' :
      '<button class="btn-report-reply"'
      + ' data-rid="' + r.id + '" title="檢舉留言">⚑</button>';
    return '<div class="reply-item" id="reply-' + r.id + '">'
      + '<span class="reply-time">' + fmtDate(r.created_at) + '</span>'
      + '<span class="reply-body">' + esc(r.content) + '</span>'
      + '<div class="reply-actions">' + replyBtn + reportBtn + '</div>'
      + subs
      + subForm
      + '</div>';
  }).join('');
}

/* ─── Reply: toggle sub-reply form ─────────────── */
function toggleSubReplyForm(replyId) {
  const target = document.getElementById('subreply-form-' + replyId);
  if (!target) return;
  const opening = target.style.display === 'none';
  document.querySelectorAll('.subreply-form').forEach(function(el) { el.style.display = 'none'; });
  if (opening) {
    target.style.display = 'block';
    const ta = document.getElementById('subreply-ta-' + replyId);
    if (ta) setTimeout(function() { ta.focus(); }, 50);
    // hide bottom comment form on the same panel
    const inFind = !!target.closest('#found-wrap');
    var bottomId = inFind ? 'find-comment-form' : 'rnd-comment-form';
    var bottomForm = document.getElementById(bottomId);
    if (bottomForm) bottomForm.style.display = 'none';
  } else {
    // all closed — restore both bottom forms
    ['find-comment-form', 'rnd-comment-form'].forEach(function(id) {
      var f = document.getElementById(id); if (f) f.style.display = '';
    });
  }
}

/* ─── Reply list: delegated click handlers ─────── */
['rnd-replies-list', 'found-list'].forEach(function(listId) {
  var el = document.getElementById(listId);
  if (!el) return;
  el.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn-text-reply');
    if (btn) { toggleSubReplyForm(btn.dataset.toggleId); return; }
    var rep = e.target.closest('.btn-report-reply');
    if (rep && !rep.disabled) { reportReply(rep.dataset.rid, rep); return; }
  });
});

/* ─── Reply: cooldown helpers ───────────────────── */
function getReplyCooldownMs(bottleId) {
  try {
    const times = JSON.parse(localStorage.getItem('bcm_reply_times') || '{}');
    const last = times[bottleId];
    return last ? Math.max(0, 30000 - (Date.now() - last)) : 0;
  } catch { return 0; }
}
function setReplyTime(bottleId) {
  try {
    const times = JSON.parse(localStorage.getItem('bcm_reply_times') || '{}');
    times[bottleId] = Date.now();
    const keys = Object.keys(times);
    if (keys.length > 100) delete times[keys[0]];
    localStorage.setItem('bcm_reply_times', JSON.stringify(times));
  } catch {}
}

/* ─── Reply: send sub-reply ─────────────────────── */
async function sendSubReply(parentReplyId, bottleId, listElId) {
  const ta    = document.getElementById('subreply-ta-' + parentReplyId);
  const errEl = document.getElementById('subreply-err-' + parentReplyId);
  if (!ta) return;
  const content = ta.value.trim();
  if (errEl) errEl.textContent = '';
  if (!content) { if (errEl) errEl.textContent = '請寫點什麼再送出。'; return; }

  const sendBtn = ta.closest('.subreply-form') && ta.closest('.subreply-form').querySelector('.btn-subreply-send');
  if (sendBtn) sendBtn.disabled = true;
  try {
    const res = await fetch(API.reply, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bottle_id: bottleId, content, user_id: uid(), parent_reply_id: parentReplyId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) errEl.textContent = data.error || '發生錯誤。';
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
    ta.value = '';
    const countEl = document.getElementById('subreply-count-' + parentReplyId);
    if (countEl) countEl.textContent = '0 / 100';
    const form = document.getElementById('subreply-form-' + parentReplyId);
    if (form) form.style.display = 'none';
    const newSub = { id: 'local-sub-' + Date.now(), content, created_at: new Date().toISOString() };
    const cache = listElId === 'found-list' ? findRepliesCache : prefetchedReplies;
    if (cache) {
      const parent = cache.find(function(r) { return r.id === parentReplyId; });
      if (parent) { if (!parent.sub_replies) parent.sub_replies = []; parent.sub_replies.push(newSub); }
    }
    renderReplyList(cache || [], bottleId, listElId);
    // restore bottom comment section after sub-reply sent
    ['find-comment-form', 'rnd-comment-form'].forEach(function(id) {
      var f = document.getElementById(id); if (f) f.style.display = '';
    });
    if (listElId === 'found-list') {
      const total = (findRepliesCache||[]).length + (findRepliesCache||[]).reduce(function(s,r){return s+(r.sub_replies||[]).length;},0);
      document.getElementById('found-heading').textContent = '拾瓶人的回聲（' + total + '）';
    } else {
      const lbl = document.getElementById('rnd-toggle-label');
      const total = (prefetchedReplies||[]).length + (prefetchedReplies||[]).reduce(function(s,r){return s+(r.sub_replies||[]).length;},0);
      if (lbl) lbl.textContent = '💬 收起留言 (' + total + ')';
    }
  } catch {
    if (errEl) errEl.textContent = '網路錯誤，請稍後再試。';
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ─── Reply: send find-panel reply ─────────────── */
async function sendFindReply() {
  if (!foundBottleId) return;
  const content = document.getElementById('find-reply-content').value.trim();
  showMsg('find-reply-err', ''); showMsg('find-reply-ok', '');
  if (!content) { showMsg('find-reply-err', '請寫點什麼再送出。', 'err'); return; }

  const cdMs = getReplyCooldownMs(foundBottleId);
  if (cdMs > 0) { startCooldownHint('find-reply-err', document.getElementById('btn-find-reply'), cdMs); return; }

  const btn = document.getElementById('btn-find-reply');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const res = await fetch(API.reply, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bottle_id: foundBottleId,
        content,
        user_id: uid(),
        turnstile_token: (window.turnstile?.getResponse('#find-reply-turnstile') ?? '') || '',
      }),
    });
    const data = await res.json();
    if (res.status === 451) { showCrisisBanner(); btn.disabled = false; btn.innerHTML = SEND_ICON; return; }
    if (!res.ok) { showMsg('find-reply-err', data.error || '發生錯誤。', 'err'); btn.disabled = false; btn.innerHTML = SEND_ICON; return; }
    setReplyTime(foundBottleId);
    showMsg('find-reply-ok', '留言已送出 ✨', 'ok');
    window.posthog?.capture('reply_sent', { panel: 'find' });
    window.turnstile?.reset('#find-reply-turnstile');
    document.getElementById('find-reply-content').value = '';
    document.getElementById('find-reply-count').textContent = '0 / 100';
    btn.innerHTML = SEND_ICON;
    startCooldownHint('find-reply-err', btn, 30000);
    const newReply = { id: 'local-' + Date.now(), content, created_at: new Date().toISOString(), sub_replies: [] };
    findRepliesCache = findRepliesCache ? [...findRepliesCache, newReply] : [newReply];
    renderReplyList(findRepliesCache, foundBottleId, 'found-list');
    const total = findRepliesCache.length + findRepliesCache.reduce(function(s,r){return s+(r.sub_replies||[]).length;},0);
    document.getElementById('found-heading').textContent = '拾瓶人的回聲（' + total + '）';
  } catch {
    showMsg('find-reply-err', '網路錯誤，請稍後再試。', 'err');
    btn.disabled = false; btn.innerHTML = SEND_ICON;
  }
}

/* ─── Crisis Intervention Banner ─────────────────── */
function showCrisisBanner() {
  document.getElementById('crisis-banner').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeCrisisBanner() {
  document.getElementById('crisis-banner').style.display = 'none';
  document.body.style.overflow = '';
}

/* ─── Panel B: Report bottle ─────────────────────── */function skipBottle() {
  window.posthog?.capture('bottle_skipped');
  loadRandom();
}
async function reportBottle(panel) {
  _reportingPanel = panel || 'random';
  const bid = _reportingPanel === 'find' ? foundBottleId : currentBottleId;
  if (!bid) return;
  document.getElementById('report-confirm-overlay').classList.add('show');
}
function cancelReport() {
  document.getElementById('report-confirm-overlay').classList.remove('show');
  document.getElementById('report-confirm-title').textContent = '確認檢舉？';
  document.getElementById('report-confirm-sub').textContent = '確認後，我哋會審核呢條內容。感謝你維護社區安全 🙏';
  document.querySelector('#report-confirm-overlay .btn-report-confirm').onclick = confirmReport;
  _pendingReplyId = null; _pendingReplyBtn = null;
}
async function confirmReport() {
  const panel = _reportingPanel;
  cancelReport();
  const bid   = panel === 'find' ? foundBottleId : currentBottleId;
  const btnId = panel === 'find' ? 'btn-find-report' : 'btn-report';
  const btn   = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = '已檢舉'; }
  try {
    await fetch(API.report, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bottle_id: bid }),
    });
    if (panel !== 'find') showMsg('report-ok', '已提交檢舉，感謝你的回報。', 'ok');
  } catch { /* silent */ }
}

let _pendingReplyId = null;
let _pendingReplyBtn = null;
function reportReply(replyId, btn) {
  if (!replyId || btn?.disabled) return;
  _pendingReplyId = replyId;
  _pendingReplyBtn = btn || null;
  document.getElementById('report-confirm-title').textContent = '確認檢舉留言？';
  document.getElementById('report-confirm-sub').textContent = '確認後，我哋會審核呢條留言。感謝你維護社區安全 🙏';
  document.querySelector('#report-confirm-overlay .btn-report-confirm').onclick = confirmReplyReport;
  document.getElementById('report-confirm-overlay').classList.add('show');
}
function cancelReplyReport() {
  // restore bottle report defaults then close
  document.getElementById('report-confirm-title').textContent = '確認檢舉？';
  document.getElementById('report-confirm-sub').textContent = '確認後，我哋會審核呢條內容。感謝你維護社區安全 🙏';
  document.querySelector('#report-confirm-overlay .btn-report-confirm').onclick = confirmReport;
  document.getElementById('report-confirm-overlay').classList.remove('show');
  _pendingReplyId = null;
  _pendingReplyBtn = null;
}
async function confirmReplyReport() {
  const rid = _pendingReplyId;
  const rb = _pendingReplyBtn;
  cancelReplyReport();
  if (!rid) return;
  if (rb) { rb.disabled = true; rb.textContent = '✓'; }
  try {
    const res = await fetch(API.report, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply_id: rid }),
    });
    if (res.ok) {
      showMsg('report-ok', '已提交檢舉，感謝你的回報。', 'ok');
    } else {
      const data = await res.json().catch(() => ({}));
      showMsg('report-ok', data.error || '檢舉失敗，請稍後再試。', 'err');
      if (rb) { rb.disabled = false; rb.textContent = '⚑'; }
    }
  } catch {
    showMsg('report-ok', '網路錯誤，請稍後再試。', 'err');
    if (rb) { rb.disabled = false; rb.textContent = '⚑'; }
  }
}

/* ─── Panel C: Find bottle by key ───────────────── */
async function findBottle() {
  const key = Array.from(document.querySelectorAll('#key-boxes .key-box')).map(function(b){return (b.value||'').toUpperCase();}).join('');
  showMsg('find-err', '');
  document.getElementById('found-wrap').classList.remove('found-visible');
  // Close any open sub-reply form and restore bottom comment section for a fresh search
  document.querySelectorAll('.subreply-form').forEach(function(f) { f.style.display = 'none'; });
  var fcf = document.getElementById('find-comment-form'); if (fcf) fcf.style.display = '';
  if (key.replace(/[A-Z0-9]/g,'').length || key.length !== 6) { showMsg('find-err', '請填滿全部 6 個格子。', 'err'); return; }

  try {
    const res  = await fetch(API.find, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (!res.ok) { showMsg('find-err', data.error || '找不到這個瓶子。', 'err'); return; }

    renderBottleCard(data, {
      card: 'found-card', moonlight: 'found-moonlight', mood: 'found-mood',
      body: 'found-body', time: 'found-time', expires: 'found-expires',
    });

    foundBottleId    = data.id;
    findRepliesCache = null;
    document.getElementById('find-reply-content').value = '';
    document.getElementById('find-reply-count').textContent = '0 / 100';
    showMsg('find-reply-err', ''); showMsg('find-reply-ok', '');
    const findBtn = document.getElementById('btn-find-reply');
    findBtn.disabled = false; findBtn.innerHTML = SEND_ICON;
    findBtn.classList.remove('btn-success');
    window.turnstile?.reset('#find-reply-turnstile');
    const reportBtn = document.getElementById('btn-find-report');
    if (reportBtn) { reportBtn.disabled = false; reportBtn.textContent = '⚑'; }

    document.getElementById('found-wrap').classList.add('found-visible');

    const listEl = document.getElementById('found-list');
    listEl.innerHTML = '<div class="no-replies" style="opacity:.5">載入中…</div>';
    document.getElementById('found-heading').textContent = '拾瓶人的回聲';
    const capturedId = foundBottleId;
    fetch(API.replies + '?id=' + capturedId)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d || foundBottleId !== capturedId) return;
        const replies = d.replies || [];
        findRepliesCache = replies;
        const total = replies.length + replies.reduce(function(s,r){return s+(r.sub_replies||[]).length;},0);
        document.getElementById('found-heading').textContent = '拾瓶人的回聲（' + total + '）';
        if (replies.length) {
          renderReplyList(replies, capturedId, 'found-list');
        } else {
          listEl.innerHTML = '<div class="no-replies">還沒有人留言，再等等看吧 🌙</div>';
        }
        window.posthog?.capture('key_lookup', { reply_count: total });
      })
      .catch(function() { listEl.innerHTML = '<div class="no-replies">載入留言失敗，請稍後再試。</div>'; });
  } catch { showMsg('find-err', '網路錯誤，請稍後再試。', 'err'); }
}

/* ─── Overlay helpers ───────────────────────────── */
function closeOverlay() {
  document.getElementById('overlay').classList.remove('show');
}
async function copyKey() {
  const btn = document.getElementById('btn-copy');
  try {
    await navigator.clipboard.writeText(currentKey);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentKey;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  btn.textContent = '✅ 已複製！';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = '📋 一鍵複製鑰匙';
    btn.classList.remove('copied');
  }, 2500);
}
async function copyLink() {
  const btn = document.getElementById('btn-link');
  const url = location.origin + location.pathname + '?key=' + currentKey;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  btn.textContent = '✅ 連結已複製！';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = '🔗 複製查閱連結';
    btn.classList.remove('copied');
  }, 2500);
}
document.getElementById('overlay').addEventListener('click', function (e) {
  if (e.target === this) closeOverlay();
});

/* ─── Phase 1: Starfield ────────────────────────── */
(function () {
  const c = document.getElementById('stars');
  const starPalette = ['#c8deff', '#ddd0ff', '#ffe8a0', '#b0d8ff', '#e8e0ff', '#fff'];
  for (let i = 0; i < 45; i++) {
    const s     = document.createElement('div');
    const pixel = i < 8;
    s.className = 'star';
    const sz    = pixel ? (Math.floor(Math.random() * 2) + 2) : (Math.random() * 1.8 + 0.7).toFixed(1);
    const dx    = ((Math.random() > .5 ? 1 : -1) * (Math.random() * 2 + 1)).toFixed(1);
    const col   = starPalette[Math.floor(Math.random() * starPalette.length)];
    s.style.cssText =
      `width:${sz}px;height:${sz}px;`
      + `top:${(Math.random() * 100).toFixed(1)}%;`
      + `left:${(Math.random() * 100).toFixed(1)}%;`
      + `--dur:${(Math.random() * 3 + 2).toFixed(1)}s;`
      + `--delay:-${(Math.random() * 5).toFixed(1)}s;`
      + `--b:${(Math.random() * 0.45 + 0.15).toFixed(2)};`
      + `--drift-dur:${(Math.random() * 6 + 8).toFixed(1)}s;`
      + `--drift-delay:-${(Math.random() * 8).toFixed(1)}s;`
      + `--drift-x:${dx}px;`
      + `background:${col};`
      + (pixel ? 'border-radius:0;' : '');
    c.appendChild(s);
  }
})();

/* ─── Phase 1: Floating particles ──────────────── */
(function () {
  const c      = document.getElementById('stars');
  const colors = ['rgba(0,229,255,', 'rgba(124,92,252,', 'rgba(255,224,102,'];
  for (let i = 0; i < 20; i++) {
    const p       = document.createElement('div');
    p.className   = 'particle';
    const sz      = (Math.random() * 3 + 1).toFixed(1);
    const col     = colors[Math.floor(Math.random() * colors.length)];
    const opacity = (Math.random() * 0.25 + 0.08).toFixed(2);
    const rise    = Math.floor(Math.random() * 200 + 80);
    const sway    = ((Math.random() - .5) * 60).toFixed(0);
    p.style.cssText =
      `width:${sz}px;height:${sz}px;`
      + `bottom:${(Math.random() * 35).toFixed(0)}%;`
      + `left:${(Math.random() * 100).toFixed(1)}%;`
      + `background:${col}${opacity});`
      + `--p-dur:${(Math.random() * 6 + 8).toFixed(1)}s;`
      + `--p-delay:-${(Math.random() * 12).toFixed(1)}s;`
      + `--p-opacity:${opacity};`
      + `--p-rise:${rise}px;`
      + `--p-sway:${sway}px;`;
    c.appendChild(p);
  }
})();

/* ─── URL param auto-load ───────────────────────── */
(function () {
  const key = new URLSearchParams(location.search).get('key');
  if (!key || key.replace(/[A-Z0-9]/gi, '').length || key.length !== 6) return;
  const upper = key.toUpperCase();
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === 'find');
    b.setAttribute('aria-selected', b.dataset.panel === 'find');
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-find'));
  document.body.dataset.tab = 'find';
  const boxes = Array.from(document.querySelectorAll('#key-boxes .key-box'));
  upper.split('').forEach(function (ch, i) { if (boxes[i]) { boxes[i].value = ch; boxes[i].classList.add('filled'); } });
  setTimeout(findBottle, 120);
})();
