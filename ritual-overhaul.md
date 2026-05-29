# 月光漂流瓶 UX Ritual Overhaul

**TL;DR** — 把 drift-bottle 從 SaaS form 徹底改造成沉浸式儀式體驗。8 個 phase，前 5 個純前端，後 3 個涉及 DB migration + backend。

---

## 依賴圖

```
Phase 1 ─┐
Phase 2 ─┤─▶ Phase 5 ─▶ Phase 7
Phase 3 ─┘
Phase 4 ──▶ Phase 5

Phase 6 ──▶ Phase 7
Phase 6 ──▶ Phase 8
```

---

## Phase 1: Background Ambience
**檔案：** `drift-bottle.html` (CSS + JS)
**可與 Phase 2 並行**

| 元素 | 實作方式 |
|---|---|
| 浮游粒子 | JS 生成 ~20 個 `.particle` div；`@keyframes particleDrift` 向上漂移 + opacity fade，掛在現有 `.stars` container |
| 海面 shimmer | 固定底部 `.sea-shimmer` strip；`@keyframes seaShimmer` 橫向移動漸層（opacity ~0.15，極 subtle） |
| 月光呼吸 | `.page-title` 加 `@keyframes moonBreath`，`text-shadow` glow 4s 循環脈動 |
| Stars 微漂移 | 現有 star system 加輕微 `translateX(±2px)` variant，讓繁星稍稍移動 |

---

## Phase 2: Tab Bar 重設計
**檔案：** `drift-bottle.html` (CSS + JS)
**可與 Phase 1 並行**

- **改名** — 📦 投瓶 → 🌙 投瓶 ｜ 🔑 尋瓶 → 🗝️ 尋瓶
- **各 tab 獨立 glow** — 投瓶 active：紫光；撈瓶 active：藍光；尋瓶 active：金光（取代現有單一 purple gradient）
- **Atmosphere shift** — tab 切換時 JS 設 `body.dataset.tab`；CSS 透過 `body[data-tab="throw|random|find"]` 驅動 `--panel-accent` CSS variable，影響 panel 的 border/badge/glow 顏色

---

## Phase 3: Floating Textarea + Paper Texture
**檔案：** `drift-bottle.html` (CSS)
**Phase 5 的前置**

- **去除 border** — textarea 無邊框，背景透明
- **橫線分隔** — `.floating-writing-area` wrapper，`::before`/`::after` 用 `border-top: 1px solid rgba(255,255,255,0.12)` 框上下
- **仿紙紋理** — `repeating-linear-gradient` 模擬橫格紙線（每 28px 一條，opacity 0.04）
- **月光倒影** — `::after` pseudo radial gradient + `@keyframes moonReflect` 輕微移動

---

## Phase 4: Emotion Tag Chips
**檔案：** `drift-bottle.html` (HTML + CSS + JS)
**Phase 5 的前置**

- 移除 `<input id="throw-mood">` 及 label
- 加入 `.mood-chips` grid，6 個預設 chip + 1 個自定義：

| 🌧️ 想被理解 | 🌙 睡不著 | 🫧 快樂不起來 | 🕯️ 有點想念誰 | 🌊 漂浮感 | ✏️ 自定義… |
|---|---|---|---|---|---|

- **JS state** — `selectedMood` 變數追蹤；點擊 toggle `.chip-selected`；再點取消
- **自定義** — 點「✏️ 自定義…」顯示 inline text input，內容實時寫入 `selectedMood`
- **CSS** — pill 形狀，active 時顯示 `--panel-accent` 顏色 border + glow

---

## Phase 5: 投瓶 Wizard UX
**檔案：** `drift-bottle.html` (HTML + CSS + JS)
**依賴 Phase 3 + Phase 4**

### 結構
`#panel-throw` 內改為 `.wizard-container` 含 3 個 `.wizard-step`，`goStep(n)` 控制過渡（fade + slide）。

| Step | 標題 | 內容 |
|---|---|---|
| 1 | 今晚想讓海浪帶走什麼？ | Floating textarea（Phase 3） |
| 2 | 這瓶子承載著什麼心情？ | Emotion chips（Phase 4）+ Back |
| 3 | 準備好了嗎？ | 🍾 glow preview + 內容預覽 + Back |

- Step 3 按鈕文字：**🌙 將話語封進瓶中**
- `throwBottle()` 改從 `throwContent` / `selectedMood` 變數讀取，非 DOM

### 增強版 post-submit 動畫（4 stage，`setTimeout` 串接）

