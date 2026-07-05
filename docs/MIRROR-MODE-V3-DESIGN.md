# Mirror Mode v3 — 設計方向（Trait 驅動）

**狀態**：**已實作（v3.1）** — 2026-07-04 上線  
**現行規格**：[`MIRROR-MODE-SPEC.md`](./MIRROR-MODE-SPEC.md)（v2.2 為舊版直接 Cat 計分；新測驗走 v3）  
**題庫單一來源**：`src/lib/mirror-questions-v3.js` → `npm run build:mirror-v3` → `public/js/mirror-v3.js`

---

## 實作摘要

| 項目 | 狀態 | 說明 |
|------|------|------|
| 10 題跨場景 Trait 題庫 | ✅ | `MIRROR_PSYCH_QUESTIONS_V3` |
| 選項 shuffle + `option.key` 計分 | ✅ | session seed；`answers[m_qN]` 存 key |
| 6 Trait 累積 + Cat 映射 | ✅ | `mirror-scoring-v3.js` |
| 內在拉鋸（3 條規則） | ✅ | 登入用戶卡片顯示；訪客不顯示 |
| DB：`trait_scores` / `scoring_version` / `tension_narratives` | ✅ | migration `20250706000000_mirror_v3_trait_scores.sql` |
| API PATCH 接受 v3 欄位 | ✅ | `src/pages/api/mirror-card/me.js` |
| 卡片「需求光譜」進度條 | ✅ | Top-3 Trait bars；標籤 `// 需求光譜` |
| `/cat-families` 需求說明頁 | ✅ | 六種需求總覽 + 各族核心需求／共鳴文案 |
| 已存卡免重測 | ✅ | 登入後 `/mirror.html` 直接顯示結果 |
| 訪客 → 登入承接結果 | ✅ | `sessionStorage` pending + claim |
| v2 題庫 fallback | ✅ | `mirror-v3.js` 載入失敗時用舊 `MIRROR_QUESTIONS` |
| Ranking 題 | ❌ v1 不做 | 維持 Forced Choice |
| 內部 50+ 份校準 / A/B | ⏳ 待做 | 見「校準與品質」 |

---

## 核心診斷：v2 測的不是「人格」，是「理想伴侶需求」

現行 v2 心理測驗（legacy fallback）表面分三個領域，實質反覆問同一件事：

| v2 題號 | 題幹本質 | 玩家心裡的翻譯 |
|---------|----------|----------------|
| Q4 | 被愛最深是什麼？ | 你要邊種愛？ |
| Q6 | 你表達愛的方式？ | 你要邊種愛？ |
| Q7 | 最希望伴侶明白什麼？ | **四大家族宣傳文案四選一** |
| Q8 | 什麼狀態最安心？ | 你要邊種安全感？ |
| Q10 | 理想伴侶扮演什麼角色？ | 你要邊種關係？ |

**後果**：玩家只要自認「要安全感」，中段已鎖定 Sentinel，後半題幾乎全揀同一軸——測驗變成 **自我標籤**，不是測量。

v3 已全面替換主線題庫；上表保留作設計動機紀錄。

---

## 核心原則

> **不要直接測「貓」，而是測「需求」。**  
> **同一個 Trait，要由不同生活角度、不同生活場景交叉測量。**  
> **每個選項都是 Trait 混合向量——沒有任何一題是 A=獨處貓、B=暖陽貓。**

### 好的測驗 vs 現行 v2

| | v2（legacy） | v3（已實作） |
|---|-----------|-----------|
| 場景 | 10 題幾乎全是戀愛 | **戀愛 · 工作 · 朋友 · 興趣 · 投射** 跨場景 |
| 問法 | 「你需要空間嗎？」連問三次 | 各場景各測一次，**人格一致、語境不同** |
| 測量角 | 價值觀陳述 | **行為 · 情緒 · 決策 · 衝突 · 習慣** |
| 選項 | 一選項 = 一隻貓（或一個 Trait） | **每選項 = 2+ Trait delta 混合**（Forced Choice 底線題除外） |
| 題型 | 全單選 | 情境單選 + **Forced Choice** |
| 呈現 | 理想伴侶問卷 | **10 個生活故事** + 1 題投射 |

玩家看到的仍是四大貓家族與 Mirror Card；底層流程：

