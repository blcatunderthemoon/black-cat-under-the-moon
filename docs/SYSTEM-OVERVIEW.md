# 🌙 月光漂流瓶 × Black Cat Under The Moon — 完整系統介紹

> 最後更新：2026-07-05｜版本：v8 新增資料庫總覽章節

---

## 目錄

1. [專案總覽](#一專案總覽)
2. [月光漂流瓶](#二月光漂流瓶)
3. [靈魂配對系統](#三靈魂配對系統)
4. [靈魂鏡像（Mirror Mode）](#四靈魂鏡像mirror-mode)
5. [社群與 Moonlight Passport 功能](#五社群與-moonlight-passport-功能)
6. [聯絡我們意見箱](#六聯絡我們意見箱)
7. [管理儀表板 — 郵件自動化](#七管理儀表板--郵件自動化)
8. [技術架構與安全機制](#八技術架構與安全機制)
9. [資料庫總覽（Supabase）](#九資料庫總覽supabase)
10. [API 速率限制一覽](#十api-速率限制一覽)
11. [部署問題記錄（Incident Log）](#十一部署問題記錄incident-log)

---

## 一、專案總覽

Black Cat Under The Moon 是一個專為**女同志社群**設計的靈魂配對與社群平台，包含匿名漂流瓶、問卷配對、Mirror 自我探索，以及登入後的論壇、Inbox 與 Moonlight Passport 訂閱。

| 模組 | 說明 | 入口 |
|---|---|---|
| 🌊 月光漂流瓶 | 完全匿名的心靈漂流空間，投出心聲並讀取陌生人的瓶子 | `drift-bottle.html` |
| 💫 靈魂配對（Echo Mode） | 多維度問卷 + 算法配對，找出最合拍的靈魂伴侶 | `echo.html` |
| 🪞 靈魂鏡像 | 自我探索問卷（v3 Trait 驅動），生成貓咪家族性格卡片與 Mirror Card | `mirror.html` |
| 🐾 四大貓家族 | Mirror 家族與**六種戀愛需求**介紹（`/cat-families`） | `/cat-families` |
| 🌙 月光旅程 | 論壇 EXP、等級、每日打卡（HK 時區） | 論壇側欄、`/moon-journey`、`/account` |
| 🔥 月光圍爐 | 論壇：發文、留言、標籤、投票、書籤、@提及 | `/forum` |
| ✉️ Inbox | 配對通知、主動投信、交換相邀請、Mirror 頻道私信 | `/inbox` |
| 📷 交換相 | Moonlight Passport 在 Mirror Card 發起真人相片交換（7 日可見） | `/exchange-photo`、`/mirror-card/[slug]` |
| 👤 帳戶 | 顯示名稱、密碼、通知偏好、訂閱、Mirror Card 管理 | `/account` |
| 🌙 Moonlight Passport | PayPal 或 PayMe／FPS 人手付款；會員狀態與配額 | `/premium` |
| 💌 聯絡我們 | 意見箱（寫入資料庫）、社群連結 | `contact.html` |
| 📋 法律頁 | 條款、私隱、退款、關於 | `tos.html` 等 |

後台管理儀表板（`/dashboard`，本地 gitignore）：配對分析、實驗室、用戶匯出、**郵件自動化（含 Moonlight Passport 即時連線佇列）**、Moonlight Passport 人手核對、月光旅程監控、論壇／Inbox 監控等，僅管理員訪問（`DASHBOARD_SECRET` + `x-dashboard-key`）。

**Mobile WebView：** 靜態頁與 Next.js App 共用 `public/js/mobile-document-scroll.js` 與 `mobile-webview-scroll.css`，詳見 [MOBILE-WEBVIEW-SCROLL.md](MOBILE-WEBVIEW-SCROLL.md)。

---

## 二、月光漂流瓶

月光漂流瓶以「完全匿名」為核心設計原則。所有內容不綁定任何帳號，透過 Cloudflare Turnstile 防止濫用。

### 2.1 投瓶

**API：** `POST /api/bottle/throw`  
**限制：** 每個 IP 每小時最多 **5 個漂流瓶**

```
用戶填寫內容（max 200 字）+ 選擇心情標籤
  ↓
Cloudflare Turnstile 人機驗證
  ↓
IP 爆發偵測（ip-guard）+ 速率限制
  ↓
內容過濾（content-filter）→ 拒絕違禁詞
  ↓
危機偵測 → 觸發則前端自動顯示危機介入橫幅
  ↓
寫入 Supabase `bottles` 表
  ↓
回傳 6 位「神秘鑰匙」（view_key）
```

**神秘鑰匙生成規則：**
- 字元集：`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（排除 `0/O/1/I` 避免視覺混淆）
- 長度：6 位，例如 `DXBDTK`
- 用途：唯一找回瓶子的憑證，系統不儲存任何用戶身份

**`bottles` 表主要欄位：**

| 欄位 | 說明 |
|---|---|
| `id` | UUID，瓶子唯一識別 |
| `content` | 瓶子正文 |
| `mood_tag` | 心情標籤（如「快樂不起來」、「想被理解」）|
| `view_key` | 6 位神秘鑰匙（唯一索引）|
| `is_active` | 是否可見（舉報超標後設為 false）|
| `report_count` | 累計舉報次數 |
| `reply_count` | 累計回聲數 |
| `is_moonlight` | 是否升格為「月光瓶」|
| `is_mission_bottle` | 是否為任務瓶 |
| `expires_at` | 沉沒時間（投出後 30 天）|

---

### 2.2 撈瓶

**API：** `GET /api/bottle/random`  
**限制：** 每個 IP 每分鐘最多 **10 次**

撈瓶採用**加權隨機（Weighted Random）**機制：

```
呼叫 Supabase RPC: get_weighted_bottle()
  ↓（若 RPC 不存在則 fallback）
呼叫 Supabase RPC: get_random_bottle()
```

**加權邏輯（`get_weighted_bottle`）：**
- 回覆多、舉報少的瓶子權重較高
- 月光瓶（`is_moonlight = true`）加權提升
- 用戶曾回覆的瓶子前端做跳過處理（最多跳過 8 次）

---

### 2.3 回聲（留言）

**API：** `POST /api/bottle/reply`  
**限制：** 每個 IP 每小時最多 **60 條回聲**

```
用戶輸入回聲（max 100 字）
  ↓
Cloudflare Turnstile 人機驗證（頂層回聲；巢狀回覆跳過驗證）
  ↓
IP 爆發偵測 + 速率限制（巢狀回覆跳過冷卻檢查）
  ↓
內容過濾（content-filter）
  ↓
已留言防護：同一瓶子同一 IP 曾回覆 → 提示跳過下一個（僅頂層）
  ↓
寫入 Supabase `replies` 表
```

**巢狀回覆（第二層）：** 每條頂層回聲下可新增最多一層子回覆（↩ 回覆），透過 `parent_reply_id` 關聯。子回覆不受冷卻限制、不需 Turnstile 驗證，但同樣經過內容過濾。前端每條回聲（含子回覆）均提供 ⚑ 舉報按鈕。

**`replies` 表主要欄位：**

| 欄位 | 說明 |
|---|---|
| `id` | UUID |
| `bottle_id` | 關聯的瓶子 UUID |
| `content` | 回聲正文 |
| `parent_reply_id` | 父回聲 UUID（`null` 為頂層；非 `null` 為第二層子回覆）|
| `report_count` | 累計舉報次數（≥ 3 自動隱藏）|
| `is_hidden` | 是否被舉報隱藏 |

---

### 2.4 找回瓶子（鑰匙系統）

**API：** `POST /api/bottle/find`  
**限制：** 每個 IP 每分鐘最多 **10 次**（防止 Key 暴力猜測）

```
用戶輸入 6 位神秘鑰匙（逐格像素字體方塊）
  ↓
格式驗證：/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
  ↓
查詢 Supabase: bottles WHERE view_key = ? AND is_active = true
  ↓
回傳瓶子內容 + 所有公開回聲（已隱藏的不含）
  ↓（敏感欄位剝離）
不回傳 view_key 及 user_id
```

---

### 2.5 舉報機制

**API：** `POST /api/bottle/report`  
**限制：** 每個 IP 每小時最多 **5 次**

```
舉報瓶子 → RPC: increment_report(p_bottle_id)
  ↓ report_count >= 3 → is_active = false（自動隱藏）

舉報回聲 → RPC: increment_reply_report(p_reply_id)
  ↓ report_count >= 3 → is_hidden = true（自動隱藏）
```

門檻 3 次：防止單一用戶惡意報復，需多人認定才隱藏。隱藏後管理員可在儀表板審核恢復。

> 舉報功能同時覆蓋頂層回聲與第二層子回覆（均使用 `increment_reply_report` RPC，前端以事件委派統一處理）。

---

### 2.6 月光瓶晉升

Supabase RPC `promote_to_moonlight` 觸發條件：
- `reply_count` 超過閾值時自動升格
- 管理員手動通過儀表板設定

月光瓶效果：撈瓶時加權提升、前端顯示 `🌙 月光瓶` 金色徽章。

---

### 2.7 任務瓶

由管理員投出的特殊瓶子（`is_mission_bottle = true`），前端顯示 `🐈 #召集貓隊友` 粉色徽章，用於社群互動活動。

---

## 三、靈魂配對系統

靈魂配對為 **31 題多面向問卷** + 硬性門檻篩選 + 六維度智能計分，輸出 0–100 分配對結果。

### 3.1 問卷結構

| Part | 主題 | 題數 | 重點欄位 |
|---|---|---|---|
| 1 | 基本畫像（The Visuals）| 8 | 姓名、年齡、身高、體型、屬性、髮型、穿搭、床上角色 |
| 2 | 生活動能（Daily Energy）| 5 | 社交電量、週末模式、興趣（多選）、運動（多選）、旅行模式 |
| 3 | 關係導向（Hard Filters）| 3 | 關係期待、相處時間投入、不可接受事項 |
| 4 | 靈魂共鳴（The Deep Layer）| 3 | 愛的語言（多選）、安全感需求、日常愛意表達 |
| 5 | 內在邏輯（Values & Logic）| 4 | 決策導向、溝通體質、開支分配、同居想法 |
| 6 | 理想對象（The Ideal Match）| 6 | 理想屬性、身型、身高差 range、年齡差 range、反差萌偏好、個人優點 |
| 7 | 聯絡方式（Stay Connected）| 2 | IG（必填，@ 前綴自動處理）、Email（必填）|

**提交安全：**
- Cloudflare Turnstile 驗證
- IG 伺服器端必填驗證（空值或僅 `@` 回傳 400）
- 速率限制：每個 IP 每小時最多 **1 次**

---

### 3.2 篩選門檻（Hard Filter）

計分前進行四層雙向篩選，任一層不符合直接排除：

```
Step 0-1: 身份屬性（identity）— 雙向互選
Step 0-2: 體型（body_type）— 雙向互選
Step 0-3: 身高差（ideal_height_gap）— 雙向 [min, max] range
Step 0-4: 年齡差（ideal_age_gap）— 雙向 [min, max] range
```

任何一方選「冇所謂」或 `null` 則該層跳過篩選。

---

### 3.3 六維度計分引擎

核心函數：`lib/intelligence.js → computeCompatibility(userA, userB)`

每個維度最高 **20 分**，加權換算為 **0–100 分**。

---

#### 🔥 維度 1 — 火花（attraction）滿分 20

衡量床上角色互補程度。

| 組合 | 基礎分 |
|---|---|
| Top ↔ Bottom（完全互補）| 18 |
| Switch ↔ 非 Switch | 16 |
| Switch ↔ Switch | 15 |
| 躺平派 / 中性（任一方）| 12 |
| 同類（Top+Top / Bottom+Bottom）| 10 |

輔助加分：`daily_love_ritual` 相同 → **+2**（上限 20）

> v4 將同類組合由 6 分升至 10 分：女女關係中同 role 組合相當普遍，原 6 分過度懲罰。

---

#### 💞 維度 2 — 情感共鳴（emotional）滿分 20

| 欄位 | 條件 | 得分 |
|---|---|---|
| `love_languages` | 每重疊一個 +5，上限 10；零重疊 +2 | 2–10 |
| `security_needs` | 相同 +6；含「自由空間」衝突 +1；其他不同 +3 | 0–6 |
| `daily_love_ritual` | 相同 +4；不同 +1 | 0–4 |

> 零重疊基礎 +2：認同愛的語言框架本身即為情感共鳴信號。

---

#### 📅 維度 3 — 生活步調（lifestyle）滿分 20

| 欄位 | 條件 | 得分 |
|---|---|---|
| `social_energy` | 相同 +5；任一方「動靜皆宜」+3；不同 +1 | 0–5 |
| `weekend_mode` | 相同 +5；任一方「平衡/隨心」+3；不同 +1 | 0–5 |
| `interests` | 每重疊一個 +2，上限 **10**（最多 5 個）| 0–10 |
| `exercise_habits` | 每重疊一個 +2，上限 **4** | 0–4 |
| `travel_mode` | 相同 +4；不同 +1 | 0–4 |

> `clamp(s, 0, 20)` 保護上限。

---

#### 💬 維度 4 — 溝通價值（communication）滿分 20

| 欄位 | 條件 | 得分 |
|---|---|---|
| `communication_style` | 相同 +8；直球 ↔ 觀察留白（衝突）+1；其他不同 +4 | 0–8 |
| `expense_splitting` | 相同 +6；AA ↔ 你一餐（軟相容）+3；其他 +1 | 0–6 |
| `living_together` | 相同 +6；早日同住 ↔ 各自居住（硬衝突）0；其他 +3 | 0–6 |
| `decision_making` | 互補（直覺+事實）+5；相同或其他 +2 | 2–5 |

> `clamp(s, 0, 20)` 保護上限。

---

#### 💑 維度 5 — 關係期望（relationship）滿分 20

關係目標相容矩陣：

| | 認真長期 | 順其自然 | 輕鬆相處 | 開放認識 |
|---|---|---|---|---|
| **認真長期** | 14 | 8 | 0 | 2 |
| **順其自然** | 8 | 14 | 2 | 8 |
| **輕鬆相處** | 0 | 2 | 14 | 8 |
| **開放認識** | 2 | 8 | 8 | 14 |

相見頻率差（`time_commitment`）：差 0 → +6，差 1 → +4，差 2 → +2，差 3+ → +0

---

#### 🛡️ 維度 6 — 相處安全感（conflictSafety）滿分 20

分越高 = 越安全，與其他維度邏輯一致。

| 情況 | 得分 |
|---|---|
| 雙方均以冷暴力溝通（強迴避衝突）| 2 |
| 雙方存在 1 項直接觸發衝突 | 4 |
| 任一方直接觸發對方溝通地雷 | 10 |
| 無觸發衝突，無共同地雷 | 14 |
| 無觸發衝突，共同地雷 = 1 個 | 16 |
| 無觸發衝突，共同地雷 ≥ 2 個（底線一致）| 20 |

> 共同地雷越多 = 深層價值觀底線越接近。「共同厭惡」是比「共同喜好」更強的相容性信號。

---

### 3.4 加權公式與非線性調整

**加權比例：**

```
attraction:     0.15
emotional:      0.20  ← 最高
lifestyle:      0.15
communication:  0.15
relationship:   0.20  ← 最高
conflictSafety: 0.15

baseScore = floor(weighted_sum / 20 × 100)
```

**非線性調整（依序套用）：**

| 條件 | 調整 |
|---|---|
| emotional ≥ 14 **且** communication ≥ 14 | **+7**（上限 100）|
| relationship ≤ 4 | **× 0.75** |
| conflictSafety ≤ 5 | **−7** |
| softPenalty 累計（上限 8）| **−min(penalty, 8)** |

**軟性懲罰（softPenalties）：**

| 條件 | 扣分 |
|---|---|
| 用戶 identity 不在對方 ideal_identity 清單 | +6 |
| 對方 identity 不在用戶 ideal_identity 清單 | +6 |
| 用戶 body_type 不符對方體型偏好 | +4 |
| 對方 body_type 不符用戶體型偏好 | +4 |
| 身高差不符對方 ideal_height_gap（任一方）| +3 each |
| 年齡差不符對方 ideal_age_gap（任一方）| +3 each |

> 累計上限 **8 分**（v4，原 12 分）：物理偏好屬 soft preference，不應比關係目標不合更懲罰。

---

### 3.5 配對分數等級

| 分數 | 標籤 | 配色 |
|---|---|---|
| 80–100 | 靈魂伴侶候選 | 🟢 綠 `#34d399` |
| 65–79 | 高度契合 | 🟢 綠 `#34d399` |
| 50–64 | 值得深入了解 | 🟡 琥珀 `#fbbf24` |
| 35–49 | 有潛力，需磨合 | 🟡 琥珀 `#fbbf24` |
| 0–34 | 差異較大 | 🔴 紅 `#f87171` |

儀表板配對探索預設門檻：**≥ 40 分**。

---

### 3.6 智能分析摘要（intel-box）

由 `lib/intelligence.js → buildSummary()` 生成，包含：

**Persona 稱號（依前兩名維度組合）：**

| 前兩名維度 | Persona |
|---|---|
| 火花 + 生活步調 | 🏃‍♀️🔥 冒險型拍檔 |
| 情感共鳴 + 相處安全感 | 🍵🌙 療癒系靈魂 |
| 溝通價值 + 關係期望 | 🤝📊 高效率隊友 |
| 火花 + 情感共鳴 | ⚡💘 電力四射 |
| 情感共鳴 + 生活步調 | 🌿☕ 慢活系情侶 |
| 生活步調 + 相處安全感 | 🛋️✨ 舒適圈同伴 |
| 溝通價值 + 情感共鳴 | 💬🌟 心靈交流者 |
| 關係期望 + 相處安全感 | 🏡🌙 安穩守護者 |
| 火花 + 溝通價值 | ✨💬 直率型愛人 |
| 生活步調 + 關係期望 | 🌸📅 生活夢想家 |
| 情感共鳴 + 關係期望 | 🌊💜 深情續變者 |
| 火花 + 相處安全感 | 🔥🛡️ 熱情守護神 |
| 其他（fallback）| 🌙✨ 靈魂共鳴者 |

**優勢標籤（💚）：** 分數最高前 2 個維度（需 ≥ 12/20），以綠色膠囊呈現。

**🐾 爪印提醒（最多 2 條）：**

| 觸發條件 | 文字 |
|---|---|
| `conflictSafety ≤ 5` | 在衝突處理上你們的模式較為不同，初期多「說出來」比沉默更有效 |
| `relationship ≤ 8` | 你們對未來的節奏略有不同，初期建議多交流彼此對穩定的看法 |
| `communication ≤ 8` | 溝通節奏稍有不同，找到專屬你們的相處默契需要一點時間 |
| `emotional ≤ 8` | 表達愛的方式各有不同，試著主動說出你的需求，對方更容易接住 |
| `softPenalty ≥ 10` | 外在條件有小差異，但這恰恰是讓兩人互相探索的有趣起點 |
| 全不觸發 | 基礎已很穩固！主要的考驗將是如何在日常生活中持續滋養這段緣分 |

---

### 3.7 配對卡片

由 `src/pages/api/match_card/template.js` 生成，可下載 PNG。

**六邊形雷達圖：** 6 維度，雙層 SVG（底層 glow blur + 頂層清晰），填充 `rgba(0,229,255,0.30)`，頂點標籤黃色維度名 + 青色百分比。

**像素貓咪頭像（依 `identity`）：**

| 身份 | 配件 |
|---|---|
| TB | 平扁帽（Cap）|
| TBG | 胸前領結（Bow Tie）|
| Pure | 花冠（三朵小花）|
| Bi | 三色小皇冠（粉/紫/靛）|
| No Label | 四角散落星點 |

**PNG 下載：** 凍結動畫 → `html2canvas({ scale: 2 })` → 自動下載 `match_[A]_x_[B].png`

---

## 四、靈魂鏡像（Mirror Mode）

Mirror Mode 為自我探索型問卷；**主線已升級為 v3 Trait 驅動**（10 題跨場景 + 需求光譜），詳見 [`MIRROR-MODE-V3-DESIGN.md`](./MIRROR-MODE-V3-DESIGN.md) 與 [`MIRROR-MODE-SPEC.md`](./MIRROR-MODE-SPEC.md)。legacy v2 題庫僅作 `mirror-v3.js` 載入失敗時 fallback。

### 4.1 貓咪家族類型

| 代號 | 名稱 | 顏色 | 核心需求（v3） |
|---|---|---|---|
| `solitary` | 獨處貓家族 | 紫 `#bd93f9` | 自主需求、穩定需求 |
| `sunny` | 暖陽貓家族 | 粉 `#ff6b9d` | 確認需求、表達需求 |
| `mystical` | 秘境貓家族 | 青 `#00e5ff` | 共鳴需求、自主需求 |
| `sentinel` | 守護貓家族 | 綠 `#50fa7b` | 穩定需求、承諾需求 |

六種 Trait 標籤定義於 `src/lib/mirror-scoring-v3.js`（`TRAIT_LABELS`）。

---

### 4.2 計分機制（v3 摘要）

```
P1–P5 基本資料 → 10 題跨場景（選項 shuffle）→ 6 Trait 分數
  → detectTensions（內在拉鋸，登入用戶）
  → traitToCat() → 主類型 + 影子類型
  → Mirror Card（家族 + 需求光譜 Top-3 + 混血標題）
```

legacy v2：10 題每題 +2 分給四貓家族之一（見 SPEC 舊章節）。

---

### 4.3 性格卡片輸出（三層架構）

**Layer 1 — 身份核心：** 品牌標題、貓咪圖片、家族名稱、身份 meta、混血靈魂標籤

**Layer 2 — 心理側寫：** hashtag、隱藏迷惑行為、個人標籤；v3 登入卡含 **需求光譜** 進度條

**Layer 3 — 情感層：** 家族描述、黑貓炸毛預警、靈魂成分進度條

**公開家族指南（`/cat-families`）：** 頂部 **六種戀愛需求** 總覽；每族卡片含核心需求說明、共鳴文案、炸毛預警與 hashtag（已移除舊版因子試管 UI）。

---

## 五、社群與 Moonlight Passport 功能

登入用戶（Supabase Auth + `profiles`）可使用論壇、Inbox、Mirror Card 與訂閱。權限與配額集中於 `src/lib/permissions.js`。

### 5.1 月光圍爐（Forum）

| 能力 | API / 實作 |
|---|---|
| 發文／編輯／刪除 | `POST/PATCH/DELETE /api/forum/posts` |
| 留言、愛心、書籤 | `/api/forum/posts/[id]/comments`、`/api/forum/comments/[id]` |
| 標籤建議、投票 | `/api/forum/tags/suggest`、`/api/forum/polls/[id]/vote` |
| @提及通知 | `forum-mentions.js`、`forum-mention-notify.js` |
| 舉報（≥3 自動隱藏） | `POST /api/forum/report` |
| 編輯器 | Tiptap + Markdown；支援 YouTube、投票區塊 |
| 草稿 | 瀏覽器 `localStorage`（`forum-draft-storage.js`） |

**發文配額：** Free 每日 **3** 篇；Moonlight Passport **不限**（`forum_post_daily`，`premium` 為 `Infinity`）。

**顯示名稱：** 列表／詳情 API 讀取 `profiles.display_name`（非發文時快照）；改名時 `PATCH /api/me` 會同步 `forum_posts.anonymous_name_snapshot` 並做大小寫不敏感唯一性檢查（`display-name-uniqueness.js`、`POST /api/auth/check-display-name`）。

**效能：** 列表 API 使用 denormalized `comment_count`、平行化詳情查詢、訪客 Cache-Control；論壇首頁 meta（含月光旅程）可背景載入並以 sessionStorage 快取當日打卡狀態（`moon-journey-cache.js`）。

**月光旅程：** 發帖／留言／被 Like／被收藏／每日打卡獲 EXP；詳見 [MOON-JOURNEY.md](./MOON-JOURNEY.md)。

### 5.2 Inbox

| 類型 | 說明 |
|---|---|
| `match` | 配對成功後的 Mirror 頻道；可查看配對卡摘要 |
| `letter` | Moonlight Passport 主動投信；通道開啟後雙方來回（頻道狀態見 `inbox-channel.js`） |
| `photo_exchange` | 交換相邀請與完成後的對話線程 |

**投信玩法（`letter-gameplay.js`）：** 可選信紙顏色（淡黃／淡粉／淡藍／淡綠）、郵票樣式；Moonlight Passport 解鎖全部選項。  
**UI：** `ChannelStatusLine` + `ChannelNarrativeViz`（通道開啟時蠟燭敘事）；`PixelScrollMessage` 顯示卷軸信與郵票。

**主動投信配額：** Free 0；Moonlight Passport 每月 3 封（`active_letter_monthly`）。每次開通道最多 10 回合來回。

### 5.3 交換相（Photo Exchange）

Moonlight Passport 在他人 Mirror Card 發起邀請；對方接受並上傳後才扣配額。

```
POST /api/photo-exchange/request
POST /api/photo-exchange/respond
POST /api/photo-exchange/cancel
GET  /api/photo-exchange/[id]
POST /api/profile/exchange-photo   # Cloudinary 上傳交換用相片
```

- 配額：Moonlight Passport 每月 3 次（`photo_exchange_monthly`）
- 成功後雙方可查看 7 日（`use-exchange-expiry-countdown.js`）
- 資料表：`photo_exchanges`；`profiles.exchange_photo_url`

### 5.4 Moonlight Passport 訂閱

| 渠道 | 說明 |
|---|---|
| Stripe（legacy）／PayPal | `POST /api/billing/create-checkout-session`、Webhook、`create-portal-session` |
| PayMe／FPS | `ManualPaymentModal`（PayMe QR 彈窗）+ Dashboard `POST /api/billing/manual-verify` |

**`/premium` 頁面：**

- 權益列表、功能對比表、定價（HKD 58／月）
- **PayMe：** 主頁只顯示金額與 CTA；點「查看 PayMe 付款步驟」才在 `ManualPaymentModal` 內顯示 QR Code 與步驟（popup 不含 FPS 說明）
- **FPS：** 獨立區塊顯示聯絡 email 說明（不開啟 PayMe popup）
- 已訂閱用戶顯示 **月光狀態卡**（會籍剩餘日數、主動投信／交換相配額 chip、返回 Mirror Card CTA）

**帳戶頁（`/account`）：** 鏡像區塊改為 **貓家族摘要**（`AccountMirrorFamilySummary`），完整 Mirror Card 連至 `/mirror-card/[slug]`。

**Mirror Card 可見度（`getMirrorCardVisibility`）：**

| 層級 | 誰可看 |
|---|---|
| `public` | 未登入／陌生人 |
| `basic` | 已配對用戶 |
| `detailed` | 本人、Moonlight Passport 觀看者 |

| `detailed` | 本人、Moonlight Passport 觀看者 |

訪客瀏覽他人 Mirror Card 時，單一 consolidated upsell（`MirrorVisitorPremiumUpsell`）避免重複 Moonlight Passport 推廣區塊。

### 5.5 配對通知與 Legacy Claim

- 問卷提交：`POST /api/submit`（可綁定登入 `user_id`）
- 舊問卷認領：Email 驗證後 `legacy-claim/*` API
- 管理員批次投送 Inbox：`POST /api/match/deliver-inbox`（`deliverMatchCard`；可 `skipEmailNotify` 避免與完整配對信重複）
- **Dashboard 人手發信：** `POST /api/dashboard/send-emails`（Gmail SMTP + 附件共鳴分析卡）→ upsert `sent_matches`
- **Moonlight Passport 即時連線：** 同上 API 設 `deliver_inbox: true` 時，同步投送 Inbox 連線卡（不重發簡易 notify email）

**用戶端配對列表：** `/matches`（Moonlight Passport）、`loadUserMatches()` 合併 Inbox + `sent_matches`。

**連線即時通知（產品定義）：** Passport 會員配對通知 **無每月上限**；Dashboard 可對含 Passport 且雙方已認領問卷的配對一鍵 **Email + Inbox**。免費用戶仍為每月 **3 次**（以 `sent_matches` 當月計數）。

### 5.6 配額總表（`QUOTA_LIMITS`）

| 配額類型 | Free | Moonlight Passport |
|---|---|---|
| `forum_post_daily` | **3** | **不限**（`Infinity`） |
| `active_letter_monthly` | 0 | 3 |
| `photo_exchange_monthly` | 0 | 3 |
| `match_monthly` | 3 | 無限制（Dashboard／`match-delivery-quota.js`） |

**`/premium` 功能對比表（摘要）：** 每月連線通知 Free「最多 3 次」／Passport「無限制」；連線通知速度 Free「批量」／Passport「即時 Email」。

---

## 六、聯絡我們意見箱

`contact.html` 意見箱不再開啟本地郵件客戶端，改為寫入 Supabase。

**API：** `POST /api/contact-feedback`  
**Body：** `{ category, display_name?, message }`  
**類別：** 功能建議、問題回報、內容舉報、合作洽談、其他

```
用戶填寫表單
  ↓
IP Guard + 速率限制（5 次 / 小時 / IP）
  ↓
內容過濾（違禁詞拒絕；危機關鍵字仍儲存並標記 is_crisis）
  ↓
可選：Bearer token 關聯 user_id
  ↓
寫入 contact_feedback 表
```

**`contact_feedback` 表：** `category`、`display_name`、`message`、`user_id`、`is_crisis`、`created_at`（RLS 啟用，僅 service role 寫入）。  
Migration：`supabase/migrations/20250701000000_contact_feedback.sql`

---

## 七、管理儀表板 — 郵件自動化與 Moonlight Passport 即時連線

路徑：`/dashboard/email-automation`（gitignore 內原始碼）  
相關頁：`/dashboard/premium`（人手授予／撤銷 Passport）  
核心 lib：`match-delivery-quota.js`、`match-response-premium.js`、`match-notify-send.js`

### 7.1 API 一覽

| 方法 | 路徑 | 說明 |
|---|---|---|
| `GET` | `/api/dashboard/email-automation?mode=pairs` | 全域配對清單 + 配額／Passport 標註 |
| `GET` | `/api/dashboard/email-automation?mode=pairs&premium_only=1` | 僅含至少一方為 Moonlight Passport 的配對 |
| `GET` | `/api/dashboard/email-automation?mode=drafts` | Gmail 草稿佇列 |
| `POST` | `/api/dashboard/email-automation` | `action: save_draft` 存入 `email_drafts` |
| `DELETE` | `/api/dashboard/email-automation?draftId=` | 刪除草稿 |
| `POST` | `/api/dashboard/send-emails` | 發送配對通知郵件（見 7.4） |
| `POST` | `/api/dashboard/create-gmail-drafts` | 存入 Gmail 草稿 |
| `POST` | `/api/billing/manual-verify` | 人手授予／撤銷 Passport |
| `POST` | `/api/match/deliver-inbox` | 僅投送 Inbox 連線卡（無完整配對信） |

### 7.2 全域配對清單

依最低智能分門檻載入所有 `responses` 兩兩配對結果（`passesHardFilter` + `computeCompatibility`），每列標註：

| 欄位 | 說明 |
|---|---|
| `already_sent` | 已記錄於 `sent_matches` |
| `in_draft` / `draft_id` | 是否在 `email_drafts` |
| `user_a_quota` / `user_b_quota` | 本月配額（見 7.3） |
| `has_premium` | 任一方為 Moonlight Passport |
| `inbox_ready` | 雙方問卷均已認領（`responses.user_id` 皆有值） |
| `premium_instant_ready` | 含 Passport + Inbox 就緒 + 未發送 + 雙方配額可收 |
| `quota_blocked` | 任一方本月已達 Free 上限 |

回應含 `summary`：`premium_pairs`、`premium_instant_ready`、`quota_blocked` 計數。

### 7.3 配對配額與 Passport 識別

**計數規則（`match-delivery-quota.js`）：**

| 用戶類型 | 本月可參與配對通知次數 |
|---|---|
| Free | **3 次**（依 `sent_matches.sent_at` 當月累計） |
| Moonlight Passport | **無限制** |

**Passport 識別（`match-response-premium.js`）：**

1. 問卷已認領 → 查 `responses.user_id` 對應 `subscriptions`（`active`／`manual`／未過期）
2. 問卷未認領 → 以問卷 **Email** 對照 Auth 帳號，若該帳號為有效 Passport 仍標記為付費

Dashboard 每用戶 badge：**🌙 無限制**（Passport）或 **本月 n/3**（Free）。  
任一方 Free 且已滿 3 次 → `quota_blocked`，checkbox 不可勾選（Passport 方不受 3 次上限，但配對仍受對方 Free 配額約束）。

### 7.4 發送流程（`match-notify-send.js`）

```
管理員選取配對（或「即時發送全部」Passport 佇列）
  ↓
伺服器端配額檢查（可 skip_quota_check 覆寫）
  ↓
Gmail SMTP：雙向個人化郵件 + 附件共鳴分析卡.html（email-template.js）
  ↓
（可選）deliver_inbox: true → deliverMatchCard(skipEmailNotify: true)
  ↓
upsert sent_matches；移除 email_drafts
```

**`POST /api/dashboard/send-emails` Body：**

```json
{
  "pairs": [{ "userAId": 1, "userBId": 2, "match_score": 72 }],
  "deliver_inbox": false,
  "skip_quota_check": false
}
```

| 參數 | 說明 |
|---|---|
| `deliver_inbox` | `true` 時同步投送 Inbox 連線卡（Moonlight Passport 即時連線） |
| `skip_quota_check` | 管理員強制發送（慎用） |

### 7.5 Dashboard UI 操作

**分頁：**「全部配對」／「🌙 Moonlight Passport」

**Moonlight Passport 即時面板：**

- 顯示含 Passport 配對數、可即時發送數、配額已滿數
- **即時發送全部** — 對所有 `premium_instant_ready` 配對執行 Email + Inbox

**狀態標籤：** `🌙 Passport`、`📬 Inbox 就緒`、`⚠ 配額已滿`、`✉ 已發送`

**篩選：**「顯示已發送」、「隱藏配額已滿」（預設開啟）

**發送方式：** 勾選後「立即發送」或「存入 Gmail 草稿」；Passport 分頁發送預設帶 `deliver_inbox: true`。

**人手授予 Passport：** `/dashboard/premium` → 授予後用戶在郵件自動化顯示無限制配額。

---

## 八、技術架構與安全機制

### 後端基礎設施

| 服務 | 用途 |
|---|---|
| **Vercel Serverless** | API 函數（`/api/bottle/*`、`/api/submit`、`/api/forum/*`、`/api/inbox/*` 等）|
| **Supabase（PostgreSQL）** | 資料儲存（`bottles`、`replies`、`responses`、`profiles`、`forum_*`、`inbox_*`、`contact_feedback` 等）|
| **Upstash Redis** | 速率限制（Sliding Window）|
| **Cloudflare Turnstile** | 人機驗證（投瓶、回聲均需驗證）|
| **PostHog** | 全站：`posthog-init.js`、`/api/analytics/config`；pageview、登入 identify、Mirror/Echo/漂流瓶事件；session recording 遮罩輸入 |
| **SEO** | `SeoHead`、`sitemap.xml`、`robots.txt`、靜態頁 OG／JSON-LD；公開論壇貼文與 `/mirror-card/[slug]` 可索引 |
| **Next.js 15** | App 路由 + 管理儀表板（`/dashboard`）|

### 內容安全三層防護

| 層次 | 實現 | 說明 |
|---|---|---|
| **人機驗證** | Cloudflare Turnstile | 投瓶、回聲均需通過，防機器人；`interaction-only` 模式，正常用戶完全無感知 |
| **IP Guard（爆發偵測）** | `src/lib/ip-guard.js` | 短時間大量請求觸發 24 小時封鎖 |
| **Content Filter** | `src/lib/content-filter.js` | 過濾違禁詞，投瓶和回聲均套用 |
| **舉報自動隱藏** | Supabase RPC | 瓶子 / 回聲累計 3 次舉報自動隱藏 |

### 匿名性與隱私

- **漂流瓶：** 不綁定帳號；瓶子僅以 6 位鑰匙關聯；Find API 剝離敏感欄位
- **問卷：** IG／Email 供配對通知；登入後可綁定 `user_id` 與 Legacy Claim
- **論壇／Inbox：** 需 Supabase Auth；顯示名稱政策見 `display-name-policy.js`
- IP 位址用於速率限制與濫用偵測，不超過 24 小時封鎖保留

### 配對通知 Email

`src/lib/email-template.js` 內含 **黑貓的守護提醒（社交安全）**：保留平台線上交流聲明，並列出見面安全、告知親友、飲品與金錢防範等完整指引。

### 法律頁（`tos.html`）

2026-07 起涵蓋 Mirror／Echo、論壇、收件箱、月光旅程、Moonlight Passport、相片交換等完整條款；論壇發文配額為免費每日 3 篇、會員不限。

---

## 九、資料庫總覽（Supabase）

所有持久化資料存放於 **Supabase（PostgreSQL）**。Next.js API 以 **service role**（`getAdminClient()`）執行寫入與跨用戶查詢；前端登入用戶則透過 Supabase Auth JWT 受 **RLS（Row Level Security）** 約束。結構變更以 `supabase/migrations/*.sql` 管理，新環境需按檔名順序執行 migration。

### 9.1 架構概覽

```
auth.users（Supabase Auth）
  └── profiles（1:1 擴展檔）
        ├── mirror_cards
        ├── subscriptions
        ├── usage_quotas
        ├── forum_posts / forum_comments / …
        ├── inbox_threads → inbox_messages
        ├── photo_exchanges
        └── moon_journey_events

匿名模組（不綁 user_id）
  └── bottles → replies

配對模組
  └── responses（問卷）→ sent_matches（通知紀錄）/ inbox_threads（連線卡）
```

| 存取方式 | 用途 |
|---|---|
| **Service role** | API 路由、Dashboard、配額扣減、跨表 join |
| **Authenticated JWT** | 用戶讀寫自己的 profile、inbox、部分 forum RLS |
| **Anon** | 僅讀 `forum_posts` 中 `visibility = 'public'` 的帖（見 `20250707000000_forum_posts_rls_anon_public_only.sql`）|

### 9.2 表分組一覽

#### 身份與訂閱

| 表 | 說明 | 主要欄位／備註 |
|---|---|---|
| `auth.users` | Supabase 內建帳號 | email、密碼 hash；由 Auth API 管理 |
| `profiles` | 用戶公開檔 | `display_name`、`subscription_tier`、`exchange_photo_url`、`moon_journey_exp`／`level`／`moon_checkin_streak` |
| `subscriptions` | Moonlight Passport 訂閱 | `provider`（paypal／manual）、`status`、`current_period_end` |
| `usage_quotas` | **站內功能配額帳本** | `quota_type`、`used_count`、`limit_count`、`period_start`／`period_end`；見 9.4 |
| `user_blocks` | Inbox 封鎖名單 | `blocker_id`、`blocked_id` |

#### 匿名漂流瓶

| 表 | 說明 | 主要欄位 |
|---|---|---|
| `bottles` | 漂流瓶 | `content`、`view_key`、`is_active`、`report_count`、`is_moonlight`、`expires_at` |
| `replies` | 回聲（含巢狀） | `bottle_id`、`parent_reply_id`、`is_hidden`、`report_count` |
| `topic_banner` | 漂流瓶頂部橫幅文案 | 管理員設定 |

#### 問卷配對（Echo）

| 表 | 說明 | 主要欄位 |
|---|---|---|
| `responses` | 31 題問卷提交 | 各 Part 答案欄位、`user_id`（認領後）、`email`、`ig` |
| `sent_matches` | **配對通知 Email 發送紀錄** | `user_a_id`、`user_b_id`、`sent_at`；Free 每月 3 次上限依此計數 |
| `legacy_match_claims` | 舊問卷 Email 認領 | token、過期時間、關聯 `responses.id` |
| `email_drafts` | Dashboard Gmail 草稿佇列 | 待發配對對、草稿內容 |

#### Mirror Card

| 表 | 說明 | 主要欄位 |
|---|---|---|
| `mirror_cards` | 鏡像性格卡 | `public_slug`、`mirror_type`、v3 `trait_scores`、`scoring_version`、`is_published` |
| `mirror_card_reports` | Mirror Card 舉報 | 累計達門檻可下架 |

#### 論壇（月光圍爐）

| 表 | 說明 |
|---|---|
| `forum_posts` | 主帖；`visibility`（`public`／`members_only`）、`anonymous_name_snapshot`、`like_count`、`comment_count` |
| `forum_comments` | 留言；支援 `parent_comment_id` |
| `forum_likes` | 帖文愛心 |
| `forum_comment_likes` | 留言愛心 |
| `forum_bookmarks` | 書籤 |
| `forum_reports` | 舉報（≥3 自動隱藏帖） |
| `forum_polls` / `forum_poll_votes` | 投票與票選紀錄 |
| `forum_post_tags` / `forum_tag_labels` | 標籤關聯與正規化名稱 |
| `forum_mention_notifications` | @提及通知佇列 |

#### Inbox

| 表 | 說明 |
|---|---|
| `inbox_threads` | 對話線程；`thread_type`：`match`／`letter`／`photo_exchange` |
| `inbox_messages` | 訊息；`message_type`：`match_card`、`user_letter`、`photo_exchange_request` 等；`payload` 存 JSON |

#### 交換相與其他

| 表 | 說明 |
|---|---|
| `photo_exchanges` | 交換相邀請；`status`：pending／completed／cancelled／expired |
| `contact_feedback` | 聯絡頁意見箱 |
| `moon_journey_events` | 月光旅程 EXP 事件（去重：`user_id` + `action_type` + `source_id`） |
| `moon_journey_daily_counts` | 每日留言 EXP 計數上限 |

### 9.3 兩套配額機制（易混淆）

系統有 **兩個獨立** 的配額來源，用途不同：

| 機制 | 儲存位置 | 管什麼 | Free | Moonlight Passport |
|---|---|---|---|---|
| **站內功能配額** | `usage_quotas` | 發文、主動投信、交換相 | 見下表 | 見下表 |
| **配對通知配額** | `sent_matches` | Dashboard／自動化發送連線 Email + Inbox | 每月 **3** 對 | **無限制** |

**`usage_quotas.quota_type`（`src/lib/permissions.js` → `QUOTA_LIMITS`）：**

| `quota_type` | 週期 | Free | Passport | 觸發時機 |
|---|---|---|---|---|
| `forum_post_daily` | 每日 0:00 起 | 3 | 不限（`Infinity`，不寫表） | `POST /api/forum/posts` |
| `active_letter_monthly` | 曆月 | 0 | 3 | 開啟 Inbox 主動投信通道 |
| `photo_exchange_monthly` | 曆月 | 0 | 3 | 交換相完成時扣 requester |
| `match_monthly` | 曆月 | 3 | 999 | **程式有定義，實際連線通知以 `sent_matches` 為準** |

每行 `usage_quotas` 記錄：`user_id` + `quota_type` + 本期 `used_count`／`limit_count` + `period_start`／`period_end`。Premium 發文雖不扣配額，其他類型仍會 upsert 用量。`/api/me` 與 `/api/billing/status` 會讀取本期剩餘配額。

### 9.4 Migration 索引

| 檔案 | 內容 |
|---|---|
| `20250615000000`–`000003` | 論壇留言、愛心、舉報 |
| `20250616000005`–`000006` | 書籤、留言愛心 |
| `20250620000000` | Dashboard 用戶搜尋 RPC |
| `20250622000000` | `auth_email_is_registered` |
| `20250623000000` | @提及通知 |
| `20250624000000` | 帖文可見度 `visibility` |
| `20250625000000` | 投票 |
| `20250626000000`–`27000000` | 標籤 |
| `20250628000000`–`000004` | 交換相、Inbox 類型、顯示名稱搜尋、投信玩法偏好 |
| `20250701000000`–`000001` | 意見箱、論壇公開讀 RLS |
| `20250703000000`–`04000000` | 論壇 topic 更名 |
| `20250705000000` | 月光旅程 |
| `20250706000000` | Mirror v3 `trait_scores` |
| `20250707000000` | 匿名僅讀 `public` 帖 RLS |

部分早期表（`bottles`、`responses`、`profiles`、`inbox_*` 等）在 Supabase 專案建立時已存在，未必有對應 migration 檔；以 Dashboard **Table Editor** 或 `information_schema` 為準。

### 9.5 常用關聯速查

```
profiles.id  ←→  auth.users.id
responses.user_id  →  profiles.id（問卷認領）
mirror_cards.user_id  →  profiles.id
inbox_threads.(user_a_id, user_b_id)  →  profiles.id
sent_matches.(user_a_id, user_b_id)  →  responses.id（問卷 ID，非 auth UUID）
photo_exchanges.(requester_id, recipient_id)  →  profiles.id
forum_posts.author_id  →  profiles.id
```

---

## 十、API 速率限制一覽

| 端點 | 限制 | 演算法 |
|---|---|---|
| `POST /api/bottle/throw` | **5 次 / 小時** / IP | Sliding Window |
| `POST /api/bottle/reply` | **60 次 / 小時** / IP | Sliding Window |
| `GET /api/bottle/random` | **10 次 / 分鐘** / IP | Sliding Window |
| `POST /api/bottle/report` | **5 次 / 小時** / IP | Sliding Window |
| `POST /api/submit`（問卷）| **1 次 / 小時** / IP | Sliding Window |
| `POST /api/bottle/find` | **10 次 / 分鐘** / IP | Sliding Window |
| `POST /api/contact-feedback` | **5 次 / 小時** / IP | Sliding Window |
| `POST /api/inbox/send` | **10 次 / 小時** / 用戶 | Sliding Window |
| `POST /api/forum/posts` | **5 次 / 10 分鐘** / 用戶 | Sliding Window（額外於每日配額） |
| `POST /api/auth/check-email` | 有限制 / IP | Sliding Window |

所有端點均套用 **IP Guard 爆發偵測**，超出短期閾值觸發 **24 小時 IP 封鎖**。

---

## 十一、部署問題記錄（Incident Log）

### 2026-05-30 — Vercel 部署問題 + Turnstile CSP 警告

#### 問題一：`/api/bottle/*` 全部回傳 404

**症狀：**
```
GET https://black-cat-under-the-moon.vercel.app/api/bottle/random 404 (Not Found)
```

**根因：**  
`vercel.json` 未指定 `"framework": "nextjs"`，Vercel 無法識別此為 Next.js 專案，導致 `src/pages/api/*` 下的所有 Serverless Function 路由無法正確映射。同時缺少根目錄的 `next.config.js`。

**修復：**
1. `vercel.json` 加入 `"framework": "nextjs"`
2. 在專案根目錄新增 `next.config.js`（最小設定）
3. 執行 `npx vercel deploy --prod` 強制重新部署（只 push 到 GitHub 未能觸發重建）

**Commits：**
- `2cb7acb` — `chore: configure Vercel for Next.js routing`

---

#### 問題二：`bubble_compiled.js` Trusted Types CSP 違規警告

**症狀：**
```
Creating a TrustedTypePolicy named 'goog#html' violates the following
Content Security policy directive: "trusted-types twKxV6 default".
Failed to execute 'createPolicy' on 'TrustedTypePolicyFactory': Policy "goog#html" disallowed.
```

**根因：**  
Cloudflare Turnstile 的 challenge iframe（`challenges.cloudflare.com`）內部使用 Google Closure Library（`bubble_compiled.js`），該 library 嘗試建立名為 `goog#html` 的 TrustedType policy。此錯誤發生在 Cloudflare 自己的 iframe 內，**並非我們頁面的 CSP 設定造成**（本站原本無任何 CSP header）。

**修復：**  
在 `vercel.json` 的 `headers` 設定中，對所有路由加入 CSP header，明確允許 `goog#html`：

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      {
        "key": "Content-Security-Policy",
        "value": "trusted-types twKxV6 default goog#html;"
      }
    ]
  }
]
```

**Commits：**
- `2685ddc` — `fix: add CSP header allowing goog#html trusted type`

---

#### 問題三：`postMessage` cross-origin 警告

**症狀：**
```
Failed to execute 'postMessage' on 'DOMWindow': The target origin provided
('https://challenges.cloudflare.com') does not match the recipient window's
origin ('https://black-cat-under-the-moon.vercel.app').
```

**根因：**  
此為 Cloudflare Turnstile widget 初始化期間的 **內部通訊時序問題**，在 Turnstile iframe 完全載入前頁面發出 postMessage 導致。此警告不影響功能，屬 Cloudflare 內部已知問題，**無需在本專案修復**。

---

### 2026-05-30 — 巢狀回聲 UI + 行動端優化

#### 功能：巢狀回覆（第二層留言）

**新增功能：**
- 每條頂層回聲新增 ↩ 回覆按鈕，點擊後展開子回覆輸入框（同時隱藏底部留言區）
- 子回覆以縮排區塊呈現，紫色左邊線區分層級
- 子回覆輸入框預設單行，輸入時自動撐高（`scrollHeight` 動態調整）
- 字數計數器與送出按鈕浮於輸入框右下角內側
- 同一時間只允許一個子回覆表單展開（切換時自動關閉其他）

**DB migration（需在 Supabase 執行）：**
```sql
ALTER TABLE replies ADD COLUMN IF NOT EXISTS parent_reply_id UUID REFERENCES replies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_replies_parent ON replies(parent_reply_id);
ALTER TABLE replies DROP CONSTRAINT IF EXISTS replies_bottle_id_user_id_key;
```

**Commits：**
- `6288a70` — `fix: compact sub-reply UX, auto-expand textarea, tighter cards, report btn on nested replies, delegation for reply/report clicks, reset find-tab state on new search`

---

#### 功能：前端 UX 優化（行動端）

**問題：**
1. 子回覆輸入框高度過高（受全域 `textarea { padding: 11px }` 影響）
2. 回聲留言卡片上下 padding 過大，內容少時仍佔大量空間
3. 撈瓶頁「拋回大海」按鈕在留言展開後需大幅下滑才能觸及

**修復：**
1. 子回覆 `<textarea>` 全面覆寫 padding：`padding: 6px 46px 24px 10px`，移除繼承的 11px 頂部空間
2. `.reply-item` 及 `.reply-subitem` padding / margin 縮減
3. `@media (max-width: 480px)` 中：`.card { padding: 14px 16px }`，`#btn-next-wrap { position: sticky; bottom: 14px }`，確保按鈕隨時可見

**Commits：**
- `1571786` — `fix(mobile): compact subreply textarea, sticky 拋回大海 btn, tighter card padding on small screens`

---

### 2026-07-05 — Moonlight Passport 即時連線 + PayMe UX + 論壇／帳戶強化

| 區域 | 變更 |
|---|---|
| `/premium` PayMe | QR Code 改為 popup 顯示；主頁僅 CTA；FPS 獨立說明區（不混入 PayMe popup） |
| 功能對比 | Passport 連線通知改為「無限制」；即時 Email + Inbox 為 Passport 權益 |
| Dashboard 郵件自動化 | Moonlight Passport 分頁、即時發送佇列、`deliver_inbox`、Email 對照 Passport 識別 |
| 共用 lib | `match-response-premium.js`、`match-notify-send.js`；`deliverMatchCard({ skipEmailNotify })` |
| 論壇 | 顯示名稱即時同步、唯一性檢查；列表／詳情載入效能優化；月光旅程 session 快取 |
| 帳戶 | 貓家族摘要取代完整 Mirror Card；Mirror Card 訪客單一 upsell |
| RLS | `20250707000000_forum_posts_rls_anon_public_only.sql` — 匿名僅讀公開帖 |

### 2026-07-01 — 社群功能文件化 + 意見箱 + 郵件自動化配額

**新增／更新功能摘要：**

| 區域 | 變更 |
|---|---|
| 聯絡頁 | `contact.html` 意見箱改為 `POST /api/contact-feedback` 寫入 `contact_feedback` |
| Moonlight Passport 頁 | 已訂閱用戶顯示月光狀態卡（會籍、投信／交換相配額） |
| 貓家族頁 | `/cat-families` 因子試管 UI 可讀性優化 |
| Dashboard | 郵件自動化顯示本月配對配額（Free 3 次／Moonlight Passport 無限）、隱藏配額已滿、超額列不可勾選 |
| 共用 lib | `src/lib/match-delivery-quota.js` |

**Migration：** `20250701000000_contact_feedback.sql`