| Stage | 延遲 | 動畫 |
|---|---|---|
| 1 | 300ms | `@keyframes corkSeal` — cork 落下彈跳封瓶 |
| 2 | 900ms | `.sea-ripple` expand（scale 0→3 + fade） |
| 3 | 1500ms | `@keyframes bottleDrift` — 瓶向遠方縮小消失 |
| 4 | 2500ms | 神秘鑰匙 `@keyframes keyFloat` 帶金光浮現 |

---

## Phase 6: Bottle Lifecycle DB Migration
**檔案：** `drift-bottle-setup.sql`
**可與 Phase 1–5 並行；Phase 7 + Phase 8 的前置**

> Append 到 `drift-bottle-setup.sql` 末尾。

### 新欄位

| 欄位 | 類型 | 預設值 | 說明 |
|---|---|---|---|
| `expires_at` | `TIMESTAMPTZ` | `NOW() + INTERVAL '30 days'` | 到期後不顯示，但**不刪除** DB 資料 |
| `bottle_type` | `TEXT` | `'normal'` | `'normal'` / `'moonlight'` / `'mission'` |
| `exposure_count` | `INT` | `0` | 被撈次數，用於加權算法 |

### 過期邏輯（重要）
- 瓶子 **30 日後沉入海底**——前端及 RPC 函數均不再返回過期瓶子。
- **資料永久保留於 DB**，不執行任何 `DELETE`，僅透過 `WHERE expires_at > NOW()` 過濾。
- Backfill — 舊有 rows 補填 `expires_at = created_at + 30 days`
- Index — `idx_bottles_expires on (expires_at) WHERE is_active = TRUE`

### 月光瓶 Trigger
INSERT on `replies` 後，若同一 bottle 回應數 ≥ 5 且 `bottle_type = 'normal'`，自動 `UPDATE bottle_type = 'moonlight'`。

### 更新 `get_random_bottle()`
`WHERE` 加 `AND (expires_at IS NULL OR expires_at > NOW())`

---

## Phase 7: Weighted Random + Exposure
**檔案：** `drift-bottle-setup.sql` + `api/bottle/random.js`
**依賴 Phase 6**

### 新 SQL 函數 `get_weighted_bottle()`

$$
\text{score} = \left(0.5 \cdot e^{-\frac{\text{age}}{7d}} + 0.3 \cdot \frac{1}{1+\text{exposure}} + 0.2 \cdot \min\!\left(\frac{\text{replies}}{10},\, 0.3\right)\right) \times (0.7 + \text{rand} \cdot 0.6)
$$

### `random.js` 三處修改

1. `rpc('get_random_bottle')` → `rpc('get_weighted_bottle')`
2. Fetch 後 fire-and-forget `UPDATE exposure_count + 1`（無 `await`，靜默失敗）
3. `safeBottle` spread 保留 `bottle_type` 和 `expires_at` 傳給前端

### 前端顯示（`loadRandom()` + `findBottle()` 渲染邏輯）

- `bottle_type === 'moonlight'` → 顯示 🌙 **月光瓶** 金色 badge
- `expires_at` → 顯示「X 日後沉沒」dim hint text

---

## Phase 8: 【#召集貓隊友】任務瓶
**檔案：** `drift-bottle-setup.sql` + `drift-bottle.html` + `api/bottle/throw.js`
**依賴 Phase 6（`bottle_type` 欄位）**

### 設計理念
任務瓶是一種特殊漂流瓶，用於「以力換力 / 技能交換 / 組隊找人」。有別於普通情緒碎碎念瓶，任務瓶鼓勵用戶留下聯絡方式，讓陌生人能真正組成隊伍。

### 8.1 資料庫變更

```sql
-- 在 bottles 表新增任務瓶識別欄位
ALTER TABLE bottles
  ADD COLUMN IF NOT EXISTS is_mission_bottle BOOLEAN NOT NULL DEFAULT FALSE;

-- 快速篩選索引
CREATE INDEX IF NOT EXISTS idx_bottles_mission
  ON bottles(is_mission_bottle)
  WHERE is_mission_bottle = TRUE AND is_active = TRUE;
```

- 當用戶選擇「召集貓隊友」模式時，系統在 `tags` 陣列中自動壓入 `'召集貓隊友'` 關鍵字，**同時** 將 `is_mission_bottle` 設為 `true`。
- `bottle_type` 設為 `'mission'`（與現有 `'normal'` / `'moonlight'` 並列）。

### 8.2 前端「丟瓶子」Wizard 修改（`drift-bottle.html`）

