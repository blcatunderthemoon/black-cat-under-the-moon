/**
 * /my-cat/guide — 月光貓養成秘笈（遊戲書風格）
 * Entry: clicking the pixel bookshelf in the cat room (MyCatPanel).
 */

import AppShell from '../../components/AppShell.js';
import AppHeaderAuth from '../../components/AppHeaderAuth.js';
import SeoHead from '../../components/SeoHead.js';
import CatSprite from '../../components/CatSprite.js';
import {
  ForumCrystalIcon,
  ForumPawIcon,
  ForumSparkleIcon,
  HeaderBellIcon,
  HeaderHeartIcon,
  UiFishIcon,
  UiPenIcon,
  UiWarningIcon,
} from '../../components/UiIcons.js';

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
        description="我的月光貓完整玩法：早晚兩餐餵食打卡、摸摸貓咪、屬性成長與月光碎屑。"
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

          <Chapter no={1} ribbon="#ffb347" title="一日兩餐＝早晚打卡" meow="罐罐！罐罐！早晚記得餵！">
            <ul className="my-cat-guide__list">
              <li>每日（香港時間）分 <strong>兩餐</strong>：<strong>早餐 00:00–17:00</strong>、<strong>晚餐 17:01–23:59</strong>，各可以餵 <strong>一次</strong>。</li>
              <li>每餐飽腹即刻<strong>回滿 100</strong>，之後 <strong>30 小時</strong>內慢慢跌返落 0 — 記得早晚返嚟續命！</li>
              <li>獎勵分開兩餐領：<strong>碎屑早 +2 / 晚 +1</strong>（全日仍然 <strong>+3</strong>）。</li>
              <li>當日 <strong>第一餐</strong>順便完成每日打卡（EXP +2、連續打卡日數 +1）。</li>
            </ul>
            <Loot items={['每餐飽腹回滿 100', 'EXP +2（每日第一餐）', '碎屑早 +2 / 晚 +1（全日 +3）']} />
          </Chapter>

          <Chapter no={2} ribbon="#ff8a5c" title="貓咪離家出走？！" meow="唔係嬲你，我只係去咗搵嘢食。">
            <ul className="my-cat-guide__list">
              <li>飽腹低過 <strong>20</strong>：貓咪好肚餓，<strong>冇心機郁</strong>，會灰灰哋坐定定等罐罐。</li>
              <li>飽腹去到 <strong>0</strong>：貓咪會<strong>離家出走</strong>！房間得返一行腳印，餵食同摸摸都會做唔到。</li>
              <li>
                按「
                <strong>
                  <HeaderBellIcon size={12} /> 召喚貓咪
                </strong>
                」之後，要等 <strong>1 小時</strong>佢先肯返嚟（有倒數計時）。
              </li>
              <li>返嚟之後即刻餵罐罐，飽腹回滿 100，一切如常。</li>
            </ul>
          </Chapter>

          <Chapter no={3} ribbon="#ff7ad9" title="摸摸貓咪（Tap to Meow）" meow="摸兩下就夠喇……先講住。">
            <ul className="my-cat-guide__list">
              <li>點擊貓咪，佢會 <strong>Meow~</strong> 一聲、擺個開心動作，仲會同你講嘢。</li>
              <li>每次成功摸摸：好感 <strong>+20</strong>，每日最多 <strong>5 次</strong> — 摸滿 5 次好感必定爆滿 100！</li>
              <li>好感同飽腹一樣會喺 <strong>30 小時</strong>內慢慢跌返落 0，想貓咪日日黐身就要日日摸。</li>
              <li><strong>好感愈高，貓咪愈活躍</strong>：會更頻密咁舔毛、伸懶腰、擺尾；好感低就淨係坐喺度眨眼。</li>
              <li>好感夠高，會解鎖新嘅台詞池。</li>
            </ul>
            <ol className="my-cat-guide__timeline" aria-label="摸摸冷卻時間">
              {['即時', '3分', '15分', '30分', '1小時'].map((t, i) => (
                <li key={t} className="my-cat-guide__timeline-step">
                  <span className="my-cat-guide__timeline-node" aria-hidden="true">
                    <span className="my-cat-guide__timeline-heart">
                      <HeaderHeartIcon size={13} />
                    </span>
                  </span>
                  <span className="my-cat-guide__timeline-no pixel-font">{i + 1}</span>
                  <span className="my-cat-guide__timeline-label pixel-font">{t}</span>
                </li>
              ))}
            </ol>
          </Chapter>

          <Chapter no={4} ribbon="#4fc3f7" title="三大屬性" meow="我嘅靈魂比你想像中深邃。">
            <ul className="my-cat-guide__stats">
              <li className="my-cat-guide__stat" style={{ '--stat': '#4fc3f7', '--fill': '72%' }}>
                <span className="my-cat-guide__stat-name">
                  <strong>
                    <UiFishIcon size={13} /> 飽腹
                  </strong>
                </span>
                <span className="my-cat-guide__statbar" aria-hidden="true"><span className="my-cat-guide__statbar-fill" /></span>
                <span className="my-cat-guide__stat-desc">餵食回滿 100，30 小時內線性跌到 0。低過 20 貓咪<strong>冇心機郁</strong>；去到 0 會<strong>離家出走</strong>（召喚後 1 小時返嚟）。</span>
              </li>
              <li className="my-cat-guide__stat" style={{ '--stat': '#ff6b9d', '--fill': '54%' }}>
                <span className="my-cat-guide__stat-name">
                  <strong>
                    <HeaderHeartIcon size={13} /> 好感
                  </strong>
                </span>
                <span className="my-cat-guide__statbar" aria-hidden="true"><span className="my-cat-guide__statbar-fill" /></span>
                <span className="my-cat-guide__stat-desc">每次摸 +20，摸滿 5 次到頂 100；同飽腹一樣，30 小時內慢慢跌到 0。<strong>好感愈高，貓咪愈活躍</strong>，會更加密咁做唔同小動作。</span>
              </li>
              <li className="my-cat-guide__stat" style={{ '--stat': '#bd93f9', '--fill': '38%' }}>
                <span className="my-cat-guide__stat-name">
                  <strong>
                    <ForumCrystalIcon size={13} /> 靈魂
                  </strong>
                </span>
                <span className="my-cat-guide__statbar" aria-hidden="true"><span className="my-cat-guide__statbar-fill" /></span>
                <span className="my-cat-guide__stat-desc">做 Mirror 性格測驗、玩漂流瓶和 Forum 會提升；<strong>唔會衰減</strong>，係成長進化嘅關鍵。</span>
              </li>
            </ul>
          </Chapter>

          <Chapter no={5} ribbon="#bd93f9" title="成長階段" meow="有一日你會見到我真正嘅樣。">
            <ul className="my-cat-guide__list">
              <li>靈魂值<strong>唔會跌</strong>，但每日靈魂有上限，體型愈大愈難升——認真養大約<strong>兩個月先一個階段</strong>。</li>
            </ul>
            <ol className="my-cat-guide__evo">
              <li className="my-cat-guide__evo-step">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--s1" aria-hidden="true" />
                <span className="my-cat-guide__evo-name pixel-font">幼崽</span>
                <span className="my-cat-guide__evo-req">初次見面 · 靈魂 &lt; 90</span>
              </li>
              <li className="my-cat-guide__evo-arrow" aria-hidden="true">▶</li>
              <li className="my-cat-guide__evo-step">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--s2" aria-hidden="true" />
                <span className="my-cat-guide__evo-name pixel-font">少年貓</span>
                <span className="my-cat-guide__evo-req">靈魂 ≥ 90 · 約 6–8 週</span>
              </li>
              <li className="my-cat-guide__evo-arrow" aria-hidden="true">▶</li>
              <li className="my-cat-guide__evo-step">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--s3" aria-hidden="true" />
                <span className="my-cat-guide__evo-name pixel-font">成貓</span>
                <span className="my-cat-guide__evo-req">靈魂 ≥ 190 + Mirror · 約 3–4 個月</span>
              </li>
              <li className="my-cat-guide__evo-arrow" aria-hidden="true">▶</li>
              <li className="my-cat-guide__evo-step my-cat-guide__evo-step--locked">
                <span className="my-cat-guide__evo-icon my-cat-guide__evo-icon--mystery" aria-hidden="true">?</span>
                <span className="my-cat-guide__evo-name pixel-font">混血形態</span>
                <span className="my-cat-guide__evo-req">靈魂 ≥ 290 + ??? · 最漫長</span>
              </li>
            </ol>
            <ul className="my-cat-guide__list">
              <li>靈魂只由<strong>參與</strong>得來：Mirror 性格測驗（一次性 +8）、玩漂流瓶（每日 +1 封頂）、Forum 發帖（每日 +2 封頂）。餵食<strong>唔再加靈魂</strong>，凈係回飽腹同碎屑。</li>
              <li>靈魂上限 <strong>300</strong>，每日靈魂有上限——要日日返嚟做唔同互動先養得大，冇捷徑。</li>
            </ul>
          </Chapter>

          <Chapter no={6} ribbon="#ffe08a" title="月光碎屑" meow="碎屑唔係垃圾，係貨幣！">
            <ul className="my-cat-guide__list">
              <li>
                每餐餵食都會賺到 <ForumSparkleIcon size={12} /> 月光碎屑（早 +2 / 晚 +1），喺頁面底部可以睇到餘額。
              </li>
              <li>將來嘅「貓咪商店」可以用碎屑換新貓咪同房間裝飾，記住儲定先！</li>
            </ul>
          </Chapter>

          <Chapter no={7} ribbon="#8be9a8" title="幫貓咪改名" meow="名改咗就係我嘅一部分，諗清楚。">
            <ul className="my-cat-guide__list">
              <li>
                點名牌旁邊嘅 <UiPenIcon size={12} /> 就可以幫貓咪起名（最多 12 個字）。
              </li>
              <li>
                <UiWarningIcon size={12} /> 只能改 <strong>一次</strong>，改完唔反悔㗎！
              </li>
            </ul>
          </Chapter>

          {/* ── 封底 ── */}
          <footer className="my-cat-guide__back-cover">
            <p className="my-cat-guide__fin pixel-font">— 全書完 —</p>
            <p className="my-cat-guide__outro">
              <ForumPawIcon size={14} /> 早晚返嚟各餵一餐、摸一摸，月光貓會一直陪住你。
            </p>
          </footer>
        </div>
      </AppShell>
    </>
  );
}
