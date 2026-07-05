# 靈魂鏡像 Mirror Mode — 問題與計分邏輯說明

**版本**：v2.5（2026-07-06）— **v3 Trait 計分**與 **v4 敘事模組（部分）** 已上線  
**問卷入口**：`index.html` → Mirror Mode → **`/mirror.html`**  
**Trait 計分主線**：[`MIRROR-MODE-V3-DESIGN.md`](./MIRROR-MODE-V3-DESIGN.md)（**已上線**）  
**敘事模組**：本文件 **§2.1**（L1–L2、L5、三段式 Warning、月光提醒 **已實作**；L3 Shadow、L4 擴充 **待做**）  
**程式來源**：
- 問卷與計分：`public/js/questionnaire.js`（`computeAndShowMirrorResult`）；v3 題庫 bundle：`public/js/mirror-v3.js`（`npm run build:mirror-v3`）
- v3 計分：`src/lib/mirror-scoring-v3.js`
- 敘事組裝：`src/lib/mirror-narratives/` → `assembleNarrative()`；瀏覽器 bundle：`public/js/mirror-narratives.js`
- 卡片資料與 helper：`src/lib/mirror-personality.js`；React 卡：`src/components/MirrorPersonalityCard.js`
- 公開卡片頁：`/mirror-card/[slug]`、`/mirror-card/me`
- 家族介紹：`/cat-families`（`CatFamiliesGuide.js`）
- 提交／載入動畫：月相序列 `public/loading/*.png` + `public/css/moon-loading.css`（白線月相，無光暈圈）

---

## 一、概覽

Mirror Mode（靈魂鏡像）是一個**自我探索型問卷**，共 15 題（5 題基本資料 ＋ 10 題心理測驗），分三個階段。  
作答完成後，系統會根據得分判斷使用者屬於哪個「貓咪家族」，並渲染性格卡片；登入用戶可**自動儲存**至帳號 Mirror Card 並取得公開分享連結。

| 項目 | 內容 |
|------|------|
| 基本資料題 | 5 題（Label / MBTI 星座 / 喜好 / 音樂 / 電影），**不計分**（P2、P3–P5 可跳過）|
| 心理測驗題 | 10 題（v3：跨場景 Trait 混合；v2 fallback：每題 4 選項對應一貓）|
| 領域數 | v3：跨場景（戀愛／工作／朋友等）；v2：親密節奏 3 + 情感語言 4 + 安全感 3 |
| 輸出類型 | 主類型（1 個）＋影子類型（可選，最多 1 個）|
| 計分單位 | **v3**：6 Trait 累積 → `traitToCat()`；**v2 fallback**：每題 +2 分給對應貓類，10 題合計 20 分 |

> **v2 legacy**：`mirror-v3.js` 載入失敗時回退舊題庫 `MIRROR_QUESTIONS`（直接 Cat 計分）。新測驗一律走 v3，見 [`MIRROR-MODE-V3-DESIGN.md`](./MIRROR-MODE-V3-DESIGN.md)。

### 1.1 體驗模式（`/mirror.html` 進入時）

| 模式 | 結果卡 | 儲存 | 分享 |
|------|--------|------|------|
| **登入用戶** | 完整 Mirror Card（`assembleNarrative` 全層含月光提醒、需求光譜、隱藏 tag、鏡像英雄句等）| 自動 `PATCH /api/mirror-card/me` | 公開 slug 如 `/mirror-card/moon-xxxxxx` |
| **訪客** | 簡易卡（L1 世界觀 + L2 Insight + L5 被誤解 + 動態三段式 Warning；無月光提醒／混血標題／隱藏 tag／需求光譜）| 不儲存 | 僅可下載 PNG；可登入承接 `sessionStorage` pending |

> **鎖定規則**：帳號一旦成功寫入 Mirror 結果（`mirror_type` 已存在），`mirror_type`、`shadow_type`、`mirror_scores`、`basic_answers` **不可再改**，僅能更新可見度設定或卡片圖片等欄位（API 回傳 `409 mirror_card_locked`）。

---

## 二、貓咪家族（四種人格類型）

| 代號 | 中文名 | 英文名 | 顏色 | 靈魂成分標籤 | 圖示 |
|------|--------|--------|------|--------------|------|
| `solitary` | 獨處貓家族 | The Solitary Moon | #bd93f9（紫） | 月光因子 | 🌙 |
| `sunny` | 暖陽貓家族 | The Sunny Tether | #ff6b9d（粉） | 暖陽熱能 | ☀️ |
| `mystical` | 秘境貓家族 | The Mystical Depth | #00e5ff（青） | 秘境電波 | 📡 |
| `sentinel` | 守護貓家族 | The Eternal Sentinel | #50fa7b（綠） | 守護力場 | 🛡️ |