在 Phase 5 Wizard 的 **Step 2**（選心情）下方，加入任務瓶切換開關：

```
[ 🤝 召集貓隊友（以力換力 / 技能交換組隊） ]  ← Toggle Switch
```

切換開啟後，在 Step 1 textarea 下方顯示提示文字：

> *提示：寫下你想組隊做的事，並留下你可以交換的技能（例如：週末排隊拉麵換專業攝影）。普通瓶子不留聯絡方式，但隊友瓶**強烈建議**你在內容最後留下 IG 或聯絡方式，方便對方找到你！*

提交時：
- `throw.js` 接收 `is_mission_bottle: true` 並寫入 DB
- `tags` 陣列 push `'召集貓隊友'`
- `bottle_type` 設為 `'mission'`

### 8.3 前端「撈瓶子」視覺特效（`drift-bottle.html`）

當撈到的瓶子 `is_mission_bottle === true` 時，卡片外觀需有明顯區別：

| 元素 | 樣式 |
|---|---|
| 邊框 | 像素風金黃色邊框（`border: 2px solid #FFD700`，box-shadow 金色 glow） |
| 勳章 | 卡片頂部顯示 🐈 或 🤝 icon badge |
| Tag | 醒目貼上 `#召集貓隊友` chip（金色背景，深色字） |
| 排版 | 標題區塊加粗，突出「任務內容」，有別於普通情緒瓶 |

---

## Relevant Files

| 檔案 | 涉及 Phase |
|---|---|
| `drift-bottle.html` | 1, 2, 3, 4, 5, 7（前端顯示）, 8.2, 8.3 |
| `drift-bottle-setup.sql` | 6（migration）, 7（新 RPC）, 8.1（任務瓶 schema）|
| `api/bottle/random.js` | 7：切換 RPC + increment `exposure_count` |
| `api/bottle/throw.js` | 8.2：接收並寫入 `is_mission_bottle` |
| `reply.js` | 無需改動（月光瓶晉升由 SQL trigger 處理） |

---

## Verification Checklist

### Phases 1–5 前端
- [ ] Wizard flow：輸入 → Step 2 → 選 chip → Step 3 → 見 glow preview → submit → 4-stage 動畫 → key 浮現
- [ ] Back navigation：Step 3 → 2 → 1，textarea 內容和 chip 選擇保留
- [ ] Tab 切換：三個 tab 分別顯示紫/藍/金氛圍
- [ ] Background：粒子上漂、海面 shimmer、標題呼吸
- [ ] Mobile：Wizard 360px 下正常，chips wrap 正確

### Phase 6–7 DB + 加權
- [ ] DB migration：Supabase 跑 SQL，確認三欄存在（`expires_at`, `bottle_type`, `exposure_count`）
- [ ] 過期過濾：手動設 `expires_at` 為過去，確認不再出現（資料仍在 DB）
- [ ] 加權 RPC：多次呼叫，新瓶出現頻率高於高曝光舊瓶
- [ ] Moonlight trigger：同一瓶 5 個回應後 `bottle_type = 'moonlight'`

### Phase 8 任務瓶
- [ ] 丟瓶時切換任務瓶模式，`is_mission_bottle = true` 寫入 DB，`tags` 含 `'召集貓隊友'`
- [ ] 撈到任務瓶時，顯示金黃邊框 + 🐈 badge + `#召集貓隊友` tag
- [ ] 普通瓶子外觀無變化

---

## Decisions

| 決策項目 | 結論 |
|---|---|
| Textarea 樣式 | floating area（無邊框）+ 紙紋 + 月光倒影 |
| Wizard 結構 | 3 頁分步（有 back 鍵），非 single-page progressive reveal |
| Emotion type balance | free-text `mood_tag` 無法分類平衡，加權算法改用新鮮度/曝光/回應三因子替代 |
| `throw.js` / `reply.js` | 無需改動現有邏輯（`expires_at` 由 DB DEFAULT 自動設定；月光瓶晉升由 trigger 處理）|
| 瓶子剩餘天數顯示 | 只顯示在撈瓶/尋瓶 panel，不出現在 wizard steps |
| 過期行為 | **軟過期**：30 日後沉入海底，前端不顯示，但 DB 永久保留，不執行 DELETE |
| 任務瓶聯絡方式 | 不強制，以提示文字鼓勵用戶在內容中自願留下 IG 或聯絡方式 |
| 任務瓶識別 | `is_mission_bottle boolean` 快速篩選 + `tags[]` 含 `'召集貓隊友'` + `bottle_type = 'mission'` |