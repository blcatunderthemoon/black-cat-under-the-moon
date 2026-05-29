# 靈魂鏡像 Mirror Mode — 問題與計分邏輯說明

**版本**：v2.1（2026-05-26）  
**問卷入口**：`index.html` → Mirror Mode（靈魂鏡像）

---

## 一、概覽

Mirror Mode（靈魂鏡像）是一個**自我探索型問卷**，共 15 題（5 題基本資料 ＋ 10 題心理測驗），分三個階段。  
作答完成後，系統會根據得分判斷使用者屬於哪個「貓咪家族」，並可下載性格卡片。

| 項目 | 內容 |
|------|------|
| 基本資料題 | 5 題（Label / MBTI 星座 / 喜好 / 音樂 / 電影），**不計分** |
| 心理測驗題 | 10 題（每題單選，4 個選項）|
| 領域數 | 3 個領域（親密節奏 3 題、情感語言 4 題、安全感基礎 3 題）|
| 輸出類型 | 主類型（1 個）＋影子類型（可選，最多 1 個）|
| 計分單位 | 每題加 2 分給對應類型，滿分每類最高 20 分 |

---

## 二、貓咪家族（四種人格類型）

| 代號 | 中文名 | 英文名 | 顏色 | 核心特質 |
|------|--------|--------|------|----------|
| `solitary` | 獨處貓家族 | The Solitary Moon | #bd93f9（紫） | 重視個人空間、低頻高質陪伴、獨立自主 |
| `sunny` | 暖陽貓家族 | The Sunny Tether | #ff6b9d（粉） | 直率熱烈、明確承諾、高溝通需求 |
| `mystical` | 秘境貓家族 | The Mystical Depth | #00e5ff（青） | 情感共鳴深、靈魂對話、重視被理解 |
| `sentinel` | 守護貓家族 | The Eternal Sentinel | #50fa7b（綠） | 穩定安全感、長期規劃、規律相處 |

### 各類型描述（性格卡片用文字）

**獨處貓家族**  
> 你是一隻住在月亮上的貓，愛情對你來說是點綴，而不是全部。你不是不愛，只是你的愛需要空間才能呼吸。

**暖陽貓家族**  
> 你喜歡曬太陽，也希望對方的世界裡只有溫暖。你的愛是直接的，你要的也是清晰而公開的。

**秘境貓家族**  
> 你潛伏在黑夜深處，只為等待那個能聽懂你頻率的人。道理不重要，被理解才是你最深的渴望。

**守護貓家族**  
> 你是守護壁爐的貓，最怕變動與突如其來的驚嚇。你的愛是一種承諾，是每天都會回來的穩定。

---

## 三、題目與選項對照

---

### 第一部分：基本資料（P1–P5，不計分）

**P1** — 你的 Label 是？  
① TB　② TBG　③ Pure　④ Bi　⑤ No Label

**P2** — 你的 MBTI 與星座？  
（MBTI 下拉選單 × 星座下拉選單，純資料收集）

**P3** — 你有哪些日常喜好？（多選，可跳過）  
① 閱讀　② 運動　③ 打遊戲　④ 旅行　⑤ 追劇　⑥ 手作　⑦ 攝影　⑧ 美食　⑨ 音樂　⑩ 電影　⑪ 藝術　⑫ 戶外活動

**P4** — 你喜歡聽哪種音樂？（多選，可跳過）  
① 流行　② 獨立　③ R&B / Soul　④ 電子　⑤ 古典　⑥ 爵士　⑦ 嘻哈　⑧ K-pop　⑨ 搖滾　⑩ 民謠

**P5** — 你喜歡哪種電影類型？（多選，可跳過）  
① 愛情　② 驚悚　③ 科幻　④ 動作　⑤ 動畫　⑥ 文藝　⑦ 紀錄片　⑧ 恐怖　⑨ 喜劇　⑩ 奇幻　⑪ 懸疑

---

### 第二部分：心理測驗（Q1–Q10，計分）

選項固定順序：① solitary　② sunny　③ mystical　④ sentinel，每選一題對應類型加 **2 分**。

#### 領域一：親密與相處節奏（Q1–Q3）

**Q1** — 你與伴侶的理想相處模式與時間分配？ 
① 保持獨立生活，需要大量個人空間作為底線
② 經常見面，個人時間少一點沒關係，伴侶更重要
③ 視乎當下內心狀態，靈魂同頻比相處次數更重要
④ 規律而穩定的相處節奏，能直接影響我的情緒與安心感

