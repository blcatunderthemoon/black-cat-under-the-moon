# 🌙 Black Cat Under The Moon — 計分方法及 File 說明

> 最後更新：2026-05-05｜當前計分引擎版本：v4（6 維度智能引擎，0–100 分制）

---

## 一、File 結構與作用

```
BlackCatUnderTheMoon/
├── index.html               # 前端問卷介面
├── package.json             # Next.js 專案依賴設定
├── questionaire.md          # 問卷題目草稿（參考用）
├── SCORING.md               # 本文件（計分方法說明）
├── README.md                # 專案介紹
├── api/
│   └── submit.js            # 提交問卷答案的 API
├── pages/
│   ├── _app.js
│   ├── dashboard/
│   │   ├── index.js             # 儀表板總覽
│   │   ├── matching-analytics.js
│   │   ├── match-explorer.js    # 配對探索（含生成配對卡片）
│   │   ├── export.js
│   │   ├── experiment-lab.js
│   │   └── test-data.js         # 植入 / 清除測試資料
│   └── api/
│       ├── match.js         # 靈魂配對計分 API（核心邏輯）
│       ├── test.js          # 系統健康檢查 API
│       ├── match_card/
│       │   ├── template.js  # 配對卡片 HTML 模板（含雷達圖）
│       │   └── notify.js    # 配對通知 API（預留）
│       └── dashboard/
│           ├── stats.js
│           ├── distributions.js
│           ├── matching-analytics.js
│           ├── match-explorer.js
│           ├── experiment.js
│           ├── export.js
│           ├── seed.js          # GET / POST — 測試資料植入 / 清除
│           └── intelligence.js  # POST — 6 維度相容性分析引擎
├── components/
│   └── dashboard/           # Layout、Sidebar、Header、KPICard、MatchDetailPanel 等
├── styles/
│   └── dashboard/           # CSS Modules + 設計 token（globals.css）
├── lib/
│   ├── matching.js          # 配對純函數庫（所有 API 共用）
│   ├── intelligence.js      # 6 維度相容性引擎（computeCompatibility / interpretScores）
│   └── seed-data.js         # 測試用戶生成器（generateUser）
├── scripts/
│   ├── generate-matches.mjs # 本地生成配對卡片（手動指定兩用戶）
│   ├── seed-test-data.mjs   # 產生測試用戶資料
│   ├── test-matching.mjs    # 執行配對算法測試
│   └── export-matches.mjs   # 全體用戶配對結果匯出至 Excel
├── match-cards/             # 生成的 HTML 配對卡片（gitignore 建議加入）
└── match-results/           # 匯出的 Excel 配對結果（gitignore 建議加入）
```

### `index.html`
前端問卷頁面。用戶填寫個人資料及配對偏好後，透過 POST 把資料送至 `/api/submit`。

### `api/submit.js`
接收前端 POST 請求，將用戶答案標準化後寫入 Supabase `responses` 資料表。  
主要工作：
- 欄位名稱對齊（前端鍵名 → DB 欄名）
- 數值類型轉換（`age`、`height` → INT）
- Range 類型處理（`ideal_height_gap`、`ideal_age_gap` → JSON 字串 `[min, max]`）
- 多選欄位處理（Array → 逗號分隔字串）

### `pages/api/match.js`
靈魂配對核心 API（`GET /api/match?userId=<id>`）。  
執行流程：
1. 從 Supabase 拉取目前用戶資料
2. 拉取所有其他用戶
3. **Hard Filter**：雙向身份屬性 + 雙向體型 + 雙向身高差 + 雙向年齡差篩選
4. **Scoring**：四維度計分（見下節）
5. 依總分降序排列後回傳

### `pages/api/match_card/template.js`
配對卡片 HTML 模板引擎（`POST /api/match_card/template`）。  
接收 `{ userId, targetId, match_score?, score_breakdown?, intelligence? }`，從 Supabase 拉取兩位用戶完整資料，自動呼叫 `computeCompatibility` 計算智能分（若呼叫方未提供），呼叫 `buildMatchCardHtml` 生成深色卡片 HTML 並回傳。  
**同步率（badge）永遠使用 `resolvedIntelligence.finalScore`**，確保顯示數字與雷達圖維度一致。

