# 🌙 月光漂流瓶 × Black Cat Under The Moon — 完整系統介紹

> 最後更新：2026-05-30｜版本：v4 智能引擎 + 月光漂流瓶 Phase 8（巢狀回聲 + 行動端優化）

---

## 目錄

1. [專案總覽](#一專案總覽)
2. [月光漂流瓶](#二月光漂流瓶)
3. [靈魂配對系統](#三靈魂配對系統)
4. [靈魂鏡像（Mirror Mode）](#四靈魂鏡像mirror-mode)
5. [技術架構與安全機制](#五技術架構與安全機制)
6. [API 速率限制一覽](#六api-速率限制一覽)
7. [部署問題記錄（Incident Log）](#七部署問題記錄incident-log)

---

## 一、專案總覽

Black Cat Under The Moon 是一個專為**女同志社群**設計的匿名社交平台，包含三個核心功能模組：

| 模組 | 說明 | 入口 |
|---|---|---|
| 🌊 月光漂流瓶 | 完全匿名的心靈漂流空間，投出心聲並讀取陌生人的瓶子 | `drift-bottle.html` |
| 💫 靈魂配對 | 多維度問卷 + 算法配對，找出最合拍的靈魂伴侶 | `questionnaire.html` |
| 🪞 靈魂鏡像 | 自我探索問卷，生成貓咪家族性格卡片 | `questionnaire.html` → Mirror Mode |

後台管理儀表板（`/dashboard`）：配對分析、實驗室、用戶匯出、郵件自動化，僅管理員訪問。

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

Mirror Mode 是自我探索型問卷，共 **15 題**（5 題基本資料 + 10 題計分），生成「貓咪家族」性格卡片。

### 4.1 貓咪家族類型

| 代號 | 名稱 | 顏色 | 核心特質 |
|---|---|---|---|
| `solitary` | 獨處貓家族 | 紫 `#bd93f9` | 重視個人空間、低頻高質陪伴、獨立自主 |
| `sunny` | 暖陽貓家族 | 粉 `#ff6b9d` | 直率熱烈、明確承諾、高溝通需求 |
| `mystical` | 秘境貓家族 | 青 `#00e5ff` | 情感共鳴深、靈魂對話、重視被理解 |
| `sentinel` | 守護貓家族 | 綠 `#50fa7b` | 穩定安全感、長期規劃、規律相處 |

---

### 4.2 計分機制

**10 題，每題對應類型 +2 分。** 四類最高各 20 分，總計 20 分分佈在四類中。

題目三個領域：

| 領域 | 題數 | 主題 |
|---|---|---|
| 親密與相處節奏 | Q1–Q3 | 相處時間分配、聯絡模式、計劃取消反應 |
| 溝通與情感語言 | Q4–Q7 | 被愛感受、衝突處理、愛意表達、最希望伴侶明白的事 |
| 安全感與未來想像 | Q8–Q10 | 安心狀態、受傷最深的情況、伴侶在生命中的角色 |

每題四選項固定對應：`① solitary  ② sunny  ③ mystical  ④ sentinel`

**主類型：** 得分最高者（平分取陣列順序 solitary → sunny → mystical → sentinel 第一個）

**影子類型（Shadow Type）：**

```
出現條件：第二高分 > 0  AND  第二高分 ≥ 主類型分數 − 2
```

分差 ≤ 2 才顯示，代表「混血靈魂」。

---

### 4.3 性格卡片輸出（三層架構）

**Layer 1 — 身份核心：** 品牌標題、貓咪圖片（類型光暈）、家族名稱、身份 meta（Label/MBTI/星座）、混血靈魂標籤（若有影子類型）

**Layer 2 — 心理側寫：** 3 個特質 hashtag、隱藏迷惑行為（由作答觸發）、喜好/音樂/電影個人標籤

**Layer 3 — 情感層：** 家族描述引述（斜體）、🐈‍⬛ 黑貓炸毛預警、靈魂成分進度條（四類型佔比動畫）

---

## 五、技術架構與安全機制

### 後端基礎設施

| 服務 | 用途 |
|---|---|
| **Vercel Serverless** | API 函數（`/api/bottle/*`、`/api/submit`）|
| **Supabase（PostgreSQL）** | 資料儲存（`bottles`、`replies`、`responses` 表）|
| **Upstash Redis** | 速率限制（Sliding Window）|
| **Cloudflare Turnstile** | 人機驗證（投瓶、回聲均需驗證）|
| **PostHog** | 使用行為分析（前端事件追蹤）|
| **Next.js 15** | 管理儀表板（`/dashboard`）|

### 內容安全三層防護

| 層次 | 實現 | 說明 |
|---|---|---|
| **人機驗證** | Cloudflare Turnstile | 投瓶、回聲均需通過，防機器人；`interaction-only` 模式，正常用戶完全無感知 |
| **IP Guard（爆發偵測）** | `src/lib/ip-guard.js` | 短時間大量請求觸發 24 小時封鎖 |
| **Content Filter** | `src/lib/content-filter.js` | 過濾違禁詞，投瓶和回聲均套用 |
| **舉報自動隱藏** | Supabase RPC | 瓶子 / 回聲累計 3 次舉報自動隱藏 |

### 匿名性保護

- 系統不儲存任何用戶帳號，瓶子僅以 6 位鑰匙關聯
- Find API 回傳前剝離 `view_key`、`user_id` 等敏感欄位
- IP 位址僅用於速率限制，不超過 24 小時保留
- 問卷提交儲存 IG / Email 僅用於管理員配對通知，不公開

---

## 六、API 速率限制一覽

| 端點 | 限制 | 演算法 |
|---|---|---|
| `POST /api/bottle/throw` | **5 次 / 小時** / IP | Sliding Window |
| `POST /api/bottle/reply` | **60 次 / 小時** / IP | Sliding Window |
| `GET /api/bottle/random` | **10 次 / 分鐘** / IP | Sliding Window |
| `POST /api/bottle/report` | **5 次 / 小時** / IP | Sliding Window |
| `POST /api/submit`（問卷）| **1 次 / 小時** / IP | Sliding Window |
| `POST /api/bottle/find` | **10 次 / 分鐘** / IP | Sliding Window |

所有端點均套用 **IP Guard 爆發偵測**，超出短期閾值觸發 **24 小時 IP 封鎖**。

---

## 七、部署問題記錄（Incident Log）

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