**Q2** — 當對方問你在做什麼，或者連續一陣子沒聯絡，你的第一反應是？
① 想保有神秘感與自由，不喜歡事事回報或被追問
② 立刻回覆詳情，若對方太久沒報備會想發訊息確認狀態
③ 想分享當下的心情和感受，多於單純報告行蹤
④ 覺得這是基本關心，樂意告知，也習慣有規律的問候

**Q3** — 伴侶突然臨時取消原定的重要計劃，你會？ 
① 其實有點鬆一口氣，覺得突然多了自由時間也不錯
② 立刻詢問原因，需要一個清晰合理的解釋
③ 感到失落，並開始擔心對方是不是心情不好或有事瞞著我
④ 會有點無所適從，希望對方能提前告知並立刻重新安排

#### 領域二：溝通與情感語言（Q4–Q7）

**Q4** — 對你而言，被愛最深、最讓你心動的時刻是？
① 對方充分信任我，跟我說「你去做你喜歡的事，不用陪我」
② 對方在眾人面前大方、自豪地介紹我，讓我有名分感
③ 對方無需我開口，就能說出「我知道你的感受，不用解釋」
④ 對方默默記著我說過的每件小事，每天規律地傳一句「到家了嗎」

**Q5** — 兩個人吵架或發生衝突後，你傾向如何處理？  
① 各自冷靜，不想在情緒頭上溝通，相信時間能解決問題
② 立刻講清楚，當下就要解決，不讓誤解和悶氣留過夜
③ 希望對方先來擁抱、安撫我的情緒，之後再解釋道理
④ 需要對方明確表態關係仍然安全，承諾不會輕易放棄

**Q6** — 你自己表達愛意時，更偏向哪種方式？
① 給對方充足的自由與個人空間，不隨意干涉
② 直接說出口，透過言語的確認與承諾讓對方踏實
③ 用眼神、氣氛和生活細節，追求「無聲勝有聲」的默契
④ 持續、穩定地出現在對方身邊，用長久的陪伴來證明

**Q7** — 你最希望伴侶能深深明白你的一點是？ 
① 我需要自己的世界和空間，但並不代表我不在乎你
② 我想要的是一段清晰、公開、有長遠承諾的穩定關係
③ 比起對錯和道理，我更需要我的情緒被你理解和接住
④ 即使日子歸於平淡，我也願意與你長久而規律地陪伴彼此

#### 領域三：安全感與未來想像（Q8–Q10）

**Q8** — 什麼樣的狀態，能讓你在這段關係中感到最踏實的安心？  
① 對方完全不干涉我的個人生活與自我發展
② 兩個人有非常明確、共同的未來計劃與前進方向
③ 感到自己被完全包容與理解，在對方眼神中能做真實的自己
④ 我知道只要我需要，無論何時對方都一定會在我身後

**Q9** — 在感情中，哪一種狀況會讓你受傷最深？
① 對方過度依賴、限制我的自由，讓我失去了自我與空間
② 關係不明朗、對方對外模糊我們的關係，遲遲不肯給予定義
③ 當我表達脆弱時，對方不接住我的情緒，反而一直講道理
④ 承諾說了又不算，反覆無常的轉變破壞了關係的穩定感

**Q10** — 你理想中的伴侶，在你的生命中扮演著什麼角色？
① 你生命中的精彩點綴，彼此獨立卻又互相欣賞
② 你的命運共同體，兩個人牽手朝著同一個目標前進
③ 懂你靈魂與沉默的存在，心靈上無話不談
④ 你最安全的避風港，無論外面多風雨，永遠可以安心靠泊

---

## 四、計分機制

### 4.1 分數累積

```
每題：選中選項對應的類型 += 2 分
10 題全選 → 每類最高 20 分，四類總分合計 20 分
```

計分程式碼邏輯（`computeAndShowMirrorResult`）：

```javascript
const scores = { solitary: 0, sunny: 0, mystical: 0, sentinel: 0 };

MIRROR_QUESTIONS.forEach(q => {
  const ans = answers[q.field];
  const optIdx = q.options.indexOf(ans);
  if (optIdx >= 0) {
    scores[q.scores[optIdx]] += 2;   // q.scores = ['solitary','sunny','mystical','sentinel']
  }
});
```

---

### 4.2 主類型判斷

```
主類型 = 四個類型中得分最高者
```

若平分（多個類型同分最高），取陣列排序後第一個（`['solitary','sunny','mystical','sentinel']` 的順序）。

---

### 4.3 影子類型（Shadow Type）

影子類型代表使用者的次要傾向，出現條件：

