import { Fragment } from 'react';
import Link from 'next/link';
import {
  PERSONALITY_TYPES,
  CAT_IMG_MAP,
  CAT_GLOW_MAP,
  MIRROR_EMOJI,
  getPublicProfile,
  formatZodiacDisplay,
  splitPcardMixedText,
} from '../lib/mirror-personality.js';
import PixelMixedLabel from './PixelMixedLabel.js';

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

function familyDescExcerpt(desc, maxLen = 72) {
  const text = String(desc || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const last = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'), cut.lastIndexOf(' '));
  const end = last > 24 ? last + 1 : maxLen;
  return `${text.slice(0, end).trim()}…`;
}

export default function AccountMirrorFamilySummary({ card, displayName }) {
  const mainType = card?.mirror_type;
  const family = mainType ? PERSONALITY_TYPES[mainType] : null;
  if (!family) return null;

  const glow = CAT_GLOW_MAP[mainType] || family.color;
  const slug = card?.public_slug;
  const tags = (family.hashtags || []).slice(0, 2);
  const excerpt = familyDescExcerpt(family.desc);

  return (
    <article className="account-mirror-family" style={{ '--family-glow': glow }}>
      <div className="account-mirror-family__hero">
        <div className="account-mirror-family__hero-glow" aria-hidden="true" />
        <img
          className="account-mirror-family__img"
          src={CAT_IMG_MAP[mainType]}
          alt={family.nameZh}
          loading="lazy"
        />
        <span className="account-mirror-family__badge">
          <PixelMixedLabel
            text="靈魂鏡像 · MIRROR"
            zhClass="account-mirror-family__badge-zh"
            enClass="account-mirror-family__badge-en"
          />
        </span>
        <span className="account-mirror-family__rivet account-mirror-family__rivet--tl" aria-hidden="true" />
        <span className="account-mirror-family__rivet account-mirror-family__rivet--tr" aria-hidden="true" />
        <span className="account-mirror-family__rivet account-mirror-family__rivet--bl" aria-hidden="true" />
        <span className="account-mirror-family__rivet account-mirror-family__rivet--br" aria-hidden="true" />
      </div>

      <div className="account-mirror-family__body">
        <p className="account-mirror-family__emoji" aria-hidden="true">
          {MIRROR_EMOJI[mainType]}
        </p>
        <h2 className="account-mirror-family__name">
          <PixelMixedLabel
            text={family.nameZh}
            zhClass="account-mirror-family__zh"
            enClass="account-mirror-family__en"
          />
        </h2>
        <p className="account-mirror-family__name-en">{family.nameEn}</p>

        <AccountMirrorIdentityMeta basicAnswers={card?.basic_answers} />

        {displayName ? (
          <p className="account-mirror-family__username">{displayName}</p>
        ) : null}

        {excerpt ? (
          <p className="account-mirror-family__desc">{excerpt}</p>
        ) : null}

        {tags.length > 0 ? (
          <ul className="account-mirror-family__tags" aria-label="家族標籤">
            {tags.map((tag) => (
              <li key={tag} className="account-mirror-family__tag">
                <PixelMixedLabel
                  text={tag}
                  zhClass="account-mirror-family__tag-zh"
                  enClass="account-mirror-family__tag-en"
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="account-mirror-family__actions">
          {slug ? (
            <Link href={`/mirror-card/${slug}`} className="pixel-btn pixel-btn--ghost account-mirror-family__cta">
              查看完整鏡像卡<span className="account-btn-arrow" aria-hidden="true"> ▶</span>
            </Link>
          ) : null}
          <Link href="/cat-families" className="account-mirror-family__guide-link">
            了解貓家族
          </Link>
        </div>
      </div>
    </article>
  );
}
