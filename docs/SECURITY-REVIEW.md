# 安全風險評估報告

**專案：** Black Cat Under The Moon  
**評估日期：** 2026-07-05  
**修復日期：** 2026-07-05  
**範圍：** 公開 repo 內 Next.js API、Supabase migrations、靜態頁、認證／計費／論壇／Inbox 等核心流程  

> **免責：** `src/pages/api/dashboard/` 等 gitignore 路由未納入審查。Supabase 上未寫入 migration 的 RLS（`responses`、`profiles` 等）仍需在 Dashboard 手動確認。

---

## 修復摘要（2026-07-05）

| 級別 | 原數量 | 狀態 |
|------|--------|------|
| 🔴 Critical | 2 | ✅ 已修 |
| 🟠 High | 7 | ✅ 已修（含 RLS migration） |
| 🟡 Medium | 7 | ✅ 已修 |
| 🟢 Low / Info | 6 | ⚠️ 部分（L-6 需 Dashboard 手動） |

**新增共用模組：**
- `src/lib/production-guard.js` — production fail-closed、PayPal 可信 origin
- `src/lib/rate-limit.js` — Upstash 限速（production 未設定則 503）

**新 migration：** `20250707000000_forum_posts_rls_anon_public_only.sql`

---

## 正式上線 Checklist

```
[x] C-1、C-2：match_card API 需 x-dashboard-key；回應不含 PII
[x] SUPABASE_SERVICE_ROLE_KEY — production 啟動時必填
[x] DASHBOARD_SECRET — production middleware + checkDashboardAuth fail-closed
[x] CF_TURNSTILE_SECRET — production fail-closed
[x] PAYPAL_WEBHOOK_ID — production webhook 拒絕未驗簽請求
[x] forum_posts RLS — anon 僅 public（需跑 migration）
[x] PayPal checkout — NEXT_PUBLIC_SITE_URL origin（非 raw Origin）
[x] activate-subscription — 強制 custom_id === user.id
[x] UPSTASH_REDIS — production 限速未設定則 503
[x] Security headers — next.config.js
[x] reset-password — resolvePostAuthDestination
[ ] Supabase Dashboard：responses / profiles / inbox_* RLS 手動稽核（L-6）
[ ] Cloudinary preset 限制（L-4，Dashboard 設定）
```

---

## 已修復項目詳情

### C-1 `/api/match_card/template`
- 強制 `checkDashboardAuth`（`x-dashboard-key`）
- 改用 `getAdminClient()`
- JSON 回應移除 raw `responses`；僅回 `user_id`、`target_name` 等摘要

### C-2 `/api/match_card/notify`
- 同上 Dashboard 保護
- 移除 `notifications_preview` 及 email/IG/TG 回傳

### H-1 Service Role
- `server-auth.js`：production 無 `SUPABASE_SERVICE_ROLE_KEY` 時 module 載入 throw
- `getAdminClient()` 不再 silent fallback 至 anon（production）

### H-2 PayPal Webhook
- `paypal.js`：production 無 `PAYPAL_WEBHOOK_ID` → 驗簽失敗

### H-3 Turnstile
- `turnstile.js`：production 無 secret → `{ success: false }`

### H-4 Dashboard
- `middleware.js`、`dashboard-auth.js`：production 無 `DASHBOARD_SECRET` → 503

### H-5 PayPal Origin
- `create-checkout-session.js` 使用 `getTrustedSiteOrigin(req)`

### H-6 Forum RLS
- Migration 拆分 anon（`public` only）與 authenticated（`public` + `members_only`）

### H-7 PayPal activate
- 缺少或不符 `custom_id` → 403

### M-1 Reset password redirect
- `reset-password.js` 使用 `resolvePostAuthDestination()`

### M-2 Match status 枚舉
- POST `/api/match-status` IP 限速（12/min）

### M-3 檢舉濫用
- Auto-hide 門檻 3 → **5**
- `/api/forum/report` 每用戶 10 次/小時

### M-4 Security headers
- `next.config.js`：CSP、HSTS、X-Frame-Options 等

### M-5 Upstash production
- `rate-limit.js`：production 無 Redis → 503

### M-6 Refresh session
- IP 限速 20/min

### M-7 Mirror card URL
- `card_image_url` 需通過 `isAllowedProfilePhotoUrl()`

### L-1 PostHog
- Production 不再使用 hardcoded fallback key

### L-5 Bottle topic CORS
- 有 `NEXT_PUBLIC_SITE_URL` 時限制為該 origin

---

## 仍須手動處理

| ID | 項目 | 動作 |
|----|------|------|
| L-6 | 其他表 RLS | Supabase Dashboard 確認 `responses`、`profiles`、`subscriptions`、`inbox_*` 等 |
| L-4 | Cloudinary | Dashboard 鎖定 unsigned preset（格式、大小、folder） |
| L-3 | Dashboard key in sessionStorage | Dashboard 頁面防 XSS（架構取捨） |

---

## 已做得好的部分（保留）

| 領域 | 做法 |
|------|------|
| 身份驗證 | `requireUser()`、Inbox participant 檢查 |
| Mirror Card | `shapeMirrorCard()` 依 visibility 裁剪 |
| 論壇 XSS | `ForumMarkdownBody` scheme 限制 |
| 敏感 RPC | 僅 `service_role` |
| 登入 redirect | `resolvePostAuthDestination()` |

---

## 相關文件

- [paypal-onboarding.md](./paypal-onboarding.md)
- [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md)
- `.env.example` — 正式站必填 env 註解

---

## 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-07-05 | 初版靜態程式碼安全評估 |
| 2026-07-05 | 實作 Critical～Medium 修復；更新 checklist |