```
影子類型 = 第二高分的類型
出現條件：第二高分 > 0  AND  第二高分 >= 主類型分數 - 2
```

即分差 ≤ 2 分時才顯示影子類型；分差 > 2 分則不顯示。

```javascript
const sorted = typeOrder.slice().sort((a, b) => scores[b] - scores[a]);
const mainType = sorted[0];
const shadowType =
  (scores[sorted[1]] >= scores[mainType] - 2 && scores[sorted[1]] > 0)
  ? sorted[1]
  : null;
```

**範例：**

| 分數情況 | 主類型 | 影子類型 |
|----------|--------|----------|
| sentinel:10, mystical:8, sunny:2, solitary:0 | sentinel | mystical（差 2，顯示）|
| sentinel:14, mystical:4, sunny:2, solitary:0 | sentinel | 無（差 10，不顯示）|
| sunny:10, solitary:10, mystical:0, sentinel:0 | sunny（陣列順序） | solitary（差 0，顯示）|
| sentinel:20, 其餘皆 0 | sentinel | 無（第二高分為 0）|

---

### 4.4 百分比計算（性格卡片進度條）

```
各類型佔比 % = round(類型分數 ÷ 所有類型分數總和 × 100)
```

若所有類型分數均為 0（未填任何題），分母強制設為 1，避免除以零。

---

## 五、輸出：性格卡片

計算完成後渲染 `#personality-card`。卡片採用**三層資訊架構**，由上至下依次呈現：

### Layer 1 — Identity Core（身份核心）

| 欄位 | 說明 |
|------|------|
| 品牌標題 | `🐈‍⬛ BLACK CAT / UNDER THE MOON`（像素字體，letter-spacing 拉寬） |
| 模式標籤 | `靈魂鏡像 · MIRROR MODE`（像素字體 badge） |
| 貓咪圖片 | 對應主類型的 AI 生成 PNG，240×240px，帶類型顏色光暈 |
| 混血標題（選填）| 若有影子類型，顯示 `[ 混血靈魂 • Lv.XX ]`（pulse 動畫） |
| 中文家族名稱 | 如 `守護貓家族`（像素字體） |
| 英文家族名稱 | 如 `The Eternal Sentinel`（像素字體，小字） |
| 身份 meta（選填）| `TB · INFJ · 天蠍座`（由 P1 / P2_mbti / P2_zodiac 組合，黃色小字） |

### Layer 2 — Psych Profile（心理側寫）

| 欄位 | 說明 |
|------|------|
| 特質標籤 | 3 個 hashtag tag（如 `#守護型依賴症`），間距加寬 |
| 隱藏迷惑行為（選填）| 最多 3 個金色 tag（中文 hashtag，如 `#已讀焦慮症`），由答題觸發 |
| 個人標籤（選填）| 喜好 / 音樂 / 電影 tag 列（由 P3 / P4 / P5 填入），以細分隔線與上方區隔 |

### Layer 3 — Emotional Layer（情感層）

| 欄位 | 說明 |
|------|------|
| 家族描述 | 對應人格引述文字（斜體，`line-height: 2.0`） |
| 黑貓炸毛預警 | 對應主類型的警告文字，帶紅色左 border |
| 靈魂成分 | 各類型佔比橫向進度條（動畫展開，120ms delay） |
| CTA | 品牌網址 + 下載 / 重測提示 |

進度條動畫：先設 `width: 0%`，渲染後 120ms 觸發 CSS transition 展開至實際寬度。

---

## 六、純類型極端情況

10 題全選同一類型 → 該類型得 **20 分**（佔比 100%），其餘為 0，**不觸發影子類型**。

---

## 七、完整計分流程圖

```
使用者填寫基本資料（5 題，不計分）
        ↓
使用者作答 10 題心理測驗（每題單選）
        ↓
每題：找出選項 index → 對應 scores 陣列 → 該類型 += 2
        ↓
四類型原始分數：{ solitary, sunny, mystical, sentinel }
        ↓
排序找最高分 → 主類型
        ↓
第二高分是否 ≥ 主類型分數 - 2 且 > 0？
  ├── 是 → 顯示影子類型
  └── 否 → 不顯示影子類型
        ↓
各類型百分比 = 類型分 ÷ 總分 × 100
        ↓
渲染性格卡片（家族名稱 / 描述 / 特質 / 進度條 / 影子類型）
        ↓
可下載 PNG 性格卡片
```

---

## 八、本機伺服器啟動方式