雷達圖固定為六邊形（6 維度），標籤：火花 / 情感共鳴 / 生活步調 / 溝通價值 / 關係期望 / 相處安全感。  
每個頂點直接標註維度名稱及對應百分比（`XX%`）。  
評語區以毛玻璃（frosted glass）卡片呈現，狀態標籤顏色隨配對類型動態改變（🟢綠 / 🟡琥珀 / 🔴紅）。  
下載 PNG 時自動凍結所有 CSS 動畫，確保 `html2canvas` 截圖一致性。

### `pages/api/dashboard/seed.js`
測試資料管理 API：
- `GET` → 回傳現有種子用戶數量
- `POST { action: 'seed', count }` → 植入 N 個模擬用戶（5–100），使用 **service role key** 繞過 RLS
- `POST { action: 'clear' }` → 清除所有種子用戶（`feedback LIKE 'Seed user%'`），使用 **service role key** 繞過 RLS

> 注意：write 操作（seed / clear）使用 `SUPABASE_SERVICE_ROLE_KEY` 建立的 admin 客戶端，read 操作（GET count）仍使用 anon key。需在 `.env.local` 及 Vercel 環境變數中設定 `SUPABASE_SERVICE_ROLE_KEY`。

### `pages/api/dashboard/intelligence.js`
6 維度相容性分析 API（`POST /api/dashboard/intelligence`）：
- **模式 A** `{ userA, userB }` → 呼叫 `computeCompatibility(userA, userB)` 從原始 DB 資料計算
- **模式 B** `{ scores: { bedRoleScore, loveLanguageScore, ... } }` → 呼叫 `interpretScores(scores)` 解讀已有分數

### `lib/intelligence.js`
6 維度相容性引擎，提供兩個匯出函數：

**`computeCompatibility(userA, userB)`** — 直接從 DB 資料列計算，回傳 `{ match: true, finalScore, dimensionScores: { attraction, emotional, lifestyle, communication, relationship, conflictSafety }, summary: { type, text, strengths, risks }, insights: string[] }`。各維度分數為 0–20，最終分加權至 0–100。  
**`interpretScores(scores)`** — 對已有的四維度分數物件進行解讀，回傳 `{ summary, strengths, risks, prediction }`
測試用戶生成器。匯出 `generateUser(index)` 及 `IDENTITIES`、`BODY_TYPES` 等常數，供 `seed.js` API 及 `seed-test-data.mjs` 腳本共用。

### `scripts/generate-matches.mjs`
本地配對卡片生成工具。手動指定兩個用戶 ID，計算配對分數並產生 HTML 配對卡片。  
用法：`node scripts/generate-matches.mjs --userA=<id> --userB=<id>`

### `scripts/seed-test-data.mjs`
測試數據產生器。產生指定數量的模擬用戶（含 TB/TBG/Pure/Bi/No Label 五種角色），寫入 Supabase。  
用法：`node scripts/seed-test-data.mjs [--count=20] [--clear]`

### `scripts/test-matching.mjs`
配對算法測試工具。抓取所有用戶，對指定用戶執行配對，顯示排名、分佈圖及可選 HTML 卡片。  
用法：`node scripts/test-matching.mjs [--userId=<id>] [--generateCards]`

### `pages/api/test.js`
健康檢查端點，`GET /api/test` 回傳系統狀態及當前時間，確認 API 服務正常運行。

---

## 二、配對計分方法

> **現行版本使用智能引擎（v4）直接計分，總分 0–100 分。**  
> 舊版四維度 80 分制已廢棄，所有 API 及儀表板一律使用 `computeCompatibility` 輸出的 `finalScore`。

### Step 0 — Hard Filter（門檻篩選）

在計分前進行**四層雙向篩選**，任何一層不符合者直接排除：

#### 0-1 — 身份屬性篩選

- 用戶的 `identity` 必須在對方的 `ideal_identity` 清單中（或對方選「冇所謂」）
- 對方的 `identity` 必須在用戶的 `ideal_identity` 清單中（或用戶選「冇所謂」）

#### 0-2 — 體型篩選

- 對方的 `body_type` 必須在用戶的 `ideal_appearance` 清單中（或用戶冇填 / 選「冇所謂」）
- 用戶的 `body_type` 必須在對方的 `ideal_appearance` 清單中（或對方冇填 / 選「冇所謂」）

#### 0-3 — 身高差篩選

- 雙向身高差分別落在對方 `ideal_height_gap [min, max]` 範圍內（或 `null` = 冇所謂）

#### 0-4 — 年齡差篩選

- 雙向年齡差分別落在對方 `ideal_age_gap [min, max]` 範圍內（或 `null` = 冇所謂）