卡片光暈色（`CAT_GLOW_MAP`）略深於主色：`#9b6fff` / `#ff6b9d` / `#00d4ff` / `#50fa7b`。  
貓咪 PNG：`/Solitary_Moon.png`、`/Sunny_Tether.png`、`/Mystical_Depth.png`、`/Eternal_Sentinel.png`。

### 2.1 卡片敘事架構（v4：固定 + 動態）

> **現況（2026-07-06）**：`assembleNarrative()` 已上線。L1 仍取自 `PERSONALITY_TYPES.desc`；L2／L5／三段式 Warning 由 Trait 與答題驅動；登入卡另含 **月光提醒**。L3 Shadow Influence、L4 內在拉扯擴充仍待實作。

#### 設計原則

| 原則 | 說明 |
|------|------|
| 固定層只回答「你是哪隻貓」 | 世界觀不常變；玩家認同的是家族身份 |
| 動態層回答「你這次測出來的樣子」 | 由 v3 `trait_scores`、主／次 Trait、Shadow、答題錨點驅動 |
| 文案模組化 | 不為每家族只寫 1 個 Description + 1 個 Warning |
| 被誤解層 | 不只描述「你是怎樣的人」，也描述「別人常怎樣誤解你」——高共鳴、適合截圖分享 |

#### Description 區塊組成（卡片主敘事）

卡片上的 **Description**（`pcard-family-desc` 區）由多段拼接，順序如下：

```
Description
  = 世界觀（固定）
  + Mirror Insight（動態）
  + Shadow Influence（動態）
  + 內在拉扯（動態，可選）
  + 被誤解（動態，可選）
```

| 層級 | 名稱 | 數量目標 | 選取來源 | 狀態 |
|------|------|----------|----------|------|
| **L1** | 世界觀 Worldview | 每家族 **1 段** | 主類型 `mirror_type` | ✅ 已上線（= 現行 `desc`） |
| **L2** | Mirror Insight | 每家族 × **3–5 段** | 主 Trait + 次高 Trait | ✅ v4.0（`mirror-narratives/data/insights.js`） |
| **L3** | Shadow Influence | 主 × Shadow **12 組合**各 1–2 段 | `mirror_type` + `shadow_type` | ⏳ 待實作（月光提醒已用 Shadow 鍵） |
| **L4** | 內在拉扯 Tension | **8–12 段** | 主 Trait × Shadow 或答題矛盾對 | 🟡 部分（`detectTensions()` 3 條規則；登入完整卡） |
| **L5** | 被誤解 Misread | 每家族 **1 段** | 主類型 | ✅ v4.0 |

**L1 世界觀（固定，保留）** — 例：守護貓

> 你是守護壁爐的貓，最怕變動與突如其來的驚嚇。

**L2 Mirror Insight（Trait 驅動）** — 同為 Sentinel、`predictability`（穩定）皆 33%，次高 Trait 不同 → 文案完全不同：

| Case | 次高 Trait | 示例文案方向 |
|------|------------|--------------|
| A | `validation` 28% | 你最安心的，不是有人陪你。而是知道：對方會一直在。 |
| B | `autonomy` 22% | 你需要安全感。但你更希望，安全感不是束縛。 |
| C | `emotional_resonance` 25% | 你很少要求什麼。真正令你安心的是：有人察覺你的沉默。 |

**L3 Shadow Influence** — 主類型 + 影子類型：

| 主類型 | Shadow | 示例方向 |
|--------|--------|----------|
| sentinel | solitary | 你的護盾背後，仍然保留一個人的空間。當世界太吵，你會暫時離開——不是逃避，只是充電。 |
| sentinel | sunny | 雖然你重視穩定。但真正愛上時，你也希望全世界知道。 |

**L4 內在拉扯** — 比「你需要安全感」更精準；例：

> 你渴望穩定。但真正有人靠近時，又會開始擔心：自己值不值得被愛。

> 你不是怕改變。你只是怕：只有自己還在努力。

**L5 被誤解（推薦必做）** — 每家族 1 段：

| 家族 | 被誤解文案方向 |
|------|----------------|
| sentinel | 很多人以為你要求很多。其實你真正想要的，只是對方做到自己答應過的事情。 |
| mystical | 很多人以為你太敏感。其實你只是比其他人更快察覺情緒的細微變化。 |
| solitary | 很多人以為你不需要任何人。其實你只是希望，靠近你的人也尊重你的節奏。 |
| sunny | 很多人以為你愛得很高調。其實你只是希望，不需要猜測自己在對方心中的位置。 |

#### Warning 區塊（v4：三段式動態 — **已上線**）

舊版每家族 **1 段固定 warning**（見 §2.2）僅作 v2 fallback；v3 卡使用 **Trigger · Behaviour · Recovery**（`mirror-narratives/data/warnings.js`，Q9 可錨定 Trigger）。

