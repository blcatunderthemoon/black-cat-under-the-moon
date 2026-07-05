# 🌙 月光旅程（Moon Journey）

> 最後更新：2026-07-05｜實作版本：v1｜核心程式：`src/lib/moon-journey.js`

---

## 一、系統概述

**月光旅程**是論壇內的累積經驗值（EXP）與等級系統。用戶透過發帖、留言、互動與每日打卡獲得 EXP，累積至指定門檻後自動升級，並獲得對應稱號。

### 設計目標

- 鼓勵有意義的論壇參與（發文、留言、被認可）
- 以 ledger（事件帳本）防重複發放 EXP
- 每日上限與自我互動排除，減少刷分

### 用戶可見位置（v1）

| 位置 | 說明 |
|------|------|
| 論壇側欄 `MoonJourneyPanel` | 等級、EXP 進度條、每日打卡按鈕 |
| 帳戶頁 `MoonJourneyAccountCard` | 自己的旅程摘要、進度條、**內嵌每日打卡** |

**v1 不顯示於**：作者名稱旁、Mirror Card、公開個人檔案連結等。

---

## 二、等級一覽

等級由**累積 EXP**決定，共 **7 級**。當 `moon_journey_exp >= 該級下限` 時即為該等級；達到 Lv7 後不再升級。

| 等級 | 圖示 | 中文稱號 | 英文稱號 | 累積 EXP 下限 | 升至下一級所需累積 EXP | 本級 EXP 跨度 |
|:----:|:----:|----------|----------|:-------------:|:----------------------:|:-------------:|
| **Lv1** | 🌑 | 月下幼貓 | Moon Kitten | **0** | 40 | 40 |
| **Lv2** | 🌒 | 夜行者 | Night Wanderer | **40** | 120 | 80 |
| **Lv3** | 🌓 | 月光傾聽者 | Moon Listener | **120** | 250 | 130 |
| **Lv4** | 🌔 | 月光同行者 | Moon Companion | **250** | 450 | 200 |
| **Lv5** | 🌕 | 月光守護者 | Moon Guardian | **450** | 700 | 250 |
| **Lv6** | 🌟 | 星光守護者 | Star Keeper | **700** | 1,000 | 300 |
| **Lv7** | 🌌 | 月夜賢者 | Moon Sage | **1,000** | —（滿級） | — |

### 升級規則說明

1. **累積制**：EXP 只增不減；等級只看 `moon_journey_exp` 總和。
2. **自動升級**：每次成功發放 EXP 後，系統以 `getLevelFromExp()` 重算等級並寫入 `profiles.moon_journey_level`。
3. **門檻範例**：
   - 新用戶 0 EXP → Lv1；再獲 40 EXP（總計 40）→ Lv2。
   - 目前 115 EXP（Lv3）→ 距 Lv4 尚差 **135 EXP**（250 − 115）。
   - 達 **1,000 EXP** → Lv7，`exp_to_next = 0`，進度條顯示 100%。
4. **進度條**：在當前等級區間內計算百分比  
   `(目前 EXP − 本級下限) ÷ (下一級下限 − 本級下限) × 100%`。

程式常數定義：

```js
// src/lib/moon-journey.js — MOON_JOURNEY_LEVELS
{ level: 1, minExp: 0,    emoji: '🌑', titleZh: '月下幼貓',   titleEn: 'Moon Kitten' },
{ level: 2, minExp: 40,   emoji: '🌒', titleZh: '夜行者',     titleEn: 'Night Wanderer' },
{ level: 3, minExp: 120,  emoji: '🌓', titleZh: '月光傾聽者', titleEn: 'Moon Listener' },
{ level: 4, minExp: 250,  emoji: '🌔', titleZh: '月光同行者', titleEn: 'Moon Companion' },
{ level: 5, minExp: 450,  emoji: '🌕', titleZh: '月光守護者', titleEn: 'Moon Guardian' },
{ level: 6, minExp: 700,  emoji: '🌟', titleZh: '星光守護者', titleEn: 'Star Keeper' },
{ level: 7, minExp: 1000, emoji: '🌌', titleZh: '月夜賢者',   titleEn: 'Moon Sage' },
```

### 理論最快升級路徑（參考）

僅供產品／營運理解，非承諾：

| 目標 | 約略最低互動量（理想情況） |
|------|---------------------------|
| Lv2（40 EXP） | 例如：打卡 2 + 發帖 2（2×2 + 2×15 = 34）再補少量留言 |
| Lv7（1,000 EXP） | 需長期穩定參與；單靠每日打卡（+2/日）約 500 日，實際應混合發帖、留言與被互動 |

---

## 三、EXP 獲取方式

