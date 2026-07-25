# 🌙 Black Cat Under The Moon — 月下靈魂社群

> 專為女同志社群設計的靈魂配對與社群平台。

**Live：** [www.blackcatunderthemoon.com](https://www.blackcatunderthemoon.com)  
參與本平台即表示同意[使用條款](/tos.html)與[私隱政策](/privacy.html)。

本 README 以**開發者入門**為主。產品規格與深度技術文件見 `docs/`（本地／內部文件；多數未進公開 repo）。配對計分見 [docs/SCORING.md](docs/SCORING.md)（若你的工作副本有該檔）。

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

**帳號：** Supabase Auth；Mirror Card 可見度分級；論壇顯示名稱唯一性檢查。

**管理儀表板：** 僅內部／本地開發使用（多數 UI 已 gitignore）。管理 API 必須以伺服器端密鑰保護；切勿把管理密鑰放進前端或公開 repo。

**內容安全：** 關鍵字過濾、舉報自動隱藏、Turnstile（漂流瓶）、API 速率限制、登入暴力破解防護（連續錯密會暫時鎖定）。實作細節見內部 `docs/`，勿在公開 README 列舉門檻與管理端點。

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
│   └── middleware.js       # 保護管理 API（需伺服器端密鑰）
├── src/pages/dashboard/    # 管理儀表板 UI（gitignore，本地開發用）
├── src/pages/api/dashboard/ # 管理員 API（多數 gitignore）
├── supabase/migrations/
├── scripts/                # 建置／備份等（敏感腳本勿提交密鑰）
├── docs/                   # 內部深度文件（多數 gitignore）
├── .env.example            # 環境變數名稱範本（無真實密鑰）
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
3. **環境變數：** 複製 `.env.example` → `.env.local`，依註解填入公開／私密變數。**私密金鑰只放 `.env.local` 與 Vercel Environment Variables，永不提交 git。**
4. **啟動：** `npm run dev`
5. **驗證：**
   - 首頁 → `http://localhost:3000/index.html`
   - 註冊登入 → `/signup`、`/forum`
   - 問卷提交 → `/mirror.html`（需正確的伺服器端 Supabase 權限）

選填：PayPal、Upstash、Turnstile、Gmail（見 `.env.example` 註解）。

> **安全（必讀）：**
> - 切勿提交：`SUPABASE_SERVICE_ROLE_KEY`、PayPal secret、Dashboard／Cron 密鑰、Gmail App Password、任何 `.env.local`
> - `NEXT_PUBLIC_*` 會進瀏覽器，只能放可公開的值（anon key、site URL 等）
> - 管理 API／儀表板僅限信任環境；正式站務必設定管理密鑰並關閉「未設密鑰即放行」的開發行為
> - `backups/` 含真實用戶資料，已 gitignore，勿上傳 GitHub

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
| （內部）管理介面 | Next.js（gitignore） | 本地／內部用，勿對外宣傳路徑 |

---

## API 模組

公開產品功能的 API 位於 `src/pages/api/`（問卷、論壇、漂流瓶、Inbox、交換相、帳戶、付款、聯絡等）。  
**管理／營運 API** 需伺服器端密鑰驗證；本 README **不列出**管理端點清單、Header 名稱或 Body 參數，避免成為攻擊地圖。內部操作請查本地 `docs/` 或程式碼。

開發時：未正確設定管理密鑰前，勿把正式資料庫連到可公開存取的預覽環境。

---

## 環境變數

複製 `.env.example` 為 `.env.local` 並填入。欄位說明見該檔案註解。

| 類別 | 範例變數名（見 `.env.example`） | 注意 |
|---|---|---|
| 公開（可進瀏覽器） | `NEXT_PUBLIC_SUPABASE_*`、`NEXT_PUBLIC_SITE_URL`、分析／Turnstile site key 等 | 視為公開資訊 |
| 私密（僅伺服器） | Service Role、PayPal secret、Upstash、Turnstile secret、Gmail、Dashboard／Cron 密鑰等 | **禁止** commit、禁止寫進前端 |

同樣需在 Vercel → Project Settings → Environment Variables 設定；Production／Preview 請分開管理密鑰。

---

## 配額一覽

| 配額 | 免費 | Moonlight Passport |
|---|---|---|
| 論壇每日發文 | 3 | 不限 |
| 每月主動投信 | 0 | 3 |
| 每月交換相邀請 | 0 | 3 |
| 每月配對通知 | 3 | 無限制 |

定義於 `src/lib/permissions.js`。Dashboard 郵件自動化與配額邏輯見內部程式／`docs/`（勿在公開文件暴露營運繞過參數）。

---

## 登入安全（摘要）

登入具暴力破解防護：連續密碼錯誤達門檻會暫時鎖定該帳號；管理員可於內部工具解鎖。  
**公開 README 不列出精確次數／時長／Redis key／管理路徑**，以免協助攻擊調參。完整規格見內部 `docs/AUTH-LOGIN-LOCKOUT.md`。

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
npm run seed                              # 植入測試用戶（僅本地／測試庫）
npm run seed:clear                        # 清除後重新植入（危險：勿對正式庫執行）
npm run test:match                        # 配對算法測試
npm run test:cards                        # 配對測試 + HTML 卡片
npm run build:mirror-v3                   # 題庫 + 敘事 bundle
npm run export:excel                      # 匯出配對 Excel（本地）
npm run backup:supabase                   # 只讀備份至本機 backups/（勿 commit）
# 還原／排程／管理腳本見內部 docs/BACKUP.md；還原會寫入資料庫，慎用
```

---

## 疑難排解

| 問題 | 處理 |
|---|---|
| `Cannot find module './chunks/...'` 或頁面 500 | 停止 dev server → 刪除 `.next` 資料夾 → `npm run dev` |
| OneDrive 下路徑 hot reload 異常 | 專案已在 `next.config.js` 啟用 webpack polling；仍異常可移出 OneDrive 同步資料夾 |
| 論壇／Inbox 401 | 確認已登入；檢查 profile 是否已建立 |
| 登入提示帳號已鎖定 | 屬安全機制；可稍後再試或使用「忘記密碼」。管理員解鎖見內部文件 |
| 問卷提交失敗 | 確認伺服器端 Supabase 金鑰與表權限 |
| Moonlight Passport 付款無反應 | 確認 PayPal 環境變數與 Webhook；見內部 paypal 文件 |
| 意見箱提交失敗 | 確認已執行對應 migration；API 為聯絡意見箱端點 |
| 管理 API 401 | 確認已設定並傳入正確的管理密鑰（細節不在公開 README） |
| PayMe QR 不顯示 | 檢查公開 PayMe 圖設定或預設靜態圖 |
| Mobile WebView 無法捲動／看不到 footer | 見內部 Mobile WebView 文件 |

---

## 法律與聯絡

- [關於我們](/about.html) · [使用條款](/tos.html) · [私隱政策](/privacy.html) · [退款與取消政策](/refund.html) · [聯絡我們](/contact.html)
- Instagram [@blackcatunderthemoonhk](https://www.instagram.com/blackcatunderthemoonhk/)
- Threads [@blackcatunderthemoonhk](https://www.threads.net/@blackcatunderthemoonhk)
- Ko-fi [blackcatunderthemoon](https://ko-fi.com/blackcatunderthemoon)

© 2026 Black Cat Under The Moon. All rights reserved.