| 段落 | 鍵名 | 選取邏輯 | 數量目標 |
|------|------|----------|----------|
| **Trigger** | 最容易炸毛 | 最低 Trait 或 Forced Choice 底線題（Q9） | 每家族 4–6 段 |
| **Behaviour** | 炸毛時的表現 | 主 Trait + 主類型 | 每家族 4–6 段 |
| **Recovery** | 最快修復方式 | `expressiveness` / `emotional_resonance` 等 | 每家族 4–6 段 |

**示例（Sentinel）**：

```
⚠ 黑貓炸毛模式

Trigger — 當承諾被打破。

Behaviour — 你會開始變得很安靜。不是因為不生氣，而是開始保護自己。

Recovery — 如果有人願意坦白原因，你的護盾其實比想像中容易放下。
```

#### 月光提醒（v4 — **登入完整卡已上線**）

不稱「建議」，而稱 **🌙 月光提醒**——成長方向，玩家易記、易分享。

| 家族 | 示例方向 |
|------|----------|
| sentinel | 安全感，來自值得相信的人。不是來自控制所有事情。 |
| solitary | 適當讓人靠近，不代表失去自由。 |
| mystical | 不是每個人，都懂得第一時間理解你。有時，表達也是一種勇敢。 |
| sunny | 公開的愛很美。但真正長久的愛，也需要留一點空間呼吸。 |

每家族 **3–5 段**；可與 Shadow 或最低 Trait 交叉選取。

#### 文案模組總表

| 模組 | 數量 | 來源 | 卡片區塊 |
|------|------|------|----------|
| 世界觀描述 | 每家族 1 段 | 主類型 | Description L1 |
| 核心 Insight | 每家族 × 3–5 段 | 主 Trait + 次高 Trait | Description L2 |
| Shadow Influence | 12 組 × 1–2 段 | 主 + Shadow | Description L3 |
| 內在拉扯 | 8–12 段 | Trait × Shadow / 答題錨點 | Description L4 |
| 被誤解 | 每家族 1 段 | 主類型 | Description L5 |
| 炸毛 Trigger | 每家族 4–6 段 | 最低 Trait / Q9 | Warning · Trigger |
| 炸毛 Behaviour | 每家族 4–6 段 | 主 Trait | Warning · Behaviour |
| 炸毛 Recovery | 每家族 4–6 段 | expressiveness / emotional_resonance | Warning · Recovery |
| 月光提醒 | 每家族 3–5 段 | 成長方向 | 新區塊 `pcard-moonlight` |

#### 選文演算法（草案）

```javascript
// 輸入：trait_scores, mirror_type, shadow_type, answers, scoring_version
const topTraits = rankTraits(trait_scores);           // [primary, secondary, ...]
const bottomTrait = topTraits[topTraits.length - 1];

const description = [
  WORLDVIEW[mirror_type],                             // L1 固定
  pickInsight(mirror_type, topTraits[0], topTraits[1]), // L2
  shadow_type && SHADOW_INFLUENCE[`${mirror_type}+${shadow_type}`], // L3
  ...detectTensions(answers),                         // L4（可 0–2 句）
  MISREAD[mirror_type],                               // L5
].filter(Boolean).join('\n\n');

const warning = {
  trigger:   pickTrigger(mirror_type, bottomTrait, answers),
  behaviour: pickBehaviour(mirror_type, topTraits[0]),
  recovery:  pickRecovery(mirror_type, trait_scores),
};

const moonlight = pickMoonlight(mirror_type, shadow_type, topTraits);
```

**鐵律**：

- 同一模組內多段文案 **互斥**（每層最多出 1 段，拉扯層最多 2 句）
- 訪客簡易卡：至少 L1 + L2 + 三段式 Warning；L3–L5、月光提醒依產品取捨（建議 L5 被誤解亦開放給訪客）
- 完整卡：全層 + 需求光譜 + 隱藏 tag
- 文案 JSON 單一來源：`src/lib/mirror-narratives/`（✅ 已建）；瀏覽器 bundle：`public/js/mirror-narratives.js`（`npm run build:mirror-v3`）

#### 與 v3 現有實作的對照

| 項目 | v3 底層 | v4 敘事（2026-07） |
|------|---------|-------------------|
| `PERSONALITY_TYPES.desc` | 固定 1 段 | → L1 世界觀 ✅ |
| `PERSONALITY_TYPES.warning` | 固定 1 段 | → v2 fallback；v3 用三段式 ✅ |
| L2 Insight | — | ✅ `pickInsight()` |
| L5 被誤解 | — | ✅ 訪客＋登入卡 |
| 月光提醒 | — | ✅ 僅登入（`includeMoonlight`） |
| `detectTensions()` | 3 條答題規則 | → 擴充至 8–12 段 ⏳ |
| L3 Shadow Influence | — | ⏳（除 `MOONLIGHT_SHADOW` 外） |
| 訪客卡 | — | ✅ L1 + L2 + L5 + 動態 warning |