| 行為 | `action_type` | EXP | 觸發時機 | 備註 |
|------|---------------|-----|----------|------|
| 發帖 | `post_created` | **+15** | `POST /api/forum/posts` 成功建立帖文後 | 受**每日發文額度**限制（見下） |
| 留言 | `comment_created` | **+5** | `POST /api/forum/posts/[id]/comments` 成功後 | 每日最多 **10 次**；**自己帖下留言不計** |
| 留言被 Like | `comment_liked` | **+3** | 他人對該留言首次按 Like | 每位按讚者對該留言只計一次 |
| 帖文被收藏 | `post_bookmarked` | **+10** | 他人首次收藏該帖 | 每位收藏者對該帖只計一次；**自己收藏自己帖不計** |
| 每日打卡 | `daily_checkin` | **+2** | 論壇側欄按「今日打卡」`POST /api/forum/moon-journey/check-in` | 每**香港日曆日**一次 |

常數：

```js
// src/lib/moon-journey.js — MOON_JOURNEY_EXP
post_created: 15,
comment_created: 5,
comment_liked: 3,
post_bookmarked: 10,
daily_checkin: 2,
```

### 發帖與論壇額度

發帖 EXP 綁定在**成功發文**之後。發文本身受 `forum_post_daily` 額度約束（`src/lib/permissions.js`）：

| 會員類型 | 每日可發帖數 |
|----------|:------------:|
| 免費 | **3** |
| Premium（月光護照） | **不限** |

因此免費用戶每日最多透過發帖獲得 **45 EXP**（3 × 15）；Premium 發文不限，EXP 仍按實際成功發帖計算（每篇 +15）。

### 留言每日上限

- `MOON_JOURNEY_COMMENT_DAILY_LIMIT = 10`
- 以**香港時區**（`Asia/Hong_Kong`）的當日日期計數，存於 `moon_journey_daily_counts.comment_exp_count`
- 第 11 則起當日留言仍可發布，但**不再獲得留言 EXP**

### 防重複（Ledger）

每筆 EXP 寫入 `moon_journey_events`，並以 `(user_id, action_type, source_id)` **UNIQUE** 保證冪等：

| 行為 | `source_id` 格式 |
|------|------------------|
| 發帖 | `post.id` |
| 留言 | `comment.id` |
| 留言被 Like | `{commentId}:{likerUserId}` |
| 帖文被收藏 | `{postId}:{bookmarkerUserId}` |
| 打卡 | 當日 HK 日期字串（`YYYY-MM-DD`） |

重複 insert 回傳 `duplicate`，不加分。

---

## 四、每日打卡與連續打卡獎勵機制

### 打卡規則

- 時區：**香港**（`getHongKongDateString()`）
- 每帳號每自然日僅可打卡一次
- 成功打卡固定 **+2 EXP**，並更新：
  - `moon_last_checkin_date`
  - `moon_checkin_streak`（連續打卡天數）
- 手機版：於論壇頂部「🌙 月光旅程」展開後打卡；每日首次進入論壇且未打卡時會有數秒提示

### 連續打卡獎勵機制

| 項目 | 說明 |
|------|------|
| **每日打卡獎勵** | 每個香港日曆日可打卡一次，固定獲得 **+2 EXP** |
| **連續天數怎樣計** | 若昨日（HK）已打卡，今日打卡後連續天數 +1；若中斷一日，下次打卡從 **1** 重新計算 |
| **在哪裡看到** | 論壇月光旅程面板、帳戶頁顯示「🔥 連續打卡 N 天」 |
| **與 EXP 的關係** | 每次打卡 EXP **固定 +2**；連續天數為參與紀錄與成就展示，**不會**令單次打卡額外加倍 |

程式常數（與玩法頁同步）：

```js
// src/lib/moon-journey.js — MOON_JOURNEY_CHECKIN_STREAK_RULES
```

### 連續天數（Streak）計算邏輯

| 情況 | 新 streak |
|------|-----------|
| 上次打卡日 = 昨日（HK） | 舊 streak + 1 |
| 否則（含首次、中斷後再打卡） | 重設為 **1** |

中斷後再打卡**不會**補發漏掉日子的 EXP；僅從當日打卡起重新累積連續天數。

### API

```
GET  /api/forum/moon-journey          # 需登入，回傳 moon_journey 摘要
POST /api/forum/moon-journey/check-in # 需登入，執行打卡
```

`GET /api/me` 亦回傳 `moon_journey` 欄位（帳戶頁使用）。

---

## 五、資料庫結構

Migration：`supabase/migrations/20250705000000_moon_journey.sql`

### `profiles` 新增欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `moon_journey_exp` | INTEGER | 累積 EXP，預設 0 |
| `moon_journey_level` | INTEGER | 快取等級 1–7，與 EXP 同步更新 |
| `moon_checkin_streak` | INTEGER | 連續打卡天數 |
| `moon_last_checkin_date` | DATE | 最後打卡日（HK 日曆） |

### `moon_journey_events`（EXP 帳本）

| 欄位 | 說明 |
|------|------|
| `user_id` | 獲得 EXP 的用戶 |
| `action_type` | 見上表 |
| `source_id` | 冪等鍵 |
| `exp_amount` | 該次獲得 EXP |
| `created_at` | 記錄時間 |

RLS：用戶僅可 `SELECT` 自己的 events。

