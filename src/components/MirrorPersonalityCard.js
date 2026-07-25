/**
 * MirrorPersonalityCard — pixel-art personality card matching mirror mode design.
 */

import { useEffect, useRef, useState, Fragment } from 'react';
import { useRouter } from 'next/router';
import {
  PERSONALITY_TYPES,
  CAT_IMG_MAP,
  CAT_GLOW_MAP,
  computeHybridTitle,
  getPublicProfile,
  getTopIngredientBars,
  splitCsv,
  cleanHobbyTag,
  formatZodiacDisplay,
  splitPcardMixedText,
} from '../lib/mirror-personality.js';
import { getTraitBars } from '../lib/mirror-scoring-v3.js';
import { assembleNarrative, formatWarningSteps } from '../lib/mirror-narratives/index.js';
import { MIRROR_NARRATIVE_LABELS, MIRROR_WARNING_STEP_LABELS, joinMirrorText, getMirrorHero, splitMoonWhisperCopy } from '../lib/mirror-narrative-ui.js';
import { getSiteHost } from '../lib/site-seo.js';

function PcardMixedText({ children, as: Tag = 'span', className }) {
  const text = children == null ? '' : String(children);
  if (text.charAt(0) === '#') {
    const parts = splitPcardMixedText(text.slice(1));
    return (
      <Tag className={className}>
        <span className="pcard-en">#</span>
        {' '}
        {parts.map(({ text: part, zh }, i) => (
          <span key={`${i}-${part}`} className={zh ? 'pcard-zh' : 'pcard-en'}>
            {part}
          </span>
        ))}
      </Tag>
    );
  }
  const parts = splitPcardMixedText(text);
  if (!parts.length) return null;
  return (
    <Tag className={className}>
      {parts.map(({ text: part, zh }, i) => (
        <span key={`${i}-${part}`} className={zh ? 'pcard-zh' : 'pcard-en'}>
          {part}
        </span>
      ))}
    </Tag>
  );
}

