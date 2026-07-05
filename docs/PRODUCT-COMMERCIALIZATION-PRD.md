# Black Cat Under The Moon 產品升級與商業化需求文檔

> 版本：v1.1  
> 建立日期：2026-06-12  
> 最後更新：2026-07-05（論壇發文配額：Free 3／日、Premium 不限）  
> 目標：將現有「靈魂配對、Mirror Mode、月光漂流瓶」升級為可登入、可留存、可變現的匿名社交平台，並統一以 Mirror Card 作為全站身份卡。

---

## 目錄

1. [產品定位](#一產品定位)
2. [核心設計原則](#二核心設計原則)
3. [目標用戶與使用情境](#三目標用戶與使用情境)
4. [整體產品架構](#四整體產品架構)
5. [會員系統與匿名身份](#五會員系統與匿名身份)
6. [Mirror Card 鏡像卡](#六mirror-card-鏡像卡)
7. [網站專屬收件箱 Inbox](#七網站專屬收件箱-inbox)
8. [圍爐討論區 Forum](#八圍爐討論區-forum)
9. [配對計劃升級](#九配對計劃升級)
10. [月光漂流瓶整合方向](#十月光漂流瓶整合方向)
11. [免費與付費權限設計](#十一免費與付費權限設計)
12. [商業化與金流需求](#十二商業化與金流需求)
13. [資料庫設計](#十三資料庫設計)
14. [API 與後端需求](#十四api-與後端需求)
15. [前端頁面與使用流程](#十五前端頁面與使用流程)
16. [通知與 Email 策略](#十六通知與-email-策略)
17. [安全、隱私與內容治理](#十七安全隱私與內容治理)
18. [數據指標與營運後台](#十八數據指標與營運後台)
19. [開發階段 Roadmap](#十九開發階段-roadmap)
20. [驗收標準](#二十驗收標準)
21. [待確認問題](#二十一待確認問題)

---

## 一、產品定位

Black Cat Under The Moon 是一個專為女同志社群設計的匿名社交平台。產品原本由三個浪漫入口構成：

| 現有模組 | 目前價值 | 升級後角色 |
|---|---|---|
| 靈魂配對 | 用問卷與演算法找到高相容對象 | 轉化為高價值配對入口，結果進入 Inbox |
| Mirror Mode | 自我探索與鏡像卡分享 | 成為每個用戶唯一的 Mirror Card 身份卡 |
| 月光漂流瓶 | 匿名心事、撈瓶、回聲 | 保持心靈樹洞定位，未來接入 Inbox |

本次產品升級的核心，是將平台從「一次性活動 / 問卷工具」變成「有登入、有身份、有日常互動、有付費動機」的社群產品。

### 1.1 商業化目標

- 增加用戶留存：讓用戶不只填一次問卷，而是每日回來查看討論區、收件箱與互動通知。
- 降低技術成本：避免即時聊天與 WebSocket 長連線，改用非即時 Inbox 模式。
- 建立付費誘因：將「查看詳細 Mirror Card」與「主動聯絡」設為高意願付費功能。
- 保留匿名安全感：所有社交行為以暱稱、Mirror Card 與站內信連結，不強制綁定現實社交帳號。

---

## 二、核心設計原則

### 2.1 不做傳統即時私聊

本產品不實作 WebSocket、不追求即時聊天室體驗。所有一對一互動統一採用「投信至對方收件箱」的筆友模式。

**設計原因：**

- 降低伺服器維護成本。
- 適合匿名社交中較慢、較安全、較有儀式感的互動節奏。
- 避免即時聊天帶來的騷擾、洗訊息與審核壓力。
- 可維持 Supabase 免費或低成本額度更久。

### 2.2 Mirror Card 是全站唯一身份卡

不額外建立另一套卡片。現有 Mirror Mode 產出的 Mirror Card 直接升級為全站身份卡，用同一張卡串連所有社交場景。它要串連：

- 配對成功後查看對方卡片。
- 討論區點擊作者後查看卡片。
- 漂流瓶未來遇到共鳴對象時查看卡片。
- 分享到 Threads / IG Story 作為裂變入口。

帳號層面的 `profiles` 只保存登入身份、暱稱、狀態與權限，不代表另有一張對外卡片。所有可分享、可查看、可解鎖的卡片都叫 Mirror Card。

### 2.3 匿名不是無身份

平台保留匿名安全感，但用戶仍需要穩定身份承載互動記錄。

**身份層級：**

| 層級 | 說明 |
|---|---|
| Supabase Auth User | 真實系統帳號，以 Email + 密碼登入 |
| Public Persona | 站內公開暱稱、貓咪家族、像素頭像、Mirror Card |
| Private Contact | Email、訂閱狀態、配對通知，不公開展示 |

---

## 三、目標用戶與使用情境

### 3.1 主要用戶

| 用戶類型 | 需求 | 產品對應 |
|---|---|---|
| 想識人的圈內用戶 | 想找同頻的人，但不想公開現實社交帳號 | 匿名 Mirror Card、配對、Inbox |
| 害羞或慢熱用戶 | 不想即時聊天，但願意慢慢寫信 | 非即時 Inbox |
| 愛分享測驗結果的用戶 | 想曬卡、找同類、吸引朋友來玩 | Mirror Card 圖片 / URL 分享 |
| 高意願付費用戶 | 想看特定人的詳細資料、主動聯絡對方 | Premium 解鎖詳細卡與主動投信 |
| 日常圍爐用戶 | 想匿名發文、留言、共鳴 | 討論區 |

### 3.2 核心使用旅程

```
新用戶看到朋友分享 Mirror Card
  ↓
進入網站註冊 Email 帳號
  ↓
完成 Mirror Mode 並生成 Mirror Card
  ↓
瀏覽討論區或參與配對
  ↓
看到有共鳴的人
  ↓
免費用戶：只能看有限資料，等待配對
Premium：查看 Detailed Mirror Card，主動投信到對方 Inbox
  ↓
對方登入後查看 Inbox 並回信
```

---

## 四、整體產品架構

### 4.1 功能模組關係

```
Supabase Auth
  ↓
Account Profile / Mirror Card
  ↓
├─ 靈魂配對 Matching → Match Card → Inbox
├─ 圍爐討論區 Forum → 點擊作者 → Mirror Card → Inbox
├─ 月光漂流瓶 Drift Bottle → 共鳴回聲 → Mirror Card / Inbox（未來）
└─ Premium 權限 → 詳細卡、主動投信、即時通知
```

### 4.2 推薦技術架構

| 層級 | 技術 | 說明 |
|---|---|---|
| Frontend | Next.js + 現有 public 靜態頁逐步整合 | 保留現有頁面，逐步把會員功能搬入 Next routes |
| Backend | Next.js API Routes | 延續現有 `/api/*` 架構 |
| Auth | Supabase Auth | Email + Password；後續可加 Magic Link |
| Database | Supabase Postgres | profiles、mirror_cards、forum、inbox、subscriptions |
| Storage | Supabase Storage 或前端 html2canvas 下載 | 儲存分享卡圖或前端即時生成 |
| Payment | Stripe 優先；PayMe / FPS 可作手動方案 | Stripe 自動化最好，香港本地方案可 MVP 手動 |
| Bot 防護 | Cloudflare Turnstile + rate limit | 延續現有漂流瓶與問卷防護策略 |

### 4.3 成本控制策略

- 不使用即時聊天室。
- Inbox 採輪詢 / 頁面切換時 fetch。
- Email 通知批量發送，Premium 才即時觸發。
- 討論區列表分頁載入，避免一次拉大量留言。
- 圖片分享優先採前端生成下載；伺服器儲存作第二階段。

---

## 五、會員系統與匿名身份

### 5.1 功能目標

導入 Supabase Auth，讓用戶可註冊、登入、登出、維持站內身份與互動記錄。

### 5.2 註冊需求

| 欄位 | 必填 | 說明 |
|---|---|---|
| Email | 是 | 登入與通知使用，不公開 |
| Password | 是 | 最少 8 字元 |
| Display Name | 是 | 站內暱稱，可匿名 |
| Birth Year / Age Range | 建議 | 用於安全與配對；是否公開由 Mirror Card 設定控制 |
| Consent | 是 | 同意條款、私隱政策、社群守則 |

### 5.3 登入需求

- 支援 Email + Password 登入。
- 登入後顯示用戶狀態、Inbox 未讀數、會員等級。
- 未登入用戶可瀏覽部分公開內容，但不能留言、投信、查看詳細卡。

### 5.4 匿名展示規則

| 資料 | 是否公開 | 備註 |
|---|---|---|
| Email | 否 | 僅系統通知與登入使用 |
| Display Name | 是 | 討論區與卡片展示 |
| User ID | 否 | 前端不可直接展示 raw UUID |
| Mirror Type | 是 | 例如守護貓家族 |
| MBTI / 星座 | 可選公開 | 由 Mirror Card 設定控制 |
| IG | 預設不公開 | 只可作配對後或 Premium 解鎖策略，需另行確認 |

### 5.5 帳號狀態

| 狀態 | 說明 |
|---|---|
| active | 正常使用 |
| limited | 被檢舉或風控限制，不能發文 / 投信 |
| suspended | 停權，不能登入或互動 |
| deleted | 用戶要求刪除資料後標記 |

---

## 六、Mirror Card 鏡像卡

### 6.1 功能目標

Mirror Card 是全站唯一身份卡，直接承接 Mirror Mode 結果與必要的配對摘要，並支援分享裂變。不另行設計或維護另一套對外卡片。

### 6.2 資料來源

| 來源 | 用途 |
|---|---|
| Mirror Mode 基本資料 | Label、MBTI、星座、喜好、音樂、電影 |
| Mirror Mode 心理測驗 | 貓咪家族、影子類型、性格描述、靈魂成分 |
| 配對問卷 | 只寫入可展示的摘要，例如關係期待、生活模式、愛的語言；完整答案仍屬配對資料 |
| 用戶自填 | 暱稱、自我介紹、公開設定 |

### 6.3 Mirror Card 可見層級

| 卡片類型 | 可見內容 | 可見對象 |
|---|---|---|
| Public Mirror Card | 暱稱、貓咪家族、性格摘要、分享 URL | 所有人 |
| Basic Mirror Card | 公開資料、Mirror 結果、少量興趣 | 已配對對象、本人 |
| Detailed Mirror Card | 深層 Mirror 分析、關係期待摘要、相處需求、更多 tag | Premium 或雙方配對成功後 |
| Admin View | 完整 Mirror Card 資料、檢舉紀錄、風控狀態 | 管理員 |

### 6.4 分享功能

#### 6.4.1 圖片生成

- 用戶可一鍵生成像素風 Mirror Card 圖片。
- 圖片尺寸需適合 IG Story / Threads 分享。
- 圖片不包含 Email、真實聯絡方式、raw user id。
- 圖片需包含品牌名稱與網站入口。

#### 6.4.2 專屬 URL

- 每張卡有公開 slug，例如 `/mirror-card/moon-abc123`。
- 未登入訪客可看到公開分享卡。
- 訪客若要互動、查看更多或投信，需先註冊 / 登入。

### 6.5 Mirror Card 編輯需求

- 用戶可重新填 Mirror Mode 更新卡片。
- 用戶可設定哪些資料公開。
- 用戶可預覽「公開視角」與「詳細卡視角」。
- 系統需記錄 `updated_at`，避免過舊卡片在配對中誤導。

---

## 七、網站專屬收件箱 Inbox

### 7.1 功能目標

Inbox 是全站私下互動的唯一承載，不做即時聊天，而是站內信 / 筆友模式。

### 7.2 Inbox 來源

| 來源 | 訊息類型 | 說明 |
|---|---|---|
| 配對成功 | match_card | 系統自動把配對卡放入雙方 Inbox |
| 用戶主動投信 | user_letter | Premium 每月限量主動寄信 |
| 討論區延伸 | forum_letter | 從 Post / Comment 作者卡片發起 |
| 漂流瓶延伸 | bottle_letter | 未來從共鳴瓶子或回聲發起 |
| 系統通知 | system | 會員、違規、活動通知 |

### 7.3 訊息互動規則

- Inbox 訊息非即時刷新。
- 用戶進入 Inbox、切換頁面、手動點擊刷新時拉取最新資料。
- 訊息以 thread 串接，不做多人群聊。
- 每封信可回覆，但需有頻率限制。
- 被封鎖 / 被檢舉成立的用戶不可繼續寄信。

### 7.4 訊息狀態

| 狀態 | 說明 |
|---|---|
| unread | 收件人未讀 |
| read | 收件人已讀 |
| replied | 已回覆 |
| archived | 使用者封存 |
| reported | 被檢舉 |
| hidden | 因檢舉或管理員操作隱藏 |

### 7.5 主動投信限制

| 用戶等級 | 權限 |
|---|---|
| 未登入 | 不可投信 |
| Free | 只能回覆已配對或已建立 thread 的對象 |
| Premium | 每月可主動寄出 5 封給任意可見用戶 |
| Admin | 不受限制，用於客服與安全處理 |

### 7.6 反騷擾設計

- 每封主動信需經內容過濾。
- 收件人可封鎖寄件人。
- 收件人可檢舉單封信或整個 thread。
- 被封鎖後，寄件人不可再主動建立 thread。
- Premium 主動信月額用完後不可加購前需另行決策。

---

## 八、圍爐討論區 Forum

### 8.1 功能目標

討論區是平台日常流量中心，讓用戶匿名發文、留言、圍爐，並自然導向 Mirror Card 與 Premium 轉化。

### 8.2 基本功能

| 功能 | Free | Premium | 未登入 |
|---|---:|---:|---:|
| 查看 Post | 是 | 是 | 可查看部分公開 Post |
| 發表 Post | 每日 1 篇 | 每日 5 篇 | 否 |
| 留言 | 是 | 是 | 否 |
| 點擊作者 | 只能看公開卡 / 已配對基本卡 | 可看詳細卡 | 要求登入 |
| 主動投信作者 | 否，除非已配對 | 每月 5 封額度內 | 否 |

### 8.3 Post 欄位

| 欄位 | 說明 |
|---|---|
| title | 標題，可選；若無標題以前 20 字生成 |
| content | 正文，建議 20-1000 字 |
| topic | 主題分類 |
| mood_tag | 心情標籤，可選 |
| author_id | 關聯 profiles |
| anonymous_name_snapshot | 發文當下暱稱快照 |
| like_count | 共鳴數 |
| comment_count | 留言數 |
| report_count | 檢舉數 |
| visibility | public / members_only / hidden |

### 8.4 建議分類

| 分類 | 說明 |
|---|---|
| 感情圍爐 | 曖昧、失戀、關係安全感 |
| 圈內日常 | 生活碎念、同溫層交流 |
| 識人徵友 | 非正式交友與尋同頻 |
| Mirror 同類 | 貓咪家族相關討論 |
| 月光樹洞 | 更匿名、更情緒向內容 |
| 官方公告 | 管理員使用 |

### 8.5 留言需求

- 登入用戶可留言。
- 留言顯示匿名暱稱與簡短 Mirror Card 標籤。
- 留言作者可被點擊進入 Mirror Card 頁。
- 支援檢舉留言。
- 初期不需要巢狀留言；若要支援，最多一層回覆即可。

### 8.6 排序與列表

| 排序 | 說明 |
|---|---|
| 最新 | 按 created_at desc |
| 熱門 | 以 like_count、comment_count、時間衰減計算 |
| 我的貓咪家族 | 優先顯示同 Mirror Type 的發文 |
| 官方精選 | 管理員置頂 |

---

## 九、配對計劃升級

### 9.1 現有定位

現有配對系統以問卷與演算法計分為核心，未來需要從「批量 Email 配對結果」升級為「站內配對卡 + Inbox 通知」。

### 9.2 配對成功規則

- 演算法分數 > 70 分視為可通知配對。
- 每位 Free 用戶每月最多收到 3 位配對通知。
- Premium 用戶可收到即時通知，且不需等待批量寄送窗口。
- 是否提高 Premium 配對數量需另行決定；本版只明確 Premium 享有即時通知。

### 9.3 配對卡進 Inbox

當 A 與 B 配對成功：

```
matching job 產生 pair
  ↓
檢查雙方每月配額與封鎖狀態
  ↓
寫入 match_results
  ↓
寫入 inbox_messages：A 收到 B 的配對卡，B 收到 A 的配對卡
  ↓
Free：等待批量 Email 或站內提示
Premium：即時 Email / 高亮提示
```

### 9.4 配對卡內容

| 內容 | Free | Premium |
|---|---|---|
| 配對分數 | 是 | 是 |
| 對方暱稱 | 是 | 是 |
| 貓咪家族 | 是 | 是 |
| 相容摘要 | 是 | 是 |
| 詳細問卷維度 | 僅部分 | 完整 |
| 主動投信 CTA | 已配對可用 | 可用 |
| 社交帳號 | 預設不展示 | 是否展示需用戶同意 |

---

## 十、月光漂流瓶整合方向

### 10.1 現狀保持

月光漂流瓶目前是匿名樹洞功能，應保留：

- 答案之書 x 月光神諭。
- 投瓶 / 撈瓶機制。
- 回聲留言。
- 神秘鑰匙找回。
- 舉報與內容治理。

### 10.2 帳號整合策略

短期不強制漂流瓶登入，避免破壞匿名安全感。可採雙模式：

| 模式 | 說明 |
|---|---|
| 完全匿名瓶 | 不綁 user_id，延續現有模式 |
| 登入後投瓶 | 可選擇綁定 user_id，但前端不展示身份 |

### 10.3 未來 Inbox 連動

當用戶撈到極度共鳴的瓶子或回聲時，可出現：

- 「想把一封月光信投給對方」CTA。
- 只有對方是登入瓶或允許接收月光信時才可投信。
- 收件人 Inbox 顯示來源為「月光漂流瓶」，不直接暴露原瓶子所有敏感資料。

---

## 十一、免費與付費權限設計

### 11.1 權限矩陣

| 功能模組 | Free 註冊用戶 | Premium 月費用戶 |
|---|---|---|
| 討論區 | 每日 **3** 篇 Post、查看 Post、留言 | **發文不限**、查看 Post、留言 |
| 配對計劃 | 每月最多 3 位配對通知 | 配對成功即時高亮 / Email 通知 |
| 查看 Mirror Card | 只能查看已配對對方的 Basic Mirror Card；討論區陌生人只看 Public Mirror Card | 可從討論區、漂流瓶、配對池查看 Detailed Mirror Card |
| 主動聯絡 | 被動接受已配對對象聯繫；可回覆既有 thread | 每月主動寄出 **3** 封站內信（神秘通道）給任何可見用戶 |
| Mirror Card 分享 | 可生成公開分享卡 | 可使用進階樣式或優先展示，是否加入待決 |
| 通知 | 批量 Email / 站內提示 | 即時 Email / Inbox 高亮 |

### 11.2 付費牆原則

付費牆應出現在「慾望已產生」的位置，而不是阻止基本探索：

- 用戶看到討論區某人很有共鳴，點進 Mirror Card 時提示 Premium 可查看 Detailed Mirror Card。
- 用戶想主動寄信時提示 Premium 每月可主動投 5 封。
- 配對成功頁中提示 Premium 可即時收到下一次高分配對。

### 11.3 限額重置規則

| 額度 | Free | Premium | 重置時間 |
|---|---:|---:|---|
| 每日發 Post | 1 | 5 | 每日 00:00 或 rolling 24h，需確認 |
| 每月配對通知 | 3 | 待決 | 每月 1 日 |
| 每月主動投信 | 0 | 5 | 訂閱週期開始日 |

---

## 十二、商業化與金流需求

### 12.1 收費方案

建議先推出單一 Premium 月費，降低選擇複雜度。

| 方案 | 價格 | 功能 |
|---|---|---|
| Free | HKD 0 | 基本使用、有限配對、有限討論區 |
| Premium Monthly | 待定 | 詳細卡、主動投信、即時通知、較高發文額度 |

### 12.2 金流選項

| 方案 | 優點 | 缺點 | 建議階段 |
|---|---|---|---|
| Stripe | 自動化訂閱、Webhook 完整 | 需設定帳戶與稅務資訊 | 正式商業化首選 |
| PayMe 商業版 | 香港用戶熟悉 | 自動化程度視方案限制 | 可作本地補充 |
| FPS 手動驗證 | 最快開始 | 人手核對、營運成本高 | MVP 測試付費意願 |

### 12.3 訂閱狀態

| 狀態 | 說明 |
|---|---|
| free | 免費用戶 |
| premium_active | 付費有效 |
| premium_past_due | 扣款失敗，寬限期內 |
| premium_cancelled | 已取消，到期後轉 free |
| premium_manual | 手動開通，例如 FPS / PayMe |

### 12.4 Webhook 需求（Stripe）

- `checkout.session.completed`：開通 Premium。
- `invoice.payment_succeeded`：延長訂閱週期、重置月額。
- `invoice.payment_failed`：標記 past_due。
- `customer.subscription.deleted`：到期後轉回 Free。

---

## 十三、資料庫設計

以下為建議新增資料表，實際 SQL 可在開發階段拆成 migration。

### 13.0 舊 MatchCard / `responses` 合併原則

現有已填配對問卷的用戶資料已儲存在 Supabase `responses` 表，並以整數 `id` 作為 match user id。登入系統導入後，不應直接搬走或覆蓋舊資料，避免破壞現有配對演算法、Dashboard 與已發送配對紀錄。

核心策略：**保留 `responses` 作為配對問卷 canonical table，新增 `user_id` 將舊 match response 與 Supabase Auth user 連結。**

```text
auth.users.id / profiles.id
  ↓ 1:N 或 1:1 認領
responses.user_id
  ↓
既有配對問卷答案、match_score、sent_matches、blocked_pairs 繼續使用 responses.id
```

#### 13.0.1 合併規則

| 情況 | 處理方式 |
|---|---|
| 新用戶註冊 Email 與舊 `responses.email` 完全一致 | 顯示「找到舊配對資料」，完成 Email 驗證後自動認領 |
| 同一 Email 有多筆 `responses` | 預設認領最新一筆為 active，其餘標記 archived / duplicate |
| 用戶註冊 Email 不同，但 IG/TG 與舊資料相似 | 不自動合併，只提示人工申請認領 |
| 舊資料沒有 Email，只有 IG/TG | 不自動合併，需人工或一次性驗證流程 |
| 舊 `responses.email` 已被另一個帳號認領 | 阻止認領，進入客服 / Admin 審核 |
| 未登入新填問卷 | 可保留現有流程，但提醒登入後可保存與接收 Inbox |
| 已登入新填問卷 | 直接寫入 `responses.user_id = auth.users.id` |

#### 13.0.2 為何不能只靠 IG/TG 自動合併

- IG/TG handle 可改名、可被冒用、格式不穩定。
- 舊資料中的 IG/TG 可能是聯絡方式，不等同帳號所有權。
- 自動合併錯誤會造成配對答案、Inbox、詳細卡暴露給錯人。

因此自動認領只應以已驗證 Email 為主。IG/TG 只作輔助比對與人工審核線索。

#### 13.0.3 `responses` 建議新增欄位

| 欄位 | 類型 | 說明 |
|---|---|---|
| `user_id` | uuid nullable | 對應 `profiles.id` / `auth.users.id`，舊資料初始為 null |
| `normalized_email` | text nullable | lower(trim(email))，用於認領比對 |
| `claim_status` | text | unclaimed / claimed / duplicate / disputed |
| `claimed_at` | timestamptz nullable | 被帳號認領時間 |
| `archived_at` | timestamptz nullable | 同 Email 多筆舊資料被歸檔時間 |
| `source` | text | legacy_match_form / logged_in_match_form / admin_import |

#### 13.0.4 新增 `legacy_match_claims`

用於記錄認領流程與安全審計。

| 欄位 | 類型 | 說明 |
|---|---|---|
| `id` | uuid pk | 認領紀錄 ID |
| `user_id` | uuid | 申請認領的登入用戶 |
| `response_id` | bigint | 被認領的舊 `responses.id` |
| `claim_method` | text | email_exact / admin_manual / contact_review |
| `status` | text | pending / approved / rejected / expired |
| `matched_email` | text nullable | 命中的 normalized email |
| `review_note` | text nullable | Admin 審核備註 |
| `created_at` | timestamptz | 建立時間 |
| `resolved_at` | timestamptz nullable | 完成時間 |

#### 13.0.5 認領流程

```text
用戶註冊 / 登入
  ↓
系統檢查 auth email 的 normalized_email 是否命中 responses.normalized_email
  ↓
如命中且未被認領，顯示「搵到你之前填過嘅配對資料」
  ↓
用戶確認認領
  ↓
系統要求 Email 已驗證，或寄出一次性認領 link
  ↓
認領成功：responses.user_id = profiles.id、claim_status = claimed
  ↓
若同 Email 多筆 response：最新一筆 active，其餘 duplicate / archived
  ↓
用戶可在 Match 頁看到舊配對資料、重新生成配對卡、接收 Inbox
```

#### 13.0.6 合併後資料展示

- Mirror Card 不直接等於配對問卷完整答案。
- `responses` 仍保存完整配對答案，用於演算法與配對結果。
- Mirror Card 只抽取可展示摘要，例如年齡段、興趣、愛的語言、相處節奏，不公開完整 hard filter 與敏感答案。
- 已認領的舊配對資料可用來補齊 Detailed Mirror Card 的「配對摘要」區塊，但需由用戶確認是否展示。

#### 13.0.7 過渡期配對 ID 策略

短期內配對系統繼續以 `responses.id` 作為 match identity，避免大改現有演算法。登入後只新增 `responses.user_id` 連結。

| 場景 | 使用 ID |
|---|---|
| 配對演算法 | `responses.id` |
| sent_matches / blocked_pairs | `responses.id` |
| Inbox 收件人 | `profiles.id`，需由 `responses.user_id` 轉換 |
| Mirror Card 查看權限 | `profiles.id` + `responses.user_id` 關係 |
| Admin 查舊資料 | 同時顯示 `responses.id` 與 `profiles.id` |

若某個配對對象尚未認領帳號，系統可先保留 match result，但不能投遞到 Inbox；待對方註冊並認領後再補發配對卡。

### 13.1 `profiles`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | 對應 auth.users.id |
| email | text | 同步 auth email，僅內部使用 |
| display_name | text | 站內暱稱 |
| avatar_style | text | 像素頭像 / 貓咪樣式 |
| bio | text | 自我介紹 |
| status | text | active / limited / suspended / deleted |
| subscription_tier | text | free / premium |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |

### 13.2 `mirror_cards`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Mirror Card ID |
| user_id | uuid fk | profiles.id |
| public_slug | text unique | 分享 URL slug |
| mirror_type | text | solitary / sunny / mystical / sentinel |
| shadow_type | text nullable | 影子類型 |
| mirror_scores | jsonb | 四類分數與百分比 |
| basic_answers | jsonb | Mirror 基本資料 |
| matching_summary | jsonb | 配對問卷可展示摘要，不儲存完整配對答案 |
| visibility_settings | jsonb | 欄位公開設定 |
| card_image_url | text nullable | 若有儲存生成圖片 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |

### 13.3 `forum_posts`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Post ID |
| author_id | uuid fk | profiles.id |
| title | text | 標題 |
| content | text | 正文 |
| topic | text | 分類 |
| mood_tag | text | 心情標籤 |
| anonymous_name_snapshot | text | 發文當下暱稱 |
| like_count | int | 共鳴數 |
| comment_count | int | 留言數 |
| report_count | int | 檢舉數 |
| visibility | text | public / members_only / hidden |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |

### 13.4 `forum_comments`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Comment ID |
| post_id | uuid fk | forum_posts.id |
| author_id | uuid fk | profiles.id |
| parent_comment_id | uuid nullable | 若支援一層回覆 |
| content | text | 留言內容 |
| report_count | int | 檢舉數 |
| is_hidden | boolean | 是否隱藏 |
| created_at | timestamptz | 建立時間 |

### 13.5 `inbox_threads`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Thread ID |
| participant_a | uuid fk | profiles.id |
| participant_b | uuid fk | profiles.id |
| source_type | text | match / forum / bottle / direct / system |
| source_id | uuid nullable | 來源資料 ID |
| last_message_at | timestamptz | 最新訊息時間 |
| created_at | timestamptz | 建立時間 |

### 13.6 `inbox_messages`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Message ID |
| thread_id | uuid fk | inbox_threads.id |
| sender_id | uuid nullable | system message 可為 null |
| recipient_id | uuid fk | profiles.id |
| message_type | text | user_letter / match_card / system |
| content | text | 文字內容 |
| payload | jsonb | 配對卡、系統通知等結構化資料 |
| read_at | timestamptz nullable | 已讀時間 |
| report_count | int | 檢舉數 |
| is_hidden | boolean | 是否隱藏 |
| created_at | timestamptz | 建立時間 |

### 13.7 `subscriptions`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Subscription ID |
| user_id | uuid fk | profiles.id |
| provider | text | stripe / payme / fps_manual |
| provider_customer_id | text | Stripe customer id |
| provider_subscription_id | text | Stripe subscription id |
| status | text | active / past_due / cancelled / manual |
| current_period_start | timestamptz | 週期開始 |
| current_period_end | timestamptz | 週期結束 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |

### 13.8 `usage_quotas`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Quota ID |
| user_id | uuid fk | profiles.id |
| quota_type | text | forum_post_daily / active_letter_monthly / match_monthly |
| used_count | int | 已使用次數 |
| limit_count | int | 上限 |
| period_start | timestamptz | 統計開始 |
| period_end | timestamptz | 統計結束 |
| updated_at | timestamptz | 更新時間 |

### 13.9 `user_blocks`

| 欄位 | 類型 | 說明 |
|---|---|---|
| id | uuid pk | Block ID |
| blocker_id | uuid fk | 封鎖者 |
| blocked_id | uuid fk | 被封鎖者 |
| reason | text nullable | 原因 |
| created_at | timestamptz | 建立時間 |

---

## 十四、API 與後端需求

### 14.1 Auth / Mirror Card

| Method | Endpoint | 說明 |
|---|---|---|
| GET | `/api/me` | 取得登入狀態、account profile、subscription、unread count |
| PATCH | `/api/me` | 更新帳號暱稱、通知偏好、匿名展示設定 |
| GET | `/api/mirror-card/me` | 取得自己的 Mirror Card |
| PATCH | `/api/mirror-card/me` | 更新自己的 Mirror Card 公開設定與可展示欄位 |
| GET | `/api/mirror-card/[slug]` | 取得 Public / Basic / Detailed Mirror Card，根據權限裁切資料 |
| POST | `/api/mirror-card/image` | 儲存或生成 Mirror Card 圖片，第二階段可做 |

### 14.2 Forum

| Method | Endpoint | 說明 |
|---|---|---|
| GET | `/api/forum/posts` | Post 列表，支援 topic、sort、pagination |
| POST | `/api/forum/posts` | 發 Post，檢查登入、限額、內容過濾 |
| GET | `/api/forum/posts/[id]` | Post 詳情與留言 |
| POST | `/api/forum/posts/[id]/comments` | 新增留言 |
| POST | `/api/forum/posts/[id]/like` | 共鳴 / 取消共鳴 |
| POST | `/api/forum/report` | 檢舉 Post 或 Comment |

### 14.3 Inbox

| Method | Endpoint | 說明 |
|---|---|---|
| GET | `/api/inbox/threads` | Thread 列表與未讀狀態 |
| GET | `/api/inbox/threads/[id]` | Thread 訊息內容 |
| POST | `/api/inbox/send` | 主動寄信或回覆 |
| POST | `/api/inbox/read` | 標記已讀 |
| POST | `/api/inbox/report` | 檢舉訊息 |
| POST | `/api/inbox/block` | 封鎖用戶 |

### 14.4 Matching

| Method | Endpoint | 說明 |
|---|---|---|
| POST | `/api/match/run` | 管理員或排程觸發配對 |
| GET | `/api/match/inbox-results` | 查詢我的配對卡 |
| POST | `/api/match/create-inbox-card` | 將配對結果寫入 Inbox |

### 14.4.1 Legacy Match Claim

| Method | Endpoint | 說明 |
|---|---|---|
| GET | `/api/match/legacy-claim/status` | 登入後檢查目前 Email 是否命中未認領的 `responses` |
| POST | `/api/match/legacy-claim/request` | 建立認領申請，必要時寄出一次性認領 link |
| POST | `/api/match/legacy-claim/confirm` | 確認認領，寫入 `responses.user_id` 與 `legacy_match_claims` |
| POST | `/api/admin/match/legacy-claim/resolve` | Admin 手動通過 / 拒絕 disputed claim |

認領 API 必須遵守：

- 只有登入用戶可呼叫。
- 自動認領前必須確認 Supabase Auth Email 已驗證。
- 不回傳完整舊問卷內容，只回傳「找到幾筆、最近提交日期、是否可認領」。
- 若命中多筆舊資料，預設只讓用戶認領最新一筆，其餘歸檔。
- IG/TG 命中不得自動認領，只能產生 pending / disputed claim。

### 14.5 Subscription

| Method | Endpoint | 說明 |
|---|---|---|
| POST | `/api/billing/create-checkout-session` | 建立 Stripe Checkout |
| POST | `/api/billing/webhook` | Stripe webhook |
| GET | `/api/billing/status` | 查詢訂閱狀態 |
| POST | `/api/billing/manual-verify` | 管理員手動開通，若採 PayMe / FPS |

### 14.6 權限檢查共用邏輯

建議建立共用 helper：

- `requireUser(req)`：檢查登入。
- `getSubscriptionTier(userId)`：取得會員等級。
- `canViewDetailedMirrorCard(viewerId, targetId, source)`：判斷是否可看 Detailed Mirror Card。
- `canSendActiveLetter(senderId, targetId)`：判斷是否可主動投信。
- `consumeQuota(userId, quotaType)`：扣除配額。
- `checkUserBlock(senderId, recipientId)`：檢查封鎖狀態。

---

## 十五、前端頁面與使用流程

### 15.1 建議新增頁面

| 頁面 | 路徑 | 說明 |
|---|---|---|
| 登入 | `/login` | Email + Password |
| 註冊 | `/signup` | 建立帳號與暱稱 |
| 我的 Mirror Card | `/mirror-card/me` | 編輯、預覽、下載、分享 Mirror Card |
| 公開 Mirror Card | `/mirror-card/[slug]` | Public / Basic / Detailed Mirror Card 視權限展示 |
| 收件箱 | `/inbox` | Thread 列表 |
| 信件詳情 | `/inbox/[threadId]` | 非即時站內信 |
| 討論區列表 | `/forum` | Post feed |
| 討論區詳情 | `/forum/[postId]` | Post + comments |
| Premium | `/premium` | 付費牆與方案說明 |
| 訂閱成功 | `/billing/success` | 支付完成導回 |

### 15.2 首次登入 Onboarding

```
註冊 / 登入
  ↓
檢查 Email 是否命中舊 responses
  ↓
若命中 → 引導認領舊 MatchCard / 配對問卷資料
  ↓
若沒有 Mirror Card → 引導完成 Mirror Mode
  ↓
若沒有配對問卷 → 可選擇填寫以加入配對池
  ↓
產生公開卡與分享 CTA
  ↓
導向 Forum 或 Inbox
```

### 15.2.1 舊配對資料認領提示

登入後若系統找到同 Email 的未認領 `responses`，前端應顯示低壓提示：

```text
搵到你之前填過嘅配對資料。
認領後可以保留舊配對答案，之後配對卡會直接送入你嘅 Inbox。
```

用戶可選：

- 立即認領。
- 稍後再處理。
- 這不是我的資料。

若用戶選擇「這不是我的資料」，該 response 進入 disputed 狀態，避免被同帳號再次自動提示。

### 15.3 Forum 到 Premium 的轉化流程

```
用戶瀏覽 Forum
  ↓
看到有共鳴的 Post / Comment
  ↓
點擊作者暱稱
  ↓
Free：顯示公開卡 + 付費解鎖詳細卡 CTA
Premium：顯示詳細卡 + 主動投信 CTA
```

### 15.4 Inbox 互動流程

```
用戶收到配對卡 / 信件
  ↓
Inbox 未讀數增加
  ↓
用戶打開 thread
  ↓
閱讀對方卡片摘要與訊息
  ↓
可回覆、封存、檢舉、封鎖
```

---

## 十六、通知與 Email 策略

### 16.1 通知類型

| 類型 | Free | Premium |
|---|---|---|
| 配對成功 | 批量 Email 或站內提示 | 即時 Email + Inbox 高亮 |
| 收到信件 | 可每日摘要 | 即時 Email 可選 |
| 討論區留言 | 站內提示 | 站內提示 + 可選 Email |
| 系統通知 | Email | Email |

### 16.2 Email 原則

- Email 不包含敏感個人資料。
- Email 只提示「你有新的配對 / 信件」，引導回站內查看。
- 用戶可取消非必要 Email。
- 安全、付款、帳號通知不可取消。

---

## 十七、安全、隱私與內容治理

### 17.1 隱私原則

- Email 永不公開。
- IG / 現實社交帳號不預設公開。
- 前端不展示 raw user id。
- 用戶可刪除或隱藏 Mirror Card。
- 用戶可封鎖其他用戶。

### 17.2 內容過濾

延續現有 `content-filter` 概念，覆蓋：

- Forum Post。
- Forum Comment。
- Inbox Message。
- Mirror Card bio。
- Drift Bottle 回聲延伸訊息。

### 17.3 Rate Limit 建議

| 行為 | 限制 |
|---|---|
| 註冊 | 每 IP 每小時 5 次 |
| 登入失敗 | 每 Email / IP 每 15 分鐘 5 次 |
| 發 Post | Free 每日 1；Premium 每日 5 |
| 留言 | 每小時 30 則 |
| 主動投信 | Premium 每月 5 封 |
| 回覆信件 | 每小時 20 則 |
| 檢舉 | 每小時 5 次 |

### 17.4 檢舉與管理員處理

| 對象 | 行為 |
|---|---|
| Mirror Card | 檢舉假冒、騷擾、違規內容 |
| Post | 檢舉公開內容 |
| Comment | 檢舉留言 |
| Message | 檢舉站內信 |

管理員後台需能：

- 查看檢舉列表。
- 隱藏內容。
- 限制或停權用戶。
- 恢復誤判內容。
- 查看用戶封鎖與檢舉紀錄。

### 17.5 Row Level Security

若直接從前端使用 Supabase client，必須設計 RLS。若所有敏感操作都走 Next.js API route，也仍建議保留 RLS 作第二層防護。

核心規則：

- 用戶只能讀寫自己的 account profile 欄位。
- Public Mirror Card 只能讀取公開欄位。
- Inbox message 只有 sender / recipient 可讀。
- Forum hidden content 只有 admin 可讀。
- Subscription 只有本人與 admin 可讀。

---

## 十八、數據指標與營運後台

### 18.1 核心產品指標

| 指標 | 說明 |
|---|---|
| 註冊轉化率 | 分享卡訪客 → 註冊 |
| Mirror Card 完成率 | 註冊後完成 Mirror Card 比例 |
| Forum 日活 | 每日查看 / 發文 / 留言用戶 |
| Inbox 開信率 | 收到訊息後打開比例 |
| 配對回覆率 | 配對卡進 Inbox 後回信比例 |
| Premium 轉化率 | Free → Premium |
| 主動投信使用率 | Premium 每月 5 封額度使用情況 |
| 留存率 | D1 / D7 / D30 |

### 18.2 後台新增功能

| 頁面 | 功能 |
|---|---|
| 用戶管理 | 查 account profile、Mirror Card、會員狀態、停權 |
| Forum 管理 | 查 Post / Comment、隱藏、置頂 |
| Inbox 風控 | 查被檢舉訊息，不可任意瀏覽所有私信，需審計 |
| Premium 管理 | 查看訂閱、手動開通、取消 |
| 成長分析 | 分享卡點擊、註冊、付費漏斗 |

### 18.3 隱私審計

管理員查看私信或敏感資料時，應記錄：

- admin id。
- viewed user / message id。
- reason。
- timestamp。

---

## 十九、開發階段 Roadmap

### Phase 1：會員註冊與 Mirror Card 基礎

**目標：建立身份與裂變入口。**

需求：

- 導入 Supabase Auth。
- 建立 `profiles`、`mirror_cards`。
- 為既有 `responses` 新增 `user_id`、`claim_status`、`claimed_at` 等認領欄位。
- 建立 `legacy_match_claims` 認領審計表。
- 完成登入、註冊、登出。
- 完成舊配對資料 Email 自動認領流程。
- Mirror Mode 結果可綁定登入用戶。
- 建立 `/mirror-card/me` 與 `/mirror-card/[slug]`。
- 支援公開卡分享 URL。
- 支援前端生成分享圖片。

驗收：

- 新用戶可註冊並生成 Mirror Card。
- 舊 match 用戶以相同 Email 註冊後，可認領既有 `responses`。
- 認領成功後，`responses.user_id` 會指向登入帳號。
- 同 Email 多筆 responses 不會同時變成 active，需有 latest active / duplicate 歸檔策略。
- 未登入訪客可打開公開分享卡。
- Email 不會出現在公開卡。
- 用戶可更新卡片並看到最新內容。

### Phase 2：Forum 與 Inbox 串連

**目標：建立日常互動與非即時私信。**

需求：

- 建立 `forum_posts`、`forum_comments`。
- 建立 `inbox_threads`、`inbox_messages`。
- 完成 Forum 列表、發文、留言、檢舉。
- 完成 Inbox thread 列表、讀信、回信。
- 配對結果可寫入 Inbox。
- Free / Premium 權限 helper 初版。

驗收：

- Free 每日只能發 1 篇 Post。
- Premium 每日可發 5 篇 Post。
- 已配對對象可互相回信。
- Premium 可主動寄信，且月額會扣除。
- 被封鎖用戶不可再寄信。

### Phase 3：Premium 與金流落地

**目標：建立實際變現能力。**

需求：

- 建立 `subscriptions`、`usage_quotas`。
- Stripe Checkout 或手動付款 MVP。
- 建立 `/premium` paywall。
- 實作詳細卡解鎖。
- 實作 Premium 即時通知。
- 後台可查看與管理訂閱狀態。

驗收：

- 成功付款後用戶變成 Premium。
- Premium 到期後自動轉回 Free。
- 詳細卡與主動投信受權限控制。
- Webhook 失敗不會錯誤開通權限。

### Phase 4：漂流瓶深度整合與成長優化

**目標：把現有浪漫入口轉化為社交留存。**

需求：

- 登入用戶可選擇投匿名登入瓶。
- 共鳴回聲可引導投月光信。
- 分享卡追蹤來源。
- Forum 推薦排序優化。
- Premium 功能包與價格 A/B 測試。

---

## 二十、驗收標準

### 20.1 MVP 必須完成

- 用戶可註冊 / 登入 / 登出。
- 舊 match 問卷資料可透過已驗證 Email 認領並連結到登入帳號。
- 用戶可建立並分享 Mirror Card。
- Forum 可發文、留言、查看作者公開卡。
- Inbox 可收到配對卡與站內信。
- Free / Premium 權限有清晰區隔。
- Premium 可查看詳細卡與主動投信。
- 內容過濾、檢舉、封鎖可用。

### 20.2 不納入 MVP

- 即時聊天室。
- WebSocket。
- 群組聊天。
- 語音 / 圖片私信。
- 複雜推薦演算法。
- 多層留言樹。
- 原生 App。

### 20.3 品質標準

- 所有私密 API 必須檢查登入。
- 權限判斷不能只靠前端隱藏按鈕。
- 付費權限必須由後端判斷。
- 所有用戶輸入需經內容過濾。
- Forum 與 Inbox 需有分頁。
- Email 不得洩露對方敏感資料。
- 舊 `responses` 不得只因 IG/TG 相似就自動合併到登入帳號。
- 舊資料認領需有審計紀錄，並能由 Admin 查詢與回復 disputed case。

---

## 二十一、待確認問題

1. Premium 月費價格是多少？建議先測 HKD 38 / 58 / 78 三檔。
2. Premium 是否增加每月配對數量，還是只提供即時通知？
3. 詳細卡是否包含 IG？若包含，是否需要雙方同意才展示？
4. Forum 是否允許未登入訪客查看全部 Post，還是只展示部分內容？
5. 主動投信每月 5 封是否可加購？
6. Free 用戶是否能在討論區查看公開卡，還是只顯示暱稱與貓咪家族？
7. PayMe / FPS 是否需要先支援，還是直接用 Stripe？
8. 漂流瓶是否維持完全匿名為主，登入整合只作 optional？
9. 舊 `responses.email` 是否足夠完整與可信，可否作為自動認領主鍵？
10. 同一 Email 多次填 match 問卷時，是否只保留最新一份 active？
11. 舊資料認領後，是否允許用戶刪除或重新填寫配對答案？
12. 舊 IG/TG 命中但 Email 不同的 case，要不要提供人工認領表單？

---

## 附錄 A：核心開發任務拆分建議

| Epic | 任務 |
|---|---|
| Auth | Supabase Auth 初始化、session helper、登入註冊頁 |
| Legacy Match Claim | `responses.user_id` migration、Email 認領 API、`legacy_match_claims` 審計表 |
| Mirror Card | `mirror_cards` 資料表、卡片 API、公開頁、編輯頁、分享圖片 |
| Forum | Post CRUD、Comment、Like、Report、列表排序 |
| Inbox | Thread、Message、Read state、Block、Report |
| Matching Integration | match result 寫入 Inbox、配對卡 payload |
| Premium | subscription table、quota table、paywall、permission helper |
| Billing | Stripe Checkout、Webhook、管理員手動開通 |
| Admin | 用戶、內容、訂閱、檢舉管理 |
| Safety | content-filter 擴展、rate limit、RLS、audit log |

---

## 附錄 B：最小可行版本建議

若希望最快推出並測試付費意願，建議最小版本如下：

1. Supabase Auth + 舊 match 資料 Email 認領。
2. Mirror Card 分享。
3. Forum 列表、發文、留言。
4. 點擊作者只能看公開卡；詳細卡需要 Premium。
5. Premium 暫時用 FPS / PayMe 手動開通。
6. Inbox 先只支援 Premium 主動投信與已配對回覆。
7. Stripe 與漂流瓶整合延後。

這個版本能最快驗證兩件事：

- 用戶會不會因為 Forum 與分享卡回來。
- 用戶會不會為「查看詳細卡」和「主動投信」付費。