---

### 2.2 Legacy 固定文案（v2 fallback / L1 世界觀來源）

**世界觀 `desc`**（= v4 L1，仍由 `PERSONALITY_TYPES` 提供）

**獨處貓家族**  
> 你是一隻住在月亮上的貓，愛情對你來說是點綴，而不是全部。你不是不愛，只是你的愛需要空間才能呼吸。

**暖陽貓家族**  
> 你喜歡曬太陽，也希望對方的世界裡只有溫暖。你的愛是直接的，你要的也是清晰而公開的。

**秘境貓家族**  
> 你潛伏在黑夜深處，只為等待那個能聽懂你頻率的人。道理不重要，被理解才是你最深的渴望。

**守護貓家族**  
> 你是守護壁爐的貓，最怕變動與突如其來的驚嚇。你的愛是一種承諾，是每天都會回來的穩定。

### 特質 hashtag（Psych Profile，每類固定 3 個）

| 類型 | Hashtags |
|------|----------|
| solitary | `#給空間才給心` `#獨處充電人類` `#一個人也很好但有你更好` |
| sunny | `#直球對決選手` `#定義關係先別怕` `#公開曬恩愛達人` |
| mystical | `#只想被懂不想被講道理` `#靈魂頻率對了才開門` `#沉默也是對話` |
| sentinel | `#PlanB狂魔` `#計劃內的浪漫最動人` `#訊息不回會內心扣分` |

### 黑貓炸毛預警（v2 單段固定版；v3 見 §2.1 三段式）

| 類型 | 預警文案（單段；所有同家族玩家相同） |
|------|--------------------------------------|
| solitary | 遇到突然黏上來、打亂個人計劃的人，自動開啟隱形模式，消失三天再出現說沒事。 |
| sunny | 遇到態度曖昧、拒絕定義關係的人，直接傳長文問清楚，不清楚不罷休。 |
| mystical | 遇到用道理而非感受回應的人，當場關掉情緒出口，從此沉默如謎。 |
| sentinel | 遇到遲到不講、臨時改行程的人，內心的護盾會當場加厚 300%。 |

---

## 三、題目與選項對照

---

### 第一部分：基本資料（P1–P5，不計分）

**P1** — 你的 Label 是？  
① TB　② TBG　③ Pure　④ Bi　⑤ No Label

**P2** — 你的 MBTI 與星座？（**可跳過**）  
（MBTI 下拉選單 × 星座下拉選單，純資料收集；欄位 `p2_mbti`、`p2_zodiac`）

**P3** — 你有哪些日常喜好？（多選，可跳過）  
① 閱讀　② 運動　③ 打遊戲　④ 旅行　⑤ 追劇　⑥ 手作 / DIY　⑦ 攝影　⑧ 美食 / 烹飪　⑨ 音樂　⑩ 電影　⑪ 藝術　⑫ 戶外活動

**P4** — 你喜歡聽哪種音樂？（多選，可跳過）  
① 流行 Pop　② 獨立 Indie　③ R&B / Soul　④ 電子 Electronic　⑤ 古典 Classical　⑥ 爵士 Jazz　⑦ 嘻哈 Hip-Hop　⑧ K-pop　⑨ 搖滾 Rock　⑩ 民謠 Folk

**P5** — 你喜歡哪種電影類型？（多選，可跳過）  
① 愛情 Romance　② 驚悚 Thriller　③ 科幻 Sci-Fi　④ 動作 Action　⑤ 動畫 Animation　⑥ 文藝 Art Film　⑦ 紀錄片 Documentary　⑧ 恐怖 Horror　⑨ 喜劇 Comedy　⑩ 奇幻 Fantasy　⑪ 懸疑 Mystery

> 卡片顯示時，以中文開頭的 tag 會自動剝離後綴英文（如「愛情 Romance」→「愛情」）。

---

### 第二部分：心理測驗（Q1–Q10）

> ⚠️ **v3 主線題庫**在 `src/lib/mirror-questions-v3.js`（跨場景、Trait 混合向量、選項 shuffle）。以下為 **v2 legacy fallback** 題目與選項對照；僅在 `mirror-v3.js` 未載入時使用。

選項固定順序（v2）：① solitary　② sunny　③ mystical　④ sentinel，每選一題對應類型加 **2 分**。  
內部欄位名：`m_q1` … `m_q10`（v3 存 `option.key`）。

#### 領域一：親密與相處節奏（Q1–Q3）

**Q1** — 你與伴侶的理想相處模式與時間分配？ 
① 保持獨立生活，需要大量個人空間作為底線
② 經常見面，個人時間少一點沒關係，伴侶更重要
③ 視乎當下內心狀態，靈魂同頻比相處次數更重要
④ 規律而穩定的相處節奏，能直接影響我的情緒與安心感

