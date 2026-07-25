import { Fragment } from 'react';
import Link from 'next/link';
import {
  PERSONALITY_TYPES,
  CAT_IMG_MAP,
  CAT_GLOW_MAP,
  getPublicProfile,
  formatZodiacDisplay,
  splitPcardMixedText,
} from '../lib/mirror-personality.js';
import PixelMixedLabel from './PixelMixedLabel.js';
import { MirrorTypeIcon } from './UiIcons.js';

function MirrorMetaValue({ value }) {
  const parts = splitPcardMixedText(value);
  return (
    <span className="account-mirror-family__meta-val">
      {parts.map(({ text, zh }, i) => (
        <span
          key={`${i}-${text}`}
          className={zh ? 'account-mirror-family__meta-zh' : 'account-mirror-family__meta-en'}
        >
          {text}
        </span>
      ))}
    </span>
  );
}

function AccountMirrorIdentityMeta({ basicAnswers }) {
  const profile = getPublicProfile(basicAnswers);
  const parts = [
    profile.label,
    profile.mbti,
    formatZodiacDisplay(profile.zodiac),
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className="account-mirror-family__meta" aria-label="鏡像身份">
      {parts.map((val, i) => (
        <Fragment key={val}>
          {i > 0 ? (
            <span className="account-mirror-family__meta-dot" aria-hidden="true">·</span>
          ) : null}
          <MirrorMetaValue value={val} />
        </Fragment>
      ))}
    </div>
  );
}

export default function AccountMirrorFamilySummary({ card, displayName }) {
  const mainType = card?.mirror_type;
  const family = mainType ? PERSONALITY_TYPES[mainType] : null;
  if (!family) return null;

  const glow = CAT_GLOW_MAP[mainType] || family.color;
  const slug = card?.public_slug;

  return (
    <article className="account-mirror-family" style={{ '--family-glow': glow }}>
      <div className="account-mirror-family__glow" aria-hidden="true" />

      <header className="account-mirror-family__head">
        <span className="account-mirror-family__badge">
          <PixelMixedLabel
            text="靈魂鏡像 · MIRROR"
            zhClass="account-mirror-family__badge-zh"
            enClass="account-mirror-family__badge-en"
          />
        </span>
      </header>

      <div className="account-mirror-family__main">
        <div className="account-mirror-family__avatar-wrap">
          <div className="account-mirror-family__avatar-frame">
            <img
              className="account-mirror-family__img"
              src={CAT_IMG_MAP[mainType]}
              alt={family.nameZh}
              loading="lazy"
            />
          </div>
        </div>

        <div className="account-mirror-family__info">
          <div className="account-mirror-family__title-row">
            <span className="account-mirror-family__sigil" aria-hidden="true">
              <MirrorTypeIcon type={mainType} size={17} />
            </span>
            <div className="account-mirror-family__title-block">
              <h2 className="account-mirror-family__name">
                <PixelMixedLabel
                  text={family.nameZh}
                  zhClass="account-mirror-family__zh"
                  enClass="account-mirror-family__en"
                />
              </h2>
              <p className="account-mirror-family__name-en">{family.nameEn}</p>
            </div>
          </div>

          <AccountMirrorIdentityMeta basicAnswers={card?.basic_answers} />

          {displayName ? (
            <p className="account-mirror-family__username">
              <span className="account-mirror-family__username-prefix" aria-hidden="true">@</span>
              <PixelMixedLabel
                text={displayName}
                zhClass="account-mirror-family__username-zh"
                enClass="account-mirror-family__username-en"
              />
            </p>
          ) : null}
        </div>
      </div>

      {slug ? (
        <footer className="account-mirror-family__actions">
          <Link href={`/mirror-card/${slug}`} className="pixel-btn pixel-btn--ghost account-mirror-family__cta">
            查看完整鏡像卡<span className="account-btn-arrow" aria-hidden="true"> ▶</span>
          </Link>
        </footer>
      ) : null}
    </article>
  );
}
