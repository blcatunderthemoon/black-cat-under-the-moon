# Supabase 資料備份指南

> 最後更新：2026-07-09

本文件說明如何定期備份 Black Cat Under The Moon 專案中**最關鍵的四張 Supabase 表**，以及備份檔的格式、排程與還原注意事項。

---

## 一、備份範圍

| 表名 | 內容 | 為何要備份 |
|------|------|------------|
| `profiles` | 註冊用戶檔案、訂閱 tier、論壇角色等 | 帳戶與權限狀態 |
| `responses` | 問卷回覆（配對演算法主資料） | 全站配對與用戶問卷 |
| `sent_matches` | 已發送配對記錄 | 郵件／Inbox 發送歷史、每月配額計數 |
| `subscriptions` | PayPal／人手 Premium 訂閱 | 付費會員狀態 |

**未包含：** `inbox_*`、`forum_*`、`email_drafts` 等表。若日後需要，可在 `scripts/backup-supabase-tables.mjs` 的 `TABLES` 陣列加入。

---

## 二、快速開始

### 前置條件

專案根目錄 `.env.local` 需有：

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

必須使用 **Service Role Key**（非 anon key），才能讀取全部列。

### 手動執行

```bash
npm run backup:supabase
```

成功後會在 `backups/supabase-YYYY-MM-DD_HHMMSS/` 產生：

```
backups/supabase-2026-07-09_234126/
├── profiles.csv
├── responses.csv
├── sent_matches.csv
├── subscriptions.csv
└── manifest.json
```

### 指令選項

```bash
# 只保留最近 14 次備份（預設 30）
node scripts/backup-supabase-tables.mjs --keep=14

# 自訂輸出目錄
node scripts/backup-supabase-tables.mjs --out=D:\Backups\blackcat

# 同時輸出 CSV + JSON
node scripts/backup-supabase-tables.mjs --format=both

# 只輸出 JSON
node scripts/backup-supabase-tables.mjs --format=json
```

---

## 三、CSV 格式

- **預設格式：** CSV（與 Supabase Table Editor 匯出類似）
- **編碼：** UTF-8 with BOM（方便 Windows Excel 正確顯示中文）
- **欄位順序：** 與 API 回傳的欄位順序一致（見 `manifest.json` 內 `columns`）
- **空值：** 空白儲存格
- **JSON / 陣列欄位：** 以 JSON 字串寫入單一儲存格（例如 `profiles.notification_prefs`）
- **含逗號或換行的內容：** 以雙引號包裹，內部 `"` 轉為 `""`

`manifest.json` 範例：

```json
{
  "created_at": "2026-07-09T15:41:26.175Z",
  "format": "csv",
  "tables": {
    "sent_matches": {
      "count": 820,
      "columns": ["id", "user_a_id", "user_b_id", "match_score", "sent_at", "notes"],
      "files": ["sent_matches.csv"]
    }
  }
}
```

---

## 四、定期排程（Windows）

建議**每週至少一次**；若經常手動改 `sent_matches`，可改為每日。

### 工作排程器設定

1. 開啟 **工作排程器** → **建立基本工作**
2. **觸發程序：** 每週（或每日）指定時間
3. **動作：** 啟動程式
   - **程式：** `powershell.exe`
   - **引數：**
     ```
     -NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Users\lhuen\OneDrive\桌面\BlackCatUnderTheMoon'; npm run backup:supabase"
     ```
4. 勾選「以最高權限執行」（若路徑權限需要）

### 建議

- 將 `backups/` 資料夾同步到 OneDrive 其他目錄或外置硬碟
- `backups/` 已加入 `.gitignore`，**切勿 commit**（含 email、問卷等敏感資料）

---

## 五、還原與資料救援

本備份為**表級匯出**，適合：

- 誤刪 `sent_matches` 後，從舊 CSV 補回特定列
- 離線查閱歷史發送記錄
- 與現有 DB 做 diff 比對

### 還原 `sent_matches` 單筆（Supabase SQL Editor）

從 CSV 找到對應列後：

```sql
INSERT INTO sent_matches (user_a_id, user_b_id, match_score, sent_at, notes)
VALUES (387, 453, 70, '2026-07-09T14:47:48.968605+00:00', '從備份還原')
ON CONFLICT (user_a_id, user_b_id) DO NOTHING;
```

### 從備份比對缺失列

1. 開啟較早的 `sent_matches.csv`
2. 與現有 DB `SELECT * FROM sent_matches` 結果比對 `user_a_id` + `user_b_id`
3. 只補**確認曾成功發送**的列，避免重複計入配額

### 不適用於

- 整庫時間點還原（需 Supabase **Pro** 備份 / PITR）
- 自動還原腳本（目前未內建；可日後加 `restore-sent-matches.mjs`）

---

## 六、與 Supabase 官方備份的差異

| 方式 | Free plan | 本機 CSV 備份 |
|------|-----------|----------------|
| 自動每日備份 | ❌ | ✅（自行排程） |
| 一鍵還原整庫 | ❌ | ❌ |
| 單表可讀、可匯入 Excel | 需手動匯出 | ✅ |
| 救回誤刪 `sent_matches` | 困難 | ✅（若有備份檔） |

**Free plan 建議：** 依賴本腳本 + 異地保存 CSV，作為 `sent_matches` 等關鍵表的安全網。

---

## 七、相關檔案

| 路徑 | 說明 |
|------|------|
| `scripts/backup-supabase-tables.mjs` | 備份腳本 |
| `package.json` → `backup:supabase` | npm 指令 |
| `backups/` | 輸出目錄（gitignore） |
| `scripts/verify-pair-score.mjs` | 驗證單一配對分數（非備份） |

---

## 八、故障排除

| 問題 | 處理 |
|------|------|
| `Missing SUPABASE_SERVICE_ROLE_KEY` | 檢查 `.env.local` |
| Excel 亂碼 | 用「資料 → 自文字檔」並選 UTF-8；或直接依賴 BOM |
| 某表 `order by id` 失敗 | 該表可能無 `id` 欄；需改腳本排序欄位 |
| 備份太大 | 調小 `--keep`；或改 `--out` 到外置碟 |
| 想備份更多表 | 編輯腳本內 `TABLES` 陣列 |

---

## 九、營運檢查清單

- [ ] 已設定 Windows 定期排程（或手動每週執行）
- [ ] `backups/` 有同步到第二份儲存位置
- [ ] 確認最新一次 `manifest.json` 的 `count` 合理
- [ ] 已部署防止誤刪 `sent_matches` 的 dashboard 修復（見 `email-automation.js`）
- [ ] 重要操作（大批量手動新增／刪除）前先跑一次 `npm run backup:supabase`
