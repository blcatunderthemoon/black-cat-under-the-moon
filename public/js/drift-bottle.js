/* ─── API endpoints ─────────────────────────────── */
const API = {
  throw:   '/api/bottle/throw',
  random:  '/api/bottle/random',
  find:    '/api/bottle/find',
  reply:   '/api/bottle/reply',
  report:  '/api/bottle/report',
  replies: '/api/bottle/replies',
  like:    '/api/bottle/like',
  peek:    '/api/bottle/peek',
  topic:   '/api/bottle/topic',
};

/* ─── Cloudflare Turnstile ──────────────────────── */
const TURNSTILE_SELECTORS = ['#throw-turnstile', '#reply-turnstile', '#find-reply-turnstile'];
const TURNSTILE_NOT_READY = '人機驗證未就緒，請重新整理頁面後再試。';

function getTurnstileToken(selector) {
  return (window.turnstile?.getResponse(selector) ?? '') || '';
}

function getSupabaseAuthToken() {
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        var session = JSON.parse(localStorage.getItem(k) || 'null');
        if (session && session.access_token) return session.access_token;
      }
    }
  } catch (e) {}
  return null;
}

function authRequestHeaders(extra) {
  var headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  var token = getSupabaseAuthToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  return headers;
}

async function requireHumanCheck(selector) {
  if (getSupabaseAuthToken()) return { ok: true };
  var token = getTurnstileToken(selector);
  if (!token) return { ok: false, message: TURNSTILE_NOT_READY };
  return { ok: true, turnstileToken: token };
}

async function initTurnstileWidgets() {
  let siteKey = '0x4AAAAAADYg006rqWz6ukif';
  try {
    const res = await fetch('/api/turnstile/site-key');
    if (res.ok) {
      const data = await res.json();
      if (data.siteKey) siteKey = data.siteKey;
    }
  } catch {}

  const renderAll = function () {
    var loggedIn = !!getSupabaseAuthToken();
    TURNSTILE_SELECTORS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (loggedIn) {
        el.style.display = 'none';
        return;
      }
      window.turnstile.render(sel, {
        sitekey: siteKey,
        theme: 'dark',
        appearance: 'interaction-only',
        size: 'flexible',
      });
    });
  };

  if (window.turnstile?.ready) {
    window.turnstile.ready(renderAll);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTurnstileWidgets);
} else {
  initTurnstileWidgets();
}

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

/* ─── 漂流瓶暫存箱 stash (localStorage, max 5) ──── */
const STASH_MAX = 5;
function getStash() {
  try { return JSON.parse(localStorage.getItem('bcm_stash') || '[]'); } catch { return []; }
}
function addToStash(entry) {
  try {
    const list = getStash().filter(function(e) { return e.id !== entry.id; });
    list.unshift(entry);
    localStorage.setItem('bcm_stash', JSON.stringify(list.slice(0, STASH_MAX)));
    renderStash();
  } catch {}
}

