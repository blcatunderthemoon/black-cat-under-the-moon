# 🃏 Match Card 設計文件

> 本文件說明 Black Cat Under The Moon 系統中所有「卡片」的設計、結構與技術細節。

---

## 概覽：系統內有兩種卡片

| 卡片類型 | 檔案 | 用途 | 尺寸 |
|---|---|---|---|
| 🃏 配對卡片 | `pages/api/match_card/template.js` | 呈現兩位用戶的相容性分析，可下載 PNG | 760px 寬 |
| 📢 宣傳卡片 | `promo-card.html` | 社群媒體宣傳素材，含品牌 logo 與社交帳號 | 560px 寬 |

---

## 🃏 配對卡片（Match Card）

### 視覺結構

```
┌─────────────────────────────────────────────┐
│  [Pixel Cat Icon]  Black Cat Under The Moon  │  ← 品牌標頭
│                                             │
│  🌙 每日靈魂配對通知                          │
│  靈貓為你尋找最合拍的靈魂伴侶                  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │  恭喜 [用戶A名稱]  成功配對：             │ │  ← 配對摘要區
│ │  [用戶B名稱]                             │ │
│ │  同步率 XX/100 · [等級標籤]              │ │
│ │  Email / IG 聯絡資訊                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │         配對雷達圖                        │ │  ← SVG 六邊形雷達圖
│ │    [6 維度六邊形 SVG + 頂點百分比標籤]    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │  [● 靈魂伴侶候選]  [動態脈衝光點]         │ │  ← 智能分析摘要框
│ │  隨機文案（依分數段抽取）                  │ │
│ │  🌙 Persona 稱號（紫色膠囊）               │ │
│ │  💚 優勢標籤  💚 優勢標籤                 │ │
│ │  🐾 爪印提醒  🐾 爪印提醒                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  Contact: blcatunderthemoon@gmail.com        │  ← 頁尾
└─────────────────────────────────────────────┘
```

### 六邊形雷達圖設計

| 維度 | 索引 | 顏色（填充） |
|---|---|---|
| 🔥 火花（attraction） | 0（頂部） | 青色填充 `#8ffff3` |
| 💞 情感共鳴（emotional） | 1（右上） | 同上 |
| 📅 生活步調（lifestyle） | 2（右下） | 同上 |
| 💬 溝通價值（communication） | 3（底部） | 同上 |
| 💑 關係期望（relationship） | 4（左下） | 同上 |
| 🛡 相處安全感（conflictSafety） | 5（左上） | 同上 |

- **SVG viewBox：** `0 0 520 490`，圓心 `(260, 230)`，半徑 `145`
- **格線：** 3 層同心六邊形（100% / 66% / 33%），顏色 `#5a547f`
- **數值多邊形（雙層）：**
  - 底層（Halo）：`fill rgba(0,229,255,0.18)`，`stroke #00e5ff`，`stroke-width 9`，套用 SVG `feGaussianBlur` glow filter（`stdDeviation="7"`），`opacity 0.65`
  - 頂層（清晰）：`fill rgba(0,229,255,0.30)`，`stroke #00e5ff`，`stroke-width 2.5`
- **頂點標籤：** 中文維度名（黃色 `#ffe066`）+ 百分比（青色 `#00e5ff`），字型 Noto Sans TC
- **數值正規化：** 每個維度原始分 0–20，轉換為 0–100% 顯示

### 配對同步率等級標籤

| 平均雷達值 | 標籤 |
|---|---|
| ≥ 80% | 超高同步 |
| ≥ 65% | 高同步 |
| ≥ 45% | 可發展 |
| < 45% | 待觀察 |

> 注意：此標籤基於 **6 維度百分比平均值**，與最終配對分數（0–100）略有差異。

### 智能分析摘要框（intel-box）

由 `lib/intelligence.js` 的 `buildSummary()` 產生，包含：