```
P1–P5 基本資料（不變）
        ↓
10 題（跨場景情境 + 投射 + 1 題 Forced Choice）
        ↓
6 個 Trait 分數（多角、多場景交叉累積）
        ↓
detectTensions → 內在拉鋸敘事（登入用戶；v4 擴充見 SPEC §2.1）
        ↓
assembleNarrative → Description + Warning 模組（v4；現行固定 desc/warning）
        ↓
traitToCat() → Cat Type（主類型 + 影子類型）
        ↓
Mirror Card（家族 + 需求光譜 + 拉鋸句 + 混血標題）
        ↓
PATCH /api/mirror-card/me（trait_scores + scoring_version）
```

**敘事模組化（v4）**：見 [`MIRROR-MODE-SPEC.md` §2.1](./MIRROR-MODE-SPEC.md#21-卡片敘事架構v4-方向固定--動態) — 固定世界觀 + Trait／Shadow 動態 Insight、三段式炸毛、月光提醒、被誤解層。

---

## UI 分 Part（心理題三段）

| Part | 標題 | 題號 | 題數 |
|------|------|------|------|
| 0 | 基本資料 Profile | P1–P5 | 5 |
| 1 | 生活場景 Life Scenarios | Q1–Q5 | 5 |
| 2 | 內心與投射 Inner & Projection | Q6–Q8 | 3 |
| 3 | 核心取向 Core Orientation | Q9–Q10 | 2 |

題號顯示：`Q1`…`Q15`（依整份問卷 index + 1）；Part 過場動畫在 part 切換時播放。

---

## v3.1 六項設計決策（產品定稿）

### 1. v1 不做 Ranking 題 → 改用 Forced Choice ✅

| Ranking（❌ v1 不做） | Forced Choice（✅ v1 採用） |
|----------------------|---------------------------|
| 拖曳排序 4 項 | 單選「只能保留一樣」 |
| 手機體驗差、完成率低 | 與現有單選 UI 一致 |
| 認知疲勞高 | 迫選一個底線，負擔低 |

**Q9 實作**（`m_q9`）：

> 如果只能保留一樣，你最唔想失去：  
> 自由 / 理解 / 穩定 / 陪伴

| key | Trait（+3 或混合） |
|-----|-------------------|
| `keep_freedom` | `autonomy` +3 |
| `keep_understanding` | `emotional_resonance` +3 |
| `keep_stability` | `predictability` +3 |
| `keep_companionship` | `validation` +2, `commitment` +2 |

> **Forced Choice 例外**：底線錨點允許單一 Trait +3；其餘 9 題仍須每選項 ≥2 非零 Trait。

---

### 2. 人格跨場景 ✅

**10 題場景配比（v3.1 定稿）**：

| 場景域 | 題數 | 題號 |
|--------|------|------|
| 親密關係 | **4** | Q2, Q4, Q6, Q8 |
| 工作／任務 | **1** | Q1 |
| 朋友／社交 | **1** | Q3 |
| 興趣／自我 | **1** | Q5 |
| 投射（世界觀） | **1** | Q7 |
| Forced Choice | **1** | Q9 |
| 人生取向 | **1** | Q10 |

---

### 3. 投射題（Projection）✅ — Q7

> 你去咖啡店，見到一隻黑貓一直望住窗外。你第一個感覺係？

| key | 文案 | Trait 混合 |
|-----|------|-----------|
| `wants_quiet` | 佢想自己靜下 | `autonomy` +2, `emotional_resonance` +1 |
| `waiting_owner` | 等緊主人 | `validation` +1, `commitment` +1 |
| `deep_thoughts` | 諗緊好多心事 | `emotional_resonance` +2, `autonomy` +1 |
| `daily_spot` | 每日都坐呢度 | `predictability` +2, `autonomy` +1 |

---

### 4. 灰色題 — Q8（定稿：情感支持，非生日驚喜）✅

**設計迭代**：原草案「生日驚喜對方想獨處」與 Q3「朋友改期」語意過近；**v3.1 定稿**改為 **傾訴後被 dismiss** 的灰色情境。

> 你同另一半傾訴，話今日好攰、好想有人陪。對方話：「你已經好叻，自己搞得掂。」你第一個感覺係？

| key | 文案 | Trait 混合 |
|-----|------|-----------|
| `accept_trust` | 明白係信任，我都唔想太依賴 | `autonomy` +2, `commitment` +1 |
| `want_comfort` | 好想佢先攬住我、聽我講 | `validation` +2, `emotional_resonance` +2 |
| `feel_unheard` | 有啲似講咗都冇用 | `emotional_resonance` +2, `expressiveness` +1 |
| `say_need_you` | 會直接講：「我需要你同我一齊」 | `expressiveness` +2, `validation` +1 |

四選項皆合理；無「好伴侶標準答案」。

---

### 5. 內在拉扯（矛盾對）✅

**原則**：不扣分；題庫配對錨點，卡片輸出 1–2 句拉鋸敘事（**僅登入用戶**；訪客卡片不顯示）。

**已實作規則**（`MIRROR_V3_TENSION_RULES`）：

| id | 觸發條件 | 文案 |
|----|----------|------|
| `freedom_vs_attention` | Q2=`reserve_time` 且 Q4=`worry_mood` | 你渴望自由，但真正安靜落嚟時，又會害怕自己唔被需要。 |
| `independent_but_wants_proof` | Q2=`reserve_time` 且 Q4=`ping_when_free` 或 `want_heads_up` | 你重視獨立，但心入面仍然需要一點信號確認自己重要。 |
| `give_space_but_need_signal` | Q8=`accept_trust` 且 Q4=`worry_mood` 或 `want_heads_up` | 你習慣自己扛，但心入面仍然渴望有人主動靠近。 |

**目標觸發率**：25–40%（待上線後用 analytics 驗證）。

---

### 6. 選項鐵律：永遠唔好四選項 = 四隻貓 ✅

**v3 強制規則**（Forced Choice 底線題除外）：

- 每個選項至少 **2 個** 非零 Trait delta
- 禁止 `legacy_cat` 單選映射
- 每題 `shuffle: true`；呈現順序與 A/B/C/D 無固定對應

```javascript
// 題庫 review（建議維護 validate 腳本）
function validateOption(opt, allowSingleAnchor) {
  const nonZero = Object.values(opt.traits).filter(v => v !== 0);
  if (!allowSingleAnchor && nonZero.length < 2) {
    throw new Error(`Option ${opt.key} needs ≥2 trait deltas`);
  }
}
```

---

## v3.1 題庫總表

| 題號 | field | 場景域 | 情境主題 | 題型 | 矛盾錨點 |
|------|-------|--------|----------|------|----------|
| **Q1** | `m_q1` | 工作 | Deadline 突變 | 情境 | — |
| **Q2** | `m_q2` | 親密 | 週末想成日一齊 | 情境 | 高自主 |
| **Q3** | `m_q3` | 朋友 | 四人約得兩人 | 情境 | — |
| **Q4** | `m_q4` | 親密 | 六鐘冇覆訊息 | 情境 | 高被需要 |
| **Q5** | `m_q5` | 興趣 | 學新嘢 | 情境 | — |
| **Q6** | `m_q6` | 親密 | 吵架後冷靜一晚 | 情境 | — |
| **Q7** | `m_q7` | 投射 | 咖啡店黑貓望窗外 | 投射 | — |
| **Q8** | `m_q8` | 親密 | 傾訴被 dismiss（灰色） | 灰色 | 與 Q4 成矛盾對 |
| **Q9** | `m_q9` | 跨場景 | Forced Choice 四需求底線 | 強制選一 | 強權重 |
| **Q10** | `m_q10` | 人生 | 五年後優先選擇 | 情境 | — |

完整 option key / traits 定義見 `src/lib/mirror-questions-v3.js`。

---

## 計分引擎（已實作）

**模組**：`src/lib/mirror-scoring-v3.js`（瀏覽器：`public/js/mirror-v3.js`）

### Trait 定義（6 項，一次上線）

| Trait key | 中文 | 主要對應貓 |
|-----------|------|------------|
| `autonomy` | 自主需求 | Solitary |
| `validation` | 確認需求 | Sunny |
| `emotional_resonance` | 共鳴需求 | Mystical |
| `predictability` | 穩定需求 | Sentinel |
| `expressiveness` | 表達需求 | Sunny（輔） |
| `commitment` | 承諾需求 | Sentinel / Sunny（輔） |

### Cat 判定

- **方法**：Trait 向量 vs `CAT_PROTOTYPES` 的 **歐氏距離平方和**
- **主類型**：距離最近的原型
- **影子類型**：次近原型，且距離差 ≤ `SHADOW_DISTANCE_THRESHOLD`（**6**）
- **legacy `mirror_scores`**：`traitScoresToMirrorScores()` 衍生，供論壇／舊 UI fallback

**`CAT_PROTOTYPES`（2026-07-04 校準）** — 縮放到題庫可達分數範圍；以四貓 stereotype 答案路徑為 seed，座標下降最小化與 25% 的偏差（`node scripts/calibrate-mirror-v3-prototypes.js` 可重現）：

| Cat | autonomy | validation | emotional_resonance | predictability | expressiveness | commitment |
|-----|----------|------------|---------------------|----------------|----------------|------------|
| solitary | 15 | 5 | 4 | 6 | 3 | 4 |
| sunny | 0 | 8 | 2 | 7 | 7 | 6 |
| mystical | 7 | 4 | 15 | 2 | 1 | 1 |
| sentinel | 6 | 2 | 1 | 13 | 4 | 5 |

**全組合模擬（4¹⁰）分布**：solitary **24.8%** · sunny **25.0%** · mystical **25.0%** · sentinel **25.2%**。**50 stereotype profile 命中率：50/50（100%）** — 見 `docs/MIRROR-V3-PROTOTYPE-DRAFT.json`；重現：`node scripts/calibrate-mirror-v3-prototypes.js`。

### 卡片成分條

- v3：`getTraitBars()` → 六項 Trait 佔比（合計 100%），標籤 **「需求光譜」**
- v2 舊卡：Top-3 Cat 分數，標籤 **「靈魂成分」**

### 資料模型

```sql
-- mirror_cards（20250706000000_mirror_v3_trait_scores.sql）
trait_scores         jsonb   -- { autonomy: 12, validation: 8, ... }
scoring_version      text    -- 'v2_cat' | 'v3_trait'
tension_narratives   jsonb   -- [{ id, copy_zh }, ...]
```

**鎖卡規則**：結果欄位（含 `trait_scores`）與 `mirror_type` 一併鎖定；PATCH 僅允許 visibility / 頭像等。**v3 重測流程尚未開放**。

---

## 選項洗牌（Phase 1）✅

```javascript
// 每題獨立 shuffle；seed = mirrorShuffleSeed + questionIndex * 97
answers[q.field] = opt.key;  // 存 key，唔存 A/B/C/D 位置
```

- Session 級 seed：同一輪作答順序穩定
- 重開測驗：`mirrorShuffleSeed = Date.now() % 2147483647`

---

## 端到端流程（實作）

```
/mirror.html
  → 載入 mirror-v3.js（build 產物）
  → 登入用戶：GET /api/mirror-card/me → 有卡則直接 showMirrorResultFromSavedCard
  → 否則 P1–P5 + 10 心理題（trait_single + shuffle）
  → computeMirrorResultV3(answers)
  → showMirrorResult（需求光譜 + 拉鋸 + 混血標題）
  → 訪客：sessionStorage pending；登入後 tryClaimPendingMirrorResult
  → 登入：PATCH /api/mirror-card/me + localStorage cache（bcutm_mirror_card_cache）
```

**v3 不再使用** v2 的 `HIDDEN_TAG_RULES` / `computeHiddenTags`（傳空陣列）。

---

## 與現有產品的銜接

| 功能 | 依賴欄位 | v3 處理 |
|------|----------|---------|
| 論壇「同族」排序 | `mirror_type` | **不變** |
| 公開卡精簡視圖 | `mirror_type` + public_profile | **不變** |
| 卡片成分條 | `trait_scores` 或 `mirror_scores` | v3 優先 Trait bars |
| 混血標題 | main + shadow Cat | **不變**；shadow 改由 Trait 距離 |
| 已鎖定 v2 卡片 | `scoring_version: v2_cat` | 永久保留；新測驗走 v3 |

---

## 建置與部署

```bash
npm run build:mirror-v3   # 題庫 / 計分改動後必跑
npm run build             # 已含 build:mirror-v3
```

**Supabase**：確認已執行 `supabase/migrations/20250706000000_mirror_v3_trait_scores.sql`。

**常見故障**：若 `mirror-v3.js` 含 ES `import` 或未 build → `MirrorV3` undefined →  silent fallback 至 v2 舊題庫。修復：`node scripts/build-mirror-v3-browser.js`。

---

## 實作路線圖（更新）

| 階段 | 內容 | 狀態 |
|------|------|------|
| **1a** | 選項 shuffle + `option.key` 計分 | ✅ |
| **1b** | 題庫資料結構（`mirror-questions-v3.js`） | ✅ |
| **2** | Trait delta 計分 | ✅ |
| **3** | `trait_scores` + Cat 映射 + API/DB | ✅ |
| **4** | 矛盾對 + 卡片拉鋸文案 | ✅ |
| **5** | 跨場景 10 題 + Forced Choice + 投射 | ✅ |
| **6** | 內部校準 50+ 份、A/B、觸發率量度 | ⏳ 原型已校準；真人試填／A/B 待做 |
| **7** | v3 重測 / Premium 深度版（Ranking?） | 📋 未決 |

---

## 校準與品質（上線後必做）

1. **`CAT_PROTOTYPES` 數學校準** ✅（2026-07-04）— 見「Cat 判定」；重現：`node scripts/calibrate-mirror-v3-prototypes.js`
2. **內部試填 50+ 份**：四貓分布是否偏斜；自評主貓命中率 ≥ 70%
3. **矛盾觸發率**：目標 25–40%
4. **A/B**：v2 fallback vs v3 主線 — 完成率、分享率  

---

## 開放問題（更新）

| # | 問題 | 決策 |
|---|------|------|
| 1 | 親密 4 題是否過多？ | **v3.1 維持 4**；待校準後再調 |
| 2 | 舊用戶 v3 重測 | **未開放**；鎖卡規則不變 |
| 3 | 訪客卡顯示 Trait / 拉鋸 | **Trait 光譜可顯示**；**拉鋸僅登入** |
| 4 | 負分 Trait | **未實作**；delta 皆 ≥ 0 |
| 5 | 語氣 | **廣東話口語** 為預設 |
| 6 | Ranking | **v1 不做** |
| 7 | Q8 情境 | **定稿：情感支持 dismiss**（非生日／搬城） |
| 8 | Q10 | **定稿：五年後優先選擇**（搬城保留為換季備選） |

---

## 相關檔案

| 檔案 | 用途 |
|------|------|
| `src/lib/mirror-questions-v3.js` | 題庫 + tension rules（**單一來源**） |
| `src/lib/mirror-scoring-v3.js` | Trait 計分、Cat 映射、shuffle |
| `scripts/build-mirror-v3-browser.js` | 打包瀏覽器 bundle |
| `public/js/mirror-v3.js` | `/mirror.html` 載入（**勿手改**） |
| `public/js/questionnaire.js` | UI、shuffle cache、存卡、訪客承接 |
| `public/mirror.html` | 引入 `mirror-v3.js` |
| `src/components/MirrorPersonalityCard.js` | 公開卡 Trait bars + 拉鋸 |
| `src/pages/api/mirror-card/me.js` | GET/PATCH v3 欄位 |
| `supabase/migrations/20250706000000_mirror_v3_trait_scores.sql` | DB 欄位 |

---

## 附錄 A：v2 → v3 題目映射

v2 心理題 **不** 1:1 保留；新用戶預設走 v3 題庫。舊卡 `scoring_version: v2_cat` 仍正常顯示。

## 附錄 B：題庫撰寫 Checklist（改題時）

- [ ] 題幹是否為**具體情境**？
- [ ] 場景域是否納入配比（親密 ≤4 / 10）？
- [ ] 不讀選項能否猜不到在測哪隻貓？
- [ ] 四選項是否都**合理**（灰色題無最好答案）？
- [ ] 每選項是否 ≥2 非零 Trait（Forced Choice 底線除外）？
- [ ] 是否無 `legacy_cat`？
- [ ] 是否避免同場景域連續 3 題？
- [ ] 是否已設 `key` + `traits` + `shuffle: true`？
- [ ] 錨點題是否已登記 tension rule？
- [ ] 改動後是否執行 `npm run build:mirror-v3`？

---

*本文件為產品／工程共用設計稿；v3.1 已實作，後續以校準與重測政策為主。*
