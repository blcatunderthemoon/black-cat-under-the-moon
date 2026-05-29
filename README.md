# 🌙 Black Cat Under The Moon — 靈魂配對系統

> 一個專為女同志社群設計的靈魂配對問卷平台。透過多維度問題探索你的性格、生活方式與愛情觀，再用算法找出最合拍的靈魂伴侶。

---

## 專案結構

本專案分為兩個獨立區域，各自對應不同用途：

```
BlackCatUnderTheMoon/
├── index.html              # 🌐 問卷網站前端（HTML + CSS + Vanilla JS）
├── promo-card.html         # 🌐 宣傳頁面
├── api/
│   └── submit.js           # 🌐 Vercel 函數 — POST /api/submit（問卷提交）
│
├── src/                    # 📊 管理儀表板（Next.js 應用）
│   ├── pages/
│   │   ├── _app.js
│   │   ├── api/
│   │   │   ├── match.js
│   │   │   ├── match_card/
│   │   │   │   ├── template.js     # 配對卡片 HTML 引擎
│   │   │   │   └── notify.js
│   │   │   └── dashboard/          # 儀表板 API 端點
│   │   └── dashboard/              # 儀表板頁面
│   ├── components/
│   │   └── dashboard/              # React 元件
│   ├── styles/
│   │   └── dashboard/              # CSS Modules + globals.css
│   └── lib/                        # 共用函式庫
│       ├── intelligence.js         # 6 維度相容性引擎
│       ├── matching.js             # 配對純函數庫
│       ├── seed-data.js            # 測試用戶生成器
│       └── email-template.js       # 郵件模板產生器
│
├── scripts/                # 🧪 開發 / 測試工具
├── emailautomation/        # 📧 郵件素材（Logo、範本）
├── docs/                   # 📄 技術文件
│   ├── SCORING.md
│   ├── MATCH-CARD-DESIGN.md
│   ├── MIRROR-MODE-SPEC.md
│   └── questionaire.md
├── package.json
└── README.md
```

---

## 快速啟動

| 區域 | 指令 | 說明 |
|---|---|---|
| 🌐 問卷網站 | `npm run website` | 啟動完整 Vercel 本地環境（問卷 + Submit API） |
| 📊 管理儀表板 | `npm run dashboard` | 啟動 Next.js（`localhost:3000/dashboard`） |
| 🧪 測試工具 | 見下方測試指令 | 資料植入、配對測試、卡片生成、匯出 Excel |

---

## 🌐 問卷網站

**對象：** 一般用戶  
**功能：** 填寫靈魂配對問卷，答案提交至 Supabase

```bash
npm run website          # 啟動 Vercel 本地環境
```

> 需先安裝 Vercel CLI：`npm i -g vercel`  
> 啟動後開啟 `index.html` 或 `http://localhost:3000`

**相關檔案：**

```
index.html               # 問卷前端介面（HTML + CSS + Vanilla JS）
api/
└── submit.js            # POST /api/submit — 接收並寫入問卷答案
```

---

## 📊 管理儀表板

**對象：** 內部營運人員  
**功能：** 配對數據總覽、分析、探索、匯出、實驗室

```bash
npm run dashboard        # 啟動 Next.js dev server
```

開啟 `http://localhost:3000/dashboard`

| 頁面 | 路徑 | 說明 |
|---|---|---|
| 總覽 | `/dashboard` | KPI 卡片、身份 / 年齡 / 愛語分佈圖 |
| 配對分析 | `/dashboard/matching-analytics` | 分數分佈、漏斗、熱力圖 |
| 配對探索 | `/dashboard/match-explorer` | 篩選用戶、查看配對詳情、生成 6 維度配對卡片（×2 PNG） |
| 匯出下載 | `/dashboard/export` | 下載 HTML / XLSX / ZIP |
| 實驗室 | `/dashboard/experiment-lab` | 調整計分權重、對比排名變化 |
| 資料管理 | `/dashboard/test-data` | 植入測試資料；顯示 SQL 一鍵複製（貼至 Supabase SQL Editor 清除） |

**相關檔案：**

```
src/
├── pages/
│   ├── _app.js
│   ├── dashboard/
│   │   ├── index.js             # 總覽
│   │   ├── matching-analytics.js
│   │   ├── match-explorer.js
│   │   ├── export.js
│   │   ├── experiment-lab.js
│   │   ├── sent-pairs.js
│   │   ├── email-automation.js  # 郵件管理（發送 / 草稿）
│   │   └── test-data.js         # 植入 / 清除測試資料
│   └── api/
│       ├── match.js             # GET /api/match — 配對核心 API
│       ├── test.js              # GET /api/test — 健康檢查
│       ├── match_card/
│       │   ├── template.js      # 配對卡片 HTML 模板引擎
│       │   └── notify.js
│       └── dashboard/
│           ├── stats.js
│           ├── distributions.js
│           ├── matching-analytics.js
│           ├── match-explorer.js
│           ├── experiment.js
│           ├── export.js
│           ├── seed.js          # 測試資料植入 / 清除
│           ├── send-emails.js   # 發送配對郵件（SMTP）
│           ├── create-gmail-drafts.js  # 存為 Gmail 草稿（IMAP）
│           ├── email-automation.js
│           └── intelligence.js  # POST — 6 維度相容性分析
├── components/
│   └── dashboard/               # Layout、Sidebar、Header、KPICard、MatchDetailPanel 等
├── styles/
│   └── dashboard/               # CSS Modules + 設計 token（globals.css）
└── lib/
    ├── matching.js              # 配對純函數庫（所有 API 共用）
    ├── intelligence.js          # 6 維度相容性引擎（computeCompatibility / interpretScores）
    ├── seed-data.js             # 測試用戶生成器（generateUser）
    └── email-template.js        # 郵件 HTML / 純文字產生器
```