- **配對類型標籤**（帶動態脈衝光點）：
  - 🟢 靈魂伴侶候選 / 高度契合 → 綠色 `#34d399`
  - 🟡 值得深入了解 / 有潛力，需磨合 → 黃色 `#fbbf24`
  - 🔴 差異較大 → 紅色 `#f87171`
- **描述文字：** 依分數段從多組模板隨機抽取（每次 request 不同），共 15 條（≥80：4條、≥65：3條、≥50：3條、≥35：3條、<35：2條）
- **關係風格標籤 Persona（🌙）：** 依前兩名維度組合給予稱號，紫色膠囊 `#d8b4fe`
- **優勢標籤（💚）：** 分數最高的前 2 個維度（需 ≥ 12/20 才顯示），綠色膠囊
- **🐾 爪印提醒：** 最多顯示 2 條，紅色膠囊，語氣為建議式而非警告式

#### 配對類型標籤對照

| 最終分數 | 標籤 | 光點顏色 |
|---|---|---|
| ≥ 80 | 靈魂伴侶候選 | 綠色 `#34d399` |
| ≥ 65 | 高度契合 | 綠色 `#34d399` |
| ≥ 50 | 值得深入了解 | 黃色 `#fbbf24` |
| ≥ 35 | 有潛力，需磨合 | 黃色 `#fbbf24` |
| < 35 | 差異較大 | 紅色 `#f87171` |

#### 行動建議文字對照

| 分數條件 | 行動建議 |
|---|---|
| ≥ 65 | 建議積極推進見面 |
| ≥ 45 | 可先嘗試線上交流了解 |
| < 45 | 需要更多了解彼此再決定 |

#### 風險標籤觸發機制（`buildSummary` 內）

> 標籤已從「⚠️ 風險」更名為「🐾 爪印提醒」，語氣改為建議式。

| 觸發條件 | 爪印提醒文字 |
|---|---|
| `conflictSafety ≤ 5` | 在衝突處理上你們的模式較為不同，初期多「說出來」比沉默更有效 |
| `relationship ≤ 8` | 你們對未來的節奏略有不同，初期建議多交流彼此對穩定的看法 |
| `communication ≤ 8` | 溝通節奏稍有不同，找到專屬你們的相處默契需要一點時間 |
| `emotional ≤ 8` | 表達愛的方式各有不同，試著主動說出你的需求，對方更容易接住 |
| `penalty ≥ 10`（soft penalty） | 外在條件有小差異，但這恰恰是讓兩人互相探索的有趣起點 |
| 以上全部不觸發 | 基礎已很穩固！主要的考驗將是如何在日常生活中持續滋養這段緣分 |

> `relationship` 分數由 `scoreRelationship()` 計算（滿分 20）：
> - **關係目標相容矩陣**（`relationship_goal` 欄位）：完全一致 → 14 分，近似 → 8 分，兼容 → 2 分，衝突 → 0 分
> - **相見頻率差**（`time_commitment` 欄位）：差 0 → +6，差 1 → +4，差 2 → +2，差 ≥3 → 0
>
> 當關係目標衝突（0 分）且相見頻率有差距，`relationship` 原始分會 ≤ 8，觸發爪印提醒。

#### Persona 稱號對照（`buildSummary` 內）

依 **前兩名維度**組合給予稱號，顯示於 intel-box 紫色膠囊，供截圖分享。

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
| 其他組合（fallback） | 🌙✨ 靈魂共鳴者 |

### 個性化像素貓咪頭像（`buildPixelCat`）

品牌標頭、用戶姓名行、對象姓名行各顯示一隻像素貓（尺寸分別為 52px / 28px / 46px），根據用戶的 `identity` 欄位顯示不同配件：