---

## 三、智能相容性引擎（`lib/intelligence.js`）

`computeCompatibility(userA, userB)` 從 DB 原始資料計算 6 個維度（各 0–20 分），加權後得出 0–100 的最終分。

### 六維度計分細節

#### 維度 1 — 火花（attraction）滿分 20

床上角色（互動能量偏好）互補程度。輔助因子：`daily_love_ritual` 相同加 +2。

| 組合 | 基礎分 |
|---|---|
| Top ↔ Bottom（完全互補） | **18** |
| Switch ↔ 非 Switch | **16** |
| Switch ↔ Switch | **15** |
| 躺平派 / 中性（任一方） | **12** |
| 同類（Top-Top / Bottom-Bottom） | **10** |
| 其他 | **10** |

> `daily_love_ritual` 相同 → 額外 +2（上限 20）

> **v4 變更：** 同類組合（Top+Top / Bottom+Bottom）由 6 → **10**，反映女女關係中同 role 組合相當普遍，原 6 分過度懲罰。

#### 維度 2 — 情感共鳴（emotional）滿分 20

| 欄位 | 條件 | 得分 |
|---|---|---|
| `love_languages` | 有重疊：每重疊一個 +5，上限 10；零重疊：+2（基礎共鳴分） | 2–10 |
| `security_needs` | 相同 +6；有「自由空間」衝突 +1；其他不同 +3 | 0–6 |
| `daily_love_ritual` | 相同 +4；不同 +1 | 0–4 |

> **v4 變更：** 愛的語言零重疊不再得 0 分，改為基礎 **+2**（認同愛的語言框架本身即為共鳴訊號）。

#### 維度 3 — 生活步調（lifestyle）滿分 20

| 欄位 | 條件 | 得分 |
|---|---|---|
| `social_energy` | 相同 +5；任一方「動靜皆宜」+3；其他不同 +1 | 0–5 |
| `weekend_mode` | 相同 +5；任一方「平衡派/隨心派」+3；其他不同 +1 | 0–5 |
| `interests` | 每重疊一個 +2，上限 **10**（最多 5 個共同興趣計分） | 0–10 |
| `exercise_habits` | 每重疊一個 +2，上限 **4** | 0–4 |
| `travel_mode` | 相同 +4；不同 +1 | 0–4 |

> **v4 變更：** `interests` cap 由 6 → **10**（原 cap 3 個共同興趣即達上限，低估深度生活共鳴）；新增 `exercise_habits` 計分（共同運動習慣係生活步調核心訊號）。整體 lifestyle 上限因子累加 > 20，由 `clamp(s, 0, 20)` 保護。

#### 維度 4 — 溝通價值（communication）滿分 20

| 欄位 | 條件 | 得分 |
|---|---|---|
| `communication_style` | 相同 +8；直球 ↔ 觀察留白（衝突）+1；其他不同 +4 | 0–8 |
| `expense_splitting` | 相同 +6；AA ↔ 你一餐（軟相容）+3；其他不同 +1 | 0–6 |
| `living_together` | 相同 +6；早日同住 ↔ 各自居住（硬衝突）0；其他不同 +3 | 0–6 |
| `decision_making` | 互補（直覺系 + 事實系）+5；相同或其他 +2 | 2–5 |

> **v4 變更：** 新增 `decision_making` 計分。互補決策風格（直覺 + 事實）= +5，反映兩者互補能強化共同決策質量；相同風格 = +2（同樣有基礎共識加分）。整體 communication 上限因子累加 > 20，由 `clamp(s, 0, 20)` 保護。

#### 維度 5 — 關係期望（relationship）滿分 20

關係目標相容矩陣（c 值 0–3）：

| | 認真長期 | 順其自然 | 輕鬆相處 | 開放認識 |
|---|---|---|---|---|
| **認真長期** | 3（14分） | 2（8分） | 0（0分） | 1（2分） |
| **順其自然** | 2（8分） | 3（14分） | 1（2分） | 2（8分） |
| **輕鬆相處** | 0（0分） | 1（2分） | 3（14分） | 2（8分） |
| **開放認識** | 1（2分） | 2（8分） | 2（8分） | 3（14分） |

時間投入差距（`time_commitment`）：

| 差距 | 得分 |
|---|---|
| 相同 | +6 |
| 差 1 級 | +4 |
| 差 2 級 | +2 |
| 差 3 級 | +0 |