### `moon_journey_daily_counts`（留言 EXP 日計數）

| 欄位 | 說明 |
|------|------|
| `user_id` + `action_date` | 複合主鍵 |
| `comment_exp_count` | 當日已發放留言 EXP 次數 |

RLS：用戶僅可 `SELECT` 自己的紀錄。

---

## 六、程式架構

```
src/lib/moon-journey.js
├── MOON_JOURNEY_EXP / MOON_JOURNEY_LEVELS     # 常數
├── getLevelFromExp(exp)                       # 等級、進度、距下一級 EXP
├── buildMoonJourneySummary(profileRow)        # API／UI 用摘要
├── awardMoonJourneyExp(admin, opts)           # 發放 EXP（冪等）
├── performDailyCheckIn(admin, userId)         # 打卡流程
└── getMoonJourneyForUser(admin, userId)

觸發點（awardMoonJourneyExp）：
├── src/pages/api/forum/posts.js                    # post_created
├── src/pages/api/forum/posts/[id]/comments.js      # comment_created
├── src/pages/api/forum/comments/[id].js            # comment_liked
├── src/pages/api/forum/posts/[id].js                 # post_bookmarked（insert）
└── performDailyCheckIn → daily_checkin

UI：
├── src/components/MoonJourneyPanel.js
├── src/components/ForumMoonJourneyMobile.js  # 手機 toggle + 每日提示
├── src/components/MoonJourneyGuide.js        # /moon-journey 玩法頁
├── src/pages/forum/index.js
├── src/pages/moon-journey.js
└── src/pages/account.js              # MoonJourneyAccountCard
```

`awardMoonJourneyExp` 失敗時 API 多以 `.catch(() => {})` 靜默處理，**不影響**發帖／留言等主要功能成功回應。

---

## 七、API 回傳摘要欄位

`buildMoonJourneySummary()` / `GET /api/forum/moon-journey` 典型回傳：

| 欄位 | 說明 |
|------|------|
| `level` | 目前等級 1–7 |
| `emoji` | 等級圖示 |
| `title_zh` / `title_en` | 稱號 |
| `exp` | 累積 EXP |
| `exp_to_next` | 距下一級尚差 EXP（滿級為 0） |
| `next_level` | 下一級數字（滿級為 `null`） |
| `next_title_zh` / `next_title_en` | 下一級稱號 |
| `progress_pct` | 本級進度 0–100 |
| `is_max_level` | 是否 Lv7 |
| `checkin_streak` | 連續打卡天數 |
| `checked_in_today` | 今日（HK）是否已打卡 |
| `last_checkin_date` | 最後打卡日期 |

打卡 `POST` 另可能包含：`awarded`、`already_checked_in`、`exp_gained`、`leveled_up` 等。

---

## 八、營運與產品備註

### v1 刻意不做的事

- streak 無倍率加成（連續天數不影響單次打卡 EXP）
- 不在公開場合展示他人等級（僅自己可見面板）
- 無排行榜、無兌換獎勵（可於後續版本擴充）

### 管理後台（可選，本地 dashboard）

若已部署內部 dashboard，可查 `src/pages/dashboard/moon-journey.js` 檢視用戶 EXP／等級匯總（此路徑可能僅本地／gitignore）。

### 調整等級表或 EXP 時

1. 修改 `src/lib/moon-journey.js` 常數
2. 既有用戶等級會在**下次獲得 EXP 時**依新表重算；或執行一次性 migration 批次更新 `moon_journey_level`
3. 更新本文件「最後更新」日期

---

## 九、常見問題

**Q：為何發了帖卻沒有 +15 EXP？**  
A：檢查是否當日發文額度已滿導致發文失敗；或該 `post.id` 已在 ledger 存在（極少見的重試情況）。

**Q：在自己帖下留言有 EXP 嗎？**  
A：沒有。程式明確排除 `user.id === post.author_id`。

**Q：取消收藏會扣 EXP 嗎？**  
A：v1 不扣；ledger 僅在**首次收藏 insert** 時發放。

**Q：取消 Like 會收回留言者的 +3 嗎？**  
A：v1 不收回；EXP 在**首次 Like insert** 時發放。

**Q：時區為何用香港？**  
A：與站內其他「每日」邏輯一致，打卡日與留言計數皆以 `Asia/Hong_Kong` 切日。

**Q：連續打卡會令每日 EXP 變多嗎？**  
A：不會。每次打卡固定 +2 EXP；連續天數只作紀錄與展示。漏掉一日後再打卡，連續天數會從 1 重計，亦不會補發漏掉日子的 EXP。

---

## 十、相關文件

- [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) — 全站功能總覽  
- [PRODUCT-COMMERCIALIZATION-PRD.md](./PRODUCT-COMMERCIALIZATION-PRD.md) — Premium 與額度產品說明  
- Migration 清單：[IMPLEMENTATION-SQL-MIGRATIONS.md](./IMPLEMENTATION-SQL-MIGRATIONS.md)