| 身份標籤 | 配件 | 配色 |
|---|---|---|
| TB | 平扁帽（Cap）橫條壓耳 | 灰藍 `#99aacc / #6677aa` |
| TBG | 胸前領結（Bow Tie） | 粉 `#ff6b9d`，中心深桃 `#cc2255` |
| Pure | 花冠（三朵小花） | 黃 `#ffe066` + 粉 `#ff79c6` |
| Bi | 三色小皇冠（粉 / 紫 / 靛） | `#ff6b9d` + `#b44fff` + `#6366f1` |
| No Label | 四角散落星點 | 黃 `#ffe066` + 青 `#00e5ff` + 粉 `#ff79c6` |
| 其他（fallback） | 原版貓咪，無配件 | — |

函式定義於 `buildPixelCat(identity, width, height)` — 返回 SVG 字串，所有貓咪共用相同基底像素身形（`viewBox 0 0 32 32`，`shape-rendering: crispEdges`）。

### 背景視覺效果

| 效果 | 實現方式 |
|---|---|
| 星空動畫 | Canvas `#card-stars`，80 顆星粒子向下飄落，閃爍效果 |
| 月牙 | SVG `<path>`，右上角，`rgba(255,224,102,0.05)` |
| 4 角星 | SVG `<path>` 手工排列，`rgba(255,255,255,0.12)` |
| 貓咪剪影 | SVG `<g>` 左下角，`rgba(200,190,255,0.04)` |
| 漸層背景 | CSS 雙 `radial-gradient` + 深色底 `#0d0b1a` |

### PNG 下載流程（html2canvas）

```
用戶點擊「下載配對卡片 (PNG)」
  ↓
凍結動畫（body.classList.add('no-anim')）
  ↓
暫停 Canvas 星空動畫（_cardStarsPause(true)）
  ↓
html2canvas({ scale: 2, backgroundColor: '#0d0b1a' })
  ↓
canvas.toDataURL('image/png')
  ↓
自動下載（檔名：match_[用戶A]_x_[用戶B].png）
  ↓
恢復動畫
```

---

## 配對卡片觸發方式

### 1. 儀表板「配對瀏覽器」頁面

**路徑：** `pages/dashboard/match-explorer.js` → `components/dashboard/MatchDetailPanel.js`

點擊配對記錄後，右側出現 MatchDetailPanel，含「🃏 下載配對卡片 (×2 PNG)」按鈕：

```
點擊下載按鈕
  ↓
呼叫 GET /api/match_card/template?userAId=X&userBId=Y  （A→B 卡片）
  ↓
取得 HTML 字串
  ↓
在 iframe 中渲染（width: 840px）
  ↓
等待字體載入（700ms delay）
  ↓
html2canvas 截圖（scale: 2）
  ↓
下載 PNG（A視角）
  ↓
重複以上流程生成 B→A 卡片
```

MatchDetailPanel 內同時顯示：
- Recharts `RadarChart`（6 維度，多邊形填充 `rgba(124,92,252,0.3)`）
- 維度分數進度條
- 優勢 / 風險文字

### 2. 命令列腳本

```bash
npm run generate:card -- --userA=1 --userB=5
# 或
node scripts/generate-matches.mjs --userA=1 --userB=5
```

生成的 HTML 卡片儲存於 `match-cards/` 目錄，可直接用瀏覽器開啟並下載 PNG。

---

## 📢 宣傳卡片（Promo Card）

**檔案：** `promo-card.html`（獨立 HTML，無需 Next.js）

### 視覺結構

```
┌──────────────────────────────────────────────┐
│  [Canvas: 像素貓動畫（閃眼 3.5s 週期）]        │
│                                              │
│  [Canvas: 像素點陣品牌名 "BLACK CAT           │
│           UNDER THE MOON"（黃色）]            │
│                                              │
│  🌙 靈魂配對系統                              │  ← tagline（紫色）
│  ─────────────────────────────              │  ← 漸層分隔線
│                                              │
│  [IG 圖示]  Instagram  @blackcatunderthemoonhk│
│  [Threads 圖示]  Threads  @blackcatunderthemoonhk │
│                                              │
│  🌐 black-cat-under-the-moon.vercel.app       │
│                                              │
│  ● 立即填寫問卷，找到你的靈魂伴侶              │  ← 動態光點 + 粉色文字
└──────────────────────────────────────────────┘
```

