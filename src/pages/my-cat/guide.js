/**
 * /my-cat/guide — 月光貓養成秘笈（遊戲書風格）
 * Entry: clicking the pixel bookshelf in the cat room (MyCatPanel).
 */

import AppShell from '../../components/AppShell.js';
import AppHeaderAuth from '../../components/AppHeaderAuth.js';
import SeoHead from '../../components/SeoHead.js';
import CatSprite from '../../components/CatSprite.js';

/* 章節絲帶顏色 = 房間書架四本書嘅顏色 */
function Chapter({ no, ribbon, title, meow, children }) {
  return (
    <section className="my-cat-guide__chapter" style={{ '--ribbon': ribbon }}>
      <header className="my-cat-guide__chapter-head">
        <span className="my-cat-guide__chapter-no pixel-font">CH.{no}</span>
        <h2 className="my-cat-guide__chapter-title">{title}</h2>
      </header>
      {children}
      {meow && <p className="my-cat-guide__meow">「{meow}」</p>}
    </section>
  );
}

function Loot({ items }) {
  return (
    <div className="my-cat-guide__loot" aria-label="獎勵">
      {items.map((it) => (
        <span key={it} className="my-cat-guide__loot-item pixel-font">{it}</span>
      ))}
    </div>
  );
}

export default function MyCatGuidePage() {
  return (
    <>
      <SeoHead
        title="月光貓養成秘笈"
        description="我的月光貓完整玩法：每日餵食打卡、摸摸貓咪、屬性成長與月光碎屑。"
        path="/my-cat/guide"
        noindex
      />
      <AppShell
        title="月光貓養成秘笈"
        backHref="/my-cat"
        maxWidth="560px"
        pageClassName="app-page--my-cat"
        nav={<AppHeaderAuth redirectPath="/my-cat/guide" />}
      >
        <div className="my-cat-guide">
          {/* ── 封面 ── */}
          <header className="my-cat-guide__cover">
            <span className="my-cat-guide__cover-moon" aria-hidden="true" />
            <CatSprite anim="sit_slowblink" size={96} alt="小黑貓坐喺封面上" />
            <p className="my-cat-guide__cover-eyebrow pixel-font">★ OFFICIAL GUIDE BOOK ★</p>
            <h1 className="my-cat-guide__cover-title pixel-font">月光貓養成秘笈</h1>
            <p className="my-cat-guide__cover-sub">著・小黑貓｜月光出版社 · 初版</p>
          </header>

          <Chapter no={1} ribbon="#ffb347" title="每日餵食＝打卡" meow="罐罐！罐罐！唔該每日準時。">
            <ul className="my-cat-guide__list">
              <li>每日（香港時間）可以餵 <strong>一次</strong> 罐罐，同時就係你嘅每日打卡。</li>
              <li>連續每日餵食可以累積連續打卡日數 🔥。</li>
            </ul>
            <Loot items={['🐟 飽腹 +25', '⭐ EXP +2', '✦ 碎屑 +3']} />
          </Chapter>

          <Chapter no={2} ribbon="#ff7ad9" title="摸摸貓咪（Tap to Meow）" meow="摸兩下就夠喇……先講住。">
            <ul className="my-cat-guide__list">
              <li>點擊貓咪，佢會 <strong>Meow~</strong> 一聲、擺個開心動作，仲會同你講嘢。</li>
              <li>每次成功摸摸：❤️ 好感 <strong>+2</strong>，每日最多 <strong>5 次</strong>。</li>
              <li>好感夠高，會解鎖新嘅台詞池 😽。</li>
            </ul>
            <ol className="my-cat-guide__timeline" aria-label="摸摸冷卻時間">
              {['即時', '3分', '15分', '30分', '1小時'].map((t, i) => (
                <li key={t} className="my-cat-guide__timeline-step">
                  <span className="my-cat-guide__timeline-node" aria-hidden="true">
                    <span className="my-cat-guide__timeline-heart">❤️</span>
                  </span>
                  <span className="my-cat-guide__timeline-no pixel-font">{i + 1}</span>
                  <span className="my-cat-guide__timeline-label pixel-font">{t}</span>
                </li>
              ))}
            </ol>
          </Chapter>

          <Chapter no={3} ribbon="#4fc3f7" title="三大屬性" meow="我嘅靈魂比你想像中深邃。">
            <ul className="my-cat-guide__stats">
              <li className="my-cat-guide__stat" style={{ '--stat': '#4fc3f7', '--fill': '72%' }}>
                <span className="my-cat-guide__stat-name"><strong>🐟 飽腹</strong></span>
                <span className="my-cat-guide__statbar" aria-hidden="true"><span className="my-cat-guide__statbar-fill" /></span>
                <span className="my-cat-guide__stat-desc">靠每日餵食維持；漏咗餵每日跌 8（最低 20，餓極唔會死）。</span>
              </li>
              <li className="my-cat-guide__stat" style={{ '--stat': '#ff6b9d', '--fill': '54%' }}>
                <span className="my-cat-guide__stat-name"><strong>❤️ 好感</strong></span>
                <span className="my-cat-guide__statbar" aria-hidden="true"><span className="my-cat-guide__statbar-fill" /></span>
                <span className="my-cat-guide__stat-desc">靠摸摸累積；連續 3 日冇理佢會跌 5（最低 30）。</span>
              </li>
              <li className="my-cat-guide__stat" style={{ '--stat': '#bd93f9', '--fill': '38%' }}>
                <span className="my-cat-guide__stat-name"><strong>🔮 靈魂</strong></span>
                <span className="my-cat-guide__statbar" aria-hidden="true"><span className="my-cat-guide__statbar-fill" /></span>
                <span className="my-cat-guide__stat-desc">做 Mirror 性格測驗、玩月光漂流瓶會提升，係成長嘅關鍵。</span>
              </li>
            </ul>
          </Chapter>

          <Chapter no={4} ribbon="#bd93f9" title="成長階段" meow="有一日你會見到我真正嘅樣。">
            <ol className="my-cat-guide__evo">
              <li className="my-cat-guide__evo-step">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--s1" aria-hidden="true" />
                <span className="my-cat-guide__evo-name pixel-font">幼崽</span>
                <span className="my-cat-guide__evo-req">初次見面</span>
              </li>
              <li className="my-cat-guide__evo-arrow" aria-hidden="true">▶</li>
              <li className="my-cat-guide__evo-step">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--s2" aria-hidden="true" />
                <span className="my-cat-guide__evo-name pixel-font">少年貓</span>
                <span className="my-cat-guide__evo-req">靈魂 ≥ 45 或 Lv4</span>
              </li>
              <li className="my-cat-guide__evo-arrow" aria-hidden="true">▶</li>
              <li className="my-cat-guide__evo-step">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--s3" aria-hidden="true" />
                <span className="my-cat-guide__evo-name pixel-font">成貓</span>
                <span className="my-cat-guide__evo-req">靈魂 ≥ 75 + Mirror Card</span>
              </li>
              <li className="my-cat-guide__evo-arrow" aria-hidden="true">▶</li>
              <li className="my-cat-guide__evo-step my-cat-guide__evo-step--locked">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--mystery" aria-hidden="true">?</span>
                <span className="my-cat-guide__evo-name pixel-font">混血形態</span>
                <span className="my-cat-guide__evo-req">靈魂 ≥ 92 + ???</span>
              </li>
            </ol>
          </Chapter>

          <Chapter no={5} ribbon="#ffe08a" title="月光碎屑" meow="碎屑唔係垃圾，係貨幣！">
            <ul className="my-cat-guide__list">
              <li>每日餵食會賺到 ✦ 月光碎屑，喺頁面底部可以睇到餘額。</li>
              <li>將來嘅「貓咪商店」可以用碎屑換新貓咪同房間裝飾，記住儲定先！</li>
            </ul>
          </Chapter>

          <Chapter no={6} ribbon="#8be9a8" title="幫貓咪改名" meow="名改咗就係我嘅一部分，諗清楚。">
            <ul className="my-cat-guide__list">
              <li>點名牌旁邊嘅 ✏️ 就可以幫貓咪起名（最多 12 個字）。</li>
              <li>⚠ 只能改 <strong>一次</strong>，改完唔反悔㗎！</li>
            </ul>
          </Chapter>

          {/* ── 封底 ── */}
          <footer className="my-cat-guide__back-cover">
            <p className="my-cat-guide__fin pixel-font">— 全書完 —</p>
            <p className="my-cat-guide__outro">🐾 每晚返嚟餵一餵、摸一摸，月光貓會一直陪住你。</p>
          </footer>
        </div>
      </AppShell>
    </>
  );
}
