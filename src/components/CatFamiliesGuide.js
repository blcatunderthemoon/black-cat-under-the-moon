import Link from 'next/link';
import {
  PERSONALITY_TYPES,
  CAT_IMG_MAP,
  CAT_GLOW_MAP,
  MIRROR_EMOJI,
  TYPE_ORDER,
} from '../lib/mirror-personality.js';
import { TRAIT_LABELS } from '../lib/mirror-scoring-v3.js';
import PixelMixedLabel from './PixelMixedLabel.js';

const GUIDE_ZH = 'cat-families-card__zh';
const GUIDE_EN = 'cat-families-card__en';

export default function CatFamiliesGuide() {
  return (
    <>
      <section className="cat-families-needs-key" aria-labelledby="cat-families-needs-key-title">
        <h2 id="cat-families-needs-key-title" className="cat-families-needs-key__title">
          <PixelMixedLabel text="// 六種戀愛需求" zhClass={GUIDE_ZH} enClass={GUIDE_EN} />
        </h2>
        <p className="cat-families-needs-key__lead">
          Mirror Mode 先量度你在關係裡真正渴望什麼。四大貓家族，只是這些需求的不同旋律。
        </p>
        <ul className="cat-families-needs-key__list">
          {Object.entries(TRAIT_LABELS).map(([key, meta]) => (
            <li key={key} className="cat-families-needs-key__item">
              <span
                className="cat-families-needs-key__dot"
                style={{ '--need-color': meta.color }}
                aria-hidden="true"
              />
              <span className="cat-families-needs-key__label">{meta.label}</span>
              <span className="cat-families-needs-key__hint">{meta.hint}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="cat-families-guide">
        {TYPE_ORDER.map((key) => {
          const family = PERSONALITY_TYPES[key];
          const glow = CAT_GLOW_MAP[key] || family.color;
          const tags = (family.hashtags || []).slice(0, 2);
          const needKeys = family.guideNeedKeys || [];

          return (
            <article
              key={key}
              className="cat-families-card"
              style={{ '--family-glow': glow }}
            >
              <div className="cat-families-card__img-wrap">
                <img
                  className="cat-families-card__img"
                  src={CAT_IMG_MAP[key]}
                  alt={family.nameZh}
                  loading="lazy"
                />
              </div>
              <div className="cat-families-card__body">
                <p className="cat-families-card__emoji" aria-hidden="true">
                  {MIRROR_EMOJI[key]}
                </p>
                <h2 className="cat-families-card__name">
                  <PixelMixedLabel text={family.nameZh} zhClass={GUIDE_ZH} enClass={GUIDE_EN} />
                </h2>
                <p className="cat-families-card__name-en">{family.nameEn}</p>

                {needKeys.length > 0 && (
                  <div className="cat-families-card__needs">
                    <p className="cat-families-card__needs-title">核心需求</p>
                    <ul className="cat-families-card__needs-list">
                      {needKeys.map((traitKey, index) => {
                        const meta = TRAIT_LABELS[traitKey];
                        if (!meta) return null;
                        return (
                          <li key={traitKey} className="cat-families-card__need">
                            <span
                              className="cat-families-card__need-bar"
                              style={{ '--need-color': meta.color, '--need-glow': meta.glow }}
                              aria-hidden="true"
                            />
                            <div className="cat-families-card__need-copy">
                              <span className="cat-families-card__need-label">
                                {meta.label}
                                {index === 0 && (
                                  <span className="cat-families-card__need-primary"> 主軸</span>
                                )}
                              </span>
                              <span className="cat-families-card__need-hint">{meta.hint}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <p className="cat-families-card__desc">{family.desc}</p>

                {family.guideResonate && (
                  <p className="cat-families-card__resonate">{family.guideResonate}</p>
                )}

                {family.warning && (
                  <p className="cat-families-card__warning">{family.warning}</p>
                )}

                {tags.length > 0 && (
                  <div className="cat-families-card__tags">
                    {tags.map((tag) => (
                      <span key={tag} className="cat-families-card__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="cat-families-cta">
        <Link href="/mirror.html" className="pixel-btn pixel-btn--primary cat-families-cta__btn">
          開始 Mirror Mode 測驗
        </Link>
        <Link href="/index.html" className="pixel-link cat-families-cta__back">
          ← 返回主頁
        </Link>
      </div>
    </>
  );
}