**Q2** — 當對方問你在做什麼，或者連續一陣子沒聯絡，你的第一反應是？
① 想保有神秘感與自由，不喜歡事事回報或被追問
② 立刻回覆詳情，若對方太久沒報備會想發訊息確認狀態
③ 想分享當下的心情和感受，多於單純報告行蹤
④ 覺得這是基本關心，樂意告知，也習慣有規律的問候

**Q3** — 伴侶突然臨時取消原定的重要計劃，你會？ 
① 其實有點鬆一口氣，覺得突然多了自由時間也不錯
② 立刻詢問原因，需要一個清晰合理的解釋
③ 感到失落，並開始擔心對方是不是心情不好或有事瞞著我
④ 會有點無所適從，希望對方能提前告知並立刻重新安排

#### 領域二：溝通與情感語言（Q4–Q7）

**Q4** — 對你而言，被愛最深、最讓你心動的時刻是？
① 對方充分信任我，跟我說「你去做你喜歡的事，不用陪我」
② 對方在眾人面前大方、自豪地介紹我，讓我有名分感
③ 對方無需我開口，就能說出「我知道你的感受，不用解釋」
④ 對方默默記著我說過的每件小事，每天規律地傳一句「到家了嗎」

**Q5** — 兩個人吵架或發生衝突後，你傾向如何處理？  
① 各自冷靜，不想在情緒頭上溝通，相信時間能解決問題
② 立刻講清楚，當下就要解決，不讓誤解和悶氣留過夜
③ 希望對方先來擁抱、安撫我的情緒，之後再解釋道理
④ 需要對方明確表態關係仍然安全，承諾不會輕易放棄

**Q6** — 你自己表達愛意時，更偏向哪種方式？
① 給對方充足的自由與個人空間，不隨意干涉
② 直接說出口，透過言語的確認與承諾讓對方踏實
③ 用眼神、氣氛和生活細節，追求「無聲勝有聲」的默契
④ 持續、穩定地出現在對方身邊，用長久的陪伴來證明

**Q7** — 你最希望伴侶能深深明白你的一點是？ 
① 我需要自己的世界和空間，但並不代表我不在乎你
② 我想要的是一段清晰、公開、有長遠承諾的穩定關係
③ 比起對錯和道理，我更需要我的情緒被你理解和接住
④ 即使日子歸於平淡，我也願意與你長久而規律地陪伴彼此

#### 領域三：安全感與未來想像（Q8–Q10）

**Q8** — 什麼樣的狀態，能讓你在這段關係中感到最踏實的安心？  
① 對方完全不干涉我的個人生活與自我發展
② 兩個人有非常明確、共同的未來計劃與前進方向
③ 感到自己被完全包容與理解，在對方眼神中能做真實的自己
④ 我知道只要我需要，無論何時對方都一定會在我身後

**Q9** — 在感情中，哪一種狀況會讓你受傷最深？
① 對方過度依賴、限制我的自由，讓我失去了自我與空間
② 關係不明朗、對方對外模糊我們的關係，遲遲不肯給予定義
③ 當我表達脆弱時，對方不接住我的情緒，反而一直講道理
④ 承諾說了又不算，反覆無常的轉變破壞了關係的穩定感

**Q10** — 你理想中的伴侶，在你的生命中扮演著什麼角色？
① 你生命中的精彩點綴，彼此獨立卻又互相欣賞
② 你的命運共同體，兩個人牽手朝著同一個目標前進
③ 懂你靈魂與沉默的存在，心靈上無話不談
④ 你最安全的避風港，無論外面多風雨，永遠可以安心靠泊

---

## 四、計分機制

> **現行主線（v3）**：10 題 → `trait_scores`（6 Trait）→ `traitToCat()` 得主／影類型 → `detectTensions()` → `assembleNarrative()` → 渲染卡片。流程與題庫見 [`MIRROR-MODE-V3-DESIGN.md`](./MIRROR-MODE-V3-DESIGN.md)。  
> **下列 §4.1–§4.7** 描述 **v2 legacy fallback** 的直接 Cat 計分；主類型／影子／混血標題／百分比等**輸出規則兩版共用**（v3 的 Cat 分數由 Trait 映射產生）。

### 4.1 分數累積（v2 legacy）

```
每題：選中選項對應的類型 += 2 分
10 題全選同一類 → 該類 20 分，其餘 0 分
10 題合計永遠分配 20 分（每題恰加 2 分）
```

計分程式碼邏輯（`computeAndShowMirrorResult`）：

```javascript
const scores = { solitary: 0, sunny: 0, mystical: 0, sentinel: 0 };

MIRROR_QUESTIONS.forEach(q => {
  if (!q.scores) return; // 跳過 P1–P5
  const ans = answers[q.field];
  const optIdx = q.options.indexOf(ans);
  if (optIdx >= 0) {
    scores[q.scores[optIdx]] += 2;   // q.scores = ['solitary','sunny','mystical','sentinel']
  }
});
```

