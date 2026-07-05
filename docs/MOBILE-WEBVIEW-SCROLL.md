# Mobile WebView 捲動與頁尾顯示指南

本文件說明 **Black Cat Under The Moon** 在 mobile browser 與 in-app WebView（LINE、Instagram、Facebook 內建瀏覽器等）中，為何會出現「無法向下捲動、看不到 footer / 頁尾內容」的問題，以及**正確的修復方式與防呆規範**。

> 若你正在改 layout、新增靜態頁、或 Next.js 頁面 shell，請先讀本文再動 CSS / JS。

---

## 目錄

- [症狀](#症狀)
- [根本原因](#根本原因)
- [正確做法：Natural document scroll](#正確做法natural-document-scroll)
- [專案中的實作位置](#專案中的實作位置)
- [新增或修改頁面時的檢查清單](#新增或修改頁面時的檢查清單)
- [常見錯誤模式（禁止）](#常見錯誤模式禁止)
- [除錯步驟](#除錯步驟)
- [例外情況](#例外情況)
- [變更紀錄摘要](#變更紀錄摘要)

---

## 症狀

在 mobile / WebView 中可能出現：

- 頁面底部內容被裁切（例如 mode-select 的 Ko-fi 連結、legal footer）
- 手指滑動無法捲到 footer
- DevTools 中 footer **存在於 DOM**，但不在可視範圍內
- 論壇 `/forum` 貼文列表只能看到前幾則，無法捲到「載入更多」或頁尾
- 配對卡 drawer 內容過長時底部被截斷

這些問題在 **桌面 Chrome 正常**，但在 **mobile WebView 特別常見**。

---

## 根本原因

以下任一組合都可能導致 scroll 失效：

### 1. `position: fixed` 全屏面板 + 內部 scroll

Landing 的 `#welcome`、`#mode-select` 原本為：

```css
.welcome-screen,
.mode-select-screen {
  position: fixed;
  inset: 0;
  overflow-y: scroll;
}
```

在許多 WebView 中，**fixed 容器內的 overflow scroll 不可靠**；footer 在面板外或面板高度未正確撐開 document 時，整頁無法捲動。

**修復：** mobile 上改為 **document flow**（`position: relative`、`height: auto`、`overflow: visible`），讓整份 document 變長，由 viewport 捲動。

### 2. 雙 scroll 容器（html 與 body 同時可 scroll）

```css
html, body {
  overflow-y: auto !important;
}
```

WebView 常無法決定哪一層在捲，導致 touch 事件被吃掉。

**修復：** mobile 上 **只讓 document 自然捲動**——`html` / `body` 皆 `overflow-y: visible`、`height: auto`，內容撐高 document。

### 3. `html { overflow: hidden; height: 100% }` + `body { height: auto }`

此組合會 **裁切 body 超出 viewport 的部分**：

- `html` 高度鎖在 viewport（例如 915px）且 `overflow: hidden`
- `body` 雖然長到 1800px，但被 `html` 裁掉
- `body` 自身高度等於內容高度，**body 內部也不會產生 scroll**

結果：底部內容完全 unreachable。**此模式在本專案曾造成 regression，禁止再用。**

### 4. JS 量測高度 + spacer（feedback loop）

曾嘗試用 JS 量測 footer 位置，設定：

- `--landing-scroll-h`
- `body { min-height: …px }`
- `#mobile-doc-scroll-spacer { height: 7000px }`

每次量測會把 **上一輪 spacer / min-height 算進 `scrollHeight`**，高度指數膨脹（例如 8000px+），scroll 行為更混亂。

**修復：** 移除量測與 spacer；document 高度由 **真實 DOM 內容** 決定。

### 5. Flex 子項 `flex: 1` + `min-height: 0`（Next.js app shell）

論壇頁 `.app-page--forum .app-main` 若為：

```css
.app-main {
  flex: 1;
  min-height: 0;
}
```

主內容會 **縮進 viewport**，長列表 overflow 但不撐高頁面，footer  unreachable。

**修復：** forum / 需完整 document scroll 的頁面，main 使用 `flex: 0 0 auto`、`min-height: auto`。

---

## 正確做法：Natural document scroll

Mobile / coarse pointer 的 **唯一推薦模式**：

```css
@media (max-width: 768px), (hover: none) and (pointer: coarse) {
  html {
    overflow-x: clip;
    overflow-y: visible;
    height: auto;
    min-height: 100%;
  }

  body:not(.quiz-viewport):not(.body-scroll-locked) {
    overflow-x: clip;
    overflow-y: visible;
    height: auto;
    min-height: 100dvh;
    position: relative;
  }
}
```

原則：

| 項目 | 做法 |
|------|------|
| Scroll 表面 | **Viewport / document**（預設行為） |
| `html` / `body` | `height: auto`，`overflow-y: visible` |
| 全屏 UI 面板 | mobile 改 **in-flow**（`position: relative`） |
| Footer | 放在 document flow 末尾，**不要**放在 fixed 容器內獨立 scroll |
| JS | 只負責 landing 面板 in-flow + 清 legacy inline style；**不要**量測高度 |

### Mobile 頁尾留白（CSS 變數）

全站 mobile 底部留白由 `public/css/mobile-webview-scroll.css` 的 `:root` 變數統一控制：

| 變數 | 預設 | 用途 |
|------|------|------|
| `--mobile-page-bottom-gap` | `12px` | landing 面板、`.app-main`、legal `.page` 等內容區底部間距 |
| `--mobile-footer-inner-pad` | `8px` | footer 文字下方 + `env(safe-area-inset-bottom)` |
| `--mobile-legal-page-bottom` | `12px` | 靜態 legal 頁 `.page` 底部 |

**禁止**在 mobile 上對 landing 面板使用 `padding-bottom: 64px / 128px` 等量測用留白；safe area 只加在 **footer** 一次，不要 panel 與 footer 重複累加。

調整全站 footer 鬆緊時，只改上述變數即可。

Landing 面板 in-flow 範例：

```css
#welcome.welcome-screen:not(.hiding),
#mode-select.mode-select-screen.active {
  position: relative !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}
```

Next.js app shell 範例（論壇等長列表頁）：

```css
.app-page--forum .app-main {
  flex: 0 0 auto !important;
  min-height: auto !important;
  overflow: visible !important;
}
```

---

## 專案中的實作位置

| 用途 | 檔案 |
|------|------|
| **Site-wide mobile scroll CSS（主要來源）** | `public/css/mobile-webview-scroll.css` |
| Landing / 問卷相關 mobile 規則 | `public/css/questionnaire.css`（檔案末尾 `@media` 區塊） |
| 靜態頁 top bar + 部分 mobile 規則 | `public/css/auth-nav.css`（末尾 mobile 區塊） |
| Next.js global mobile 規則 | `src/styles/globals.css` |
| Next.js 頁面 mobile 微調 | `src/styles/mobile.css` |
| 論壇 / app shell 樣式 | `src/styles/pixel-theme.css` |
| Landing in-flow JS | `public/js/mobile-document-scroll.js` |
| Next.js 載入 scroll helper | `src/pages/_app.js`（`mobile-webview-scroll.css` + Script） |

### 靜態 HTML 頁必須包含

```html
<link rel="stylesheet" href="css/mobile-webview-scroll.css">
<script src="/js/mobile-document-scroll.js"></script>
```

（路徑依頁面深度調整，例如 `index.html` 用 `/js/...`）

已接入的靜態頁包括：`index.html`、`match.html`、`mirror.html`、`drift-bottle.html`、legal 頁等。  
**新增靜態頁時請一併加入。**

### Landing 專用 markup

`index.html` 的 welcome / mode-select 內嵌 footer 需保留 scroll anchor（供 CSS / 除錯，非 JS 量測）：

```html
<footer class="site-footer site-footer--legal site-footer--embedded">…</footer>
<div class="mode-select-scroll-end" aria-hidden="true"></div>
```

Next.js 頁使用 `AppShell` 底部的 `<SiteLegalFooter />`（class：`site-footer--app`）。

---

## 新增或修改頁面時的檢查清單

在 PR 合併前，用 **Chrome DevTools → mobile emulation**（或實機 WebView）確認：

- [ ] 頁面可捲至 **最底部 legal footer** 全文可見
- [ ] `document.documentElement.scrollHeight` **>** `window.innerHeight`
- [ ] `<html>` computed：`overflow-y` 為 `visible`（非 `hidden`）
- [ ] `<body>` computed：`overflow-y` 為 `visible`；**無** 異常 `min-height: 8000px` 等 inline style
- [ ] DOM 中 **不存在** `#mobile-doc-scroll-spacer`
- [ ] 無 `--landing-scroll-h` inline 變數
- [ ] 主要內容區 **非** `position: fixed` + `overflow-y: auto`（landing 除外且 mobile 已 in-flow）
- [ ] Flex 主內容 **非** `flex: 1; min-height: 0` 導致列表被 clip（論壇 / inbox 等）
- [ ] Viewport meta 含 `viewport-fit=cover`（已有 safe-area 的頁面）

### 新增 Next.js 頁

- [ ] 使用 `AppShell`，footer 由 `SiteLegalFooter` 輸出
- [ ] 確認 `_app.js` 已載入 `mobile-webview-scroll.css` 與 `mobile-document-scroll.js`（全站預設已載入）
- [ ] 若為長列表頁，`.app-main` 需能隨內容增高（參考 `.app-page--forum` 規則）

### 新增靜態 HTML 頁

- [ ] 載入 `mobile-webview-scroll.css` + `mobile-document-scroll.js`
- [ ] Footer 放在 `.page` / main content **之後**，處於 document flow
- [ ] 避免在 `html, body` 上再加 `overflow-y: auto !important`

---

## 常見錯誤模式（禁止）

| 禁止 | 原因 |
|------|------|
| `html { overflow: hidden; height: 100% }` + 長內容 body | 裁切 document，無法 scroll |
| JS 設定 `body.min-height` / `--landing-scroll-h` / scroll spacer | feedback loop、高度爆炸 |
| `html, body { overflow-y: auto !important }` 同時設定 | 雙 scroll 容器 |
| Mobile 全屏 `position: fixed` + 內部 `overflow-y: scroll` | WebView 內 scroll 常失效 |
| `.app-main { flex: 1; min-height: 0 }`  on 長列表頁 | 內容被 flex 裁切 |
| `touch-action: none` 或 touchmove `preventDefault`（全頁） | 阻擋原生 scroll |
| 在 questionnaire.css 再加與 `mobile-webview-scroll.css` **衝突** 的 landing overflow 規則 | 後載順序造成 regression |

若必須鎖 scroll（modal 開啟），只用既有 API：

```js
MobileDocumentScroll.setBodyScrollLocked(true);  // 關閉
MobileDocumentScroll.setBodyScrollLocked(false); // 還原
```

並確保 `body.body-scroll-locked` 樣式未被其他規則覆寫。

---

## 除錯步驟

1. **Hard refresh**（Ctrl+Shift+R），清除舊版 JS 寫入的 inline style。
2. DevTools → Elements → 選 `<html>`、`<body>`，查看 **Computed**：
   - `overflow-y`
   - `height` / `min-height`
   - 是否有 inline `style="..."` 來自舊 script
3. Console：

```js
({
  innerHeight: window.innerHeight,
  docScrollHeight: document.documentElement.scrollHeight,
  bodyScrollHeight: document.body.scrollHeight,
  htmlOverflow: getComputedStyle(document.documentElement).overflowY,
  bodyOverflow: getComputedStyle(document.body).overflowY,
  spacer: !!document.getElementById('mobile-doc-scroll-spacer'),
  landingVar: document.documentElement.style.getPropertyValue('--landing-scroll-h'),
})
```

預期：`docScrollHeight > innerHeight`；`spacer` 為 `false`；`landingVar` 為空字串。

4. 檢查 **哪一層** 有 `overflow: hidden` 且高度被限制：

```js
[...document.querySelectorAll('html, body, #__next, .app-page, .app-main')]
  .filter(Boolean)
  .map(el => ({
    tag: el.className || el.tagName,
    oy: getComputedStyle(el).overflowY,
    h: getComputedStyle(el).height,
    sh: el.scrollHeight,
    ch: el.clientHeight,
  }))
```

若某層 `clientHeight < scrollHeight` 且 `overflow-y: hidden`，即為 clip 來源。

5. Landing 頁確認 `#mode-select` computed 為 `position: relative`（mobile），非 `fixed`。

---

## 例外情況

以下場景 **刻意** 不使用全頁 document scroll：

| 場景 | 做法 |
|------|------|
| Match / Mirror **問卷進行中** | `body.quiz-viewport`：固定 viewport，`.main-container` 內部 scroll（見 `auth-nav.css`） |
| Modal / drawer 開啟 | `body.body-scroll-locked`；關閉後呼叫 `setBodyScrollLocked(false)` |
| Match card drawer（mobile） | `.match-card-drawer__body { overflow-y: auto }`——drawer **內部** scroll，非整頁 |
| Forum compose overlay | overlay 自身 scroll；關閉後還原 body |

新增例外前請評估：是否能在 mobile WebView 實機驗證。

---

## 變更紀錄摘要

| 時期 | 做法 | 結果 |
|------|------|------|
| 初期 | fixed 面板 + 內部 scroll | WebView 常無法捲到 footer |
| 中期 | html scroll + JS 量測 `--landing-scroll-h` + spacer | feedback loop，頁面高度異常 |
| 中期 | html locked + body scroll | body 被 html 裁切，更糟 |
| **現行** | natural document scroll + landing in-flow | 穩定；footer 隨 document 增高 |

**維護原則：** 優先改 `mobile-webview-scroll.css`；避免在多处重复添加冲突的 `html/body overflow` 规则。若需调整 landing，同步检查 `mobile-document-scroll.js` 是否仅做 in-flow，不做高度量测。

---

## 相關文件

- [README.md](../README.md) — 疑難排解
- `public/css/mobile-webview-scroll.css` — 實作來源
- `public/js/mobile-document-scroll.js` — Landing helper

如有新頁面類型（例如全屏 wizard），請在本文件 **例外情況** 一節補充並在 PR 描述中連結本文。
