/**
 * MyCatPanel — /my-cat main interactive area (Phase 1 MVP).
 * Tap to Meow, unified feed (= daily check-in), stats bars.
 * Spec: docs/MY-CAT-GAME-DESIGN.md §4, §5, §11
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import CatSprite from './CatSprite.js';
import MoonLoading from './MoonLoading.js';
import {
  GROWTH_STAGE_LABELS,
  getCatAnimDurationMs,
  getCatStripUrl,
  TOO_HUNGRY_THRESHOLD,
} from '../lib/my-cat.js';

const IDLE_REST_ANIM = 'idle_slowblink';
// 閒置時偶爾播一段的小動作池（播完再回到靜止）
const IDLE_VARIETY_ANIMS = [
  'idle_slowblink',
  'idle_yawn',
  'sit_slowblink',
  'groom',
  'stretch',
  'tailwack',
];
// 靜止 6–14 秒先考慮郁一次
const IDLE_REST_MIN_MS = 6000;
const IDLE_REST_RANGE_MS = 8000;
// 好感 → 郁動機率：0 好感 25%，100 好感 90%
const IDLE_MOVE_CHANCE_BASE = 0.25;
const IDLE_MOVE_CHANCE_SPAN = 0.65;

function formatCooldown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function StatBar({ icon, label, value, barClass, max = 100 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="my-cat-stat">
      <span className="my-cat-stat__label">
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      <div
        className="my-cat-stat__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className={`my-cat-stat__fill ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="my-cat-stat__value">{max > 100 ? `${value}/${max}` : value}</span>
    </div>
  );
}

export default function MyCatPanel({ accessToken, userId, soundEnabled = true }) {
  const [cat, setCat] = useState(null);
  const [moonJourney, setMoonJourney] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [anim, setAnim] = useState(IDLE_REST_ANIM);
  const [animPaused, setAnimPaused] = useState(true);
  const [bubble, setBubble] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [feeding, setFeeding] = useState(false);
  const [petting, setPetting] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [typedChars, setTypedChars] = useState(0);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [feedReward, setFeedReward] = useState(null);

  const heartIdRef = useRef(0);
  const lastLineRef = useRef(null);
  const animTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const busyRef = useRef(false);
  const audioRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const catRef = useRef(null);
  const [summoning, setSummoning] = useState(false);
  const [shopBusy, setShopBusy] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => { catRef.current = cat; }, [cat]);

  useEffect(() => {
    reducedMotionRef.current = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const applyState = useCallback((data) => {
    if (data?.cat) setCat(data.cat);
    if (data?.moon_journey) setMoonJourney(data.moon_journey);
    if (data?.shop) setShop(data.shop);
  }, []);

  const loadCat = useCallback(async ({ silent = false } = {}) => {
    if (!accessToken) return;
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/my-cat', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (!silent) setLoadError(data.error || '貓咪走失了一下，請重新整理。');
        return;
      }
      applyState(data);
    } catch {
      if (!silent) setLoadError('網路錯誤，請重新整理。');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [accessToken, applyState]);

  useEffect(() => { loadCat(); }, [loadCat]);

  // 離家出走召喚倒數：每秒 tick；時間到就靜默刷新（貓咪返嚟）。
  useEffect(() => {
    const iso = cat?.cat_returns_at;
    if (!iso) return undefined;
    const target = new Date(iso).getTime();
    setNowTs(Date.now());
    const iv = setInterval(() => {
      const t = Date.now();
      setNowTs(t);
      if (t >= target) {
        clearInterval(iv);
        loadCat({ silent: true });
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [cat?.cat_returns_at, loadCat]);

  // Preload the single meow bound to the equipped skin (§8.1).
  useEffect(() => {
    if (!cat?.meow_url || typeof window === 'undefined') return;
    const audio = new Audio(cat.meow_url);
    audio.preload = 'auto';
    audioRef.current = audio;
  }, [cat?.meow_url]);

  // 預載所有會用到嘅動畫 strip：唔預載嘅話，第一次摸摸（buff）／餵食（eat）
  // 要即場載圖，載入期間 background 係空 → 貓咪會「消失」一陣。
  useEffect(() => {
    if (!cat?.skin_id || typeof window === 'undefined') return;
    const anims = new Set([IDLE_REST_ANIM, ...IDLE_VARIETY_ANIMS, 'buff', 'eat']);
    anims.forEach((a) => {
      const img = new window.Image();
      img.src = getCatStripUrl(cat.skin_id, a);
    });
  }, [cat?.skin_id]);

  useEffect(() => () => {
    clearTimeout(animTimerRef.current);
    clearTimeout(idleTimerRef.current);
  }, []);

  useEffect(() => {
    if (!statusMsg) return undefined;
    const t = setTimeout(() => setStatusMsg(''), 3600);
    return () => clearTimeout(t);
  }, [statusMsg]);

  useEffect(() => {
    if (!bubble) return undefined;
    const t = setTimeout(() => setBubble(''), 5600);
    return () => clearTimeout(t);
  }, [bubble]);

  useEffect(() => {
    if (!feedReward) return undefined;
    const t = setTimeout(() => setFeedReward(null), 2800);
    return () => clearTimeout(t);
  }, [feedReward]);

  // Tick every second while a pet cooldown is counting down.
  useEffect(() => {
    const iso = cat?.next_pet_available_at;
    if (!iso) return undefined;
    const target = new Date(iso).getTime();
    if (target <= Date.now()) return undefined;
    setNowTs(Date.now());
    const iv = setInterval(() => {
      const t = Date.now();
      setNowTs(t);
      if (t >= target) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [cat?.next_pet_available_at]);

  // RPG typewriter reveal for the speech bubble.
  useEffect(() => {
    if (!bubble) {
      setTypedChars(0);
      return undefined;
    }
    if (reducedMotionRef.current) {
      setTypedChars(bubble.length);
      return undefined;
    }
    setTypedChars(0);
    const iv = setInterval(() => {
      setTypedChars((n) => {
        if (n >= bubble.length) {
          clearInterval(iv);
          return n;
        }
        return n + 1;
      });
    }, 45);
    return () => clearInterval(iv);
  }, [bubble]);

  // 閒置節奏：大部分時間靜止唔郁，隔 6–14 秒**考慮**播一段小動作。
  // 好感愈高愈活躍（郁動機率 25%–90%）；太餓（飽腹 < 20）冇心機郁。
  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    if (reducedMotionRef.current) return;
    const restMs = IDLE_REST_MIN_MS + Math.random() * IDLE_REST_RANGE_MS;
    idleTimerRef.current = setTimeout(() => {
      if (busyRef.current) return;
      const c = catRef.current;
      // 太餓 → 訓喺度唔郁，等餵食
      if ((c?.hunger ?? 100) < TOO_HUNGRY_THRESHOLD) {
        scheduleIdle();
        return;
      }
      const affection = c?.affection ?? 50;
      const moveChance = IDLE_MOVE_CHANCE_BASE + IDLE_MOVE_CHANCE_SPAN * (affection / 100);
      if (Math.random() > moveChance) {
        scheduleIdle();
        return;
      }
      const next = IDLE_VARIETY_ANIMS[Math.floor(Math.random() * IDLE_VARIETY_ANIMS.length)];
      setAnim(next);
      setAnimPaused(false);
      idleTimerRef.current = setTimeout(() => {
        if (busyRef.current) return;
        setAnimPaused(true);
        scheduleIdle();
      }, getCatAnimDurationMs(next, 1));
    }, restMs);
  }, []);

  useEffect(() => {
    if (!cat) return undefined;
    scheduleIdle();
    return () => clearTimeout(idleTimerRef.current);
  }, [cat != null, scheduleIdle]);

  function playAnim(next, durationMs) {
    if (reducedMotionRef.current) return;
    clearTimeout(animTimerRef.current);
    clearTimeout(idleTimerRef.current);
    busyRef.current = true;
    setAnim(next);
    setAnimPaused(false);
    animTimerRef.current = setTimeout(() => {
      busyRef.current = false;
      setAnim(IDLE_REST_ANIM);
      setAnimPaused(true);
      scheduleIdle();
    }, durationMs);
  }

  function spawnHeart() {
    const id = heartIdRef.current + 1;
    heartIdRef.current = id;
    setHearts((prev) => [...prev, id]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h !== id));
    }, 1400);
  }

  function playMeow() {
    if (!soundEnabled || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {
      /* autoplay restrictions */
    }
  }

  async function handleSummon() {
    if (!accessToken || summoning) return;
    setSummoning(true);
    try {
      const r = await fetch('/api/my-cat/summon', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '召喚失敗，請重試');
        return;
      }
      if (data.cat) setCat(data.cat);
      if (data.ok && !data.already_summoned) {
        setStatusMsg('🔔 召喚咗喇 · 貓咪 1 小時後返嚟');
      }
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setSummoning(false);
    }
  }

  async function handlePet() {
    if (!accessToken || petting || feeding || cat?.away) return;
    // Daily limit reached → next_pet_available_at is null.
    if (cat?.next_pet_available_at == null) return;
    // Escalating cooldown still counting down.
    if (new Date(cat.next_pet_available_at).getTime() > Date.now()) return;

    setPetting(true);
    playMeow();
    spawnHeart();
    // 摸摸 → 開心 buff 動作
    playAnim('buff', getCatAnimDurationMs('buff', 1));

    try {
      const r = await fetch('/api/my-cat/pet', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ last_line: lastLineRef.current }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '摸摸失敗');
        return;
      }
      if (data.cat) setCat(data.cat);
      if (data.line) {
        lastLineRef.current = data.line;
        setBubble(data.line);
      }
      if (data.counted) {
        setStatusMsg('❤️ 好感度 +20');
      }
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setPetting(false);
    }
  }

  async function handleFeed() {
    if (!accessToken || feeding || cat?.fed_today || cat?.away) return;
    setFeeding(true);
    setStatusMsg('');
    try {
      const r = await fetch('/api/my-cat/feed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '餵食失敗');
        return;
      }
      applyState(data);
      if (data.away) {
        setStatusMsg(data.error || '貓咪離家出走咗，先召喚佢返嚟。');
      } else if (data.already_fed_today) {
        setStatusMsg('今日已餵過罐罐 🐟');
      } else {
        playMeow();
        playAnim('eat', getCatAnimDurationMs('eat', 2));
        setFeedReward({
          exp: data.awarded ? (data.exp_gained || 2) : 0,
          shards: (data.shards_gained || 0) + (data.bonus_shards || 0),
          soul: (data.soul_gained || 0) + (data.bonus_soul || 0),
          leveledUp: !!data.leveled_up,
        });
        if (data.leveled_up) setBubble('升級了！月光又亮了一分 ✨');
      }
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setFeeding(false);
    }
  }

  async function handleShopBuy(skinId) {
    if (!accessToken || shopBusy) return;
    setShopBusy(skinId);
    setStatusMsg('');
    try {
      const r = await fetch('/api/my-cat/shop/buy-cat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ skin_id: skinId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '購買失敗');
        return;
      }
      applyState(data);
      playMeow();
      playAnim('buff', getCatAnimDurationMs('buff', 1));
      setStatusMsg(`✨ 迎咗${data.cat?.family_zh || '新貓'}回家！`);
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setShopBusy(null);
    }
  }

  async function handleShopEquip(skinId) {
    if (!accessToken || shopBusy) return;
    setShopBusy(skinId);
    setStatusMsg('');
    try {
      const r = await fetch('/api/my-cat/equip', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ skin_id: skinId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '換裝失敗');
        return;
      }
      applyState(data);
      playMeow();
      playAnim('buff', getCatAnimDurationMs('buff', 1));
      setStatusMsg('換咗裝備貓咪～');
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setShopBusy(null);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name || renameBusy) return;
    setRenameBusy(true);
    setRenameError('');
    try {
      const r = await fetch('/api/my-cat/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRenameError(data.error || '改名失敗，請重試');
        if (data?.error && r.status === 409) setRenameOpen(false);
        return;
      }
      if (data.cat) setCat(data.cat);
      setRenameOpen(false);
      setStatusMsg(`改名成功 · 以後就叫「${data.cat?.name || name}」`);
      setBubble('Meow～我有名字了！');
      playMeow();
    } catch {
      setRenameError('網路錯誤，請重試');
    } finally {
      setRenameBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="my-cat-panel my-cat-panel--loading">
        <MoonLoading size={40} />
      </div>
    );
  }

  if (loadError || !cat) {
    return (
      <div className="my-cat-panel my-cat-panel--error">
        <p>{loadError || '找不到貓咪。'}</p>
      </div>
    );
  }

  const stageLabel = GROWTH_STAGE_LABELS[cat.growth_stage] || '幼崽';
  const petLimitReached = cat.next_pet_available_at == null;
  const nextPetTs = cat.next_pet_available_at ? new Date(cat.next_pet_available_at).getTime() : 0;
  const cooldownMs = petLimitReached ? 0 : Math.max(0, nextPetTs - nowTs);
  const isAway = !!cat.away;
  const canPet = !isAway && !petLimitReached && cooldownMs <= 0;
  const tooHungry = !isAway && cat.hunger < TOO_HUNGRY_THRESHOLD;
  const returnTs = cat.cat_returns_at ? new Date(cat.cat_returns_at).getTime() : 0;
  const returnMs = Math.max(0, returnTs - nowTs);

  return (
    <div className="my-cat-panel">
      {/* ── 像素房間場景 ── */}
      <div className="my-cat-room">
        <div className="my-cat-room__wall" aria-hidden="true">
          <div className="my-cat-room__window">
            <span className="my-cat-room__moon" />
            <span className="my-cat-room__star my-cat-room__star--1" />
            <span className="my-cat-room__star my-cat-room__star--2" />
            <span className="my-cat-room__star my-cat-room__star--3" />
            <span className="my-cat-room__window-bars" />
          </div>
          <span className="my-cat-room__neon">meow<span className="my-cat-room__neon-tilde" aria-hidden="true">~</span></span>
        </div>
        <Link
          href="/my-cat/guide"
          className="my-cat-room__shelf"
          title="玩法指南 · 點書睇貓咪養成攻略"
          aria-label="玩法指南"
        />
        <div className="my-cat-room__floor" aria-hidden="true" />
        <span className="my-cat-room__beam" aria-hidden="true" />
        <span className="my-cat-room__moonpatch" aria-hidden="true" />

        {bubble && (
          <div className="my-cat-panel__bubble" role="status">
            <span className="my-cat-panel__bubble-tag pixel-font">
              🐾 {cat?.name || '小黑貓'}
            </span>
            <div className="my-cat-panel__bubble-box">
              <span className="my-cat-panel__bubble-ghost" aria-hidden="true">{bubble}</span>
              <span className="my-cat-panel__bubble-text" aria-hidden="true">
                {bubble.slice(0, typedChars)}
                {typedChars < bubble.length && (
                  <span className="my-cat-panel__bubble-cursor">▌</span>
                )}
              </span>
              <span className="my-cat-panel__bubble-sr">{bubble}</span>
            </div>
            <span className="my-cat-panel__bubble-tail" aria-hidden="true" />
          </div>
        )}

        {hearts.map((id) => (
          <span key={id} className="my-cat-room__heart" aria-hidden="true">❤</span>
        ))}

        {feedReward && (
          <div className="my-cat-reward" role="status">
            <div className="my-cat-reward__card">
              <span className="my-cat-reward__exp pixel-font">
                {feedReward.exp > 0 ? `+${feedReward.exp} EXP` : '已打卡'}
              </span>
              <span className="my-cat-reward__sub">🐟 飽腹回滿 100</span>
              {feedReward.shards > 0 && (
                <span className="my-cat-reward__sub">✦ 月光碎屑 +{feedReward.shards}</span>
              )}
              {feedReward.soul > 0 && (
                <span className="my-cat-reward__sub">🔮 靈魂 +{feedReward.soul}</span>
              )}
              {feedReward.leveledUp && (
                <span className="my-cat-reward__sub my-cat-reward__sub--up">⭐ 升級！</span>
              )}
            </div>
          </div>
        )}

        {isAway ? (
          <div className="my-cat-away" role="status">
            <span className="my-cat-away__paws" aria-hidden="true">🐾 🐾 🐾</span>
            <p className="my-cat-away__title pixel-font">貓咪離家出走咗！</p>
            {cat.summon_pending ? (
              <p className="my-cat-away__text">
                🔔 已召喚 · <strong>{formatCooldown(returnMs)}</strong> 後返嚟
              </p>
            ) : (
              <>
                <p className="my-cat-away__text">肚餓到頂唔順，走咗去搵嘢食……</p>
                <button
                  type="button"
                  className="my-cat-away__btn pixel-font"
                  onClick={handleSummon}
                  disabled={summoning}
                >
                  {summoning ? '召喚中…' : '🔔 召喚貓咪'}
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={`my-cat-panel__cat-btn${canPet ? '' : ' my-cat-panel__cat-btn--resting'}`}
            onClick={handlePet}
            disabled={!canPet}
            aria-label="摸摸貓咪"
            title={
              petLimitReached
                ? '今日摸摸已滿，聽日再嚟'
                : canPet
                  ? '摸摸貓咪（Tap to Meow）'
                  // 唔好放倒數入 title：每秒改 title 會令 tooltip 不停閃（倒數睇下面提示行）
                  : '貓咪休息中，等佢唞埋先啦'
            }
          >
            <CatSprite
              skinId={cat.skin_id}
              anim={anim}
              size={150}
              paused={animPaused}
              className={`${cat.growth_stage === 'kitten' ? 'cat-sprite--kitten' : ''}${tooHungry ? ' cat-sprite--starving' : ''}`}
            />
          </button>
        )}

        {/* 遊戲式名牌 */}
        <div className="my-cat-room__nameplate" title={cat.custom_name ? cat.family_zh : undefined}>
          <span className="my-cat-room__name pixel-font">{cat.name}</span>
          {cat.can_rename && (
            <button
              type="button"
              className="my-cat-room__rename-btn"
              onClick={() => {
                setNameInput(cat.custom_name || '');
                setRenameError('');
                setRenameOpen(true);
              }}
              title="幫貓咪改名（只能改一次）"
              aria-label="幫貓咪改名"
            >
              ✏️
            </button>
          )}
        </div>

        {renameOpen && (
          <div className="my-cat-rename" role="dialog" aria-label="幫貓咪改名">
            <form className="my-cat-rename__box" onSubmit={handleRename}>
              <p className="my-cat-rename__title pixel-font">幫貓咪起名</p>
              <input
                type="text"
                className="my-cat-rename__input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={12}
                placeholder="最多 12 個字"
                autoFocus
              />
              <p className="my-cat-rename__note">⚠ 只能改一次，改完唔反悔㗎！</p>
              {renameError && <p className="my-cat-rename__error">{renameError}</p>}
              <div className="my-cat-rename__actions">
                <button
                  type="submit"
                  className="my-cat-rename__btn my-cat-rename__btn--ok"
                  disabled={renameBusy || !nameInput.trim()}
                >
                  {renameBusy ? '改緊…' : '就叫呢個名'}
                </button>
                <button
                  type="button"
                  className="my-cat-rename__btn"
                  onClick={() => setRenameOpen(false)}
                  disabled={renameBusy}
                >
                  再諗下
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <p className={`my-cat-panel__hint${!canPet ? ' my-cat-panel__hint--resting' : ''}`}>
        {isAway ? (
          cat.summon_pending ? (
            <>🌃 貓咪喺出面遊蕩緊 · 就快返嚟喇</>
          ) : (
            <>🌃 飽腹去到 0，貓咪離家出走咗 · 按「召喚」叫佢返嚟</>
          )
        ) : tooHungry ? (
          <>😿 貓咪好肚餓，冇心機郁 · 記得餵罐罐</>
        ) : petLimitReached ? (
          <>🌙 今日摸摸已滿 · 聽日再嚟陪我啦</>
        ) : canPet ? (
          <><span aria-hidden="true">👆</span> 點貓咪摸摸 · 好感 <strong>+20</strong></>
        ) : (
          <>💤 貓咪休息緊 · <strong>{formatCooldown(cooldownMs)}</strong> 後先可以再摸</>
        )}
      </p>

      {/* ── HUD 屬性面板 ── */}
      <div className="my-cat-panel__stats">
        <div className="my-cat-panel__stats-head">
          <p className="my-cat-panel__stats-title pixel-font">STATUS</p>
          <span className="my-cat-stage-badge" title="成長階段">
            <span className="my-cat-stage-badge__icon" aria-hidden="true">🌙</span>
            <span className="my-cat-stage-badge__label pixel-font">{stageLabel}</span>
          </span>
        </div>
        <StatBar icon="🐟" label="飽腹" value={cat.hunger} barClass="my-cat-stat__fill--hunger" />
        <StatBar icon="❤️" label="好感" value={cat.affection} barClass="my-cat-stat__fill--affection" />
        <StatBar icon="🔮" label="靈魂" value={cat.soul} max={cat.soul_max ?? 150} barClass="my-cat-stat__fill--soul" />
      </div>

      <button
        type="button"
        className={`my-cat-panel__feed-btn pixel-font${cat.fed_today ? ' my-cat-panel__feed-btn--done' : ''}`}
        onClick={handleFeed}
        disabled={feeding || cat.fed_today || isAway}
      >
        <span aria-hidden="true">{cat.fed_today ? '✓' : '🥫'}</span>
        {feeding ? '餵食中…' : cat.fed_today ? '今日已餵食' : isAway ? '貓咪出走中…' : '餵食罐罐'}
      </button>

      {statusMsg && (
        <p className="my-cat-panel__status" role="status">{statusMsg}</p>
      )}

      {shop?.has_mirror && (
        <section
          className={`my-cat-shop${shop.unlocked ? '' : ' my-cat-shop--locked'}${shopOpen ? ' my-cat-shop--open' : ''}`}
          aria-label="貓咪商店"
        >
          <button
            type="button"
            className="my-cat-shop__head"
            aria-expanded={shopOpen}
            onClick={() => setShopOpen((v) => !v)}
          >
            <h2 className="my-cat-shop__title pixel-font">🛒 貓咪商店</h2>
            <span className="my-cat-shop__price pixel-font">✦ {shop.moon_shards}</span>
            <span className="my-cat-shop__chevron" aria-hidden="true">{shopOpen ? '▲' : '▼'}</span>
          </button>
          {shopOpen && (
            <>
              {!shop.unlocked && (
                <p className="my-cat-shop__hint">
                  儲夠 <strong>{shop.unlock_cost}</strong> 月光碎屑先可以買家族貓（而家 {shop.moon_shards}）
                </p>
              )}
              <ul className="my-cat-shop__list">
                {shop.skins.map((skin) => {
                  const busy = shopBusy === skin.skin_id;
                  const canBuy = shop.unlocked && !skin.owned && skin.price > 0
                    && shop.moon_shards >= skin.price;
                  const canEquip = skin.owned && !skin.equipped;
                  return (
                    <li
                      key={skin.skin_id}
                      className={`my-cat-shop__item${skin.equipped ? ' my-cat-shop__item--equipped' : ''}`}
                    >
                      <span className="my-cat-shop__name">
                        {skin.family_zh}
                        {skin.is_family && skin.price > 0 && (
                          <span className="my-cat-shop__tag">本命</span>
                        )}
                        {skin.equipped && (
                          <span className="my-cat-shop__tag">裝備中</span>
                        )}
                      </span>
                      <span className="my-cat-shop__price">
                        {skin.price === 0 ? '免費' : `✦ ${skin.price}`}
                      </span>
                      {skin.owned ? (
                        <button
                          type="button"
                          className="my-cat-shop__btn my-cat-shop__btn--equip pixel-font"
                          disabled={!canEquip || busy || isAway}
                          onClick={() => handleShopEquip(skin.skin_id)}
                        >
                          {busy ? '…' : skin.equipped ? '已裝備' : '裝備'}
                        </button>
                      ) : skin.price > 0 ? (
                        <button
                          type="button"
                          className="my-cat-shop__btn pixel-font"
                          disabled={!canBuy || busy}
                          onClick={() => handleShopBuy(skin.skin_id)}
                        >
                          {busy ? '…' : shop.unlocked ? '購買' : '未解鎖'}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="my-cat-panel__footer">
        <div className="my-cat-footer-chip my-cat-footer-chip--shards" title="月光碎屑">
          <span className="my-cat-footer-chip__icon" aria-hidden="true">✦</span>
          <span className="my-cat-footer-chip__body">
            <span className="my-cat-footer-chip__label">月光碎屑</span>
            <span className="my-cat-footer-chip__value pixel-font">{cat.moon_shards}</span>
          </span>
        </div>
        {moonJourney && (
          <div className="my-cat-footer-chip my-cat-footer-chip--growth">
            <span className="my-cat-footer-chip__icon" aria-hidden="true">{moonJourney.emoji}</span>
            <span className="my-cat-footer-chip__body">
              <span className="my-cat-footer-chip__label">
                Lv{moonJourney.level} {moonJourney.title_zh}
              </span>
              {(moonJourney.checkin_streak ?? 0) > 0 && (
                <span className="my-cat-footer-chip__value my-cat-footer-chip__value--streak">
                  🔥 連續 {moonJourney.checkin_streak} 天
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