下載卡片功能需要透過 HTTP 協定運行，**不可直接用 `file://` 開啟 `index.html`**。  
每次要測試時，先按以下步驟啟動本機伺服器。

### 步驟

1. 在 VS Code 開啟終端機（**Ctrl + `**）
2. 確認目前在專案資料夾，貼上以下指令並按 Enter：

```powershell
npx serve . --listen 8080
```

3. 看到以下訊息代表啟動成功：

```
   ┌────────────────────────────────────────┐
   │   Serving!                             │
   │   - Local:    http://localhost:8080    │
   └────────────────────────────────────────┘
```

4. 用瀏覽器開啟 **http://localhost:8080**

> **注意**：終端機視窗保持開著，關掉或按 `Ctrl+C` 會停止伺服器。  
> 第一次執行時 npm 會詢問是否安裝 `serve@14.x.x`，輸入 `y` 並按 Enter 即可，之後不會再問。

---

## 九、瀏覽器主控台快速預覽教學

### 開啟主控台

按 **F12**（或 **Ctrl+Shift+I**）→ 點頂部 **Console** 分頁。

> **首次使用提示**：Chrome 首次開啟 Console 時，有時會顯示黃色警告框（自我 XSS 保護）。若底部出現「Type 'allow pasting' to allow」字樣，直接手動輸入 `allow pasting` 並按 Enter，之後即可正常貼上。若沒看到警告框，直接 `Ctrl+V` 貼上即可，無需輸入任何文字。

---

### 指令一：四款圖示並排預覽

同時展示四款貓咪圖片，浮現在頁面左上角。

```javascript
var imgs = {
  solitary: 'Solitary Moon（獨處貓）.png',
  sunny:    'Sunny Tether（暖陽貓）.png',
  mystical: 'Mystical Depth（秘境貓）.png',
  sentinel: 'Eternal Sentinel（守護貓）.png'
};
var wrap = document.createElement('div');
wrap.style = 'position:fixed;top:10px;left:10px;background:#1a1030;padding:12px;border-radius:8px;z-index:9999;display:flex;gap:8px';
document.body.appendChild(wrap);

['solitary','sunny','mystical','sentinel'].forEach(function(type) {
  var img = document.createElement('img');
  img.src = imgs[type];
  img.title = type;
  img.style.cssText = 'width:96px;height:96px;object-fit:cover;border-radius:4px';
  wrap.appendChild(img);
});
```

---

### 指令二：單一類型預覽

將 `'sunny'` 換成任何類型代號。

```javascript
var imgs = {
  solitary: 'Solitary Moon（獨處貓）.png',
  sunny:    'Sunny Tether（暖陽貓）.png',
  mystical: 'Mystical Depth（秘境貓）.png',
  sentinel: 'Eternal Sentinel（守護貓）.png'
};
var img = document.createElement('img');
img.src = imgs['sunny'];
img.style.cssText = 'position:fixed;top:10px;left:10px;width:200px;height:200px;object-fit:cover;border-radius:6px;z-index:9999';
document.body.appendChild(img);
```

### 指令三：快速預覽完整結果卡（含 P1–P5 資料）

一鍵模擬填寫完整問卷並直接顯示結果卡，無需逐題作答。  
可調整 `optIdx` (0=solitary / 1=sunny / 2=mystical / 3=sentinel) 或 P1–P5 內容。

```javascript
// 1. 填入基本資料 (P1–P5)
answers = {
  p1: 'TB',
  p2_mbti: 'INFJ',
  p2_zodiac: '天蠍座',
  p3: '閱讀, 旅行, 音樂',                    // 多選，逗號分隔
  p4: '獨立 Indie, R&B / Soul',              // 必須用完整選項（含英文）
  p5: '愛情 Romance, 文藝 Art Film'           // 卡片顯示時會自動移除英文
};

// 2. 填入心理測驗 (Q1–Q10)
// optIdx: 0=獨處貓 1=暖陽貓 2=秘境貓 3=守護貓
var optIdx = 3; // 改這裡切換主類型
MIRROR_QUESTIONS.filter(function(q) { return q.scores; }).forEach(function(q) {
  answers[q.field] = q.options[optIdx];
});

// 3. 顯示結果
isMirrorMode = true;
var quizSection = document.getElementById('quiz-section');
if (quizSection) quizSection.style.display = 'none';
computeAndShowMirrorResult();
var resultSection = document.getElementById('mirror-result');
if (resultSection) resultSection.scrollIntoView({ behavior: 'smooth' });
```

---

### 清除預覽

按 **F5** 刷新頁面即可移除所有預覽元素。