---

## 🧪 測試工具

**對象：** 開發人員  
**功能：** 植入測試資料、執行配對算法、生成卡片、匯出結果

### 植入測試資料

```bash
npm run seed                              # 產生 20 個模擬用戶
npm run seed:clear                        # 清除舊資料後重新產生
node scripts/seed-test-data.mjs --count=30 --clear   # 自訂數量
```

### 執行配對測試

```bash
npm run test:match                        # 對第一個用戶執行配對
npm run test:cards                        # 同上 + 生成 HTML 配對卡片
node scripts/test-matching.mjs --userId=5 --generateCards
```

### 生成配對卡片

```bash
npm run generate:card -- --userA=1 --userB=5    # 指定兩個用戶 ID
```

產生的 HTML 卡片存放於 `match-cards/`，可直接用瀏覽器開啟。

> 儀表板「配對探索」頁面亦可直接點擊配對記錄，透過「🃏 下載配對卡片 (×2 PNG)」按鈕生成兩張 PNG 卡片（A→B 及 B→A），自動呼叫 6 維度智能分析並以六邊形雷達圖呈現。

### 匯出 Excel

```bash
npm run export:excel                      # 匯出所有配對（預設 ≥ 60 分）
node scripts/export-matches.mjs --threshold=50   # 自訂門檻
```

產生的 `.xlsx` 存放於 `match-results/`，每個用戶一個 sheet。

**相關檔案：**

```
scripts/
├── seed-test-data.mjs       # 產生模擬用戶（TB/TBG/Pure/Bi/No Label）
├── test-matching.mjs        # 配對算法測試與分析
├── generate-matches.mjs     # 手動指定兩用戶生成配對卡片
└── export-matches.mjs       # 全體用戶配對結果匯出至 Excel
match-cards/                 # 生成的 HTML 配對卡片
match-results/               # 匯出的 Excel 配對結果
```

---

## 環境設定

```bash
npm install
```

建立 `.env.local`：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
```

> 同樣需在 Vercel 的 Project Settings → Environment Variables 中設定。

---

## 配對系統架構

### Step 0 — Hard Filter（門檻篩選）

在計分前進行 **四層雙向篩選**，任何一層不通過即直接排除：

| 篩選層 | 通過條件 |
|---|---|
| 身份屬性 | 雙方 `identity` 互相在對方 `ideal_identity` 清單內（或填「冇所謂」） |
| 體型 | 雙方 `body_type` 互相在對方 `ideal_appearance` 清單內（或冇填 / 「冇所謂」） |
| 身高差 | 雙向高度差落在對方 `ideal_height_gap [min, max]` 範圍內（或 `null`） |
| 年齡差 | 雙向年齡差落在對方 `ideal_age_gap [min, max]` 範圍內（或 `null`） |

### 智能相容性引擎（`src/lib/intelligence.js`）— 0–100 分制

所有配對分數由 `computeCompatibility(userA, userB)` 計算，輸出 6 維度分數（各 0–20）及加權後的最終分（0–100）。

| 維度（雷達圖標籤） | 計分要素 | 權重 |
|---|---|---|
| 🔥 火花（attraction） | 床上角色互補程度 | 15% |
| 💞 情感共鳴（emotional） | 愛語重疊 + 安全感需求 + 日常儀式 | 20% |
| 📅 生活步調（lifestyle） | 社交能量 + 週末模式 + 興趣 + 旅遊 | 15% |
| 💬 溝通價值（communication） | 溝通風格 + 消費觀 + 同住意願 | 15% |
| 💑 關係期望（relationship） | 關係目標相容矩陣 + 時間投入差距 | 20% |
| ⚠️ 衝突風險（risk） | 地雷行為違規 + 溝通地雷偵測 | 15% |

**非線性調整：**
- 情感 ≥ 16 且溝通 ≥ 16 → +5
- 關係期望 ≤ 4 → × 0.75（目標嚴重不合）
- 風險 ≤ 5 → −7（高衝突警告）
- 軟性偏好懲罰：最多 −12 分

**分數對應等級：**

| 分數 | 類型 |
|---|---|
| 80–100 | 靈魂伴侶候選 🟢 |
| 65–79 | 高度契合 🟢 |
| 50–64 | 值得深入了解 🟡 |
| 35–49 | 有潛力，需磨合 🟡 |
| 0–34 | 差異較大 🔴 |

> 完整計分細節請參閱 [docs/SCORING.md](docs/SCORING.md)