/* ─── Like trackers (localStorage, one-way) ────── */
function getLikedBottles() {
  try { return new Set(JSON.parse(localStorage.getItem('bcm_liked_bottles') || '[]')); } catch { return new Set(); }
}
function markBottleLiked(id) {
  try {
    const list = [...getLikedBottles(), id].slice(-200);
    localStorage.setItem('bcm_liked_bottles', JSON.stringify(list));
  } catch {}
}
function getLikedReplies() {
  try { return new Set(JSON.parse(localStorage.getItem('bcm_liked_replies') || '[]')); } catch { return new Set(); }
}
function markReplyLiked(id) {
  try {
    const list = [...getLikedReplies(), id].slice(-500);
    localStorage.setItem('bcm_liked_replies', JSON.stringify(list));
  } catch {}
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
// Active topic tag filter (set by topic banner click for official-type topics)
let _topicTags = [];
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
const MAX_MOOD_TAGS = 3;
let selectedMoods = [];
let isMission    = false;
let throwContent = '';
let currentStep  = 1;
let _preferNewOnNextRandom = false;

/* ─── 月光神諭 / 答案之書 ─────────────────────── */
const DEFAULT_THROW_PLACEHOLDER = '深夜的心事、一個問題、一段話……';
const ORACLE_HISTORY_KEY = 'bcm_oracle_recent_ids';
const ORACLE_HISTORY_LIMIT = 3;
const ORACLE_QUESTION_OPEN = '[[moon_oracle_question]]';
const ORACLE_QUESTION_CLOSE = '[[/moon_oracle_question]]';
let currentOracle = null;

const MOON_ORACLES = [
  { id: 1, oracle: '你唔需要因為驚失去佢，就收起自己真正嘅感受。真正留低嘅人，唔會因為真心而走。', question: '如果唔使擔心結果，你最想同邊個講出心底嗰句說話？' },
  { id: 2, oracle: '有時你掛住嘅唔一定係嗰個人，而係同佢一齊時嗰個被愛住嘅自己。', question: '你最唔捨得嘅，到底係佢，定係嗰段感覺？' },
  { id: 3, oracle: '所有遲遲未覆嘅訊息，其實都帶住答案。只係答案未必係你想聽嗰個。', question: '你仲喺度等緊回覆，定其實已經知道結果？' },
  { id: 4, oracle: '你一直懷疑自己唔夠好，但真正令你疲累嘅，係不斷想證明自己值得被愛。', question: '最近有冇一段關係，令你覺得自己要特別努力先配得上？' },
  { id: 5, oracle: '圈內標籤好多，但你唔需要急住搵一個名稱去定義自己而家嘅模樣。', question: '如果冇人會評價，你會點樣形容而家嘅自己？' },
  { id: 6, oracle: '有啲人出現，只係為咗提醒你原來仲有能力心動，而唔係陪你行到最後。', question: '最近令你暈船嗰個人，帶畀你嘅最大發現係乜嘢？' },
  { id: 7, oracle: '你以為自己放唔低，其實只係仲未習慣冇咗佢之後嘅生活節奏。', question: '如果今日開始唔再諗佢，你會空出幾多時間畀自己？' },
  { id: 8, oracle: '唔係每段沉默都代表冷淡，有時對方都只係同你一樣，唔知點開口。', question: '有冇一句你一直等緊對方先講，但自己其實都可以講？' },
  { id: 9, oracle: '你唔需要向所有人解釋自己鍾意邊個，明白你嘅人自然會明白。', question: '最近有冇因為他人目光，而收起咗真實嘅自己？' },
  { id: 10, oracle: '有啲答案唔喺對方身上，而係藏喺你一次又一次重複嘅選擇入面。', question: '你最近反覆跌入緊邊種感情模式？' },
  { id: 11, oracle: '當你不停分析訊息背後意思，可能係因為對方從來冇畀過你安全感。', question: '呢段關係入面，你最常懷疑嘅係自己定對方？' },
  { id: 12, oracle: '有時唔係你太敏感，而係你一直忽略咗自己真正嘅委屈。', question: '最近有件事令你好唔舒服，但你一直冇承認嗎？' },
  { id: 13, oracle: '你唔一定要成為某種理想模樣，先值得有人真心留低陪你。', question: '你最怕別人知道自己邊一面？' },
  { id: 14, oracle: '有啲門關上唔係懲罰，而係提醒你前面仲有其他方向可以行。', question: '最近有邊件失去咗嘅事，你其實仲未真正接受？' },
  { id: 15, oracle: '你一直想被選擇，但更重要嘅係，你有冇選擇過自己。', question: '最近一次為自己而唔係為別人做決定，係幾時？' },
  { id: 16, oracle: '唔係所有曖昧都值得等，有啲關係拖得越耐，只會令你越迷失。', question: '呢段令你心亂嘅關係，帶畀你快樂多定消耗多？' },
  { id: 17, oracle: '有時放低唔係因為唔愛，而係終於知道自己值得更穩定嘅愛。', question: '你仲留戀嘅，到底係回憶定未完成嘅期待？' },
  { id: 18, oracle: '你唔需要喺所有人面前堅強，偶爾脆弱都唔代表失敗。', question: '最近有冇情緒一直頂住，卻未曾向任何人講過？' },
  { id: 19, oracle: '圈子再細，都唔值得為咗避免流言而放棄屬於自己嘅幸福。', question: '有冇一段關係，你曾經因為旁人意見而退縮？' },
  { id: 20, oracle: '當你開始質疑自己係咪太多要求，其實可能只係基本需要未被滿足。', question: '你最希望對方做到，但一直冇做到嘅係乜嘢？' },
  { id: 21, oracle: '有啲人令你心跳加速，有啲人令你安心入睡。兩者未必係同一個人。', question: '你而家追求緊刺激，定係追求安穩？' },
  { id: 22, oracle: '你唔需要急住證明自己屬於邊一類人，流動本身都係一種真實。', question: '最近有冇一個標籤，開始令你覺得唔再貼近自己？' },
  { id: 23, oracle: '有時候最難原諒嘅唔係對方，而係當初明知如此都投入嘅自己。', question: '有冇一段關係，你其實仲責怪緊自己？' },
  { id: 24, oracle: '你唔係冇人愛，只係仲未遇到一個唔需要你委屈自己嘅人。', question: '你曾經為咗維持關係，放棄過邊部分嘅自己？' },
  { id: 25, oracle: '答案未必即刻出現，但你已經慢慢行出嗰段最黑嘅夜路。', question: '回頭望，你覺得自己比半年前勇敢咗乜嘢？' },
  { id: 26, oracle: '真正重要嘅人，唔會淨係喺寂寞時先搵你出現。', question: '你最近有冇將將就就接受一段唔對等嘅關係？' },
  { id: 27, oracle: '你以為自己需要答案，其實更需要嘅可能係一個停止幻想嘅理由。', question: '有邊件事，你其實已經腦補咗無數個版本？' },
  { id: 28, oracle: '成長有時唔係學識爭取，而係學識分辨邊啲人值得你爭取。', question: '最近有冇一個人，其實已經唔再值得你等待？' },
  { id: 29, oracle: '月亮唔會因為烏雲而消失，你嘅價值都唔會因為一次失戀而減少。', question: '如果唔再用感情衡量自己，你最欣賞自己邊一點？' },
  { id: 30, oracle: '今晚你未必要找到答案，只需要誠實面對自己真正嘅感受。', question: '如果海浪會替你保守秘密，你最想坦白乜嘢？' },
  { id: 31, oracle: '有啲關係一直停留喺曖昧，唔係因為時機未到，而係有人從來冇打算向前行。', question: '你而家等緊嘅，係一個機會，定係一個永遠唔會出現嘅答案？' },
  { id: 32, oracle: '你以為自己太執著，其實只係曾經真心投入過，所以先會咁痛。', question: '如果唔再責怪自己，你最想原諒自己邊件事？' },
  { id: 33, oracle: '有時最孤單唔係冇人陪，而係身邊有人都唔敢做真正嘅自己。', question: '最近有冇一刻，你覺得自己需要戴住面具做人？' },
  { id: 34, oracle: '當你不停比較自己同其他人，其實已經忽略咗自己一路行過嚟嘅路。', question: '最近有咩進步，被你自己輕輕帶過咗？' },
  { id: 35, oracle: '你唔需要用痛苦證明愛得夠深，舒服同安心都可以係愛情嘅樣子。', question: '你心目中理想嘅關係，真係需要咁辛苦嗎？' },
  { id: 36, oracle: '有啲訊號其實一直都喺度，只係你太想相信另一個故事版本。', question: '如果只睇事實唔睇幻想，你會得出咩結論？' },
  { id: 37, oracle: '你唔係輸畀其他人，只係輸畀咗自己對未來嘅過高期待。', question: '最近有冇一件事，令你失望多過實際傷害？' },
  { id: 38, oracle: '圈內傳聞嚟得快去得快，但你的人生唔應該交畀流言決定方向。', question: '有冇一個選擇，你因為怕人講而一直唔敢做？' },
  { id: 39, oracle: '有啲人教識你愛，有啲人教識你界線，兩種相遇都值得感謝。', question: '最近有邊段關係，令你重新認識自己？' },
  { id: 40, oracle: '你一直向外搵答案，但心入面其實早就知道自己想要乜。', question: '如果唔理任何人意見，你下一步最想點做？' },
  { id: 41, oracle: '唔好因為一個人對你好，就忽略咗自己其實未必鍾意佢。', question: '你而家嘅感情，係出於心動定感動？' },
  { id: 42, oracle: '真正屬於你嘅關係，唔需要你日日猜測自己仲有冇位置。', question: '最近有冇一段關係，令你長期缺乏安全感？' },
  { id: 43, oracle: '月光照唔到每個角落，但唔代表黑暗入面冇值得珍惜嘅東西。', question: '有咩情緒，你一直刻意避開唔去面對？' },
  { id: 44, oracle: '有時唔係你放唔低，而係你仲未接受故事已經去到結尾。', question: '如果今日真係畫上句號，你最唔捨得乜嘢？' },
  { id: 45, oracle: '成長唔一定係變得更強，而係終於肯承認自己都有脆弱時候。', question: '最近一次令你想喊，但又忍住咗嘅事係乜？' },
  { id: 46, oracle: '你唔需要急住成為別人眼中理想嘅樣子，舒服做自己已經好難得。', question: '有邊個期待，你其實一直勉強自己去符合？' },
  { id: 47, oracle: '有啲距離唔係因為唔愛，而係大家已經行向唔同方向。', question: '有冇一段關係，其實你都感覺到慢慢變遠？' },
  { id: 48, oracle: '你最掛住嗰個人，未必係最適合你嘅人，呢兩件事從來唔一樣。', question: '如果只考慮幸福，你仲會選擇同一個人嗎？' },
  { id: 49, oracle: '唔好急住否定自己而家嘅迷惘，有時迷路都係認識自己嘅過程。', question: '最近有咩問題，你一直想逃避但始終避唔開？' },
  { id: 50, oracle: '今晚嘅海浪唔會替你做決定，但會提醒你，你值得被溫柔對待。', question: '如果未來嘅自己寫信畀你，佢最希望你放低乜嘢？' },
];

function getOracleHistory() {
  try { return JSON.parse(sessionStorage.getItem(ORACLE_HISTORY_KEY) || '[]'); } catch { return []; }
}
function rememberOracle(id) {
  try {
    const recent = [id].concat(getOracleHistory().filter(prevId => prevId !== id));
    sessionStorage.setItem(ORACLE_HISTORY_KEY, JSON.stringify(recent.slice(0, ORACLE_HISTORY_LIMIT)));
  } catch {}
}
function pickOracle() {
  const recent = getOracleHistory();
  const pool = MOON_ORACLES.filter(item => !recent.includes(item.id));
  const source = pool.length ? pool : MOON_ORACLES;
  return source[Math.floor(Math.random() * source.length)];
}
function resetOracle() {
  currentOracle = null;
  const card = document.getElementById('oracle-card');
  const btn = document.getElementById('btn-oracle');
  const textarea = document.getElementById('throw-content');
  if (card) card.classList.remove('oracle-visible');
  if (btn) {
    btn.textContent = '🔮 翻開答案之書';
    btn.setAttribute('aria-expanded', 'false');
  }
  if (textarea) textarea.placeholder = DEFAULT_THROW_PLACEHOLDER;
}
function drawOracle() {
  const oracle = pickOracle();
  currentOracle = oracle;
  rememberOracle(oracle.id);

  const card = document.getElementById('oracle-card');
  const oracleText = document.getElementById('oracle-text');
  const oracleQuestion = document.getElementById('oracle-question');
  const btn = document.getElementById('btn-oracle');
  const textarea = document.getElementById('throw-content');
  if (!card || !oracleText || !oracleQuestion || !btn || !textarea) return;

  oracleText.textContent = oracle.oracle;
  oracleQuestion.textContent = oracle.question;
  textarea.placeholder = oracle.question;

  btn.textContent = '🎲 換個預言';
  btn.setAttribute('aria-expanded', 'true');

  card.classList.remove('oracle-visible');
  void card.offsetWidth;
  card.classList.add('oracle-visible');
}

function formatOracleAnswerContent(answer) {
  const cleanAnswer = String(answer || '').trim();
  if (!currentOracle || !currentOracle.question) return cleanAnswer;
  return ORACLE_QUESTION_OPEN + currentOracle.question + ORACLE_QUESTION_CLOSE + '\n' + cleanAnswer;
}
function parseOracleAnswerContent(content) {
  const raw = String(content || '').trim();
  const markerStart = raw.indexOf(ORACLE_QUESTION_OPEN);
  const markerEnd = raw.indexOf(ORACLE_QUESTION_CLOSE);
  if (markerStart === 0 && markerEnd > ORACLE_QUESTION_OPEN.length) {
    return {
      question: raw.slice(ORACLE_QUESTION_OPEN.length, markerEnd).trim(),
      answer: raw.slice(markerEnd + ORACLE_QUESTION_CLOSE.length).trim(),
    };
  }

  const legacy = raw.match(/^【月光神諭提問】([\s\S]*?)\n\s*\n【我的回答】([\s\S]*)$/);
  if (legacy) {
    return {
      question: legacy[1].trim(),
      answer: legacy[2].trim(),
    };
  }

  return { question: '', answer: raw };
}
function renderBottleBodyContent(el, content) {
  if (!el) return;
  const parsed = parseOracleAnswerContent(content);
  if (!parsed.question) {
    el.textContent = parsed.answer;
    return;
  }
  el.innerHTML =
    '<div class="oracle-answer-shell">' +
      '<div class="oracle-public-prompt">' +
        '<div class="oracle-public-label">月光問你</div>' +
        '<div class="oracle-public-question">' + esc(parsed.question) + '</div>' +
      '</div>' +
      '<div class="oracle-public-divider"></div>' +
      '<div class="oracle-public-answer">' + esc(parsed.answer) + '</div>' +
    '</div>';
}

/* Phase 4: Mood chips */
function normMoodTag(v) {
  return String(v || '').trim().slice(0, 20);
}
function updateMoodSelectedCount() {
  const el = document.getElementById('mood-selected-count');
  if (el) el.textContent = '已選 ' + selectedMoods.length + ' / ' + MAX_MOOD_TAGS;
}
function addMoodTag(tag) {
  const mood = normMoodTag(tag);
  if (!mood) return false;
  if (selectedMoods.includes(mood)) return true;
  if (selectedMoods.length >= MAX_MOOD_TAGS) return false;
  selectedMoods.push(mood);
  return true;
}
function removeMoodTag(tag) {
  selectedMoods = selectedMoods.filter(m => m !== tag);
}
function removeCustomTagChips() {
  document.querySelectorAll('.chip.chip-custom-added').forEach(el => el.remove());
}
function syncMoodChipUI() {
  const atLimit = selectedMoods.length >= MAX_MOOD_TAGS;
  document.querySelectorAll('.chip').forEach(chip => {
    const isCustomPicker = chip.classList.contains('chip-custom');
    const isSelected = selectedMoods.includes(chip.dataset.mood);
    if (!isCustomPicker) chip.classList.toggle('chip-selected', isSelected);
    chip.classList.toggle('chip-disabled', atLimit && !isSelected);
  });
  removeCustomTagChips();
  const picker = document.querySelector('.chip.chip-custom');
  const wrap = document.getElementById('mood-chips');
  if (picker && wrap) {
    selectedMoods.forEach(mood => {
      const exists = Array.from(wrap.querySelectorAll('.chip:not(.chip-custom):not(.chip-custom-added)'))
        .some(c => c.dataset.mood === mood);
      if (exists) return;
      const chip = document.createElement('div');
      chip.className = 'chip chip-selected chip-custom-added';
      chip.dataset.mood = mood;
      chip.textContent = mood + ' ×';
      chip.addEventListener('click', function () {
        removeMoodTag(mood);
        syncMoodChipUI();
        updateMoodSelectedCount();
      });
      wrap.insertBefore(chip, picker);
    });
  }
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function () {
    const isCustom = this.classList.contains('chip-custom');
    const input = document.getElementById('chip-custom-input');
    if (isCustom) {
      input.classList.toggle('show');
      if (input.classList.contains('show')) input.focus();
      return;
    }
    // Hide the custom input box when switching to a regular chip
    input.classList.remove('show');
    const mood = this.dataset.mood;
    if (selectedMoods.includes(mood)) {
      removeMoodTag(mood);
    } else if (!addMoodTag(mood)) {
      showMsg('throw-err', '最多只可同時選 3 個標籤。', 'err');
    }
    syncMoodChipUI();
    updateMoodSelectedCount();
  });
});

