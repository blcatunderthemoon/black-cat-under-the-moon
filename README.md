# 🌙 Black Cat Under The Moon — 月下靈魂社群

> 專為女同志社群設計的靈魂配對與社群平台。

**Live：** [www.blackcatunderthemoon.com](https://www.blackcatunderthemoon.com)  
參與本平台即表示同意[使用條款](/tos.html)與[私隱政策](/privacy.html)。

本 README 以**開發者入門**為主。產品規格見 [docs/PRODUCT-COMMERCIALIZATION-PRD.md](docs/PRODUCT-COMMERCIALIZATION-PRD.md)；漂流瓶／安全機制見 [docs/SYSTEM-OVERVIEW.md](docs/SYSTEM-OVERVIEW.md)；登入密碼鎖定見 [docs/AUTH-LOGIN-LOCKOUT.md](docs/AUTH-LOGIN-LOCKOUT.md)；配對計分見 [docs/SCORING.md](docs/SCORING.md)；**Mobile WebView 捲動與頁尾**見 [docs/MOBILE-WEBVIEW-SCROLL.md](docs/MOBILE-WEBVIEW-SCROLL.md)。

---

## 目錄

- [功能總覽](#功能總覽)
- [系統架構](#系統架構)
- [技術棧](#技術棧)
- [專案結構](#專案結構)
- [首次設定](#首次設定)
- [快速啟動](#快速啟動)
- [頁面一覽](#頁面一覽)
- [API 模組](#api-模組)
- [環境變數](#環境變數)
- [配額一覽](#配額一覽)
- [配對系統](#配對系統)
- [資料庫遷移](#資料庫遷移)
- [開發工具](#開發工具)
- [疑難排解](#疑難排解)
- [法律與聯絡](#法律與聯絡)

---

## 功能總覽

| 模組 | 說明 | 入口 |
|---|---|---|
| 💫 **Echo Mode** | 多維度靈魂配對問卷，六維度相容性評分；配對成功後**雙方**收 Email，已註冊用戶另收 Inbox 連線卡（對方未註冊亦可單邊投送） | `/echo.html` |
| 🪞 **Mirror Mode** | v3 Trait 計分 + 模組化敘事（Insight／三段式炸毛／被誤解／月光提醒）；四大貓家族、12 種混血標題、可分享 Mirror Card | `/mirror.html` |
| 🐾 **四大貓家族** | Mirror 測驗家族介紹 | `/cat-families` |
| 🌊 **月光漂流瓶** | 完全匿名：投瓶、撈瓶、回聲、愛心、神秘鑰匙 | `/drift-bottle.html` |
| 🔥 **黑貓樹洞** | 論壇：分類、留言、愛心、書籤、同族排序、舉報 | `/forum` |
| ✉️ **Inbox** | 配對通知、主動投信（信紙／郵票玩法）、交換相邀請、頻道狀態敘事 | `/inbox` |
| 📷 **交換相** | Moonlight Passport 真人相片交換邀請，成功後 7 日可見 | `/exchange-photo`、`/mirror-card/[slug]` |
| 👤 **帳戶** | 顯示名稱、密碼、通知偏好、訂閱、Mirror Card、交換相相片 | `/account` |
| 🌙 **Moonlight Passport** | PayPal 或 PayMe／FPS 人手付款；PayMe QR 於付款步驟 popup 顯示 | `/premium` |
| 💌 **聯絡我們** | 意見箱寫入資料庫（非 mailto）、社群連結 | `contact.html` |
| 📋 **法律頁** | 條款、私隱、退款、關於 | `/tos.html` 等 |

**Moonlight Passport 權益：** 詳細 Mirror Card、每月 **3** 封主動投信、每月 3 次交換相邀請、**連線即時通知**（Inbox 高亮 + Email，配對通知無上限）、論壇發文不限（免費每日 3 篇）；Free 用戶每月配對通知 **3 次**。

**帳號：** Supabase Auth、Legacy Match Claim（Email 認領舊問卷）、Mirror Card 三級可見度（`public` → `basic` → `detailed`）；論壇顯示名稱即時同步與唯一性檢查。

**管理儀表板（`/dashboard`，gitignore）：**

- **郵件自動化** — 全域配對、Free「本月 n/3」／Passport「🌙 無限制」、Moonlight Passport 分頁與**即時發送（Email + Inbox）**
- **Moonlight Passport 管理** — 人手授予／撤銷（PayMe／FPS 核對）
- 月光旅程監控、論壇／Inbox 監控、配對分析等

**內容安全：** 關鍵字過濾、3 次舉報自動隱藏、Turnstile（漂流瓶）、Upstash 速率限制。

**登入安全：** 15 分鐘內連續輸錯密碼 **10** 次會暫時凍結該 Email **30** 分鐘（`POST /api/auth/login` + Redis）；詳見 [docs/AUTH-LOGIN-LOCKOUT.md](docs/AUTH-LOGIN-LOCKOUT.md)。

---

## 系統架構

```mermaid
flowchart LR
  subgraph static [public 靜態頁]
    IDX[index.html]
    ECHO[echo.html]
    MIRROR[mirror.html]
    BOTTLE[drift-bottle.html]
  end

  subgraph next [Next.js 頁面]
    FORUM[/forum]
    INBOX[/inbox]
    MCARD[/mirror-card]
    ACCOUNT[/account]
  end

  subgraph api [API Routes]
    SUBMIT[/api/submit]
    BAPI[/api/bottle/*]
    FAPI[/api/forum/*]
    IAPI[/api/inbox/*]
    PAPI[/api/photo-exchange/*]
    CAPI[/api/contact-feedback]
  end

  DB[(Supabase)]

  IDX --> ECHO & MIRROR & BOTTLE
  ECHO & MIRROR --> SUBMIT --> DB
  BOTTLE --> BAPI --> DB
  FORUM & INBOX & MCARD --> FAPI & IAPI --> DB
  ACCOUNT --> DB
```

靜態問卷／漂流瓶用 Vanilla JS；論壇、Inbox、帳戶等用 React（`src/pages/`）。兩者共用 `src/pages/api/` 後端。

---

## 技術棧

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 15（Pages Router）+ React 18 |
| 靜態前端 | `public/` HTML + Vanilla JS |
| 樣式 | `pixel-theme.css`、`auth-nav.css`、`questionnaire.css`、Zpix 字體 |
| 資料庫／Auth | Supabase（PostgreSQL + Auth） |
| 付款 | PayPal Subscriptions／Webhook；PayMe／FPS 人手核對 |
| 速率限制 | Upstash Redis |
| 郵件 | Gmail SMTP（`nodemailer`） |
| 分析 | PostHog（全站 pageview、登入識別、Mirror/Echo/漂流瓶事件；session recording 遮罩輸入） |
| 部署 | Vercel |

---

## 專案結構

```
BlackCatUnderTheMoon/
├── public/                 # 靜態頁（index、match、mirror、漂流瓶、法律頁）
├── src/
│   ├── pages/              # Next.js 頁面 + api/
│   ├── components/
│   ├── lib/                # intelligence、matching、mirror-scoring-v3、mirror-narratives、match-notify-send…
│   ├── styles/
│   └── middleware.js       # 保護 /api/dashboard/*（x-dashboard-key）
├── src/pages/dashboard/    # 管理儀表板 UI（gitignore，本地開發用）
├── src/pages/api/dashboard/ # 管理員 API（gitignore）
├── supabase/migrations/
├── scripts/                # seed、配對測試、匯出、create-admin-user
├── docs/                   # 深度技術文件
├── .env.example
└── package.json
```

---

## 首次設定

開始寫 code 前，建議依序完成：

1. **環境：** Node.js **18+**、npm
2. **Supabase：** 建立 project → Authentication 開啟 Email provider → 在 SQL Editor **依序執行** `supabase/migrations/*.sql` → **URL Configuration** 設 `Site URL` 為正式網域（如 `https://www.blackcatunderthemoon.com`），並在 **Redirect URLs** 加入：
   - `https://www.blackcatunderthemoon.com/auth/confirm`
   - `https://www.blackcatunderthemoon.com/auth/reset-password`
   - `http://localhost:3000/auth/confirm`（本地開發）
   - 換 domain 後若驗證信／重設密碼信收不到或連結失效，多數是此處未更新
3. **環境變數：** 複製 `.env.example` → `.env.local`，至少填入：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（伺服器 API 必需）
4. **啟動：** `npm run dev`
5. **驗證：**
   - 首頁 → `http://localhost:3000/index.html`
   - 註冊登入 → `/signup`、`/forum`
   - 問卷提交 → `/mirror.html`（需 Supabase 寫入權限）

選填：PayPal（見 [docs/paypal-onboarding.md](docs/paypal-onboarding.md)）、Upstash、Turnstile、Gmail。

> **安全：** 切勿將 `SUPABASE_SERVICE_ROLE_KEY`、`PAYPAL_CLIENT_SECRET`、`DASHBOARD_SECRET` 提交至 git。

---

## 快速啟動

```bash
npm install
cp .env.example .env.local    # macOS / Linux / Git Bash
npm run dev
```

**Windows（PowerShell）：**

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

| 指令 | 說明 |
|---|---|
| `npm run dev` | 本地開發（推薦，`localhost:3000`） |
| `npm run build` / `npm start` | 正式建置與啟動 |
| `npm run website` | `vercel dev`（模擬 Vercel 路由／環境） |
| `npm run seed` | 植入測試用戶 |
| `npm run test:match` | 配對算法測試 |
| `npm run build:mirror-v3` | 建置 `public/js/mirror-v3.js` + `mirror-narratives.js`（改 v3 題庫或敘事後執行） |

**PayPal 本地 webhook（選填）：**

本地需用 [ngrok](https://ngrok.com/) 等工具將 `https://xxxx.ngrok.app/api/billing/webhook` 登記至 PayPal Developer Dashboard。詳見 [docs/paypal-onboarding.md](docs/paypal-onboarding.md)。

---

## 頁面一覽

| 路徑 | 類型 | 說明 |
|---|---|---|
| `/index.html` | 靜態 | 首頁、模式選擇 |
| `/echo.html` | 靜態 | Echo Mode 問卷 |
| `/mirror.html` | 靜態 | Mirror Mode 問卷 |
| `/drift-bottle.html` | 靜態 | 月光漂流瓶 |
| `/tos.html` `/privacy.html` `/refund.html` `/contact.html` `/about.html` | 靜態 | 法律、聯絡與關於我們 |
| `/forum` `/forum/[postId]` | Next.js | 黑貓樹洞 |
| `/inbox` `/inbox/[threadId]` | Next.js | 收件箱 |
| `/mirror-card/me` `/mirror-card/[slug]` | Next.js | Mirror Card |
| `/matches` | Next.js | 配對列表（**Moonlight Passport only**） |
| `/account` `/premium` `/cat-families` `/exchange-photo` | Next.js | 帳戶、訂閱、家族介紹、交換相管理 |
| `/login` `/signup` `/billing/success` | Next.js | 登入、註冊、付款成功 |
| `/dashboard/*` | Next.js（gitignore） | 內部管理儀表板（含郵件自動化） |

---

## API 模組

完整端點見 `src/pages/api/`。按模組分類：

| 模組 | 路徑前綴 | 重點 |
|---|---|---|
| 問卷／配對 | `/api/submit`、`/api/match*`、`/api/matches*` | 問卷提交、配對計分、卡片 |
| Mirror Card | `/api/mirror-card/*` | 公開卡片、圖片匯出、舉報 |
| 黑貓樹洞 | `/api/forum/*` | 貼文、留言、meta、舉報 |
| 漂流瓶 | `/api/bottle/*` | 投瓶、撈瓶、回聲、舉報 |
| Inbox | `/api/inbox/*` | 對話、發信、封鎖、用戶搜尋 |
| 交換相 | `/api/photo-exchange/*`、`/api/profile/exchange-photo` | 邀請、回應、取消、上傳 |
| 帳戶 | `/api/me`、`/api/auth/*` | Profile、**login（含密碼鎖定）**、init-profile、refresh-session、clear-login-lockout |
| 付款 | `/api/billing/*` | PayPal 訂閱、webhook、人手核對 |
| 聯絡 | `POST /api/contact-feedback` | 意見箱寫入 `contact_feedback` |

**管理員 API**（Header：`x-dashboard-key: <DASHBOARD_SECRET>`）：

- `GET /api/dashboard/email-automation` — 全域配對、草稿佇列、配額／Passport 標註（`premium_only=1` 篩選）
- `POST /api/dashboard/send-emails` — Gmail 發送配對通知、寫入 `sent_matches`；Body 可含 `deliver_inbox`、`skip_quota_check`
- `POST /api/dashboard/create-gmail-drafts` — 存入 Gmail 草稿
- `POST /api/match/deliver-inbox` — 僅投送 Inbox 連線卡
- `POST /api/billing/manual-verify` — 人手付款核對（授予／撤銷 Passport）
- `GET /api/dashboard/premium` — 訂閱列表與人手授予
- `POST /api/admin/match/legacy-claim/resolve` — Legacy 問卷認領爭議

本地未設定 `DASHBOARD_SECRET` 時，middleware 不攔截。

---

## 環境變數

複製 `.env.example` 為 `.env.local` 並填入。欄位說明見該檔案註解。

| 變數 | 必填 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_*` | ✅ | 客戶端 Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 伺服器寫入／權限 |
| `NEXT_PUBLIC_SITE_URL` | 建議 | Canonical、sitemap、PayPal 回傳 URL |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | 選填 | Google Search Console HTML 驗證 |
| `NEXT_PUBLIC_POSTHOG_KEY` | 選填 | PostHog 專案 key（未設定則分析關閉） |
| `NEXT_PUBLIC_POSTHOG_HOST` | 選填 | PostHog API host（預設 `https://us.i.posthog.com`） |
| `PAYPAL_*` | 選填 | Moonlight Passport 自動訂閱 |
| `UPSTASH_*` | 選填 | API 速率限制 |
| `CF_TURNSTILE_SECRET` / `NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY` | 選填 | 漂流瓶人機驗證；換 domain 須在 Cloudflare Turnstile 加入新 hostname |
| `GMAIL_*` | 選填 | 配對／投信 Email |
| `DASHBOARD_SECRET` | 選填 | 管理員 API |
| `NEXT_PUBLIC_PAYME_QR_URL` | 選填 | PayMe QR 圖（預設 `/PayCode.jpg`） |

同樣需在 Vercel Project Settings → Environment Variables 設定。

---

## 配額一覽

| 配額 | 免費 | Moonlight Passport |
|---|---|---|
| 論壇每日發文 | 3 | 不限 |
| 每月主動投信 | 0 | 3 |
| 每月交換相邀請 | 0 | 3 |
| 每月配對通知 | 3 | 無限制 |

定義於 `src/lib/permissions.js`（`QUOTA_LIMITS`）。  
**Dashboard 郵件自動化**使用 `src/lib/match-delivery-quota.js` 計數；Passport 識別見 `src/lib/match-response-premium.js`（已認領 `user_id` 或問卷 Email 對照 Auth 帳號）。發送邏輯集中於 `src/lib/match-notify-send.js`。

| Dashboard 顯示 | Free | Moonlight Passport |
|---|---|---|
| 配額 badge | 本月 n/3 | 🌙 無限制 |
| 即時連線 | — | Email + Inbox（`deliver_inbox: true`） |

任一方 Free 且本月已滿 3 次則 `quota_blocked`，不可勾選發送。

---

## 登入密碼鎖定

| 項目 | 設定 |
|---|---|
| 觸發條件 | 同一 Email 在 **15 分鐘**內密碼錯誤 **10** 次 |
| 凍結時間 | **30 分鐘**（期間正確密碼亦無法登入） |
| 解除方式 | 等待凍結結束；或完成「忘記密碼」重設（會清除鎖定） |
| 實作 | `src/lib/login-lockout.js`、`POST /api/auth/login`（Upstash Redis；本地無 Redis 時用記憶體） |

完整說明 → [docs/AUTH-LOGIN-LOCKOUT.md](docs/AUTH-LOGIN-LOCKOUT.md)

---

## 配對系統

1. **Hard Filter** — 身份、體型、身高差、年齡差四層雙向篩選（不通過即排除）
2. **六維度引擎** — `src/lib/intelligence.js` 的 `computeCompatibility()`：火花、情感、生活、溝通、關係期望、衝突風險 → 0–100 分
3. **等級** — 80+ 靈魂伴侶候選｜65+ 高度契合｜50+ 值得了解｜35+ 需磨合｜以下差異較大

完整權重、非線性調整、地雷矩陣 → [docs/SCORING.md](docs/SCORING.md)  
Mirror 測驗規格 → [docs/MIRROR-MODE-SPEC.md](docs/MIRROR-MODE-SPEC.md)（v3 Trait 設計 → [docs/MIRROR-MODE-V3-DESIGN.md](docs/MIRROR-MODE-V3-DESIGN.md)）

---

## 資料庫遷移

`supabase/migrations/` 含論壇、Inbox、Mirror Card、漂流瓶、**交換相**、**投信玩法偏好**、**意見箱**等。**新環境請依檔名順序**在 Supabase SQL Editor 執行。

近期重要 migration：

| 檔案 | 說明 |
|---|---|
| `20250628000000_photo_exchange.sql` | 交換相表與 profile 相片欄位 |
| `20250628000004_letter_gameplay_prefs.sql` | 投信信紙／郵票偏好 |
| `20250701000000_contact_feedback.sql` | 聯絡頁意見箱 `contact_feedback` |
| `20250705000000_moon_journey.sql` | 月光旅程 EXP／打卡 |
| `20250706000000_mirror_v3_trait_scores.sql` | Mirror v3 `trait_scores` 等欄位 |
| `20250707000000_forum_posts_rls_anon_public_only.sql` | 論壇匿名僅讀公開帖 RLS |

---

## 開發工具

```bash
npm run seed                              # 植入 20 個模擬用戶
npm run seed:clear                        # 清除後重新植入
node scripts/seed-test-data.mjs --count=30 --clear
npm run test:match                        # 配對算法測試
npm run test:cards                        # 配對測試 + HTML 卡片
npm run build:mirror-v3                   # 題庫 + 敘事 bundle（改 mirror-questions-v3 或 mirror-narratives 後）
npm run generate:card -- --userA=1 --userB=5
npm run export:excel                      # 匯出配對 Excel（≥ 60 分）
node scripts/create-admin-user.mjs        # 建立管理員帳號
```

---

## 疑難排解

| 問題 | 處理 |
|---|---|
| `Cannot find module './chunks/...'` 或頁面 500 | 停止 dev server → 刪除 `.next` 資料夾 → `npm run dev` |
| OneDrive 下路徑 hot reload 異常 | 專案已在 `next.config.js` 啟用 webpack polling；仍異常可移出 OneDrive 同步資料夾 |
| 論壇／Inbox 401 | 確認已登入；檢查 `init-profile` 是否成功建立 `profiles` row |
| 登入提示帳號已鎖定 | 15 分鐘內錯密 10 次會凍結 30 分鐘；可等鎖定結束或走「忘記密碼」；見 [docs/AUTH-LOGIN-LOCKOUT.md](docs/AUTH-LOGIN-LOCKOUT.md) |
| 問卷提交失敗 | 確認 `SUPABASE_SERVICE_ROLE_KEY`；檢查 `responses` 表權限 |
| Moonlight Passport 付款無反應 | 確認 `PAYPAL_*` 已設且 `PAYPAL_MODE=live`；正式站需設定 Webhook，見 [docs/paypal-onboarding.md](docs/paypal-onboarding.md) |
| 意見箱提交失敗 | 確認已執行 `20250701000000_contact_feedback.sql`；API 路徑為 `POST /api/contact-feedback` |
| Dashboard 郵件自動化 API 500 | 刪除 `.next` 後重啟 dev server；深層巢狀 API 路徑可能需改為扁平路徑 |
| Passport 即時連線 Inbox 未投送 | 已註冊一方應可收 solo match thread；確認 Dashboard 用 Passport 分頁或 `deliver_inbox: true`；已發送配對可 `POST /api/match/deliver-inbox` 補投 |
| PayMe QR 不顯示 | 檢查 `NEXT_PUBLIC_PAYME_QR_URL` 或 `public/PayCode.jpg`；QR 僅在 `/premium` 付款步驟 popup 內 |
| Mobile WebView 無法捲動／看不到 footer | 見 [docs/MOBILE-WEBVIEW-SCROLL.md](docs/MOBILE-WEBVIEW-SCROLL.md) |
| 管理員 API 401 | 請求加 header `x-dashboard-key`，值同 `DASHBOARD_SECRET` |

---

## 法律與聯絡

- [關於我們](/about.html) · [使用條款](/tos.html) · [私隱政策](/privacy.html) · [退款與取消政策](/refund.html) · [聯絡我們](/contact.html)
- Instagram [@blackcatunderthemoonhk](https://www.instagram.com/blackcatunderthemoonhk/)
- Threads [@blackcatunderthemoonhk](https://www.threads.net/@blackcatunderthemoonhk)
- Ko-fi [blackcatunderthemoon](https://ko-fi.com/blackcatunderthemoon)

© 2026 Black Cat Under The Moon. All rights reserved.