---

### 4.2 主類型判斷

```
主類型 = 四個類型中得分最高者
```

若平分（多個類型同分最高），取陣列排序後第一個（`['solitary','sunny','mystical','sentinel']` 的順序）。

---

### 4.3 影子類型（Shadow Type）

影子類型代表使用者的次要傾向，出現條件：

```
影子類型 = 第二高分的類型
出現條件：第二高分 > 0  AND  第二高分 >= 主類型分數 - 2
```

即分差 ≤ 2 分時才顯示影子類型；分差 > 2 分則不顯示。  
**訪客模式不顯示**混血標題／影子類型 UI。

```javascript
const sorted = typeOrder.slice().sort((a, b) => scores[b] - scores[a]);
const mainType = sorted[0];
const shadowType =
  (scores[sorted[1]] >= scores[mainType] - 2 && scores[sorted[1]] > 0)
  ? sorted[1]
  : null;
```

**範例：**

| 分數情況 | 主類型 | 影子類型 |
|----------|--------|----------|
| sentinel:10, mystical:8, sunny:2, solitary:0 | sentinel | mystical（差 2，顯示）|
| sentinel:14, mystical:4, sunny:2, solitary:0 | sentinel | 無（差 10，不顯示）|
| sunny:10, solitary:10, mystical:0, sentinel:0 | sunny（陣列順序） | solitary（差 0，顯示）|
| sentinel:20, 其餘皆 0 | sentinel | 無（第二高分為 0）|

---

### 4.4 混血標題（Hybrid Title）

僅**登入完整卡**顯示。由 `mainType + shadowType` 查表 `HYBRID_TITLES`，並附加動態等級：

```
Lv = 20 + round((主類型分數 ÷ 四類總分) × 77)
```

| 組合 | 標題 |
|------|------|
| solitary+sunny | `[ ☀️ 荒野玫瑰與暖陽 • Lv.XX ]` |
| solitary+mystical | `[ 🌙 月光下嘅電波解碼者 • Lv.XX ]` |
| solitary+sentinel | `[ 🛡️ 深淵獨行守夜人 • Lv.XX ]` |
| sunny+solitary | `[ 🌟 寂靜星空嘅尋光者 • Lv.XX ]` |
| sunny+mystical | `[ ✨ 霓虹秘境嘅愛情魔法師 • Lv.XX ]` |
| sunny+sentinel | `[ 🔥 鐵壁之下嘅溫柔侵略者 • Lv.XX ]` |
| mystical+solitary | `[ 🌑 月影裂縫嘅靈魂占卜師 • Lv.XX ]` |
| mystical+sunny | `[ 💫 螢光狂歡嘅電波密語者 • Lv.XX ]` |
| mystical+sentinel | `[ ⚡ 霧中堡壘嘅深淵探索者 • Lv.XX ]` |
| sentinel+solitary | `[ 🌠 孤城深處嘅星空守望者 • Lv.XX ]` |
| sentinel+sunny | `[ 🌺 鐵甲之下嘅玫瑰魂靈 • Lv.XX ]` |
| sentinel+mystical | `[ 🔮 秘境邊境嘅魔法衛士 • Lv.XX ]` |

未命中組合時 fallback：`[ 混血靈魂 • Lv.XX ]`。

---

### 4.5 百分比計算（性格卡片進度條）

```
各類型佔比 % = round(類型分數 ÷ 所有類型分數總和 × 100)
```

若所有類型分數均為 0（未填任何題），分母強制設為 1，避免除以零。

**靈魂成分列**僅顯示**分數 > 0 的前 3 名**，標籤使用各類 `factorName`（如「月光因子」），非家族中文名。

---

### 4.6 隱藏迷惑行為（Hidden Tags）

由 `computeHiddenTags(answers)` 依 `HIDDEN_TAG_RULES` **優先順序**匹配，最多取 **3 個**不重複 tag（僅登入完整卡顯示）。

| 題目 | 選項 index | 中文 tag |
|------|-----------|----------|
| m_q3 | 0 | #獨處充電怪 |
| m_q3 | 2 | #已讀焦慮症 |
| m_q3 | 3 | #PlanB怪 |
| m_q9 | 0 | #防窒息陣地 |
| m_q9 | 1 | #見光死過敏 |
| m_q9 | 2 | #不吃畫大餅這一套 |
| m_q9 | 3 | #可靠度至上 |
| m_q2 | 1 | #主動確認安全感 |
| m_q2 | 2 | #已讀焦慮症 |
| m_q5 | 0 | #冷靜期必要型 |
| m_q5 | 1 | #問題不隔夜選手 |
| m_q4 | 1 | #名分控 |
| m_q8 | 3 | #隨叫隨到型安全感 |
| m_q1 | 0 | #個人時間勿侵犯 |
| m_q2 | 0 | #神秘感重症患者 |