#### 維度 6 — 相處安全感（conflictSafety）滿分 20

⚠️ **定義為正向「安全性分數」— 分數越高 = 越安全**。所有維度均「越高越好」，計算邏輯統一。

| 情況 | 得分 |
|---|---|
| 雙方均以冷暴力溝通（強迴避模式衝突）| **2** |
| 任一方直接觸發對方溝通地雷（單方衝突）| **10** |
| 雙方存在 1 項直接觸發衝突 | **4** |
| 無觸發衝突，共同地雷 ≥ 2 個（底線一致）| **20** |
| 無觸發衝突，共同地雷 = 1 個 | **16** |
| 無觸發衝突，無共同地雷 | **14** |

> **設計邏輯**：共同地雷越多 = 價值觀底線越接近 = 安全感越高。這反映「共同厭惡」往往是深層價值觀一致的體現。

---

## 四、加權公式與非線性調整

### 加權計算

$$
\text{weighted} = \sum_{d} \text{dim}[d] \times w[d]
$$

$$
w = \{ \text{attraction}: 0.15,\ \text{emotional}: 0.20,\ \text{lifestyle}: 0.15,\ \text{communication}: 0.15,\ \text{relationship}: 0.20,\ \text{conflictSafety}: 0.15 \}
$$

$$
\text{baseScore} = \left\lfloor \frac{\text{weighted}}{20} \times 100 \right\rceil
$$

### 非線性調整（依序套用）

| 條件 | 調整 | 說明 |
|---|---|---|
| emotional ≥ **14** 且 communication ≥ **14** | **+7**（上限 100） | 情感+溝通雙強加成，反映關係韌性 |
| relationship ≤ 4 | × 0.75 | 關係目標嚴重不合懲罰 |
| conflictSafety ≤ 5 | −7 | 相處安全感極低警告（冷暴力衝突或直接觸發） |
| softPenalty（見下） | −min(penalty, **8**) | 偏好條件不符扣分，上限 **8** |

> **v4 變更：** 雙強 bonus 門檻由 ≥16 → **≥14**（更多 pair 可觸發），bonus 由 +5 → **+7**（獎勵更顯著）；soft penalty 上限由 12 → **8**（物理偏好係 soft preference，不應比關係目標不合更懲罰）。

### 軟性懲罰（softPenalties）

| 條件 | 扣分 |
|---|---|
| 用戶 identity 不在對方 ideal_identity 清單 | +6 |
| 對方 identity 不在用戶 ideal_identity 清單 | +6 |
| 用戶 body_type 不符對方體型偏好 | +4 |
| 對方 body_type 不符用戶體型偏好 | +4 |
| 身高差不符對方 ideal_height_gap（任一方） | +3 each |
| 年齡差不符對方 ideal_age_gap（任一方） | +3 each |

> **上限：** 累計懲罰最多扣 **8 分**（v4，原 12 分）。

---

## 五、分數對應等級

| 分數範圍 | 類型標籤 | 狀態顏色 |
|---|---|---|
| 80–100 | 靈魂伴侶候選 | 🟢 綠 |
| 65–79 | 高度契合 | 🟢 綠 |
| 50–64 | 值得深入了解 | 🟡 琥珀 |
| 35–49 | 有潛力，需磨合 | 🟡 琥珀 |
| 0–34 | 差異較大 | 🔴 紅 |

配對探索預設門檻：**≥ 40 分**（match-explorer 及 export 頁面均以此為預設值）。

---

## 六、配對卡片視覺設計說明

| 元素 | 說明 |
|---|---|
| 背景 | 深紫色 `#0d0b1a` + 雙層 radial-gradient，含星空水印 SVG（新月 / 散點星 / 貓剪影） |
| 雷達圖 | 六邊形，每頂點直接標 `維度名\nXX%`（黃色標籤 + 青色百分比），無底部獨立圖例方塊 |
| 評語區 | 毛玻璃卡片（`backdrop-filter: blur(12px)`），類型徽章顏色跟隨配對等級 |
| 狀態圓點 | `@keyframes pulse-glow` 脈衝效果；PNG 截圖前自動套用 `.no-anim` 凍結動畫 |
| 資訊層次 | 配對姓名 38px 加粗為主角；Email / IG 降至 13px + 低亮度，屬功能性資訊 |
| PNG 下載 | html2canvas CDN，`scale: 2`，`backgroundColor: #0d0b1a` |