document.getElementById('chip-custom-input').addEventListener('input', function () {
  if (this.value.length > 20) this.value = this.value.slice(0, 20);
});
document.getElementById('chip-custom-input').addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const mood = normMoodTag(this.value);
  if (!mood) return;
  if (!addMoodTag(mood)) {
    showMsg('throw-err', '最多只可同時選 3 個標籤。', 'err');
    return;
  }
  this.value = '';
  this.classList.remove('show');
  syncMoodChipUI();
  updateMoodSelectedCount();
});
updateMoodSelectedCount();

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
    renderBottleBodyContent(document.getElementById('wp-content'), formatOracleAnswerContent(throwContent));
    const moodEl    = document.getElementById('wp-mood');
    const missionEl = document.getElementById('wp-mission');
    moodEl.textContent   = selectedMoods.length ? '心情：' + selectedMoods.join(' · ') : '';
    moodEl.style.display = selectedMoods.length ? '' : 'none';
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
  if (btnEl) { btnEl.disabled = true; }
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
  const moodTags = Array.isArray(data.tags) && data.tags.length
    ? data.tags
    : (data.mood_tag ? [data.mood_tag] : []);
  moodEl.innerHTML = moodTags.map(t =>
    '<span class="mood-pill">' + esc(t) + '</span>'
  ).join('');
  moodEl.style.display = moodTags.length ? '' : 'none';

  renderBottleBodyContent(document.getElementById(ids.body), data.content);
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
  if (ids.likeBtn) {
    const lBtn = document.getElementById(ids.likeBtn);
    const lCnt = document.getElementById(ids.likeCount);
    if (lBtn && lCnt) {
      lBtn.dataset.bottleId = data.id;
      lCnt.textContent = data.like_count || 0;
      const liked = getLikedBottles().has(data.id);
      lBtn.disabled = liked;
      lBtn.classList.toggle('liked', liked);
    }
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
  const submittedContent = formatOracleAnswerContent(throwContent);
  const check = await requireHumanCheck('#throw-turnstile');
  if (!check.ok) { showMsg('throw-err', check.message, 'err'); return; }
  btn.disabled = true; btn.textContent = '🌊 投放中…';

  try {
    const res  = await fetch(API.throw, {
      method: 'POST',
      headers: authRequestHeaders(),
      body: JSON.stringify({
        content:           submittedContent,
        mood_tag:          selectedMoods[0] || null,
        mood_tags:         selectedMoods,
        is_mission_bottle: isMission,
        turnstile_token:   check.turnstileToken,
      }),
    });
    const data = await res.json();
    if (res.status === 451) { showCrisisBanner(); return; }
    if (!res.ok) { showMsg('throw-err', data.error || '發生錯誤，請重試。', 'err'); return; }
    window.posthog?.capture('bottle_thrown', {
      mood_tag:       selectedMoods[0] || null,
      mood_tags:      selectedMoods,
      is_mission:     isMission,
      content_length: submittedContent.length,
      oracle_id:      currentOracle?.id || null,
    });

    // Reset state
    document.getElementById('throw-content').value = '';
    document.getElementById('throw-count').textContent = '0 / 200';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-selected'));
    removeCustomTagChips();
    document.getElementById('chip-custom-input').classList.remove('show');
    document.getElementById('chip-custom-input').value = '';
    if (isMission) toggleMission();
    selectedMoods = [];
    updateMoodSelectedCount();
    throwContent = '';
    resetOracle();

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
  // Cancel any lingering cooldown timer so it doesn't bleed onto the new bottle
  if (_cdTimers['reply-err']) { clearInterval(_cdTimers['reply-err']); delete _cdTimers['reply-err']; }
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
  // Reset replies panel + comment form visibility
  repliesOpen = false;
  prefetchedReplies = null;
  document.getElementById('rnd-replies-expanded').style.display = 'none';
  document.getElementById('rnd-replies-list').innerHTML = '';
  var _tb = document.getElementById('rnd-toggle-btn'); if (_tb) _tb.style.display = 'none';
  var _rs = document.getElementById('rnd-replies-section'); if (_rs) _rs.style.display = 'none';
  var _cf = document.getElementById('rnd-comment-form'); if (_cf) _cf.style.display = '';
  document.querySelectorAll('.subreply-form').forEach(function(f) { f.style.display = 'none'; });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const seen = getSeenSession();
    let url = _topicTags.length
      ? API.random + '?' + _topicTags.map(t => 'tag=' + encodeURIComponent(t)).join('&')
      : API.random;
    if (_preferNewOnNextRandom) url += (url.includes('?') ? '&' : '?') + 'prefer_new=1';
    if (seen.length) url += (url.includes('?') ? '&' : '?') + 'exclude=' + seen.join(',');
    const res  = await fetch(url, { signal: ctrl.signal });
    _preferNewOnNextRandom = false;
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
      likeBtn: 'rnd-like-btn', likeCount: 'rnd-like-count',
    });
    window.posthog?.capture('bottle_found', {
      bottle_type: data.bottle_type || 'normal',
      mood_tag:    data.mood_tag || null,
    });

    document.getElementById('rnd-content').style.display = 'block';

    // Show replies section when others have already commented
    var _replySection = document.getElementById('rnd-replies-section');
    var _replyHeading = document.getElementById('rnd-replies-heading');
    var _tBtn = document.getElementById('rnd-toggle-btn');
    if (data.reply_count > 0) {
      if (_replySection) _replySection.style.display = '';
      if (_replyHeading) _replyHeading.textContent = '拾瓶人的回聲（' + data.reply_count + '）';
      document.getElementById('rnd-toggle-label').textContent = '💬 查看留言 (' + data.reply_count + ')';
      if (_tBtn) { _tBtn.style.display = ''; _tBtn.style.opacity = '.6'; }
      // Pre-fetch and auto-expand so comments are visible without an extra tap
      const prefetchId = data.id;
      fetch(`${API.replies}?id=${prefetchId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.replies || currentBottleId !== prefetchId) return;
          prefetchedReplies = d.replies;
          repliesOpen = true;
          document.getElementById('rnd-replies-expanded').style.display = 'block';
          renderReplyList(prefetchedReplies, prefetchId, 'rnd-replies-list');
          const total = prefetchedReplies.length + prefetchedReplies.reduce(function(s, r) {
            return s + (r.sub_replies || []).length;
          }, 0);
          document.getElementById('rnd-toggle-label').textContent = '💬 收起留言 (' + total + ')';
          if (_replyHeading) _replyHeading.textContent = '拾瓶人的回聲（' + total + '）';
        })
        .catch(() => {});
    } else {
      if (_replySection) _replySection.style.display = 'none';
      if (_tBtn) _tBtn.style.display = 'none';
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
  if (!currentBottleId) {
    showMsg('reply-err', '請先拾取一個瓶子。', 'err');
    return;
  }
  const content = document.getElementById('reply-content').value.trim();
  showMsg('reply-err', ''); showMsg('reply-ok', '');
  if (!content) { showMsg('reply-err', '請寫點什麼再送出。', 'err'); return; }

  const cdMs = getReplyCooldownMs(currentBottleId);
  if (cdMs > 0) { startCooldownHint('reply-err', document.getElementById('btn-reply'), cdMs); return; }

  const check = await requireHumanCheck('#reply-turnstile');
  if (!check.ok) { showMsg('reply-err', check.message, 'err'); return; }

  const btn = document.getElementById('btn-reply');
  btn.disabled = true; btn.textContent = '⏳';
  let replied = false;
  try {
    const res  = await fetch(API.reply, {
      method: 'POST',
      headers: authRequestHeaders(),
      body: JSON.stringify({
        bottle_id: currentBottleId,
        content,
        user_id: uid(),
        turnstile_token: check.turnstileToken,
      }),
    });
    const data = await res.json();
    if (res.status === 451) { showCrisisBanner(); return; }
    if (!res.ok) { showMsg('reply-err', data.error || '發生錯誤。', 'err'); return; }
    replied = true;
    setReplyTime(currentBottleId);
    showMsg('reply-ok', '留言已送出 ✨', 'ok');
    window.posthog?.capture('reply_sent');
    window.turnstile?.reset('#reply-turnstile');
    document.getElementById('reply-content').value = '';
    document.getElementById('reply-count').textContent = '0 / 100';
    btn.innerHTML = SEND_ICON;
    startCooldownHint('reply-err', btn, 30000);
    const lbl = document.getElementById('rnd-toggle-label');
    // Show replies section + auto-expand so the new reply is immediately visible
    var _replySection = document.getElementById('rnd-replies-section');
    if (_replySection) _replySection.style.display = '';
    var _tBtnS = document.getElementById('rnd-toggle-btn');
    if (_tBtnS) { _tBtnS.style.display = ''; _tBtnS.style.opacity = '1'; }
    var _expS = document.getElementById('rnd-replies-expanded');
    if (_expS) _expS.style.display = 'block';
    repliesOpen = true;
    const newReply = { id: 'local-' + Date.now(), content, created_at: new Date().toISOString(), sub_replies: [] };
    prefetchedReplies = prefetchedReplies ? [...prefetchedReplies, newReply] : [newReply];
    renderReplyList(prefetchedReplies, currentBottleId, 'rnd-replies-list');
    const _total = prefetchedReplies.length + prefetchedReplies.reduce(function(s, r) { return s + (r.sub_replies || []).length; }, 0);
    lbl.textContent = '💬 收起留言 (' + _total + ')';
    var _replyHeading = document.getElementById('rnd-replies-heading');
    if (_replyHeading) _replyHeading.textContent = '拾瓶人的回聲（' + _total + '）';
    // 漂流瓶暫存 — save to stash (no viewKey for random bottles)
    addToStash({
      id: currentBottleId,
      viewKey: null,
      preview: (document.getElementById('rnd-body').textContent || '').slice(0, 30),
      moodTag: document.getElementById('rnd-mood').textContent || '',
      bottleType: document.getElementById('rnd-card').classList.contains('mission') ? 'mission'
        : document.getElementById('rnd-moonlight').classList.contains('show') ? 'moonlight' : 'normal',
      repliedAt: new Date().toISOString(),
    });
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
  if (!expanded || !list || !label) return;
  // Use actual DOM state as source of truth to stay in sync
  const isOpen = expanded.style.display === 'block';
  if (isOpen) {
    expanded.style.display = 'none';
    repliesOpen = false;
    const n = label.textContent.match(/\d+/)?.[0];
    label.textContent = n ? '💬 查看留言 (' + n + ')' : '💬 留下第一條留言';
    return;
  }
  expanded.style.display = 'block';
  repliesOpen = true;
  if (prefetchedReplies) {
    const replies = prefetchedReplies;
    renderReplyList(replies, currentBottleId, 'rnd-replies-list');
    const total = replies.length + replies.reduce((s, r) => s + (r.sub_replies || []).length, 0);
    label.textContent = '💬 收起留言 (' + total + ')';
    return;
  }
  // Show loading indicator immediately — no blank flash
  list.innerHTML = '<div class="no-replies" style="opacity:.55">⏳ 載入留言中…</div>';
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
    expanded.style.display = 'none';
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
        '<button class="btn-report-reply" data-rid="' + s.id + '" title="檢舉留言">⚑</button>';
      const subLiked = !isLocalSub && getLikedReplies().has(s.id);
      const subLikeBtn = isLocalSub ? '' :
        '<button class="btn-like-reply' + (subLiked ? ' liked' : '') + '" data-rid="' + s.id + '"'
        + (subLiked ? ' disabled' : '') + '>♥ <span>' + (s.like_count || 0) + '</span></button>';
                  return '<div class="reply-subitem">'
        + '<div class="reply-header">'
        + '<span class="reply-time">' + fmtDate(s.created_at) + '</span>'
        + subReport
        + '</div>'
        + '<div class="reply-body-row">'
        + '<span class="reply-body">' + esc(s.content) + '</span>'
        + (isLocalSub ? '' : subLikeBtn)
        + '</div>'
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
    const liked = !isLocal && getLikedReplies().has(r.id);
    const likeBtn = isLocal ? '' :
      '<button class="btn-like-reply' + (liked ? ' liked' : '') + '" data-rid="' + r.id + '"'
      + (liked ? ' disabled' : '') + '>♥ <span>' + (r.like_count || 0) + '</span></button>';
    const reportBtn = isLocal ? '' :
      '<button class="btn-report-reply"'
      + ' data-rid="' + r.id + '" title="檢舉留言">⚑</button>';
        return '<div class="reply-item" id="reply-' + r.id + '">'
      + '<div class="reply-header">'
      + '<span class="reply-time">' + fmtDate(r.created_at) + '</span>'
      + reportBtn
      + '</div>'
      + '<span class="reply-body">' + esc(r.content) + '</span>'
      + '<div class="reply-actions"><div class="reply-actions-left">' + replyBtn + '</div>' + likeBtn + '</div>'
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
    var like = e.target.closest('.btn-like-reply');
    if (like && !like.disabled) { likeReply(like.dataset.rid, like); return; }
    var rep = e.target.closest('.btn-report-reply');
    if (rep && !rep.disabled) { reportReply(rep.dataset.rid, rep); return; }
  });
});

/* ─── Like: bottle + reply ────────────────── */
async function likeBottle(btn) {
  const bottleId = btn.dataset.bottleId;
  if (!bottleId || getLikedBottles().has(bottleId)) return;
  // Optimistic update
  btn.disabled = true;
  btn.classList.add('liked');
  const cnt = btn.querySelector('span');
  const prevCount = parseInt(cnt?.textContent, 10) || 0;
  if (cnt) cnt.textContent = prevCount + 1;
  try {
    const res = await fetch(API.like, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bottle_id: bottleId }),
    });
    if (res.ok) {
      markBottleLiked(bottleId);
    } else {
      // Revert
      btn.classList.remove('liked');
      if (cnt) cnt.textContent = prevCount;
      btn.disabled = false;
    }
  } catch {
    // Revert
    btn.classList.remove('liked');
    if (cnt) cnt.textContent = prevCount;
    btn.disabled = false;
  }
}
async function likeReply(replyId, btn) {
  if (getLikedReplies().has(replyId)) return;
  // Optimistic update
  btn.disabled = true;
  btn.classList.add('liked');
  const cnt = btn.querySelector('span');
  const prevCount = parseInt(cnt?.textContent, 10) || 0;
  if (cnt) cnt.textContent = prevCount + 1;
  try {
    const res = await fetch(API.like, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply_id: replyId }),
    });
    if (res.ok) {
      markReplyLiked(replyId);
    } else {
      // Revert
      btn.classList.remove('liked');
      if (cnt) cnt.textContent = prevCount;
      btn.disabled = false;
    }
  } catch {
    // Revert
    btn.classList.remove('liked');
    if (cnt) cnt.textContent = prevCount;
    btn.disabled = false;
  }
}

/* ─── Reply: cooldown helpers ─────────────────── */
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
      headers: authRequestHeaders(),
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

  const check = await requireHumanCheck('#find-reply-turnstile');
  if (!check.ok) { showMsg('find-reply-err', check.message, 'err'); return; }

  const btn = document.getElementById('btn-find-reply');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const res = await fetch(API.reply, {
      method: 'POST',
      headers: authRequestHeaders(),
      body: JSON.stringify({
        bottle_id: foundBottleId,
        content,
        user_id: uid(),
        turnstile_token: check.turnstileToken,
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
    // 漂流瓶暫存 — save to stash with viewKey from key-boxes
    var vKey = Array.from(document.querySelectorAll('#key-boxes .key-box'))
      .map(function(b) { return (b.value || '').toUpperCase(); }).join('');
    addToStash({
      id: foundBottleId,
      viewKey: vKey.length === 6 ? vKey : null,
      preview: (document.getElementById('found-body').textContent || '').slice(0, 30),
      moodTag: document.getElementById('found-mood').textContent || '',
      bottleType: document.getElementById('found-card').classList.contains('mission') ? 'mission'
        : document.getElementById('found-moonlight').classList.contains('show') ? 'moonlight' : 'normal',
      repliedAt: new Date().toISOString(),
    });
  } catch {
    showMsg('find-reply-err', '網路錯誤，請稍後再試。', 'err');
    btn.disabled = false; btn.innerHTML = SEND_ICON;
  }
}

/* ─── Crisis Intervention Banner ─────────────────── */
function showCrisisBanner() {
  document.getElementById('crisis-banner').style.display = 'flex';
  document.body.classList.add('body-scroll-locked');
}
function closeCrisisBanner() {
  document.getElementById('crisis-banner').style.display = 'none';
  document.body.classList.remove('body-scroll-locked');
}

/* ─── Panel B: Report bottle ─────────────────────── */function skipBottle() {
  window.posthog?.capture('bottle_skipped');
  _preferNewOnNextRandom = true;
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
      likeBtn: 'found-like-btn', likeCount: 'found-like-count',
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
    if (reportBtn) { reportBtn.disabled = false; reportBtn.textContent = '⚑'; reportBtn.style.color = 'rgba(255,255,255,.18)'; }

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

/* ─── 漂流瓶暫存箱 — render, load ─────────────────── */
function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return '剛剛';
  if (mins < 60)  return mins + ' 分鐘前';
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return hrs + ' 小時前';
  return Math.floor(hrs / 24) + ' 天前';
}
function renderStashInto(wrapId, listId) {
  const wrap = document.getElementById(wrapId);
  const list = document.getElementById(listId);
  if (!wrap || !list) return;
  const stash = getStash();
  if (!stash.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  list.innerHTML = stash.map(function(e, i) {
    const mood = e.moodTag
      ? '<span class="stash-mood">' + esc(e.moodTag) + '</span>'
      : '';
    const typeIcon = e.bottleType === 'moonlight' ? '🌙 '
      : e.bottleType === 'mission' ? '🐈 ' : '';
    const preview = esc((e.preview || '').trim()) || '…';
    const previewFull = preview + ((e.preview || '').length >= 30 ? '…' : '');
    return '<div class="stash-item" onclick="loadStashBottle(' + i + ')" role="button" tabindex="0" '
      + 'onkeydown="if(event.key===\'Enter\'||event.key===\' \')loadStashBottle(' + i + ')" >'
      + '<div class="stash-item-top">' + mood
      + '<span class="stash-time">' + fmtRelative(e.repliedAt) + ' 留過言</span></div>'
      + '<div class="stash-preview">' + typeIcon + previewFull + '</div>'
      + '</div>';
  }).join('');
}
function renderStash() {
  renderStashInto('stash-wrap-rnd', 'stash-list-rnd');
}
function toggleStash() {
  var wrap = document.getElementById('stash-wrap-rnd');
  if (!wrap) return;
  wrap.classList.toggle('stash-collapsed');
}
function loadStashBottle(index) {
  const entry = getStash()[index];
  if (!entry) return;
  document.querySelectorAll('.tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.panel === 'find');
    b.setAttribute('aria-selected', b.dataset.panel === 'find');
  });
  document.querySelectorAll('.panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'panel-find');
  });
  document.body.dataset.tab = 'find';
  if (entry.viewKey) {
    const boxes = Array.from(document.querySelectorAll('#key-boxes .key-box'));
    entry.viewKey.split('').forEach(function(ch, i) {
      if (boxes[i]) { boxes[i].value = ch; boxes[i].classList.add('filled'); }
    });
    setTimeout(findBottle, 60);
  } else {
    loadBottleById(entry.id);
  }
}
async function loadBottleById(id) {
  showMsg('find-err', '');
  document.getElementById('found-wrap').classList.remove('found-visible');
  document.querySelectorAll('.subreply-form').forEach(function(f) { f.style.display = 'none'; });
  var fcf = document.getElementById('find-comment-form'); if (fcf) fcf.style.display = '';
  try {
    const res  = await fetch(API.peek + '?id=' + encodeURIComponent(id));
    const data = await res.json();
    if (!res.ok) { showMsg('find-err', data.error || '找不到這個瓶子。', 'err'); return; }
    renderBottleCard(data, {
      card: 'found-card', moonlight: 'found-moonlight', mood: 'found-mood',
      body: 'found-body', time: 'found-time', expires: 'found-expires',
      likeBtn: 'found-like-btn', likeCount: 'found-like-count',
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
    if (reportBtn) { reportBtn.disabled = false; reportBtn.textContent = '⚑'; reportBtn.style.color = 'rgba(255,255,255,.18)'; }
    document.getElementById('found-wrap').classList.add('found-visible');
    const listEl = document.getElementById('found-list');
    listEl.innerHTML = '<div class="no-replies" style="opacity:.5">載入中…</div>';
    document.getElementById('found-heading').textContent = '拾瓶人的回聲';
    const capturedId = foundBottleId;
    fetch(API.replies + '?id=' + capturedId)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d || foundBottleId !== capturedId) return;
        findRepliesCache = d.replies || [];
        renderReplyList(findRepliesCache, capturedId, 'found-list');
        const total = findRepliesCache.length + findRepliesCache.reduce(function(s,r){return s+(r.sub_replies||[]).length;},0);
        document.getElementById('found-heading').textContent =
          total > 0 ? '拾瓶人的回聲（' + total + '）' : '拾瓶人的回聲';
        if (!total) listEl.innerHTML = '<div class="no-replies">這個瓶子還沒有人回應。</div>';
      })
      .catch(function() { listEl.innerHTML = ''; });
  } catch {
    showMsg('find-err', '網路錯誤，請稍後再試。', 'err');
  }
}

/* ─── Topic Banner ──────────────────────────────── */
(function () {
  /** Render the topic banner given a config object from /api/bottle/topic */
  function renderTopicBanner(cfg) {
    const banner = document.getElementById('topic-banner');
    if (!banner || !cfg || !cfg.active) return;

    // Set type-specific class + icon
    banner.classList.remove('type-official', 'type-featured');
    banner.classList.add(cfg.type === 'featured' ? 'type-featured' : 'type-official');

    const icon = cfg.type === 'featured' ? '⭐' : '🌙';
    document.getElementById('topic-banner-icon').textContent = icon;

    // Label prefix (styled separately)
    const prefix = cfg.type === 'featured' ? '精選漂流瓶' : '今日話題';
    document.getElementById('topic-banner-label').textContent = prefix;
    document.getElementById('topic-banner-body').textContent = cfg.text;

    // Reply / response count badge
    const countEl = document.getElementById('topic-banner-count');
    if (cfg.count != null && cfg.count > 0) {
      countEl.textContent = cfg.count + ' 則回應';
      countEl.style.display = '';
    } else {
      countEl.style.display = 'none';
    }

    // Click handler — switches to appropriate panel
    banner.addEventListener('click', function handleBannerClick() {
      if (cfg.type === 'official' && cfg.tag) {
        // Switch to 撈瓶 panel with tag filter active
        _topicTags = Array.isArray(cfg.tags) && cfg.tags.length ? cfg.tags : (cfg.tag ? [cfg.tag] : []);
        clearSeenSession();
        randomLoaded = false;
        document.querySelectorAll('.tab').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        const rndTab = document.querySelector('.tab[data-panel="random"]');
        if (rndTab) { rndTab.classList.add('active'); rndTab.setAttribute('aria-selected', 'true'); }
        document.getElementById('panel-random').classList.add('active');
        document.body.dataset.tab = 'random';
        randomLoaded = true;
        loadRandom();
      } else if (cfg.type === 'featured' && cfg.bottleId) {
        // Switch to 尋瓶 panel and load the featured bottle
        _topicTags = [];
        document.querySelectorAll('.tab').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        const findTab = document.querySelector('.tab[data-panel="find"]');
        if (findTab) { findTab.classList.add('active'); findTab.setAttribute('aria-selected', 'true'); }
        document.getElementById('panel-find').classList.add('active');
        document.body.dataset.tab = 'find';
        loadBottleById(cfg.bottleId);
      }
    }, { once: false });

    // Show banner
    banner.style.display = '';
  }

  /** Fetch topic config from API and render if active */
  async function loadTopic() {
    try {
      const res = await fetch(API.topic, { cache: 'no-cache' });
      if (!res.ok) return;
      const cfg = await res.json();
      renderTopicBanner(cfg);
    } catch {
      // Topic banner is non-critical; fail silently
    }
  }

  loadTopic();
})();

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
  renderStash();
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