---

## 五、輸出：性格卡片

計算完成後渲染 `#personality-card`。登入用戶為完整卡；訪客為 `mirror-simple-card` 精簡版。  
敘事由 `assembleNarrative()` 組裝（§2.1）；以下為卡片 **UI 區塊** 對照。

### Layer 1 — Identity Core（身份核心）

| 欄位 | 說明 |
|------|------|
| 品牌標題 | `BLACK CAT / UNDER THE MOON` |
| 模式標籤 | `靈魂鏡像 · MIRROR MODE` |
| 貓咪圖片 | 主類型 PNG（類型光暈 `--type-col`） |
| 混血標題（選填）| 12 種 `HYBRID_TITLES` + 動態 Lv（**僅登入**） |
| 中文／英文家族名 | 如 `守護貓家族` / `The Eternal Sentinel` |
| 身份 meta（選填）| `TB · INFJ · 天蠍座`（P1 / P2） |
| 鏡像英雄句 | 每家族固定 verdict／hero（`MIRROR_HEROES`；登入完整卡） |

### Layer 2 — Description（主敘事，`pcard-family-desc`）

| 層級 | 訪客 | 登入 |
|------|------|------|
| L1 世界觀 | ✅ | ✅ |
| L2 Mirror Insight | ✅ | ✅ |
| L3 Shadow Influence | — | —（待實作） |
| L4 內在拉扯 | — | ✅（`detectTensions`，最多 3 句） |
| L5 被誤解 | ✅ | ✅ |

### Layer 3 — Warning（`pcard-warning`）

| 欄位 | 訪客 | 登入 |
|------|------|------|
| 三段式炸毛（Trigger／Behaviour／Recovery） | ✅（v3） | ✅ |
| 月光提醒 `pcard-moonlight` | — | ✅ |

### Layer 4 — Psych Profile（心理側寫）

| 欄位 | 說明 |
|------|------|
| 特質 hashtag | 3 個固定（§2.2 表） |
| 隱藏迷惑行為 | 最多 3 個（**僅登入**；v2 規則） |
| 個人標籤 | P3–P5 喜好／音樂／電影（**僅登入**） |

### Layer 5 — Trait Spectrum（需求光譜，僅登入）

| 欄位 | 說明 |
|------|------|
| 需求光譜 | v3：六 Trait 佔比條；v2 fallback：Top-3 靈魂成分 |
| 內在拉扯句 | v3 可併入 Description L4 或獨立 `pcard-tension` |
| CTA | 品牌網址 + 「測測你是哪隻貓 →」（**僅登入**） |

結果頁另有：**下載 PNG**、**了解四大貓家族 →**（`/cat-families`）；訪客另見登入 upsell。

### 5.1 四大貓家族指南頁（`/cat-families`）

公開行銷／教育頁，說明 v3 **六種戀愛需求**與四大家族對應關係：

| 區塊 | 內容 |
|------|------|
| 需求總覽 | `TRAIT_LABELS` 六項（自主、確認、共鳴、穩定、表達、承諾） |
| 家族卡片 | 核心需求、家族描述、共鳴句、炸毛預警、hashtag |
| 程式 | `CatFamiliesGuide.js` + `PERSONALITY_TYPES.guideNeedKeys` |

> 2026-07 已移除舊版「因子試管」UI。

進度條動畫：先設 `width: 0%`，渲染後 120ms 觸發 CSS transition 展開至實際寬度。

---

## 六、Mirror Card 帳號與公開頁

### 6.1 自動儲存

登入用戶完成測驗後，`tryAutoSaveMirrorCard` 以 Supabase session token 呼叫：

```
PATCH /api/mirror-card/me
{
  mirror_type, shadow_type, mirror_scores, basic_answers,
  trait_scores, scoring_version, tension_narratives   // v3
}
```

首次建立時自動生成 `public_slug`（格式 `moon-xxxxxx`）。

### 6.2 公開頁可見度（`GET /api/mirror-card/[slug]`）

| 等級 | 條件 | API 回傳內容 |
|------|------|--------------|
| `detailed` | 本人；或 Premium 訪客（非封鎖） | 完整卡（分數、shadow、basic_answers、隱藏 tag 可重算等） |
| `basic` | 已配對用戶（inbox match thread） | 精簡：`mirror_type` + label/mbti/zodiac |
| `public` | 訪客或未配對登入用戶 | 同上精簡欄位 |

封鎖關係下降為 `public`。未發布卡（`is_published === false`）僅本人可見。

公開頁路由：`/mirror-card/[slug]`；本人管理：`/mirror-card/me`、`/account`。

---

## 七、純類型極端情況

10 題全選同一類型 → 該類型得 **20 分**（佔比 100%），其餘為 0，**不觸發影子類型**。