### 像素貓動畫（Canvas）

- **畫布：** 240×112，每格 8px（邏輯上 30×14 格）
- **色彩：** 貓身 `#2a2640`、眼睛 `#50fa7b`、鼻子 `#ff79c6`、月亮 `#ffe066`、星點 `#ffffff`（動態閃爍）
- **閃眼：** 每 3.5s 閉眼 180ms，`requestAnimationFrame` 循環重繪

### 像素品牌名（Canvas）

- **畫布：** 584×112，`pixel = 4`（每點 4px）
- **字型：** 自訂點陣字母表（A/B/C/D/E/H/K/L/M/N/O/R/T/U），7 行高
- **渲染：** 兩行置中：`BLACK CAT`（y=20）/ `UNDER THE MOON`（y=60），填色 `#ffe066`

### PNG 下載流程（html-to-image）

> 宣傳卡片使用 **html-to-image**（非 html2canvas），更好地處理 Canvas 轉換。

```
用戶點擊「下載宣傳卡片 (PNG)」
  ↓
凍結動畫 + 暫停星空
  ↓
將卡片內所有 <canvas> 替換為 <img>（toDataURL 快照）
  ↓
等待字體載入 + 取得 fontEmbedCSS（避免字體走樣）
  ↓
htmlToImage.toPng({ pixelRatio: 2, backgroundColor: '#12111d' })
  ↓
下載（檔名：blackcat_promo_card.png）
  ↓
還原所有 <img> 回 <canvas>，恢復動畫
```

---

## 通知 API（Notify）

**檔案：** `pages/api/match_card/notify.js`

```
POST /api/match_card/notify
Body: { userAId, userBId, match_score }
```

- 從 Supabase 撈取兩位用戶資料
- 生成 HTML 郵件（黑底深色設計，配色與卡片一致）
- 同時寄出兩封（A 告知 B 資訊、B 告知 A 資訊）
- 透過 `MATCH_NOTIFICATION_WEBHOOK` 環境變數投遞（需自行接入 email 服務）
- 若未設定 webhook，回傳 `{ delivered: false, reason: 'MATCH_NOTIFICATION_WEBHOOK not configured' }`

---

## 設計 Token（Design Tokens）

以下 CSS 變數為兩種卡片共用的視覺語言：

```css
--bg:     #07060e   /* 最深底色 */
--panel:  #12111d   /* 卡片底色 */
--line:   #2a2650   /* 邊框 / 格線 */
--cyan:   #00e5ff   /* 主要強調色（雷達圖、邊框） */
--pink:   #ff6b9d   /* 副強調色（分數標籤） */
--yellow: #ffe066   /* 品牌色（標題、月亮） */
--purple: #b48fff   /* tagline 色 */
--text:   #f0ebd8   /* 主文字色（米白） */
--dim:    #a09c8c   /* 次要文字色 */
```

**字型：**
- `'Press Start 2P'` — 像素英文（品牌標頭、部分標籤）
- `'Noto Sans TC'` — 中文主體文字

---

## 相關檔案索引

```
pages/
└── api/
    └── match_card/
        ├── template.js     # 配對卡片 HTML 模板引擎（API endpoint）
        └── notify.js       # 配對通知 webhook 投遞

components/
└── dashboard/
    └── MatchDetailPanel.js # 儀表板內的配對詳情面板 + 下載觸發器

promo-card.html             # 獨立宣傳卡片（無需 Next.js）

scripts/
└── generate-matches.mjs    # 命令列配對卡片生成腳本

match-cards/                # 命令列生成的 HTML 卡片輸出目錄
```