function MetaRow({ profile }) {
  const parts = [
    profile?.label,
    profile?.mbti,
    formatZodiacDisplay(profile?.zodiac),
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className="pcard-profile-meta">
      {parts.map((val, i) => (
        <Fragment key={`${val}-${i}`}>
          {i > 0 && (
            <span className="pcard-profile-dot" aria-hidden="true">·</span>
          )}
          <span className="pcard-profile-val">
            {splitPcardMixedText(val).map(({ text: part, zh }, j) => (
              <span key={`${j}-${part}`} className={zh ? 'pcard-zh' : 'pcard-en'}>
                {part}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function OwnerNameBar({ displayName, onClick, clickable }) {
  if (!displayName) return null;
  const inner = (
    <div
      className="pcard-owner-name"
      style={clickable ? { cursor: 'pointer' } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onClick?.(); } : undefined}
    >
      {displayName}
    </div>
  );
  if (clickable && onClick) {
    return (
      <button type="button" className="pcard-owner-name-btn" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return inner;
}

function HobbyRows({ basicAnswers }) {
  if (!basicAnswers) return null;
  const rows = [
    { label: '喜好', items: splitCsv(basicAnswers.p3) },
    { label: '音樂', items: splitCsv(basicAnswers.p4) },
    { label: '電影', items: splitCsv(basicAnswers.p5) },
  ].filter((r) => r.items.length);

  if (!rows.length) return null;

  return (
    <div className="pcard-hobby-divider">
      {rows.map((row) => (
        <div key={row.label} className="pcard-profile-row">
          <span className="pcard-profile-label">{row.label}</span>
          <div className="pcard-profile-tags">
            {row.items.map((t) => (
              <span key={t} className="pcard-profile-tag">{cleanHobbyTag(t)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TraitSpectrum({ bars }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const spectrumRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (spectrumRef.current && !spectrumRef.current.contains(e.target)) {
        setActiveIdx(null);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  if (!bars.length) return null;

  function toggleIdx(idx) {
    setActiveIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="pcard-trait-spectrum" ref={spectrumRef}>
      <div className="pcard-trait-spectrum__track">
        {bars.map((bar, idx) => (
          <div
            key={bar.key}
            className={`pcard-trait-spectrum__seg${activeIdx === idx ? ' is-active' : ''}`}
            style={{
              width: `${bar.pct}%`,
              backgroundColor: bar.color,
              '--trait-color': bar.color,
              '--trait-glow': bar.glow || bar.color,
            }}
            data-label={bar.label}
            data-tip={`${bar.label} · ${bar.pct}%`}
            data-hint={bar.hint || ''}
            role="button"
            aria-label={bar.hint ? `${bar.label} ${bar.pct}%：${bar.hint}` : `${bar.label} ${bar.pct}%`}
            title={bar.label}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleIdx(idx);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleIdx(idx);
              }
            }}
          />
        ))}
      </div>
      <ul className="pcard-trait-spectrum__legend">
        {bars.map((bar, idx) => (
          <li
            key={bar.key}
            className={`pcard-trait-spectrum__item${activeIdx === idx ? ' is-linked' : ''}`}
            style={{
              '--trait-color': bar.color,
              '--trait-glow': bar.glow || bar.color,
            }}
            tabIndex={bar.hint ? 0 : undefined}
            aria-label={bar.hint ? `${bar.label} ${bar.pct}%：${bar.hint}` : undefined}
            onClick={(e) => {
              e.stopPropagation();
              toggleIdx(idx);
            }}
          >
            <span className="pcard-trait-spectrum__dot" aria-hidden="true" />
            <span className="pcard-trait-spectrum__name">{bar.label}</span>
            <span className="pcard-trait-spectrum__pct">{bar.pct}%</span>
            {bar.hint ? (
              <span className="pcard-trait-spectrum__tip" role="tooltip">{bar.hint}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IngredientBars({ bars, ingredientLabel = '// 靈魂成分', variant = 'cat' }) {
  if (!bars.length) return null;
  return (
    <>
      <div className={`pcard-ingredients-label${variant === 'trait' ? ' pcard-ingredients-label--trait' : ''}`}>
        {ingredientLabel}
      </div>
      {variant === 'trait' ? (
        <TraitSpectrum bars={bars} />
      ) : (
        <div className="pcard-bars">
          {bars.map((bar) => (
            <div key={bar.key} className="pcard-bar-row">
              <div className="pcard-bar-label">{bar.label}</div>
              <div className="pcard-bar-wrap">
                <div
                  className="pcard-bar-fill"
                  data-pct={bar.pct}
                  style={{ width: '0%', backgroundColor: bar.color }}
                />
              </div>
              <span className="pcard-bar-heart">♥</span>
              <div className="pcard-bar-pct">{bar.pct}%</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FamilyNameReveal({ nameZh, worldview }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const text = joinMirrorText(worldview);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  if (!text) {
    return <div className="pcard-family-name pcard-zh">{nameZh}</div>;
  }

  return (
    <div
      ref={wrapRef}
      className={`pcard-family-name-wrap pcard-family-name-wrap--reveal${open ? ' pcard-family-name-wrap--open' : ''}`}
    >
      <button
        type="button"
        className="pcard-family-name-btn"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="pcard-family-name pcard-zh">{nameZh}</span>
      </button>
      <p className="pcard-family-magic pcard-zh" role="region">「{text}」</p>
    </div>
  );
}

function HeroBlock({ narrative, mirrorType }) {
  const hero = getMirrorHero(mirrorType);
  if (!hero.hero) return null;
  const sub = joinMirrorText(narrative?.insight) || hero.heroSub || '';
  return (
    <div className="pcard-hero-block">
      <p className="pcard-hero-line pcard-zh">{hero.hero}</p>
      {sub ? <p className="pcard-hero-sub pcard-zh">{sub}</p> : null}
    </div>
  );
}

function BerserkStep({ idx, keyClass, label, text }) {
  return (
    <div className="pcard-berserk-terminal__step">
      <span className="pcard-berserk-terminal__idx" aria-hidden="true">{idx}</span>
      <span className={`pcard-berserk-terminal__key pcard-berserk-terminal__key--${keyClass} pcard-zh`}>
        {label}
      </span>
      <span className="pcard-berserk-terminal__prompt" aria-hidden="true">&gt;</span>
      <p className="pcard-berserk-terminal__val">{joinMirrorText(text)}</p>
    </div>
  );
}

function NarrativeWarning({ narrative, legacyWarning }) {
  if (narrative?.warning?.trigger) {
    const steps = formatWarningSteps(narrative.warning);
    if (!steps) return null;
    return (
      <div className="pcard-narrative-block">
        <div className="pcard-berserk-terminal">
          <div className="pcard-berserk-terminal__scan" aria-hidden="true" />
          <div className="pcard-berserk-terminal__head">
            <span className="pcard-berserk-terminal__icon" aria-hidden="true">⚠</span>
            <span className="pcard-berserk-terminal__title pcard-zh">
              {MIRROR_NARRATIVE_LABELS.warn.zh}
            </span>
          </div>
          <div className="pcard-berserk-terminal__body">
            <BerserkStep idx="01" keyClass="trigger" label={MIRROR_WARNING_STEP_LABELS.trigger} text={steps.trigger} />
            <BerserkStep idx="02" keyClass="reaction" label={MIRROR_WARNING_STEP_LABELS.reaction} text={steps.reaction} />
            <BerserkStep idx="03" keyClass="recovery" label={MIRROR_WARNING_STEP_LABELS.recovery} text={steps.recovery} />
          </div>
        </div>
      </div>
    );
  }
  const legacy = narrative?.warningLegacy || legacyWarning;
  if (!legacy) return null;
  return (
    <div className="pcard-warning pcard-warning--legacy" style={{ marginTop: 6 }}>
      黑貓警戒：{legacy}
    </div>
  );
}

function MoonlightBlock({ text }) {
  const parts = splitMoonWhisperCopy(text);
  if (!parts.lead) return null;
  return (
    <div className="pcard-narrative-block pcard-narrative-block--whisper">
      <div className="pcard-moon-whisper__label pcard-zh">{MIRROR_NARRATIVE_LABELS.moon.zh}</div>
      <div className="pcard-moon-whisper">
        <div className="pcard-moon-whisper__body">
          <p className="pcard-moon-whisper__lead pcard-zh">{parts.lead}</p>
          {parts.tail ? <p className="pcard-moon-whisper__tail pcard-zh">{parts.tail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function MirrorPersonalityCard({
  card,
  owner,
  viewerLevel,
  isLoggedIn,
  isOwner = false,
  slug,
  hideOwnerBar = false,
  hideCta = false,
}) {
  const router = useRouter();
  const cardRef = useRef(null);
  const isDetailed = viewerLevel === 'detailed';
  const mainType = card?.mirror_type;
  const p = PERSONALITY_TYPES[mainType] || {};
  const glowCol = CAT_GLOW_MAP[mainType] || '#bd93f9';
  const catImg = CAT_IMG_MAP[mainType] || '';

  const profile = isDetailed
    ? getPublicProfile(card?.basic_answers)
    : (card?.public_profile || {});

  const hybridTitle = isDetailed
    ? computeHybridTitle(card?.mirror_scores, mainType, card?.shadow_type)
    : null;

  const bars = isDetailed
    ? (card?.scoring_version === 'v3_trait' && card?.trait_scores
      ? getTraitBars(card.trait_scores)
      : getTopIngredientBars(card?.mirror_scores))
    : [];

  const narrative = isDetailed
    ? assembleNarrative({
        mirrorType: mainType,
        shadowType: card?.shadow_type,
        traitScores: card?.trait_scores,
        answers: card?.basic_answers,
        scoringVersion: card?.scoring_version,
        includeMisread: true,
        includeMoonlight: true,
      })
    : null;

  function handleOwnerClick() {
    if (isOwner) {
      router.push('/mirror-card/me');
      return;
    }
    if (!isLoggedIn) {
      router.push(`/login?redirect=/mirror-card/${encodeURIComponent(slug || '')}`);
    }
  }

  // Animate ingredient bars after mount
  useEffect(() => {
    if (!isDetailed || !cardRef.current) return;
    const timer = setTimeout(() => {
      cardRef.current.querySelectorAll('.pcard-bar-fill').forEach((bar) => {
        const pct = bar.getAttribute('data-pct');
        if (pct) bar.style.width = `${pct}%`;
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [isDetailed, card]);

  return (
    <div
      id="personality-card"
      ref={cardRef}
      className="mirror-public-card"
      style={{ '--type-col': glowCol }}
    >
      <div className="pcard-rivet pcard-rivet-tl" />
      <div className="pcard-rivet pcard-rivet-tr" />
      <div className="pcard-rivet pcard-rivet-bl" />
      <div className="pcard-rivet pcard-rivet-br" />

      <div className="pcard-header">
        <div className="pcard-brand">BLACK CAT<br />UNDER THE MOON</div>
      </div>
      <div className="pcard-divider" />
      <PcardMixedText as="div" className="pcard-mode-badge">
        靈魂鏡像 · MIRROR MODE
      </PcardMixedText>

      <div className="pcard-section">
        <div className="pcard-avatar-wrap">
          {catImg && (
            <img
              className="pcard-cat-img"
              src={catImg}
              alt={mainType || 'cat'}
              draggable={false}
            />
          )}
        </div>

        {isDetailed && hybridTitle && (
          <PcardMixedText as="div" className="pcard-hybrid-title">
            {hybridTitle}
          </PcardMixedText>
        )}

        <FamilyNameReveal nameZh={p.nameZh || mainType} worldview={narrative?.worldview} />
        <div className="pcard-family-en">{p.nameEn || ''}</div>
        <MetaRow profile={profile} />

        {!isDetailed && !hideOwnerBar && (
          <OwnerNameBar
            displayName={owner?.display_name}
            clickable={isOwner || !isLoggedIn}
            onClick={handleOwnerClick}
          />
        )}
      </div>

      {isDetailed && (
        <>
          <div className="pcard-section">
            <HeroBlock narrative={narrative} mirrorType={mainType} />
            <NarrativeWarning narrative={narrative} legacyWarning={p.warning} />
            <MoonlightBlock text={narrative?.moonlight} />
            {card?.tension_narratives?.length > 0 && (
              <div className="pcard-tension">
                {card.tension_narratives.map((t) => (
                  <p key={t.id} className="pcard-tension__line">「{t.copy_zh}」</p>
                ))}
              </div>
            )}
            <IngredientBars
              bars={bars.map((b) => ({ ...b }))}
              ingredientLabel={card?.scoring_version === 'v3_trait' ? '需求光譜' : '// 靈魂成分'}
              variant={card?.scoring_version === 'v3_trait' ? 'trait' : 'cat'}
            />
          </div>

          <div className="pcard-section pcard-section--panel">
            <div className="pcard-tags">
              {(p.hashtags || []).map((h) => (
                <PcardMixedText key={h} as="span" className="pcard-tag">
                  {h}
                </PcardMixedText>
              ))}
            </div>
            <HobbyRows basicAnswers={card?.basic_answers} />
          </div>
        </>
      )}

      {isDetailed && !hideCta && (
        <div className="pcard-cta">
          <div className="pcard-cta-text">測測你是哪隻貓 ➡️</div>
          <div className="pcard-cta-url">{getSiteHost()}</div>
        </div>
      )}
    </div>
  );
}