---

## 八、完整計分流程圖

```
進入 /mirror.html → 選登入或訪客（或已存卡直接顯示結果）
        ↓
P1–P5 基本資料（不計分）
        ↓
10 題心理測驗（v3 主線；失敗則 v2 fallback）
        ↓
v3：option.key → Trait delta 累積 → trait_scores
v2：每題 += 2 至對應 Cat
        ↓
traitToCat() 或 v2 排序 → 主類型 + 影子類型（規則見 §4.3）
        ↓
detectTensions(answers) → 內在拉扯句（登入）
        ↓
assembleNarrative() → L1–L5 + 三段式 Warning + 月光提醒（登入）
        ↓
computeHiddenTags → 隱藏 tag（登入；v2 規則）
        ↓
需求光譜（v3 Trait 條）／靈魂成分（v2 fallback）
        ↓
渲染性格卡片（訪客簡易 / 登入完整）
        ↓
登入：PATCH mirror-card/me │ 皆可下載 PNG
```

提交／載入時顯示 **月相 loading**（`moon-loading.js` 輪播 `public/loading/*.png`，CSS 白線反相，無底圈光暈）。

---

## 九、本機開發與測試

專案為 **Next.js + 靜態 public 頁**混合架構。Mirror 問卷在 `public/mirror.html`，需透過 HTTP 提供（含 API 儲存與下載）。

### 推薦方式（完整功能）

```powershell
npm run dev
```

瀏覽器開啟 **http://localhost:3000/mirror.html**

> 下載卡片、登入儲存需 Supabase 環境變數與有效 session；見專案 `.env.example`。

### 僅靜態預覽（無 API）

```powershell
npx serve . --listen 8080
```

開啟 **http://localhost:8080/mirror.html** — 可作答與看結果，但無法儲存至帳號。

> **注意**：不可直接用 `file://` 開啟 HTML。終端機保持運行；`Ctrl+C` 停止。

---

## 十、瀏覽器主控台快速預覽教學

在 **`/mirror.html`** 頁面使用。按 **F12** → **Console**。

> Chrome 若提示 paste 限制，先輸入 `allow pasting` 再貼上。

---

### 指令一：四款圖示並排預覽

```javascript
var imgs = {
  solitary: '/Solitary_Moon.png',
  sunny:    '/Sunny_Tether.png',
  mystical: '/Mystical_Depth.png',
  sentinel: '/Eternal_Sentinel.png'
};
var wrap = document.createElement('div');
wrap.style = 'position:fixed;top:10px;left:10px;background:#1a1030;padding:12px;border-radius:8px;z-index:9999;display:flex;gap:8px';
document.body.appendChild(wrap);

['solitary','sunny','mystical','sentinel'].forEach(function(type) {
  var img = document.createElement('img');
  img.src = imgs[type];
  img.title = type;
  img.style.cssText = 'width:96px;height:96px;object-fit:cover;border-radius:4px';
  wrap.appendChild(img);
});
```

---

### 指令二：單一類型預覽

將 `'sunny'` 換成任何類型代號。

```javascript
var imgs = {
  solitary: '/Solitary_Moon.png',
  sunny:    '/Sunny_Tether.png',
  mystical: '/Mystical_Depth.png',
  sentinel: '/Eternal_Sentinel.png'
};
var img = document.createElement('img');
img.src = imgs['sunny'];
img.style.cssText = 'position:fixed;top:10px;left:10px;width:200px;height:200px;object-fit:cover;border-radius:6px;z-index:9999';
document.body.appendChild(img);
```

### 指令三：快速預覽完整結果卡（含 P1–P5 資料）

一鍵模擬填寫完整問卷並直接顯示結果卡。  
`optIdx`：0=solitary / 1=sunny / 2=mystical / 3=sentinel。

```javascript
// 1. 基本資料
answers = {
  p1: 'TB',
  p2_mbti: 'INFJ',
  p2_zodiac: '天蠍座',
  p3: '閱讀, 旅行, 音樂',
  p4: '獨立 Indie, R&B / Soul',
  p5: '愛情 Romance, 文藝 Art Film'
};

// 2. 心理測驗 — 改 optIdx 切換主類型
var optIdx = 3;
MIRROR_QUESTIONS.filter(function(q) { return q.scores; }).forEach(function(q) {
  answers[q.field] = q.options[optIdx];
});

// 3. 顯示結果（訪客卡：mirrorGuestMode = true；完整卡：false 且需登入 session 才會 auto-save）
isMirrorMode = true;
mirrorGuestMode = false;
var quizSection = document.getElementById('main-content');
if (quizSection) quizSection.style.display = 'none';
computeAndShowMirrorResult();
document.getElementById('mirror-result').scrollIntoView({ behavior: 'smooth' });
```

---

### 清除預覽

按 **F5** 刷新頁面即可移除所有預覽元素。
