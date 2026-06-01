/* ==============================================================
   BLACK CAT UNDER THE MOON — SOUL MATCH QUESTIONNAIRE
   ============================================================== */

// ===================== QUESTIONS DATA =====================
const QUESTIONS = [
  // ---- Part 1: 基本畫像 ----
  {
    id:'name', part:1, partTitle:'基本畫像 The Visuals',
    text:'Hello，點稱呼你？', type:'text',
    placeholder:'輸入你嘅名字...', field:'name'
  },
  {
    id:'age', part:1,
    text:'年齡：', type:'text', inputType:'number',
    placeholder:'你嘅年齡...', field:'age',
    minValue:18, maxValue:60,
    underMinWarning:'需滿 18 歲方可參與'
  },
  {
    id:'height', part:1,
    text:'身高 (cm)：', type:'text', inputType:'number',
    placeholder:'例如：165', field:'height',
    minValue:140, maxValue:190
  },
  {
    id:'body_type', part:1,
    text:'體型：', type:'single',
    options:['纖瘦偏薄','均勻適中','結實健美','圓潤肉感'],
    field:'body_type'
  },
  {
    id:'attribute', part:1,
    text:'你的屬性：', type:'single',
    options:['TB','TBG','Pure','Bi','No Label','仲探索緊'],
    field:'attribute'
  },
  {
    id:'hair_style', part:1,
    text:'髮型標籤：', type:'single',
    options:['飄逸長髮','中長及肩','爽朗短髮','帥氣剷青'],
    field:'hair_style'
  },
  {
    id:'fashion_style', part:1,
    text:'穿搭風格（可多選）：', type:'multi',
    options:['簡約歐美','日系小清新','街頭型格','文青文藝','優雅大方','慵懶隨性','運動機能','中性帥氣'],
    field:'fashion_style'
  },
  {
    id:'bed_position', part:1,
    text:'關於「床上地位」，誠實豆沙包時間：', type:'single',
    options:[
      '霸總負責進攻：全力輸出，我唔係嚟休息嘅 (Top)',
      '懶豬負責享受：穩定接收，我就係嚟休息嘅 (Bottom)',
      '遇強則弱，遇弱則強：睇對方係咩料，我可以隨時切換 (Switch)',
      '躺平派：係咪一定要分？唔想動腦，舒服就得'
    ],
    field:'bed_position'
  },
  // ---- Part 2: 生活動能 ----
  {
    id:'social_energy', part:2, partTitle:'生活動能與頻率 Daily Energy',
    text:'你的社交電量：', type:'single',
    options:['好動（戶外玩家）','好靜（宅家修煉）','動靜皆宜（睇心情切換）'],
    field:'social_energy'
  },
  {
    id:'ideal_weekend', part:2,
    text:'理想週末模式：', type:'single',
    options:[
      '社交派：鍾意同朋友聚會、參加活動',
      '二人世界：同另一半靜靜過，唔想被打擾',
      '平衡派：一半社交，一半留俾對方',
      '隨心派：完全睇當日心情同能量決定'
    ],
    field:'ideal_weekend'
  },
  {
    id:'interests', part:2,
    text:'興趣與活動（可多選）：', type:'multi',
    categories:[
      { label:'🎨 文藝類', options:['睇戲/睇展覽','影相記錄','睇書','寫作/手帳','聽 Live House/音樂節'] },
      { label:'🏠 生活類', options:['搵正餐廳食好嘢','咖啡店打卡','行超市/市集','煮飯研究','居家佈置'] },
      { label:'🎯 體驗類', options:['深度旅遊','工作坊體驗 (DIY/畫畫/陶藝)','密室逃脫/劇本殺','買嘢 Shopping'] },
      { label:'🛋️ 休閒類', options:['屋企 Netflix & Chill','漫無目的散步','同寵物玩','冥想/放空'] }
    ],
    field:'interests'
  },
  {
    id:'exercise', part:2,
    text:'身體能量（運動，可多選）：', type:'multi',
    categories:[
      { label:'🌿 戶外系', options:['行山/露營','水上運動（衝浪/潛水）','球類運動','跑步/踩單車'] },
      { label:'🏋️ 室內系', options:['做 Gym 訓練','瑜伽/普拉提','跳舞','攀石'] },
      { label:'🧘 佛系', options:['拉筋伸展','呼吸係我唯一運動'] }
    ],
    field:'exercise'
  },
  {
    id:'travel_mode', part:2,
    text:'旅行模式：', type:'single',
    options:['隨心即興（去到邊玩到邊）','完美攻略（做足準備唔想浪費時間）'],
    field:'travel_mode'
  },
  // ---- Part 3: 關係導向 ----
  {
    id:'relationship_goal', part:3, partTitle:'關係導向 Hard Filters',
    text:'你目前對關係嘅期待係？', type:'single',
    options:[
      '認真長期發展：以穩定伴侶為目標，穩定後考慮未來',
      '順其自然：慢慢了解，唔急於定義關係',
      '輕鬆相處：偏向 Casual，唔想有太多標籤或束縛',
      '開放認識：仲未準備好投入關係，但開放識人'
    ],
    field:'relationship_goal'
  },
  {
    id:'time_investment', part:3,
    text:'你每星期可以投入幾多時間喺關係？', type:'single',
    options:[
      '幾乎每日見 / 長時間相處',
      '一星期 2–3 次',
      '一星期 1 次',
      '視乎工作或當下心情'
    ],
    field:'time_investment'
  },
  {
    id:'deal_breaker', part:3,
    text:'你最唔可以接受邊樣（最多選 2）：', type:'multi',
    maxSelect:2,
    options:[
      '冷暴力 / 已讀不回 / 唔溝通',
      '控制慾強 / 查手機 / 限制社交',
      '經常失約 / 唔守承諾',
      '金錢觀極端（過度計較或過度揮霍）'
    ],
    field:'deal_breaker'
  },
  // ---- Part 4: 靈魂共鳴 ----
  {
    id:'love_language', part:4, partTitle:'靈魂共鳴與安全感 The Deep Layer',
    text:'邊種行為最能令你感受到被愛？（最多選 2）', type:'multi',
    maxSelect:2,
    options:[
      '肯定的言語：對方不斷讚美、鼓勵同肯定我',
      '服務的行動：對方主動幫我分擔生活瑣事或解決困難',
      '身體的接觸：隨時隨地的牽手、擁抱或親吻',
      '禮物與驚喜：收到對方悉心準備的小禮物',
      '精心時刻：兩個人放低電話，全神貫注地深度交流、散步，或者只係專屬於彼此嘅陪伴'
    ],
    field:'love_language'
  },
  {
    id:'security_need', part:4,
    text:'你喺關係中最需要嘅「安全感」係？', type:'single',
    options:[
      '穩定聯絡：每日都有交流，唔會突然失蹤',
      '明確承諾：對關係定義清晰，有共同認可嘅名分',
      '行動證明：講得出做得到，會為我做實事',
      '自由空間：有足夠個人空間，唔會被過度限制'
    ],
    field:'security_need'
  },
  {
    id:'ritual_sense', part:4,
    text:'你認為最能代表「愛」嘅日常小事係咩？', type:'single',
    options:[
      '記得我隨口講過嘅小願望或細碎嘅喜好',
      '喺我攰嘅時候默默陪伴（例如幫我吹頭/按摩）',
      '喺社交媒體公開合照，俾我有安全感',
      '即使再忙，每日都會抽時間講電話或錄語音'
    ],
    field:'ritual_sense'
  },
  // ---- Part 5: 三觀 ----
  {
    id:'decision_style', part:5, partTitle:'內在邏輯與三觀 Values & Logic',
    text:'決策導向：', type:'single',
    options:['直覺系：相信第一印象同感覺','事實系：鍾意收集資訊，分析過後先做決定'],
    field:'decision_style'
  },
  {
    id:'conflict_style', part:5,
    text:'當雙方出現分歧或你感到受委屈時，你屬於哪種「溝通體質」？', type:'single',
    options:[
      '直球解決型：唔鍾意拖，要即時講清楚介意咩',
      '冷靜消化型：會先分開一下，等自己整理好情緒同邏輯先再傾',
      '情感引導型：比起即刻講道理，我更想對方先接住我情緒',
      '觀察留白型：唔太習慣主動開口，會希望對方自己察覺我唔對路'
    ],
    field:'conflict_style'
  },
  {
    id:'money_view', part:5,
    text:'約會時比較傾向點分配開支？', type:'single',
    options:[
      '絕對 AA 制，大家清清楚楚',
      '你一餐我一餐，唔需要計到盡',
      '收入較高或主動約嗰位請客'
    ],
    field:'money_view'
  },
  {
    id:'cohabitation', part:5,
    text:'你理想中的同居生活係？', type:'single',
    options:[
      '期待早日同居，每日睜開眼就見到對方',
      '穩定交往一段時間（一年以上）再考慮',
      '傾向各自居住，保有個人空間'
    ],
    field:'cohabitation'
  },
  // ---- Part 6: 理想對象 ----
  {
    id:'preferred_attribute', part:6, partTitle:'理想對象與彩蛋 The Ideal Match',
    text:'希望對方的屬性（可多選）：', type:'multi',
    options:['TB','TBG','Pure','Bi','No Label','冇所謂'],
    field:'preferred_attribute'
  },
  {
    id:'ideal_appearance', part:6,
    text:'理想對象嘅身型（可多選）：', type:'multi',
    options:['纖瘦偏薄','均勻適中','結實健美','圓潤肉感','冇所謂'],
    field:'ideal_appearance'
  },
  {
    id:'height_diff', part:6,
    text:'理想對象嘅身高差（正數 = 對方高過你）：', type:'dual_range',
    min:-30, max:30, step:1, unit:'cm',
    field:'ideal_height_gap',
    allowNoPreference:true
  },
  {
    id:'age_diff', part:6,
    text:'理想對象嘅年齡差（正數 = 對方大過你）：', type:'dual_range',
    min:-20, max:20, step:1, unit:'歲',
    field:'ideal_age_gap',
    allowNoPreference:true
  },
  {
    id:'gap_moe', part:6,
    text:'關於「反差萌」：邊種反差最容易令你心動？', type:'single',
    options:[
      '外表高冷硬朗，但對住我會展現極致溫柔',
      '平時理性冷靜，但喺我面前會撒嬌變細路女',
      '生活隨性自然，但對工作或熱愛嘅事極度專注'
    ],
    field:'gap_moe'
  },
  {
    id:'three_traits', part:6,
    text:'假如要用三個詞形容你嘅優點：', type:'text',
    placeholder:'例如：善良、幽默、有耐性（最多20字）', field:'three_traits',
    maxLength:20
  },
  // ---- Part 7: 聯絡資訊 ----
  {
    id:'contact_choice', part:7, partTitle:'留下聯絡方式 Stay Connected',
    text:'請至少選擇一種聯絡方式（可多選）：', type:'contact_options',
    options: [
      { id: 'ig', label: 'Instagram 📸', field: 'ig_username', placeholder: '@your_ig_handle' },
      { id: 'tg', label: 'Telegram 📲', field: 'tg_username', placeholder: '@your_tg_handle' }
    ]
  },
  {
    id:'email', part:7,
    text:'你的 Email 📧', type:'text',
    placeholder:'example@email.com', field:'email',
    inputType:'email'
  },
  {
    id:'feedback', part:7,
    text:'給我們的建議 / 意見收集箱 📮', type:'textarea',
    placeholder:'任何想法、建議、或者想對黑貓講嘅說話...', field:'feedback',
    optional: true
  }
];

const TOTAL = QUESTIONS.length; // 32 (29 soul + 3 contact)

// ===================== MIRROR MODE QUESTIONS =====================
// Structure: 5 profile questions (P1-P5, no scores) + 10 scored questions (Q1-Q10)
// scores array maps option index → type: ['solitary','sunny','mystical','sentinel']
const MIRROR_QUESTIONS = [
  // --- 基本資料 Profile (P1–P5, not scored) ---
  {
    id:'p1', part:0, partTitle:'基本資料 Profile', label:'P1',
    text:'你的 Label 是？', type:'single',
    options:['TB', 'TBG', 'Pure', 'Bi', 'No Label'],
    field:'p1'
  },
  {
    id:'p2', part:0, label:'P2',
    text:'你的 MBTI 與星座？', type:'select_pair', optional:true,
    selects:[
      { label:'MBTI', field:'p2_mbti', options:['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'] },
      { label:'星座', field:'p2_zodiac', options:['牡羊座','金牛座','雙子座','巨蟹座','獅子座','處女座','天秤座','天蠍座','射手座','摩羯座','水瓶座','雙魚座'] }
    ],
    field:'p2'
  },
  {
    id:'p3', part:0, label:'P3',
    text:'你有哪些日常喜好？（多選，可跳過）', type:'multi', optional:true,
    options:['閱讀','運動','打遊戲','旅行','追劇','手作 / DIY','攝影','美食 / 烹飪','音樂','電影','藝術','戶外活動'],
    field:'p3'
  },
  {
    id:'p4', part:0, label:'P4',
    text:'你喜歡聽哪種音樂？（多選，可跳過）', type:'multi', optional:true,
    options:['流行 Pop','獨立 Indie','R&B / Soul','電子 Electronic','古典 Classical','爵士 Jazz','嘻哈 Hip-Hop','K-pop','搖滾 Rock','民謠 Folk'],
    field:'p4'
  },
  {
    id:'p5', part:0, label:'P5',
    text:'你喜歡哪種電影類型？（多選，可跳過）', type:'multi', optional:true,
    options:['愛情 Romance','驚悚 Thriller','科幻 Sci-Fi','動作 Action','動畫 Animation','文藝 Art Film','紀錄片 Documentary','恐怖 Horror','喜劇 Comedy','奇幻 Fantasy','懸疑 Mystery'],
    field:'p5'
  },
  // --- 領域一：親密與相處節奏 Intimacy Rhythm (Q1–Q3) ---
  {
    id:'m_q1', part:1, partTitle:'親密與相處節奏 Intimacy Rhythm', label:'Q1',
    text:'你與伴侶的理想相處模式與時間分配？', type:'single',
    options:[
      '保持獨立生活，需要大量個人空間作為底線',
      '經常見面，個人時間少一點沒關係，伴侶更重要',
      '視乎當下內心狀態，靈魂同頻比相處次數更重要',
      '規律而穩定的相處節奏，能直接影響我的情緒與安心感'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q1'
  },
  {
    id:'m_q2', part:1, label:'Q2',
    text:'當對方問你在做什麼，或者連續一陣子沒聯絡，你的第一反應是？', type:'single',
    options:[
      '想保有神秘感與自由，不喜歡事事回報或被追問',
      '立刻回覆詳情，若對方太久沒報備會想發訊息確認狀態',
      '想分享當下的心情和感受，多於單純報告行蹤',
      '覺得這是基本關心，樂意告知，也習慣有規律的問候'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q2'
  },
  {
    id:'m_q3', part:1, label:'Q3',
    text:'伴侶突然臨時取消原定的重要計劃，你會？', type:'single',
    options:[
      '其實有點鬆一口氣，覺得突然多了自由時間也不錯',
      '立刻詢問原因，需要一個清晰合理的解釋',
      '感到失落，並開始擔心對方是不是心情不好或有事瞞著我',
      '會有點無所適從，希望對方能提前告知並立刻重新安排'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q3'
  },
  // --- 領域二：溝通與情感語言 Emotional Language (Q4–Q7) ---
  {
    id:'m_q4', part:2, partTitle:'溝通與情感語言 Emotional Language', label:'Q4',
    text:'對你而言，被愛最深、最讓你心動的時刻是？', type:'single',
    options:[
      '對方充分信任我，跟我說「你去做你喜歡的事，不用陪我」',
      '對方在眾人面前大方、自豪地介紹我，讓我有名分感',
      '對方無需我開口，就能說出「我知道你的感受，不用解釋」',
      '對方默默記著我說過的每件小事，每天規律地傳一句「到家了嗎」'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q4'
  },
  {
    id:'m_q5', part:2, label:'Q5',
    text:'兩個人吵架或發生衝突後，你傾向如何處理？', type:'single',
    options:[
      '各自冷靜，不想在情緒頭上溝通，相信時間能解決問題',
      '立刻講清楚，當下就要解決，不讓誤解和悶氣留過夜',
      '希望對方先來擁抱、安撫我的情緒，之後再解釋道理',
      '需要對方明確表態關係仍然安全，承諾不會輕易放棄'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q5'
  },
  {
    id:'m_q6', part:2, label:'Q6',
    text:'你自己表達愛意時，更偏向哪種方式？', type:'single',
    options:[
      '給對方充足的自由與個人空間，不隨意干涉',
      '直接說出口，透過言語的確認與承諾讓對方踏實',
      '用眼神、氣氛和生活細節，追求「無聲勝有聲」的默契',
      '持續、穩定地出現在對方身邊，用長久的陪伴來證明'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q6'
  },
  {
    id:'m_q7', part:2, label:'Q7',
    text:'你最希望伴侶能深深明白你的一點是？', type:'single',
    options:[
      '我需要自己的世界和空間，但並不代表我不在乎你',
      '我想要的是一段清晰、公開、有長遠承諾的穩定關係',
      '比起對錯和道理，我更需要我的情緒被你理解和接住',
      '即使日子歸於平淡，我也願意與你長久而規律地陪伴彼此'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q7'
  },
  // --- 領域三：安全感與未來想像 Security Foundation (Q8–Q10) ---
  {
    id:'m_q8', part:3, partTitle:'安全感與未來想像 Security Foundation', label:'Q8',
    text:'什麼樣的狀態，能讓你在這段關係中感到最踏實的安心？', type:'single',
    options:[
      '對方完全不干涉我的個人生活與自我發展',
      '兩個人有非常明確、共同的未來計劃與前進方向',
      '感到自己被完全包容與理解，在對方眼神中能做真實的自己',
      '我知道只要我需要，無論何時對方都一定會在我身後'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q8'
  },
  {
    id:'m_q9', part:3, label:'Q9',
    text:'在感情中，哪一種狀況會讓你受傷最深？', type:'single',
    options:[
      '對方過度依賴、限制我的自由，讓我失去了自我與空間',
      '關係不明朗、對方對外模糊我們的關係，遲遲不肯給予定義',
      '當我表達脆弱時，對方不接住我的情緒，反而一直講道理',
      '承諾說了又不算，反覆無常的轉變破壞了關係的穩定感'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q9'
  },
  {
    id:'m_q10', part:3, label:'Q10',
    text:'你理想中的伴侶，在你的生命中扮演著什麼角色？', type:'single',
    options:[
      '你生命中的精彩點綴，彼此獨立卻又互相欣賞',
      '你的命運共同體，兩個人牽手朝著同一個目標前進',
      '懂你靈魂與沉默的存在，心靈上無話不談',
      '你最安全的避風港，無論外面多風雨，永遠可以安心靠泊'
    ],
    scores:['solitary','sunny','mystical','sentinel'],
    field:'m_q10'
  }
];

// ===================== PERSONALITY TYPES =====================
const PERSONALITY_TYPES = {
  solitary: {
    nameZh: '獨處貓家族',
    nameEn: 'The Solitary Moon',
    icon: '🌙',
    color: '#bd93f9',
    traits: ['重視個人空間', '低頻高質陪伴', '獨立自主'],
    factorName: '月光因子',
    hashtags: ['#給空間才給心', '#獨處充電人類', '#一個人也很好但有你更好'],
    warning: '遇到突然黏上來、打亂個人計劃的人，自動開啟隱形模式，消失三天再出現說沒事。',
    desc: '你是一隻住在月亮上的貓，愛情對你來說是點綴，而不是全部。你不是不愛，只是你的愛需要空間才能呼吸。'
  },
  sunny: {
    nameZh: '暖陽貓家族',
    nameEn: 'The Sunny Tether',
    icon: '☀️',
    color: '#ff6b9d',
    traits: ['直率熱烈', '明確承諾', '高溝通需求'],
    factorName: '暖陽熱能',
    hashtags: ['#直球對決選手', '#定義關係先別怕', '#公開曬恩愛達人'],
    warning: '遇到態度曖昧、拒絕定義關係的人，直接傳長文問清楚，不清楚不罷休。',
    desc: '你喜歡曬太陽，也希望對方的世界裡只有溫暖。你的愛是直接的，你要的也是清晰而公開的。'
  },
  mystical: {
    nameZh: '秘境貓家族',
    nameEn: 'The Mystical Depth',
    icon: '🔮',
    color: '#00e5ff',
    traits: ['情感共鳴深', '靈魂對話', '重視被理解'],
    factorName: '秘境電波',
    hashtags: ['#只想被懂不想被講道理', '#靈魂頻率對了才開門', '#沉默也是對話'],
    warning: '遇到用道理而非感受回應的人，當場關掉情緒出口，從此沉默如謎。',
    desc: '你潛伏在黑夜深處，只為等待那個能聽懂你頻率的人。道理不重要，被理解才是你最深的渴望。'
  },
  sentinel: {
    nameZh: '守護貓家族',
    nameEn: 'The Eternal Sentinel',
    icon: '🛡️',
    color: '#50fa7b',
    traits: ['穩定安全感', '長期規劃', '規律相處'],
    factorName: '守護力場',
    hashtags: ['#PlanB狂魔', '#討厭驚喜變成驚嚇', '#訊息不回會內心扣分'],
    warning: '遇到遲到不講、臨時改行程的人，內心的護盾會當場加厚 300%。',
    desc: '你是守護壁爐的貓，最怕變動與突如其來的驚嚇。你的愛是一種承諾，是每天都會回來的穩定。'
  }
};

// 12 special hybrid titles — one per main+shadow combination
var HYBRID_TITLES = {
  'solitary+sunny':    '[ ☀️ 荒野玫瑰與暖陽 ]',
  'solitary+mystical': '[ 🌙 月光下嘅電波解碼者 ]',
  'solitary+sentinel': '[ 🛡️ 深淵獨行守夜人 ]',
  'sunny+solitary':    '[ 🌟 寂靜星空嘅尋光者 ]',
  'sunny+mystical':    '[ ✨ 霓虹秘境嘅愛情魔法師 ]',
  'sunny+sentinel':    '[ 🔥 鐵壁之下嘅溫柔侵略者 ]',
  'mystical+solitary': '[ 🌑 月影裂縫嘅靈魂占卜師 ]',
  'mystical+sunny':    '[ 💫 螢光狂歡嘅電波密語者 ]',
  'mystical+sentinel': '[ ⚡ 霧中堡壘嘅深淵探索者 ]',
  'sentinel+solitary': '[ 🌠 孤城深處嘅星空守望者 ]',
  'sentinel+sunny':    '[ 🌺 鐵甲之下嘅玫瑰魂靈 ]',
  'sentinel+mystical': '[ 🔮 秘境邊境嘅魔法衛士 ]',
};

// ===================== HIDDEN PERKS/FLAWS =====================
// Each rule maps a specific (question field, option index) → game-style behavior tag.
// Rules are checked in priority order; 2–3 unique tags are picked per user.
var HIDDEN_TAG_RULES = [
  // m_q3 = 伴侶臨時取消計劃
  { field:'m_q3',  optIdx:0, zh:'#獨處充電怪',       en:'#SoloRechargeMode' },
  { field:'m_q3',  optIdx:2, zh:'#已讀焦慮症',       en:'#ReadReceiptAnxiety' },
  { field:'m_q3',  optIdx:3, zh:'#PlanB怪',          en:'#PlanBMonster' },
  // m_q9 = 感情中讓你受傷最深
  { field:'m_q9',  optIdx:0, zh:'#防窒息陣地',       en:'#AntiSuffocationZone' },
  { field:'m_q9',  optIdx:1, zh:'#見光死過敏',       en:'#SunlightAllergy' },
  { field:'m_q9',  optIdx:2, zh:'#不吃畫大餅這一套', en:'#NoPretendCommitments' },
  { field:'m_q9',  optIdx:3, zh:'#可靠度至上',       en:'#ReliabilityPolice' },
  // m_q2 = 對方問你/沒聯絡反應
  { field:'m_q2',  optIdx:1, zh:'#主動確認安全感',   en:'#RelationshipStatusChecker' },
  { field:'m_q2',  optIdx:2, zh:'#已讀焦慮症',       en:'#ReadReceiptAnxiety' },
  // m_q5 = 吵架後處理方式
  { field:'m_q5',  optIdx:0, zh:'#冷靜期必要型',     en:'#CooldownRequired' },
  { field:'m_q5',  optIdx:1, zh:'#問題不隔夜選手',   en:'#NoOvernightIssues' },
  // m_q4 = 最讓你心動的時刻
  { field:'m_q4',  optIdx:1, zh:'#名分控',           en:'#LabelCollector' },
  // m_q8 = 讓你最安心的狀態
  { field:'m_q8',  optIdx:3, zh:'#隨叫隨到型安全感', en:'#AlwaysThereForMe' },
  // m_q1 = 相處模式
  { field:'m_q1',  optIdx:0, zh:'#個人時間勿侵犯',   en:'#PersonalSpaceIsSacred' },
  // m_q2 = 神秘感
  { field:'m_q2',  optIdx:0, zh:'#神秘感重症患者',   en:'#MysteryModeON' },
];

function computeHiddenTags(userAnswers) {
  var seen = {};
  var tags = [];
  for (var i = 0; i < HIDDEN_TAG_RULES.length && tags.length < 3; i++) {
    var rule = HIDDEN_TAG_RULES[i];
    var q = MIRROR_QUESTIONS.find(function(mq) { return mq.field === rule.field; });
    if (!q) continue;
    var ans = userAnswers[rule.field];
    if (ans === undefined || ans === null) continue;
    var optIdx = q.options.indexOf(ans);
    if (optIdx === rule.optIdx && !seen[rule.zh]) {
      seen[rule.zh] = true;
      tags.push(rule);
    }
  }
  return tags;
}

// ============ SUBMIT CONFIG ============
// 透過 /api/submit serverless function 提交（Token 藏在 env vars）

// ===================== STATE =====================
let isMirrorMode = false;
let activeQuestions = QUESTIONS;
let activeTotal = TOTAL;
let currentIdx = 0;
let answers = {};
let multiSelected = new Set();
let typewriterTimer = null;
let typewriterDoneTimer = null;
let isTransitioning = false;
let lastPart = 0;
let renderTimer = null;
let partTransitionTimer = null;
let partTransitionFadeTimer = null;

const THREADS_SHARE_TEXT = [
  '我剛完成了「Black Cat Under The Moon」靈魂配對問卷，一份專為 Lesbian 配對設計嘅問卷，你都試下搵屬於你嘅 Soulmate？',
  'https://black-cat-under-the-moon.vercel.app/',
  '#月老靈貓 #靈魂配對 #LesbianHK'
].join('\n');

// ===================== DOM REFS =====================
const $welcome     = document.getElementById('welcome');
const $progressWrap= document.getElementById('progress-wrap');
const $progressFill= document.getElementById('progress-fill');
const $progressText= document.getElementById('progress-text');
const $header      = document.getElementById('site-header');
const $main        = document.getElementById('main-content');
const $card        = document.getElementById('q-card');
const $partLabel   = document.getElementById('q-part-label');
const $qNumber     = document.getElementById('q-number');
const $qText       = document.getElementById('q-text');
const $qAnswers    = document.getElementById('q-answers');
const $btnRow      = document.getElementById('btn-row');
const $nextBtn     = document.getElementById('next-btn');
const $backBtn     = document.getElementById('back-btn');
const $loading     = document.getElementById('loading-screen');
const $thankyou    = document.getElementById('thankyou-screen');
const $error       = document.getElementById('error-screen');
const $errorDetail = document.getElementById('error-detail');
const $retryBtn    = document.getElementById('retry-btn');
const $partTrans   = document.getElementById('part-transition');
const $ptNum       = document.getElementById('pt-num');
const $ptName      = document.getElementById('pt-name');
const $shareThreadsBtn = document.getElementById('share-threads-btn');
const $socialHandles = document.getElementById('social-handles');

function normalizeHandleValue(raw) {
  const trimmed = String(raw || '').trim();
  const withoutAt = trimmed.replace(/^@+/, '');
  return withoutAt;
}

function hasAnyContactHandle(igRaw, tgRaw) {
  return Boolean(normalizeHandleValue(igRaw) || normalizeHandleValue(tgRaw));
}

function toFriendlyErrorMessage(raw) {
  const msg = String(raw || '').trim();
  const lower = msg.toLowerCase();
  if (!msg) return '請稍後再試，或聯絡管理員檢查伺服器設定。';
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return '連線不到提交 API。請確認你正使用 http://localhost 或已部署網址開啟頁面（不要用 file:// 直接打開），並檢查 /api/submit 是否可用。';
  }
  if (lower.includes('missing token') || lower.includes('server misconfigured')) {
    return '伺服器環境變數未設定。請在部署平台加入 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。';
  }
  if (lower.includes('unauthorized') || lower.includes('401')) {
    return 'Supabase 授權失敗，請確認 SUPABASE_SERVICE_ROLE_KEY 是否正確。';
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return 'API 路由不存在（404）。請確認已用 vercel dev 或正式部署網址開啟，不可直接用 file:// 開啟。';
  }
  return msg;
}

function showErrorOverlay(errLike) {
  const raw = errLike && errLike.message ? errLike.message : errLike;
  const friendly = toFriendlyErrorMessage(raw);
  if ($errorDetail) {
    $errorDetail.textContent = '詳細：' + friendly;
    $errorDetail.style.display = 'block';
  }
  $loading.classList.remove('active');
  $error.classList.add('active');
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  drawHeaderCat();
  initShareLink();
  ensureSocialHandlesVisible();
  // If navigated back from a sub-page with #mode, skip the welcome splash
  if (window.location.hash === '#mode') {
    $welcome.style.display = 'none';
    showModeSelect();
  }
  $welcome.addEventListener('click', startQuiz);
  const $modeA = document.getElementById('mode-a-btn');
  if ($modeA) $modeA.addEventListener('click', startMatchMode);
  const $modeB = document.getElementById('mode-b-btn');
  if ($modeB && !$modeB.classList.contains('coming-soon')) $modeB.addEventListener('click', startMirrorMode);

  // Home back button
  document.getElementById('home-back-btn').addEventListener('click', () => {
    document.getElementById('home-confirm-overlay').classList.add('active');
  });
  document.getElementById('home-confirm-yes').addEventListener('click', () => {
    document.getElementById('home-confirm-overlay').classList.remove('active');
    goBackToHome();
  });
  document.getElementById('home-confirm-no').addEventListener('click', () => {
    document.getElementById('home-confirm-overlay').classList.remove('active');
  });

  // Deep-link: questionnaire.html#match skips welcome + mode-select
  if (window.location.hash === '#match') {
    $welcome.style.display = 'none';
    startMatchMode();
    return;
  }

  // Standalone pages: auto-start based on body data-automode attribute
  const autoMode = document.body.dataset.automode;
  if (autoMode === 'match') {
    startMatchMode();
  } else if (autoMode === 'mirror') {
    startMirrorMode();
  }
});

function initShareLink() {
  if (!$shareThreadsBtn) return;
  const params = new URLSearchParams({ text: THREADS_SHARE_TEXT });
  const url = 'https://www.threads.net/intent/post?' + params.toString();
  $shareThreadsBtn.setAttribute('href', url);
}

function ensureSocialHandlesVisible() {
  if (!$socialHandles) return;
  $socialHandles.style.display = 'flex';
}

function startQuiz() {
  $welcome.classList.add('hiding');
  setTimeout(() => {
    $welcome.style.display = 'none';
    showModeSelect();
  }, 800);
}

function showModeSelect() {
  document.getElementById('mode-select').classList.add('active');
}

function goBackToHome() {
  window.location.href = 'index.html';
}

function startMatchMode() {
  isMirrorMode = false;
  activeQuestions = QUESTIONS;
  activeTotal = TOTAL;
  answers = {};
  lastPart = 0;
  document.getElementById('mode-select').classList.remove('active');
  $progressWrap.style.display = 'block';
  $header.style.display = 'block';
  $main.style.display = 'block';
  showQuestion(0);
}

function startMirrorMode() {
  isMirrorMode = true;
  activeQuestions = MIRROR_QUESTIONS;
  activeTotal = MIRROR_QUESTIONS.length;
  answers = {};
  lastPart = 0;
  document.getElementById('mode-select').classList.remove('active');
  $progressWrap.style.display = 'block';
  $header.style.display = 'block';
  $main.style.display = 'block';
  showQuestion(0);
}

// ===================== SHOW QUESTION =====================
function showQuestion(idx, goingBack = false) {
  if (isTransitioning) return;
  resetQuestionState(true);
  window.scrollTo({ top: 0, behavior: 'auto' });
  const q = activeQuestions[idx];

  // Part transition: skip when going back to avoid re-showing it
  if (!goingBack && q.partTitle && q.part !== lastPart) {
    lastPart = q.part;
    showPartTransition(q.part, q.partTitle, () => renderQuestion(idx, true));
    return;
  }

  lastPart = q.part;
  renderQuestion(idx);
}

function showPartTransition(partNum, partTitle, callback) {
  isTransitioning = true;
  // Hide card during transition to prevent ghosting
  $card.style.opacity = '0';
  $card.style.pointerEvents = 'none';
  
  $ptNum.textContent = 'PART ' + partNum;
  $ptName.textContent = partTitle;
  $partTrans.classList.add('active');
  $partTrans.classList.remove('fade-out');

  partTransitionTimer = setTimeout(() => {
    $partTrans.classList.add('fade-out');
    partTransitionFadeTimer = setTimeout(() => {
      $partTrans.classList.remove('active', 'fade-out');
      isTransitioning = false;
      callback();
    }, 500);
  }, 1400);
}

function renderQuestion(idx, fromPartTransition = false) {
  isTransitioning = true;
  const q = activeQuestions[idx];
  currentIdx = idx;
  multiSelected = new Set();

  // Update progress
  $progressFill.style.width = ((idx / activeTotal) * 100) + '%';
  $progressText.textContent = 'Q' + (idx + 1) + ' / ' + activeTotal;

  // Immediately clear old answers to prevent flashing
  $qAnswers.innerHTML = '';
  // Fade out - hide answers
  $qAnswers.style.opacity = '0';
  $qAnswers.style.transform = 'translateY(10px)';
  $card.classList.remove('fade-in');
  if (!fromPartTransition) {
    $card.classList.add('fade-out');
  }

  renderTimer = setTimeout(() => {
    // Update labels first
    const partQ = activeQuestions.find(qq => qq.part === q.part && qq.partTitle);
    $partLabel.textContent = 'Part ' + q.part + ': ' + (partQ ? partQ.partTitle : '');
    $qNumber.textContent = q.label || ('Q' + (idx + 1));

    // Clear old content
    resetQuestionDOM();
    $qAnswers.innerHTML = '';

    // Pre-hide answer area
    $qAnswers.style.display = 'none';
    $qAnswers.style.opacity = '0';
    $qAnswers.style.transform = 'translateY(10px)';

    // Build new answer area (hidden)
    buildAnswerArea(q);

    // Show container
    $qAnswers.style.display = '';

    // Fade in card
    if (fromPartTransition) {
      $card.style.opacity = '';
      $card.style.pointerEvents = '';
    }
    $card.classList.remove('fade-out');
    $card.classList.add('fade-in');

    // Start typewriter
    typeWriter($qText, q.text, () => {
      // After typewriter, fade in answers
      $qAnswers.style.opacity = '1';
      $qAnswers.style.transform = 'translateY(0)';
      // Always show btn-row and manage navigation buttons
      $btnRow.style.display = 'flex';
      $nextBtn.textContent = idx === activeTotal - 1 ? (isMirrorMode ? '完成 ✦' : '提交 ✦') : '下一題 ▸';
      $backBtn.style.display = idx > 0 ? 'inline-block' : 'none';
      // Enable Next button based on question type
      if (q.type === 'select_pair') {
        $nextBtn.disabled = false;
      } else if (q.type === 'single') {
        $nextBtn.disabled = !answers[q.field];
      } else if (q.type === 'text') {
        const textInp = $qAnswers.querySelector('.pixel-input');
        if (textInp) textInp.dispatchEvent(new Event('input'));
      } else if (q.type === 'textarea') {
        const ta = $qAnswers.querySelector('.pixel-textarea');
        if (ta) ta.dispatchEvent(new Event('input'));
      } else if (q.type === 'contact_options') {
        // validation already handled in buildContactOptions
      } else if (q.optional) {
        $nextBtn.disabled = false;
      }
      // Focus input
      const inp = $qAnswers.querySelector('.pixel-input') || $qAnswers.querySelector('.pixel-textarea');
      if (inp) setTimeout(() => inp.focus(), 100);

      // Navigation hint
      if (idx === 0 && (q.type === 'single' || q.type === 'multi')) {
        let hintBubble = document.getElementById('nav-hint-bubble');
        if (!hintBubble) {
          hintBubble = document.createElement('div');
          hintBubble.id = 'nav-hint-bubble';
          hintBubble.style.position = 'fixed';
          hintBubble.style.bottom = '120px';
          hintBubble.style.right = '20px';
          hintBubble.style.background = 'var(--bg-card)';
          hintBubble.style.border = '2px solid var(--pink)';
          hintBubble.style.color = 'var(--cream)';
          hintBubble.style.padding = '12px 16px';
          hintBubble.style.fontSize = '0.8rem';
          hintBubble.style.borderRadius = '4px';
          hintBubble.style.boxShadow = '0 0 20px rgba(255,107,157,0.3)';
          hintBubble.style.zIndex = '50';
          hintBubble.style.maxWidth = '200px';
          hintBubble.style.lineHeight = '1.6';
          hintBubble.textContent = '💡 先揀答案，再按「下一題」前進';
          hintBubble.style.animation = 'fadeInFloat 0.5s ease-out forwards';
          document.body.appendChild(hintBubble);
          setTimeout(() => {
            if (hintBubble) {
              hintBubble.style.animation = 'fadeOutFloat 0.5s ease-out forwards';
              setTimeout(() => hintBubble.remove(), 500);
            }
          }, 3000);
        }
      }


    });

    isTransitioning = false;
  }, fromPartTransition ? 0 : 400);
}

// ===================== TYPEWRITER =====================
function typeWriter(el, text, callback) {
  if (typewriterTimer) clearInterval(typewriterTimer);
  if (typewriterDoneTimer) clearTimeout(typewriterDoneTimer);
  el.innerHTML = '';
  const chars = typeof Intl !== 'undefined' && Intl.Segmenter
    ? Array.from(new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(text), seg => seg.segment)
    : Array.from(text);
  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  el.appendChild(cursor);

  function completeTypewriter() {
    // Show remaining text
    while (i < chars.length) {
      el.insertBefore(document.createTextNode(chars[i]), cursor);
      i++;
    }
    if (typewriterTimer) clearInterval(typewriterTimer);
    typewriterTimer = null;
    if (cursor.parentNode) cursor.remove();
    if (callback) callback();
  }

  // Allow clicking anywhere on $qText to complete typewriter immediately
  el.addEventListener('click', completeTypewriter, { once: true });

  typewriterTimer = setInterval(() => {
    if (i < chars.length) {
      el.insertBefore(document.createTextNode(chars[i]), cursor);
      i++;
    } else {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      el.removeEventListener('click', completeTypewriter);
      typewriterDoneTimer = setTimeout(() => {
        if (cursor.parentNode) cursor.remove();
        if (callback) callback();
      }, 300);
    }
  }, 15);
}

// ===================== BUILD ANSWER AREA =====================
function buildAnswerArea(q) {
  if (q.type === 'text') {
    buildTextInput(q);
  } else if (q.type === 'textarea') {
    buildTextarea(q);
  } else if (q.type === 'single') {
    buildSingleChoice(q);
  } else if (q.type === 'multi') {
    buildMultiChoice(q);
  } else if (q.type === 'select_pair') {
    buildSelectPair(q);
  } else if (q.type === 'range' || q.type === 'dual_range') {
    buildRangeInput(q);
  } else if (q.type === 'contact_options') {
    buildContactOptions(q);
  }
}

function buildRangeInput(q) {
  const wrap = document.createElement('div');
  wrap.className = 'range-wrap';

  const display = document.createElement('div');
  display.className = 'range-display';
  const valSpan = document.createElement('span');
  valSpan.className = 'range-value';
  const unitSpan = document.createElement('span');
  unitSpan.className = 'range-unit';
  unitSpan.textContent = q.unit || '';
  display.appendChild(valSpan);
  display.appendChild(unitSpan);

  if (q.type === 'dual_range') {
    // Dual range slider
    const minVal = answers[q.field] && answers[q.field][0] !== undefined ? answers[q.field][0] : q.min;
    const maxVal = answers[q.field] && answers[q.field][1] !== undefined ? answers[q.field][1] : q.max;

    const minSlider = document.createElement('input');
    minSlider.type = 'range';
    minSlider.className = 'pixel-range dual-min';
    minSlider.min = q.min;
    minSlider.max = q.max;
    minSlider.step = q.step || 1;
    minSlider.value = minVal;
    minSlider.style.zIndex = '2';

    const maxSlider = document.createElement('input');
    maxSlider.type = 'range';
    maxSlider.className = 'pixel-range dual-max';
    maxSlider.min = q.min;
    maxSlider.max = q.max;
    maxSlider.step = q.step || 1;
    maxSlider.value = maxVal;
    maxSlider.style.zIndex = '1';

    // Tooltip for realtime value display
    const tooltip = document.createElement('div');
    tooltip.className = 'range-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '30px';
    tooltip.style.left = '0';
    tooltip.style.background = 'var(--bg-card-alt)';
    tooltip.style.border = '1px solid var(--cyan)';
    tooltip.style.color = 'var(--cyan)';
    tooltip.style.padding = '4px 8px';
    tooltip.style.fontSize = '0.75rem';
    tooltip.style.borderRadius = '2px';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '10';

    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'dual-slider-wrap';

    const dualTrack = document.createElement('div');
    dualTrack.className = 'dual-track';
    const dualFill = document.createElement('div');
    dualFill.className = 'dual-track-fill';
    dualTrack.appendChild(dualFill);

    sliderWrap.appendChild(dualTrack);
    sliderWrap.appendChild(minSlider);
    sliderWrap.appendChild(maxSlider);
    sliderWrap.appendChild(tooltip);

    function updateDisplay() {
      const min = parseInt(minSlider.value);
      const max = parseInt(maxSlider.value);
      valSpan.textContent = (min > 0 ? '+' : '') + min + ' 至 ' + (max > 0 ? '+' : '') + max;
      // Update tooltip
      tooltip.textContent = (min > 0 ? '+' : '') + min + ' 至 ' + (max > 0 ? '+' : '') + max + q.unit;
      // Update range fill bar
      const range = q.max - q.min;
      const leftPct = ((min - q.min) / range) * 100;
      const rightPct = ((max - q.min) / range) * 100;
      dualFill.style.left = leftPct + '%';
      dualFill.style.width = (rightPct - leftPct) + '%';
    }
    updateDisplay();

    function enforceConstraints() {
      const min = parseInt(minSlider.value);
      const max = parseInt(maxSlider.value);
      if (min > max) {
        minSlider.value = max;
      }
      if (max < min) {
        maxSlider.value = min;
      }
      updateDisplay();
      answers[q.field] = [parseInt(minSlider.value), parseInt(maxSlider.value)];
      if (noPrefItem && noPrefItem.classList.contains('checked')) {
        noPrefItem.classList.remove('checked');
        setNoPreferenceMode(false);
      }
    }

    minSlider.addEventListener('input', enforceConstraints);
    maxSlider.addEventListener('input', enforceConstraints);

    function activateSlider(slider, other) {
      slider.style.zIndex = '4';
      slider.classList.add('active-thumb');
      other.style.zIndex = '2';
      other.classList.remove('active-thumb');
      other.style.pointerEvents = 'none';
    }

    function resetSliderState(slider, other) {
      slider.style.zIndex = slider === minSlider ? '2' : '1';
      slider.classList.remove('active-thumb');
      other.style.pointerEvents = '';
    }

    minSlider.addEventListener('pointerdown', () => activateSlider(minSlider, maxSlider));
    maxSlider.addEventListener('pointerdown', () => activateSlider(maxSlider, minSlider));
    minSlider.addEventListener('pointerup', () => resetSliderState(minSlider, maxSlider));
    maxSlider.addEventListener('pointerup', () => resetSliderState(maxSlider, minSlider));
    minSlider.addEventListener('pointercancel', () => resetSliderState(minSlider, maxSlider));
    maxSlider.addEventListener('pointercancel', () => resetSliderState(maxSlider, minSlider));

    // Haptic feedback on limits
    function addHaptic() {
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }

    minSlider.addEventListener('change', () => {
      if (parseInt(minSlider.value) === q.min) addHaptic();
    });
    maxSlider.addEventListener('change', () => {
      if (parseInt(maxSlider.value) === q.max) addHaptic();
    });

    minSlider.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
      activateSlider(minSlider, maxSlider);
    });
    minSlider.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
      resetSliderState(minSlider, maxSlider);
    });
    maxSlider.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
      activateSlider(maxSlider, minSlider);
    });
    maxSlider.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
      resetSliderState(maxSlider, minSlider);
    });

    minSlider.addEventListener('touchstart', () => {
      tooltip.style.display = 'block';
      activateSlider(minSlider, maxSlider);
    });
    minSlider.addEventListener('touchend', () => {
      tooltip.style.display = 'none';
      resetSliderState(minSlider, maxSlider);
    });
    maxSlider.addEventListener('touchstart', () => {
      tooltip.style.display = 'block';
      activateSlider(maxSlider, minSlider);
    });
    maxSlider.addEventListener('touchend', () => {
      tooltip.style.display = 'none';
      resetSliderState(maxSlider, minSlider);
    });

    const labels = document.createElement('div');
    labels.className = 'range-labels';
    labels.innerHTML = '<span>' + q.min + '</span><span>0</span><span>+' + q.max + '</span>';

    let noPrefItem = null;
    const setNoPreferenceMode = (isNoPreference) => {
      minSlider.disabled = isNoPreference;
      maxSlider.disabled = isNoPreference;
      sliderWrap.style.opacity = isNoPreference ? '0.45' : '1';
      labels.style.opacity = isNoPreference ? '0.45' : '1';
      display.style.opacity = isNoPreference ? '0.6' : '1';
      if (isNoPreference) {
        valSpan.textContent = '冇所謂';
        unitSpan.style.visibility = 'hidden';
        tooltip.textContent = '冇所謂';
        answers[q.field] = null;
      } else {
        unitSpan.style.visibility = '';
        updateDisplay();
        answers[q.field] = [parseInt(minSlider.value), parseInt(maxSlider.value)];
      }
    };

    wrap.appendChild(display);
    wrap.appendChild(sliderWrap);
      wrap.appendChild(labels);
    if (q.allowNoPreference) {
      noPrefItem = document.createElement('div');
      noPrefItem.className = 'multi-item';
      noPrefItem.style.marginTop = '12px';

      const noPrefCheck = document.createElement('div');
      noPrefCheck.className = 'pixel-check';
      noPrefCheck.textContent = '✓';

      const noPrefText = document.createElement('span');
      noPrefText.className = 'multi-item-text';
      noPrefText.textContent = '冇所謂';

      noPrefItem.appendChild(noPrefCheck);
      noPrefItem.appendChild(noPrefText);
      wrap.appendChild(noPrefItem);

      if (answers[q.field] === null) {
        noPrefItem.classList.add('checked');
      }

      noPrefItem.addEventListener('click', () => {
        const isChecked = noPrefItem.classList.toggle('checked');
        setNoPreferenceMode(isChecked);
      });
    }
    $qAnswers.appendChild(wrap);

    // Dual range has values unless user chooses no preference.
    if (noPrefItem && noPrefItem.classList.contains('checked')) {
      setNoPreferenceMode(true);
    } else {
      answers[q.field] = [parseInt(minSlider.value), parseInt(maxSlider.value)];
    }
  } else {
    // Single range slider (existing code)
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'pixel-range';
    slider.min = q.min;
    slider.max = q.max;
    slider.step = q.step || 1;
    slider.value = answers[q.field] !== undefined ? answers[q.field] : 0;

    // Tooltip for realtime value display
    const tooltip = document.createElement('div');
    tooltip.className = 'range-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '30px';
    tooltip.style.left = '0';
    tooltip.style.background = 'var(--bg-card-alt)';
    tooltip.style.border = '1px solid var(--cyan)';
    tooltip.style.color = 'var(--cyan)';
    tooltip.style.padding = '4px 8px';
    tooltip.style.fontSize = '0.75rem';
    tooltip.style.borderRadius = '2px';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '10';

    const sliderWrap = document.createElement('div');
    sliderWrap.style.position = 'relative';
    sliderWrap.appendChild(slider);
    sliderWrap.appendChild(tooltip);

    function updateDisplay(v) {
      const num = parseInt(v);
      valSpan.textContent = (num > 0 ? '+' : '') + num;
      // Update tooltip
      tooltip.textContent = (num > 0 ? '+' : '') + num + q.unit;
    }
    updateDisplay(slider.value);

    slider.addEventListener('input', () => {
      updateDisplay(slider.value);
      answers[q.field] = slider.value;
    });

    slider.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });

    slider.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    slider.addEventListener('touchstart', () => {
      tooltip.style.display = 'block';
    });

    slider.addEventListener('touchend', () => {
      tooltip.style.display = 'none';
    });

    const labels = document.createElement('div');
    labels.className = 'range-labels';
    labels.innerHTML = '<span>' + q.min + '</span><span>0</span><span>+' + q.max + '</span>';

    wrap.appendChild(display);
    wrap.appendChild(sliderWrap);
    wrap.appendChild(labels);
    $qAnswers.appendChild(wrap);

    // Range always has a value, so enable next
    answers[q.field] = slider.value;
  }

  $nextBtn.disabled = false;
}

function buildTextInput(q) {
  const inp = document.createElement('input');
  inp.type = q.inputType || 'text';
  inp.className = 'pixel-input';
  inp.placeholder = q.placeholder || '';
  inp.setAttribute('autocomplete', 'off');
  if (typeof q.minValue === 'number') inp.min = String(q.minValue);
  if (typeof q.maxValue === 'number') inp.max = String(q.maxValue);
  if (q.maxLength) inp.maxLength = q.maxLength;

  // Restore previous answer
  if (answers[q.field]) inp.value = answers[q.field];

  const warn = document.createElement('div');
  warn.className = 'max-warn';
  warn.style.marginTop = '10px';
  warn.style.display = 'none';

  function validateTextInput() {
    const raw = inp.value.trim();
    let valid = q.optional ? true : raw.length > 0;
    warn.classList.remove('show');
    warn.style.display = 'none';
    warn.textContent = '';

    if (valid && typeof q.minValue === 'number' && typeof q.maxValue === 'number') {
      const numeric = Number.parseInt(raw, 10);
      if (Number.isNaN(numeric)) {
        valid = false;
      } else if (numeric < q.minValue) {
        valid = false;
        warn.textContent = q.underMinWarning || ('輸入值需大於或等於 ' + q.minValue);
      } else if (numeric > q.maxValue) {
        valid = false;
        warn.textContent = '輸入值需介乎 ' + q.minValue + ' 至 ' + q.maxValue;
      }
    }

    if (!valid && warn.textContent) {
      warn.style.display = 'block';
      warn.classList.add('show');
    }

    $nextBtn.disabled = !valid;
  }

  inp.addEventListener('input', () => {
    validateTextInput();
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$nextBtn.disabled) {
      e.preventDefault();
      handleNext();
    }
  });

  $qAnswers.appendChild(inp);
  $qAnswers.appendChild(warn);
  validateTextInput();
}

function buildTextarea(q) {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';

  const ta = document.createElement('textarea');
  ta.className = 'pixel-textarea';
  ta.placeholder = q.placeholder || '';
  ta.setAttribute('autocomplete', 'off');
  if (answers[q.field]) ta.value = answers[q.field];

  // Nodding cat
  const cat = document.createElement('div');
  cat.className = 'nodding-cat';
  cat.textContent = '🐈‍⬛';
  wrap.appendChild(cat);

  let nodTimer = null;
  ta.addEventListener('input', () => {
    const hasText = ta.value.trim().length > 0;
    // Enable/disable next: optional fields always allow proceed
    $nextBtn.disabled = q.optional ? false : !hasText;
    // Show nodding cat while typing
    cat.classList.add('visible');
    clearTimeout(nodTimer);
    nodTimer = setTimeout(() => cat.classList.remove('visible'), 1200);
  });
  ta.addEventListener('keydown', (e) => {
    // Don't submit on Enter in textarea (allow newlines)
  });

  if (q.optional) {
    const note = document.createElement('div');
    note.className = 'contact-note';
    note.textContent = '（選填，可直接跳過）';
    wrap.appendChild(note);
  }

  wrap.insertBefore(ta, wrap.firstChild);
  $qAnswers.appendChild(wrap);
  $nextBtn.disabled = q.optional ? false : !ta.value.trim();
}

function buildSelectPair(q) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '16px';

  q.selects.forEach(sel => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '6px';

    const lbl = document.createElement('label');
    lbl.textContent = sel.label;
    lbl.style.color = 'var(--cream-dim)';
    lbl.style.fontSize = '0.82rem';
    lbl.style.letterSpacing = '0.05em';

    const select = document.createElement('select');
    select.className = 'pixel-select';
    select.setAttribute('data-subfield', sel.field);

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— 請選擇 —';
    select.appendChild(defaultOpt);

    sel.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (answers[sel.field] === opt) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      answers[sel.field] = select.value || undefined;
    });

    row.appendChild(lbl);
    row.appendChild(select);
    wrap.appendChild(row);
  });

  const note = document.createElement('div');
  note.style.fontSize = '0.76rem';
  note.style.color = 'var(--text-dim)';
  note.style.marginTop = '4px';
  note.textContent = '（選填，可直接按下一題跳過）';
  wrap.appendChild(note);

  $qAnswers.appendChild(wrap);
  $nextBtn.disabled = false; // always optional
}

function buildContactOptions(q) {
  const wrap = document.createElement('div');
  wrap.className = 'contact-options-wrap';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '20px';

  const contactStates = {};
  const contactInputs = {};

  q.options.forEach(opt => {
    const optWrap = document.createElement('div');
    optWrap.className = 'contact-option-item';
    optWrap.style.display = 'flex';
    optWrap.style.flexDirection = 'column';
    optWrap.style.gap = '10px';

    // Checkbox row
    const checkRow = document.createElement('div');
    checkRow.style.display = 'flex';
    checkRow.style.alignItems = 'center';
    checkRow.style.gap = '10px';
    checkRow.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'contact-check-' + opt.id;
    checkbox.className = 'pixel-checkbox';
    checkbox.style.width = '20px';
    checkbox.style.height = '20px';
    checkbox.style.cursor = 'pointer';

    const checkLabel = document.createElement('label');
    checkLabel.setAttribute('for', 'contact-check-' + opt.id);
    checkLabel.textContent = opt.label;
    checkLabel.style.fontSize = '0.9rem';
    checkLabel.style.color = 'var(--cream)';
    checkLabel.style.cursor = 'pointer';
    checkLabel.style.userSelect = 'none';

    checkRow.appendChild(checkbox);
    checkRow.appendChild(checkLabel);

    // Input field (initially hidden)
    const inputWrap = document.createElement('div');
    inputWrap.className = 'contact-input-wrap';
    inputWrap.style.display = 'none';
    inputWrap.style.paddingLeft = '30px';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pixel-input';
    input.placeholder = opt.placeholder;
    input.setAttribute('data-field', opt.field);

    // Restore previous values
    if (answers[opt.field]) {
      checkbox.checked = true;
      input.value = answers[opt.field];
      inputWrap.style.display = 'block';
    }

    contactStates[opt.id] = checkbox;
    contactInputs[opt.id] = { input, wrap: inputWrap, field: opt.field };

    inputWrap.appendChild(input);
    optWrap.appendChild(checkRow);
    optWrap.appendChild(inputWrap);
    wrap.appendChild(optWrap);

    // Checkbox change handler
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        inputWrap.style.display = 'block';
        input.focus();
      } else {
        inputWrap.style.display = 'none';
        input.value = '';
        answers[opt.field] = '';
      }
      validateContactOptions();
    });

    // Input change handler
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      answers[opt.field] = normalizeHandleValue(raw);
      validateContactOptions();
    });

    // Enter key handler
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !$nextBtn.disabled) {
        e.preventDefault();
        handleNext();
      }
    });
  });

  // Validation function
  function validateContactOptions() {
    const anyChecked = q.options.some(opt => contactStates[opt.id].checked);
    if (!anyChecked) {
      $nextBtn.disabled = true;
      return;
    }

    // Check if all checked options have filled inputs
    const allCheckedFilled = q.options.every(opt => {
      if (!contactStates[opt.id].checked) return true;
      const inputVal = contactInputs[opt.id].input.value.trim();
      return inputVal.length > 0;
    });

    $nextBtn.disabled = !allCheckedFilled;
  }

  const note = document.createElement('div');
  note.style.fontSize = '0.76rem';
  note.style.color = 'var(--yellow)';
  note.style.marginTop = '4px';
  note.textContent = '✓ 至少選擇一種聯絡方式，並填寫對應的帳號';
  wrap.appendChild(note);

  $qAnswers.appendChild(wrap);
  validateContactOptions();
}

function buildSingleChoice(q) {
  const wrap = document.createElement('div');
  wrap.className = 'choices';
  const markers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = '<span class="choice-marker">' + markers[i] + '</span>' + escHtml(opt);
    // Restore selection
    if (answers[q.field] === opt) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      playClick();
      wrap.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      answers[q.field] = opt;
      $nextBtn.disabled = false;
    });
    wrap.appendChild(btn);
  });

  $qAnswers.appendChild(wrap);
}

function buildMultiChoice(q) {
  const wrap = document.createElement('div');
  wrap.className = 'multi-choices';
  const maxSel = q.maxSelect || Infinity;

  // Restore previous selections
  if (answers[q.field]) {
    const prev = answers[q.field].split(', ');
    prev.forEach(v => multiSelected.add(v));
  }

  let warnEl = null;
  if (maxSel < Infinity) {
    warnEl = document.createElement('div');
    warnEl.className = 'max-warn';
    warnEl.textContent = '最多選擇 ' + maxSel + ' 項';
  }

  const allOptions = [];
  if (q.categories) {
    q.categories.forEach(cat => {
      const label = document.createElement('div');
      label.className = 'cat-label';
      label.textContent = cat.label;
      wrap.appendChild(label);
      cat.options.forEach(opt => {
        wrap.appendChild(createMultiItem(opt, maxSel, warnEl, q));
        allOptions.push(opt);
      });
    });
  } else {
    q.options.forEach(opt => {
      wrap.appendChild(createMultiItem(opt, maxSel, warnEl, q));
      allOptions.push(opt);
    });
  }

  if (warnEl) wrap.appendChild(warnEl);
  $qAnswers.appendChild(wrap);
  $nextBtn.disabled = q.optional ? false : (multiSelected.size === 0);
}

function createMultiItem(opt, maxSel, warnEl, q) {
  const item = document.createElement('div');
  item.className = 'multi-item';
  if (multiSelected.has(opt)) item.classList.add('checked');

  const check = document.createElement('div');
  check.className = 'pixel-check';
  check.textContent = '✓';

  const text = document.createElement('span');
  text.className = 'multi-item-text';
  text.textContent = opt;

  item.appendChild(check);
  item.appendChild(text);

  item.addEventListener('click', () => {
    playClick();
    if (multiSelected.has(opt)) {
      multiSelected.delete(opt);
      item.classList.remove('checked');
      if (warnEl) warnEl.classList.remove('show');
    } else {
      if (multiSelected.size >= maxSel) {
        if (warnEl) warnEl.classList.add('show');
        return;
      }
      multiSelected.add(opt);
      item.classList.add('checked');
      if (warnEl && multiSelected.size < maxSel) warnEl.classList.remove('show');
    }
    $nextBtn.disabled = q.optional ? false : (multiSelected.size === 0);
  });

  return item;
}

// ===================== NAVIGATION =====================
$nextBtn.addEventListener('click', handleNext);
$backBtn.addEventListener('click', handleBack);

function saveCurrentAnswer() {
  const q = activeQuestions[currentIdx];
  if (q.type === 'text') {
    const inp = $qAnswers.querySelector('.pixel-input');
    if (inp) answers[q.field] = inp.value.trim();
  } else if (q.type === 'textarea') {
    const ta = $qAnswers.querySelector('.pixel-textarea');
    if (ta) answers[q.field] = ta.value.trim();
  } else if (q.type === 'multi') {
    if (multiSelected.size > 0) answers[q.field] = Array.from(multiSelected).join(', ');
  } else if (q.type === 'contact_options') {
    // Contact options already saved via input handlers
  }
  // single: already saved on click; range/dual_range: already saved on input
}

function handleBack() {
  if (isTransitioning || currentIdx <= 0) return;
  saveCurrentAnswer();
  playClick();
  showQuestion(currentIdx - 1, true);
}

function handleNext(skipClickSound = false) {
  if (isTransitioning) return;
  const q = activeQuestions[currentIdx];

  // Save answer
  if (q.type === 'text') {
    const inp = $qAnswers.querySelector('.pixel-input');
    if (!inp) return;
    const raw = inp.value.trim();
    if (!raw && !q.optional) return;
    answers[q.field] = raw;
  } else if (q.type === 'textarea') {
    const ta = $qAnswers.querySelector('.pixel-textarea');
    if (ta && ta.value.trim()) {
      answers[q.field] = ta.value.trim();
    } else if (!q.optional) {
      return;
    }
  } else if (q.type === 'multi') {
    if (multiSelected.size === 0 && !q.optional) return;
    if (multiSelected.size > 0) answers[q.field] = Array.from(multiSelected).join(', ');
  } else if (q.type === 'select_pair') {
    // sub-fields already saved on change; nothing extra needed
  } else if (q.type === 'range') {
    // already saved on input
  } else if (q.type === 'contact_options') {
    // Contact options already saved and validated
  }
  // single choice already saved on click

  if (!skipClickSound) playClick();

  if (currentIdx < activeTotal - 1) {
    showQuestion(currentIdx + 1);
  } else {
    if (isMirrorMode) {
      computeAndShowMirrorResult();
    } else {
      submitAnswers();
    }
  }
}

function resetQuestionDOM() {
  $qText.innerHTML = '';
  $qAnswers.innerHTML = '';
  $qAnswers.style.opacity = '0';
  $qAnswers.style.transform = 'translateY(10px)';
  $btnRow.style.display = 'none';
  $nextBtn.disabled = true;
  $backBtn.style.display = 'none';
}

function resetQuestionState(preserveDOM = false) {
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
  if (typewriterDoneTimer) {
    clearTimeout(typewriterDoneTimer);
    typewriterDoneTimer = null;
  }
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  if (partTransitionTimer) {
    clearTimeout(partTransitionTimer);
    partTransitionTimer = null;
  }
  if (partTransitionFadeTimer) {
    clearTimeout(partTransitionFadeTimer);
    partTransitionFadeTimer = null;
  }
  $card.classList.remove('fade-in', 'fade-out');
  if (!preserveDOM) resetQuestionDOM();
}

// ===================== SUBMIT =====================
async function submitAnswers() {
  $main.style.display = 'none';
  $header.style.display = 'none';
  $progressWrap.style.display = 'none';
  $loading.classList.add('active');
  if ($errorDetail) {
    $errorDetail.textContent = '';
    $errorDetail.style.display = 'none';
  }
  
  const loadingStartTime = Date.now();
  const minLoadingDuration = 800; // Minimum loading display time in ms

  // Map internal values to API payload keys matching Supabase columns
  const payload = {
    name: answers.name || '',
    age: (answers.age ?? '').toString(),
    height: (answers.height ?? '').toString(),
    identity: answers.attribute || '',
    body_type: answers.body_type || '',
    hair_style: answers.hair_style || '',
    fashion_styles: answers.fashion_style || '',
    bed_role: answers.bed_position || '',
    social_energy: answers.social_energy || '',
    weekend_mode: answers.ideal_weekend || '',
    interests: answers.interests || '',
    exercise_habits: answers.exercise || '',
    travel_mode: answers.travel_mode || '',
    relationship_goal: answers.relationship_goal || '',
    time_commitment: answers.time_investment || '',
    deal_breakers: answers.deal_breaker || '',
    love_languages: answers.love_language || '',
    security_needs: answers.security_need || '',
    daily_love_ritual: answers.ritual_sense || '',
    decision_making: answers.decision_style || '',
    communication_style: answers.conflict_style || '',
    expense_splitting: answers.money_view || '',
    living_together: answers.cohabitation || '',
    ideal_identity: answers.preferred_attribute || '',
    ideal_body_type: answers.ideal_appearance || '',
    ideal_height_gap: answers.ideal_height_gap === null
      ? null
      : JSON.stringify(Array.isArray(answers.ideal_height_gap) ? answers.ideal_height_gap : [-30, 30]),
    ideal_age_gap: answers.ideal_age_gap === null
      ? null
      : JSON.stringify(Array.isArray(answers.ideal_age_gap) ? answers.ideal_age_gap : [-20, 20]),
    gap_moe: answers.gap_moe || '',
    preferred_attribute: answers.preferred_attribute || '',
    ideal_appearance: answers.ideal_appearance || '',
    personal_traits: answers.three_traits || '',
    email: answers.email || '',
    ig_username: normalizeHandleValue(answers.ig_username),
    tg_username: normalizeHandleValue(answers.tg_username),
    feedback: answers.feedback || ''
  };

  try {
    if (window.location.protocol === 'file:') {
      throw new Error('Failed to fetch: opened via file://');
    }

    const resp = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      console.error('Submit error:', errBody);
      throw new Error(errBody.error || ('HTTP ' + resp.status));
    }
    
    // Calculate elapsed time and wait for remaining duration if needed
    const elapsedTime = Date.now() - loadingStartTime;
    const remainingDelay = Math.max(0, minLoadingDuration - elapsedTime);
    
    setTimeout(() => {
      $loading.classList.remove('active');
      $thankyou.classList.add('active');
      $progressFill.style.width = '100%';
      // Trigger confetti and animations
      setTimeout(() => {
        createConfetti();
      }, 200);
      // Ko-fi support reminder after confetti settles
      setTimeout(function() { showKofiToast(); }, 4000);
    }, remainingDelay);
  } catch (err) {
    console.error('Submit error:', err);
    showErrorOverlay(err);
  }
}

$retryBtn.addEventListener('click', () => {
  $error.classList.remove('active');
  if ($errorDetail) {
    $errorDetail.textContent = '';
    $errorDetail.style.display = 'none';
  }
  submitAnswers();
});

// ===================== CONFETTI EFFECT =====================
function createConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  
  const confettiCount = 50;
  const colors = ['var(--pink)', 'var(--cyan)', 'var(--yellow)', 'var(--purple-light)', 'var(--green)'];
  const colorVars = ['#ff6b9d', '#00e5ff', '#ffe066', '#bd93f9', '#50fa7b'];
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = Math.random() * 10 + 5 + 'px';
    confetti.style.height = Math.random() * 10 + 5 + 'px';
    confetti.style.left = Math.random() * window.innerWidth + 'px';
    confetti.style.top = '-10px';
    confetti.style.backgroundColor = colorVars[Math.floor(Math.random() * colorVars.length)];
    confetti.style.opacity = '0.8';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '15';
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0px';
    
    const duration = Math.random() * 2 + 2.5; // 2.5-4.5 seconds
    const delay = Math.random() * 0.5;
    
    confetti.style.animation = `confettiFall ${duration}s linear ${delay}s forwards`;
    
    container.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), (duration + delay) * 1000 + 100);
  }
}

let clickCtx = null;
function playClick() {
  try {
    if (!clickCtx) clickCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (clickCtx.state === 'suspended') clickCtx.resume();
    const osc = clickCtx.createOscillator();
    const gain = clickCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, clickCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, clickCtx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.06, clickCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, clickCtx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(clickCtx.destination);
    osc.start(clickCtx.currentTime);
    osc.stop(clickCtx.currentTime + 0.07);
  } catch (e) {}
}

// ===================== STARFIELD =====================
function initStarfield() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() < 0.3 ? 2 : 1,
      speed: Math.random() * 0.15 + 0.05,
      phase: Math.random() * Math.PI * 2,
      twinkle: Math.random() * 0.015 + 0.005
    });
  }

  function draw(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.y += s.speed;
      if (s.y > canvas.height + 2) {
        s.y = -2;
        s.x = Math.random() * canvas.width;
      }
      const alpha = 0.25 + 0.35 * Math.sin(time * s.twinkle + s.phase);
      const colors = ['255,255,255', '200,180,255', '180,230,255', '255,220,180'];
      const c = colors[(s.size + Math.floor(s.x)) % colors.length];
      ctx.fillStyle = 'rgba(' + c + ',' + alpha.toFixed(2) + ')';
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ===================== HEADER CAT PIXEL ART =====================
function drawHeaderCat() {
  const canvas = document.getElementById('cat-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const px = 3;
  const sprite = [
    [0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
    [1,1,2,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0],
    [1,1,1,1,3,1,1,1,1,0,0,0,0,0,0,0,0,0,0,5,0,0,4,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0],
    [0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
    [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0],
    [1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];
  const colors = { 1: '#2a2640', 2: '#50fa7b', 3: '#ff79c6', 4: '#ffe066', 5: '#ffffff' };
  let eyeOpen = true;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < sprite.length; r++) {
      for (let c = 0; c < sprite[r].length; c++) {
        const val = sprite[r][c];
        if (val === 0) continue;
        if (val === 2 && !eyeOpen) { ctx.fillStyle = colors[1]; }
        else if (val === 5) {
          const t = Date.now() * 0.003 + c * 2;
          const a = 0.4 + 0.6 * Math.abs(Math.sin(t));
          ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
        } else { ctx.fillStyle = colors[val]; }
        ctx.fillRect(c * px, r * px, px, px);
      }
    }
  }
  setInterval(() => { eyeOpen = false; draw(); setTimeout(() => { eyeOpen = true; draw(); }, 180); }, 3500);
  function loop() { draw(); requestAnimationFrame(loop); }
  loop();
}

// ===================== MIRROR MODE LOGIC =====================
function computeAndShowMirrorResult() {
  $main.style.display = 'none';
  $header.style.display = 'none';
  $progressWrap.style.display = 'none';

  const scores = { solitary: 0, sunny: 0, mystical: 0, sentinel: 0 };
  const typeOrder = ['solitary', 'sunny', 'mystical', 'sentinel'];

  MIRROR_QUESTIONS.forEach(q => {
    if (!q.scores) return; // skip profile questions
    const ans = answers[q.field];
    if (ans === undefined || ans === null) return;
    const optIdx = q.options.indexOf(ans);
    if (optIdx >= 0 && optIdx < q.scores.length) {
      scores[q.scores[optIdx]] += 2;
    }
  });

  const sorted = typeOrder.slice().sort((a, b) => scores[b] - scores[a]);
  const mainType = sorted[0];
  const shadowType = (scores[sorted[1]] >= scores[mainType] - 2 && scores[sorted[1]] > 0) ? sorted[1] : null;

  var hiddenTags = computeHiddenTags(answers);
  showMirrorResult(scores, mainType, shadowType, hiddenTags);
}

function showMirrorResult(scores, mainType, shadowType, hiddenTags) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const p = PERSONALITY_TYPES[mainType];
  const typeOrder = ['solitary', 'sunny', 'mystical', 'sentinel'];

  // Top-3 non-zero ingredient bars
  var sortedTypes = typeOrder.slice().sort(function(a, b) { return scores[b] - scores[a]; });
  sortedTypes = sortedTypes.filter(function(k) { return scores[k] > 0; }).slice(0, 3);

  var mixedTitleHtml = '';
  if (shadowType) {
    var hybridKey = mainType + '+' + shadowType;
    var lv = 20 + Math.round(((scores[mainType] || 0) / total) * 77);
    var hybridText = (HYBRID_TITLES[hybridKey] || '[ 混血靈魂 ]').replace(' ]', ' \u2022 Lv.' + lv + ' ]');
    mixedTitleHtml = '<div class="pcard-hybrid-title">' + escHtml(hybridText) + '</div>';
  }

  var barsHtml = sortedTypes.map(function(k) {
    var pct = Math.round((scores[k] / total) * 100);
    var tp = PERSONALITY_TYPES[k];
    return '<div class="pcard-bar-row">' +
      '<div class="pcard-bar-label">' + escHtml(tp.factorName) + '</div>' +
      '<div class="pcard-bar-wrap"><div class="pcard-bar-fill" data-pct="' + pct + '" style="width:0%;background-color:' + tp.color + '"></div></div>' +
      '<span class="pcard-bar-heart">\u2665</span>' +
      '<div class="pcard-bar-pct">' + pct + '%</div>' +
    '</div>';
  }).join('');

  // Cat image and glow maps
  var CAT_IMG_MAP = {
    solitary: 'Solitary_Moon.png',
    sunny:    'Sunny_Tether.png',
    mystical: 'Mystical_Depth.png',
    sentinel: 'Eternal_Sentinel.png'
  };
  var CAT_GLOW_MAP = {
    solitary: '#9b6fff',
    sunny:    '#ff6b9d',
    mystical: '#00d4ff',
    sentinel: '#50fa7b'
  };
  var catImgSrc  = CAT_IMG_MAP[mainType]  || '';
  var catGlowCol = CAT_GLOW_MAP[mainType] || '#bd93f9';

  // Build identity meta (Label · MBTI · Zodiac) and hobby tags separately
  var identityMetaHtml = '';
  var hobbyTagsHtml    = '';
  (function() {
    var label  = answers.p1        || null;
    var mbti   = answers.p2_mbti   || null;
    var zodiac = answers.p2_zodiac || null;
    var hobbies = answers.p3 ? answers.p3.split(', ') : [];
    var music   = answers.p4 ? answers.p4.split(', ') : [];
    var movies  = answers.p5 ? answers.p5.split(', ') : [];

    // Identity Core: compact meta row beneath family name
    var metaParts = [];
    if (label)  metaParts.push('<span class="pcard-profile-val">' + escHtml(label)  + '</span>');
    if (mbti)   metaParts.push('<span class="pcard-profile-val">' + escHtml(mbti)   + '</span>');
    if (zodiac) metaParts.push('<span class="pcard-profile-val">' + escHtml(zodiac) + '</span>');
    if (metaParts.length) {
      identityMetaHtml = '<div class="pcard-profile-meta">' +
        metaParts.join('<span class="pcard-profile-dot"> · </span>') +
      '</div>';
    }

    // Psych Profile: hobby / music / movie tag rows
    var rowsHtml = '';
    [
      { label: '喜好', items: hobbies, max: 8 },
      { label: '音樂', items: music,   max: 6 },
      { label: '電影', items: movies,  max: 6 }
    ].forEach(function(row) {
      if (!row.items.length) return;
      rowsHtml += '<div class="pcard-profile-row">' +
        '<span class="pcard-profile-label">' + escHtml(row.label) + '</span>' +
        '<div class="pcard-profile-tags">' +
          row.items.slice(0, row.max).map(function(t) {
            // Remove English suffix (e.g., "流行 Pop" -> "流行", "手作 / DIY" -> "手作")
            // But keep tags that start with English (e.g., "R&B / Soul", "K-pop")
            var cleaned = t.trim();
            // Remove " / DIY" or " / 烹飪"
            cleaned = cleaned.replace(/\s*\/\s*(DIY|烹飪)$/, '');
            // Remove space + English word suffix (only if tag starts with Chinese)
            if (/^[\u4e00-\u9fff]/.test(cleaned)) {
              cleaned = cleaned.replace(/\s+[A-Za-z].*$/, '');
            }
            return '<span class="pcard-profile-tag">' + escHtml(cleaned) + '</span>';
          }).join('') +
        '</div></div>';
    });
    if (rowsHtml) {
      hobbyTagsHtml = '<div style="width:100%;margin-top:8px;border-top:1px dashed rgba(189,147,249,0.15);padding-top:7px">' +
        rowsHtml +
      '</div>';
    }
  })();

  const pcard = document.getElementById('personality-card');
  pcard.innerHTML =
    // ── Header ──────────────────────────────────────────────────────────────
    '<div class="pcard-header">' +
      '<div class="pcard-brand">\ud83d\udc08\u200d\u2b1b BLACK CAT<br>UNDER THE MOON</div>' +
    '</div>' +
    '<div class="pcard-divider"></div>' +
    '<div class="pcard-mode-badge">\u9748\u9b42\u93e1\u50cf \xb7 MIRROR MODE</div>' +
    // ── Layer 1: Identity Core ───────────────────────────────────────────────
    '<div class="pcard-section">' +
      '<div class="pcard-avatar-wrap"><img class="pcard-cat-img" src="' + catImgSrc + '" alt="' + mainType + '" style="box-shadow:0 0 30px ' + catGlowCol + '99,0 0 10px ' + catGlowCol + '44;border:2px solid ' + catGlowCol + '55"></div>' +
      mixedTitleHtml +
      '<div class="pcard-family-name">' + escHtml(p.nameZh) + '</div>' +
      '<div class="pcard-family-en">' + escHtml(p.nameEn) + '</div>' +
      identityMetaHtml +
    '</div>' +
    // ── Layer 2: Psych Profile ───────────────────────────────────────────────
    '<div class="pcard-section">' +
      '<div class="pcard-tags">' + p.hashtags.map(function(h) { return '<span class="pcard-tag">' + escHtml(h) + '</span>'; }).join('') + '</div>' +
      (hiddenTags && hiddenTags.length ? (
        '<div style="width:100%;margin-top:8px;border-top:1px dashed rgba(255,215,0,0.2);padding-top:7px">' +
          '<div class="pcard-hidden-label">\u25b8 \u96b1\u85cf\u8ff7\u60d1\u884c\u70ba</div>' +
          '<div class="pcard-hidden-tags">' +
            hiddenTags.map(function(t) {
              return '<span class="pcard-hidden-tag">' + escHtml(t.zh) + '</span>';
            }).join('') +
          '</div>' +
        '</div>'
      ) : '') +
      hobbyTagsHtml +
    '</div>' +
    // ── Layer 3: Emotional Layer ─────────────────────────────────────────────
    '<div class="pcard-section">' +
      '<div class="pcard-family-desc">\u300c' + escHtml(p.desc) + '\u300d</div>' +
      '<div class="pcard-warning" style="margin-top:6px">\u9ed1\u8c93\u70b8\u6bdb\u9810\u8b66\uff1a' + escHtml(p.warning) + '</div>' +
      '<div class="pcard-ingredients-label">// 靈魂成分</div>' +
      '<div class="pcard-bars">' + barsHtml + '</div>' +
    '</div>' +
    // ── CTA ─────────────────────────────────────────────────────────────────
    '<div class="pcard-cta">' +
      '<div class="pcard-cta-text">\u6e2c\u6e2c\u4f60\u662f\u54ea\u96bb\u8c93 \u27a1\ufe0f</div>' +
      '<div class="pcard-cta-url">black-cat-under-the-moon.vercel.app</div>' +
    '</div>';

  // Apply type-specific colour theme to the whole card
  pcard.style.setProperty('--type-col', catGlowCol);

  document.getElementById('mirror-result').classList.add('active');

  // Inject background twinkling stars
  injectCardStars();

  // Inject corner rivets
  ['tl','tr','bl','br'].forEach(function(pos) {
    var r = document.createElement('div');
    r.className = 'pcard-rivet pcard-rivet-' + pos;
    pcard.appendChild(r);
  });

  // Animate bars after paint
  setTimeout(function() {
    pcard.querySelectorAll('.pcard-bar-fill').forEach(function(bar) {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 120);

  document.getElementById('mirror-download-btn').onclick = downloadPersonalityCard;
  document.getElementById('mirror-retry-btn').onclick = function() {
    document.getElementById('mirror-result').classList.remove('active');
    answers = {};
    activeQuestions = MIRROR_QUESTIONS;
    activeTotal = MIRROR_QUESTIONS.length;
    currentIdx = 0;
    lastPart = 0;
    $progressWrap.style.display = 'block';
    $header.style.display = 'block';
    $main.style.display = 'block';
    showQuestion(0);
  };
}

function drawPixelCatOnCanvas(type, canvasId, shadowType) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  // Each type has its own sprite (12×14 grid, 0=transparent) and color map.
  // ALL four share the same cute sitting black-cat silhouette.
  // Type-specific: eye color (2), ear-inner shade (4), nose (3), accent details (5).
  var typeData = {

    // 獨處貓 — silver-blue eyes; star sparkles between ears & below paws
    solitary: {
      colors: { 1:'#2a1a40', 2:'#c8d4f5', 3:'#ff79c6', 4:'#3c2a58', 5:'#8090c0' },
      sprite: [
        [0,0,1,0,5,0,5,0,1,0,0,0],  // ear tips + two silver star dots between ears
        [0,1,1,1,0,0,0,1,1,1,0,0],  // ear bodies
        [0,1,4,1,1,1,1,1,4,1,0,0],  // head top + lighter inner-ear pixel (4)
        [0,1,1,2,1,1,1,2,1,1,0,0],  // silver-blue eyes (2) at cols 3, 7
        [0,1,1,1,1,1,1,1,1,1,0,0],  // cheeks
        [0,0,1,1,3,1,3,1,1,0,0,0],  // pink whisker-cheek dots (3) at cols 4, 6
        [0,0,1,1,1,1,1,1,1,0,0,0],  // chin
        [0,1,1,1,1,1,1,1,1,1,0,0],  // chest
        [0,1,1,1,1,1,1,1,1,1,0,0],  // body
        [0,1,1,1,1,1,1,1,1,1,0,0],  // body
        [0,0,1,1,1,1,1,1,1,0,0,0],  // lower tummy
        [0,1,1,0,0,0,0,1,1,0,0,0],  // front paws (cols 1-2, 7-8)
        [0,1,1,0,5,0,5,1,1,0,1,0],  // paw base + star sparkles + tail start (col 10)
        [0,0,0,0,0,0,0,0,0,1,1,0],  // tail tip
      ]
    },

    // 暖陽貓 — golden 2-px-wide bright eyes; pink heart dots floating near paws
    sunny: {
      colors: { 1:'#2a1a40', 2:'#ffd700', 3:'#ff79c6', 4:'#3c2a58', 5:'#ff6b9d' },
      sprite: [
        [0,0,1,0,0,5,0,0,1,0,0,0],  // ear tips + floating heart above head (col 5)
        [0,1,1,1,0,0,0,1,1,1,0,0],  // ear bodies
        [0,1,4,1,1,1,1,1,4,1,0,0],  // head top + inner ear
        [0,1,2,2,1,1,2,2,1,1,0,0],  // bright golden eyes — 2px wide each (cols 2-3 and 6-7)
        [0,1,1,1,1,1,1,1,1,1,0,0],  // cheeks
        [0,0,1,1,3,1,3,1,1,0,0,0],  // whisker cheek dots
        [0,0,1,1,1,1,1,1,1,0,0,0],  // chin
        [0,1,1,1,1,1,1,1,1,1,0,0],  // chest
        [0,1,1,1,1,1,1,1,1,1,0,0],  // body
        [0,1,1,1,1,1,1,1,1,1,0,0],  // body
        [0,0,1,1,1,1,1,1,1,0,0,0],  // lower tummy
        [0,1,1,0,5,0,5,1,1,0,0,0],  // paws + two floating pink hearts between paws (cols 4, 6)
        [0,1,1,0,0,0,0,1,1,0,1,0],  // paw base + tail start
        [0,0,0,0,0,0,0,0,0,1,1,0],  // tail tip
      ]
    },

    // 秘境貓 — winking: left eye row 3, right eye row 4 (offset = wink); neon purple accents
    mystical: {
      colors: { 1:'#2a1a40', 2:'#39ff14', 3:'#ff79c6', 4:'#3c2a58', 5:'#7b29ff' },
      sprite: [
        [5,0,1,0,0,0,0,0,1,0,5,0],  // ear tips + neon purple corner sparks (cols 0, 10)
        [0,1,1,1,0,0,0,1,1,1,0,0],  // ear bodies
        [0,1,4,1,1,1,1,1,4,1,0,0],  // head top + inner ear
        [0,1,1,2,1,1,1,1,1,1,0,0],  // LEFT eye only (col 3 = neon green) → wink starts here
        [0,1,1,1,1,1,1,2,1,1,0,0],  // RIGHT eye one row lower (col 7) → creates wink asymmetry
        [0,0,1,1,3,1,3,1,1,0,0,0],  // whisker cheek dots
        [0,0,1,1,1,1,1,1,1,0,0,0],  // chin
        [0,1,1,1,1,1,1,1,1,1,0,0],  // chest
        [0,1,1,1,1,1,1,1,1,1,0,0],  // body
        [5,1,1,1,1,1,1,1,1,1,0,5],  // body + neon spark at far edges (cols 0, 11)
        [0,0,1,1,1,1,1,1,1,0,0,0],  // lower tummy
        [0,1,1,0,0,0,0,1,1,0,0,0],  // paws
        [0,1,1,0,0,0,0,1,1,0,1,0],  // paw base + tail start
        [5,0,0,0,0,0,0,0,0,1,1,0],  // neon corner dot + tail tip
      ]
    },

    // 守護貓 — green eyes; thin grey helmet-band at head top; tiny shield badge on chest; warm orange glow at base
    sentinel: {
      colors: { 1:'#2a1a40', 2:'#50fa7b', 3:'#ff79c6', 4:'#888888', 5:'#ff7c20' },
      sprite: [
        [0,0,1,0,0,0,0,0,1,0,0,0],  // ear tips
        [0,1,1,1,0,0,0,1,1,1,0,0],  // ear bodies
        [0,4,4,4,4,4,4,4,4,4,0,0],  // grey helmet visor-band across entire head top (4=steel)
        [0,1,1,2,1,1,1,2,1,1,0,0],  // green glowing eyes below band (2=green)
        [0,1,1,1,1,1,1,1,1,1,0,0],  // cheeks
        [0,0,1,1,3,1,3,1,1,0,0,0],  // whisker cheek dots
        [0,0,1,1,1,1,1,1,1,0,0,0],  // chin
        [0,1,1,1,1,1,1,1,1,1,0,0],  // chest
        [0,1,1,1,4,4,4,1,1,1,0,0],  // body + tiny 3-px grey shield badge (cols 4-6)
        [0,1,1,1,4,2,4,1,1,1,0,0],  // shield with green paw-dot center (col 5)
        [0,0,1,1,1,1,1,1,1,0,0,0],  // lower tummy
        [0,1,1,0,0,0,0,1,1,0,0,0],  // paws
        [5,1,1,0,0,0,0,1,1,0,5,0],  // paw base + warm orange corner glow (cols 0, 10)
        [5,5,0,0,0,0,0,0,0,1,1,5],  // orange fireplace base + tail
      ]
    }
  };

  var td = typeData[type] || typeData.sentinel;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (var r = 0; r < td.sprite.length; r++) {
    for (var col = 0; col < td.sprite[r].length; col++) {
      var v = td.sprite[r][col];
      if (!v || !td.colors[v]) continue;
      ctx.fillStyle = td.colors[v];
      ctx.fillRect(col, r, 1, 1);
    }
  }

  // Hybrid aura: overlay 4 shadow-type accent pixels at ear inner edges + paw outer edges
  if (shadowType && typeData[shadowType]) {
    var shadowAccent = typeData[shadowType].colors[2];  // shadow type's eye/glow color
    var mainAccent   = td.colors[2];                    // main type's eye color (for paw R)
    ctx.fillStyle = shadowAccent;
    ctx.fillRect(3, 0, 1, 1);   // inner left ear area
    ctx.fillRect(7, 0, 1, 1);   // inner right ear area
    ctx.fillRect(0, 11, 1, 1);  // left of left paw
    ctx.fillStyle = mainAccent;
    ctx.fillRect(9, 11, 1, 1);  // right of right paw (main accent — creates dual-color)
  }
}

// ===================== HEX TO RGB CONVERTER =====================
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 189, g: 147, b: 249 }; // fallback to purple
}

// ===================== DOWNLOAD PERSONALITY CARD =====================
async function downloadPersonalityCard() {
  if (typeof html2canvas === 'undefined') {
    alert('下載功能未能載入，請重新整理頁面後再試。');
    return;
  }
  const btn = document.getElementById('mirror-download-btn');
  btn.textContent = '生成中...';
  btn.disabled = true;
  var clone = null;
  var canvasStates = [];
  try {
    const orig = document.getElementById('personality-card');
    if (!orig) throw new Error('personality-card not found');
    if (orig.offsetWidth <= 0 || orig.offsetHeight <= 0) {
      throw new Error('personality-card has invalid size');
    }
    
    // ⚠️ 確保所有圖片都載入完成，避免 0 寬高錯誤
    const imgs = orig.querySelectorAll('img');
    const imgPromises = Array.from(imgs).map(function(img) {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = function() {
          console.warn('Image failed to load:', img.src);
          resolve(); // 即使失敗也繼續
        };
        // 設置超時，避免無限等待
        setTimeout(resolve, 5000);
      });
    });
    await Promise.all(imgPromises);
    
    // 額外等待一小段時間，確保瀏覽器完成渲染
    await new Promise(function(r) { setTimeout(r, 200); });
    
    // Convert original images to data URLs BEFORE cloning to avoid CORS taint on file://
    // Read type color now before cloning so it's available for all clone overrides
    var typeCol = getComputedStyle(orig).getPropertyValue('--type-col').trim() || '#bd93f9';
    var rgb = hexToRgb(typeCol);

    var imgDataUrlMap = new Map();
    var origImgList = Array.from(orig.querySelectorAll('img'));
    for (var ii = 0; ii < origImgList.length; ii++) {
      var srcImg = origImgList[ii];
      if (srcImg.naturalWidth > 0 && srcImg.naturalHeight > 0) {
        try {
          var tmpC = document.createElement('canvas');
          tmpC.width = srcImg.naturalWidth;
          tmpC.height = srcImg.naturalHeight;
          tmpC.getContext('2d').drawImage(srcImg, 0, 0);
          imgDataUrlMap.set(srcImg.src, tmpC.toDataURL('image/png'));
        } catch(imgErr) {
          // already tainted — keep original src
          imgDataUrlMap.set(srcImg.src, srcImg.src);
        }
      }
    }

    clone = orig.cloneNode(true);
    const w = orig.offsetWidth;
    const h = orig.offsetHeight;
    clone.setAttribute('data-export', '1');
    clone.style.cssText = 'position:absolute;left:-9999px;top:0;width:' + w + 'px;height:' + h + 'px;z-index:-1;';
    document.body.appendChild(clone);

    // Set type color variable directly on clone root so CSS vars resolve correctly
    clone.style.setProperty('--type-col', typeCol);

    // Inject scoped style targeting ONLY the clone (via data-export attribute).
    // Disables animated pseudo-elements and glows that html2canvas captures incorrectly.
    var exportStyle = document.createElement('style');
    exportStyle.setAttribute('data-export-style', '1');
    exportStyle.textContent =
      '#personality-card[data-export] { animation: none !important; box-shadow: 0 0 0 1px rgba(255,224,102,0.12) !important; }' +
      '#personality-card[data-export]::before, #personality-card[data-export]::after { display: none !important; content: none !important; }' +
      '#personality-card[data-export] *,#personality-card[data-export] *::before,#personality-card[data-export] *::after { animation: none !important; transition: none !important; }';
    document.head.appendChild(exportStyle);

    // Replace clone img srcs with data URLs — avoids any CORS/taint issue on file://
    clone.querySelectorAll('img').forEach(function(img) {
      var dataUrl = imgDataUrlMap.get(img.src);
      if (dataUrl) img.src = dataUrl;
      img.removeAttribute('crossorigin');
      img.removeAttribute('referrerpolicy');
    });

    // Inline-disable grid pattern backgrounds on sections only (not the card itself)
    clone.querySelectorAll('.pcard-section').forEach(function(el) {
      el.style.background = 'rgba(255,255,255,0.02)';
      el.style.backgroundImage = 'none';
    });
    clone.querySelectorAll('.pcard-divider').forEach(function(el) {
      el.style.backgroundImage = 'none';
      el.style.background = 'rgba(255,224,102,0.30)';
    });
    
    // .pcard-section border: color-mix(22%)
    clone.querySelectorAll('.pcard-section').forEach(function(el) {
      el.style.borderColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.22)';
    });
    
    // .pcard-tag border: color-mix(50%), background: color-mix(8%)
    clone.querySelectorAll('.pcard-tag').forEach(function(el) {
      el.style.borderColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.50)';
      el.style.background = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.08)';
    });
    
    // .pcard-profile-tag border: color-mix(35%), background: color-mix(7%)
    clone.querySelectorAll('.pcard-profile-tag').forEach(function(el) {
      el.style.borderColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.35)';
      el.style.background = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.07)';
    });

    // Export-only safety: avoid pattern rendering on 0-width bars in html2canvas
    clone.querySelectorAll('.pcard-bar-fill').forEach(function(el) {
      var pct = parseFloat(el.dataset.pct || '0');
      if (!isFinite(pct) || pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      el.style.transition = 'none';
      el.style.animation = 'none';
      el.style.width = pct + '%';
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = el.style.backgroundColor || 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.95)';
    });
    
    // Remove background stars from the download version
    clone.querySelectorAll('.pcard-star').forEach(function(s) {
      s.remove();
    });
    
    // ⚠️ 移除 clone 內所有 canvas 元素（性格卡片不應包含 canvas）
    clone.querySelectorAll('canvas').forEach(function(c) {
      c.remove();
    });
    
    // ⚠️ 臨時隱藏頁面上所有 canvas 元素，避免 html2canvas 誤觸
    var allCanvases = document.querySelectorAll('canvas');
    allCanvases.forEach(function(c) {
      canvasStates.push({
        element: c,
        display: c.style.display,
        visibility: c.style.visibility
      });
      c.style.display = 'none';
      c.style.visibility = 'hidden';
    });
    
    // ⚠️ 等待一小段時間讓 clone 完全渲染
    await new Promise(function(r) { setTimeout(r, 200); });

    var initialScale = Math.min(1.5, (window.devicePixelRatio || 1));
    var captureOpts = {
      backgroundColor: '#07060e',
      scale: initialScale,
      useCORS: true,
      logging: false,
      allowTaint: true,
      foreignObjectRendering: false,
      imageTimeout: 8000
    };

    var canvas;
    try {
      canvas = await html2canvas(clone, captureOpts);
    } catch (firstErr) {
      // Retry once with a lighter scale if browser/canvas pipeline is unstable
      captureOpts.scale = 1;
      canvas = await html2canvas(clone, captureOpts);
    }

    var blob = await new Promise(function(resolve, reject) {
      try {
        canvas.toBlob(function(b) {
          if (!b) {
            reject(new Error('EXPORT_BLOB_EMPTY'));
            return;
          }
          resolve(b);
        }, 'image/png');
      } catch (exportErr) {
        if (exportErr && (exportErr.name === 'SecurityError' || /tainted canvases/i.test(String(exportErr.message || '')))) {
          reject(new Error('EXPORT_TAINTED_CANVAS'));
          return;
        }
        reject(exportErr);
      }
    });

    var objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'mirror-personality-' + mainTypeKey() + '.png';
    link.href = objectUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);
  } catch (e) {
    console.error('Card download failed:', e);
    if (e && e.message === 'EXPORT_TAINTED_CANVAS') {
      alert('\u4e0b\u8f09\u5931\u6557\uff1a\u5716\u50cf\u8cc7\u6e90\u8de8\u7db2\u57df\u5c0e\u81f4\u7121\u6cd5\u532f\u51fa\u3002\n\u8acb\u6539\u7528 http://localhost \u958b\u555f\u9801\u9762\uff08\u4e0d\u8981\u76f4\u63a5 file:// \u57f7\u884c\uff09\u5f8c\u518d\u8a66\u3002');
    } else if (location.protocol === 'file:') {
      alert('\u4e0b\u8f09\u5931\u6557\uff1afile:// \u76f4\u958b\u5bb9\u6613\u89f8\u767c\u700f\u89bd\u5668\u5b89\u5168\u9650\u5236\u8207\u8a18\u61b6\u9ad4\u554f\u984c\u3002\n\u8acb\u6539\u7528 http://localhost \u958b\u555f index.html \u5f8c\u518d\u8a66\u3002');
    } else {
      alert('\u4e0b\u8f09\u5931\u6557\uff0c\u8acb\u91cd\u65b0\u6574\u7406\u5f8c\u518d\u8a66\u3002');
    }
  } finally {
    canvasStates.forEach(function(state) {
      state.element.style.display = state.display;
      state.element.style.visibility = state.visibility;
    });
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
    // Remove the scoped export style injected into <head>
    var exportStyle = document.querySelector('style[data-export-style]');
    if (exportStyle && exportStyle.parentNode) {
      exportStyle.parentNode.removeChild(exportStyle);
    }
    btn.textContent = '下載性格卡片 ↓';
    btn.disabled = false;
  }
}

function mainTypeKey() {
  // Read the current displayed type from the card
  var en = document.querySelector('.pcard-family-en');
  if (!en) return 'card';
  return en.textContent.replace(/\s+/g, '-').toLowerCase().slice(0, 20);
}

// ===================== KO-FI TOAST =====================
var _kofiToastTimer = null;
function showKofiToast() {
  localStorage.setItem('kofi_popup_ts', String(Date.now()));
  var t = document.getElementById('kofi-toast');
  t.classList.add('visible');
  clearTimeout(_kofiToastTimer);
  _kofiToastTimer = setTimeout(function() { t.classList.remove('visible'); }, 5000);
}
function closeKofiToast() {
  clearTimeout(_kofiToastTimer);
  document.getElementById('kofi-toast').classList.remove('visible');
}
document.getElementById('kofi-toast-close').addEventListener('click', closeKofiToast);
// Auto-show on landing page — once per 3 days
(function() {
  var last = parseInt(localStorage.getItem('kofi_popup_ts') || '0', 10);
  if (Date.now() - last > 3 * 24 * 60 * 60 * 1000) {
    setTimeout(showKofiToast, 8000);
  }
})();

// ===================== 可愛金幣貓圖示 =====================
function drawHalftoneKat(type, canvasId, shadowType) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height; // 96 × 88
  ctx.clearRect(0, 0, W, H);

  var THEME = {
    solitary: { acc:'#9b6fff', glow:'#4020a0', eye:'#c89eff', lid:true  },  // purple scarf cat
    sunny:    { acc:'#ff6b9d', glow:'#a03060', eye:'#ff88cc', lid:false },  // pink bow cat
    mystical: { acc:'#00d4ff', glow:'#0055c0', eye:'#00d4ff', lid:false },  // cyan cloak cat
    sentinel: { acc:'#50fa7b', glow:'#007840', eye:'#50fa7b', lid:false }   // green cloak cat
  };
  var t = THEME[type] || THEME.solitary;
  var BLK = '#07051a';
  var PNK = '#c45880';

  // ── 1. Background disk ──────────────────────────────────────────────────
  ctx.save();
  ctx.shadowBlur = 22; ctx.shadowColor = t.glow;
  var bg = ctx.createRadialGradient(42, 38, 5, 48, 44, 42);
  bg.addColorStop(0, '#1c1840'); bg.addColorStop(0.55, '#0d0b22');
  bg.addColorStop(1, '#050312');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(48, 44, 42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (shadowType && shadowType !== type) {
    var SEC = { solitary:'#4070d0', sunny:'#c07800', mystical:'#7030c0', sentinel:'#008840' };
    if (SEC[shadowType]) {
      ctx.save();
      ctx.strokeStyle = SEC[shadowType]; ctx.lineWidth = 3; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(48, 44, 41, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(48, 44, 41, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // ── 2. Pixel art cat face (scale=3, virtual 20×16 grid) ─────────────────
  var S = 3, ox = 18, oy = 28;

  function R(vx, vy, vw, vh, col, alpha) {
    if (alpha !== undefined) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.fillStyle = col;
    ctx.fillRect(ox + vx * S, oy + vy * S, vw * S, vh * S);
    if (alpha !== undefined) ctx.restore();
  }

  // Ears (rows 0–1)
  R(4,  0, 2, 2, BLK);
  R(14, 0, 2, 2, BLK);
  R(4,  0, 1, 2, PNK, 0.55);
  R(15, 0, 1, 2, PNK, 0.55);

  // Head block (rows 2–15)
  R(0, 2, 20, 14, BLK);

  // Eyes — left: cols 3–6, rows 5–7; right: cols 13–16, rows 5–7
  R(3,  5, 4, 3, t.eye);
  R(13, 5, 4, 3, t.eye);
  R(4,  6, 2, 1, '#040211', 0.80); // left pupil
  R(14, 6, 2, 1, '#040211', 0.80); // right pupil
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.fillRect(ox + 3  * S, oy + 5 * S, S, S);
  ctx.fillRect(ox + 13 * S, oy + 5 * S, S, S);
  if (t.lid) { // sleepy half-lid for solitary
    R(3,  5, 4, 1, BLK, 0.72);
    R(13, 5, 4, 1, BLK, 0.72);
  }

  // Nose (row 10, cols 9–10)
  R(9, 10, 2, 1, PNK, 0.88);
  R(9,  9, 1, 1, PNK, 0.42);

  // ── 3a. Body accessories (clothing on cat body, vy 11–15) ──────────────────

  if (type === 'solitary') {
    // Purple flowing scarf around neck
    R(1,  11, 18,  2, '#6030b0', 0.92);        // scarf band
    R(2,  11, 16,  1, '#9060d8', 0.45);        // scarf top sheen
    R(14, 13,  6,  1, '#6030b0', 0.75);        // scarf tail draping right
    R(15, 14,  5,  1, '#6030b0', 0.55);
    R(16, 15,  4,  1, '#6030b0', 0.35);
    // Golden moon-charm pixel on scarf center
    R(9,  11,  2,  2, '#ffe066', 0.85);
    R(10, 11,  1,  1, '#fffaaa', 0.50);        // charm highlight
  }
  else if (type === 'sunny') {
    // Pink bow ribbon at neck
    R(2,  11,  5,  2, '#ff6b9d', 0.88);        // left wing
    R(3,  11,  1,  1, '#ffb0cc', 0.55);        // wing highlight
    R(13, 11,  5,  2, '#ff6b9d', 0.88);        // right wing
    R(16, 11,  1,  1, '#ffb0cc', 0.55);        // wing highlight
    R(8,  11,  4,  2, '#d01850', 0.95);        // center knot
    R(9,  11,  2,  1, '#ff6b9d', 0.55);        // knot highlight
    // Heart charm dangling from bow
    R(9,  13,  2,  1, '#d01850', 0.90);
    R(8,  14,  4,  1, '#d01850', 0.80);
    R(9,  15,  2,  1, '#d01850', 0.60);
  }
  else if (type === 'mystical') {
    // Dark navy wizard cloak side panels
    R(0,  12,  3,  4, '#0c1860', 0.92);        // left cloak panel
    R(0,  12,  1,  4, '#2040c8', 0.38);        // left edge glow
    R(17, 12,  3,  4, '#0c1860', 0.92);        // right cloak panel
    R(19, 12,  1,  4, '#2040c8', 0.38);        // right edge glow
    // Star particles on cloak
    R(1,  12,  1,  1, t.acc, 0.55);
    R(2,  14,  1,  1, t.acc, 0.40);
    R(18, 13,  1,  1, t.acc, 0.55);
    R(17, 15,  1,  1, t.acc, 0.40);
    // Cyan gem pendant at chest center
    R(9,  12,  2,  1, t.acc, 0.92);            // gem top highlight
    R(8,  13,  4,  2, '#0040a0', 0.82);        // gem body
    R(9,  13,  2,  1, '#50a8ff', 0.60);        // gem inner shine
  }
  else if (type === 'sentinel') {
    // Dark green cloak side panels with gold trim
    R(0,  12,  3,  4, '#071a0c', 0.92);        // left cloak
    R(0,  12,  1,  4, t.acc, 0.32);            // left green trim
    R(17, 12,  3,  4, '#071a0c', 0.92);        // right cloak
    R(19, 12,  1,  4, t.acc, 0.32);            // right green trim
    // Paw-print emblem on chest (3 toe dots + main pad)
    R(8,  12,  1,  1, t.acc, 0.50);            // left toe dot
    R(10, 12,  1,  1, t.acc, 0.50);            // right toe dot
    R(9,  12,  1,  1, t.acc, 0.50);            // center toe dot
    R(8,  13,  4,  2, '#0a2a10', 0.88);        // main pad
    R(9,  13,  2,  1, t.acc, 0.45);            // pad glow
    // Warm lantern glow at base corners
    R(1,  14,  2,  2, '#ff7020', 0.32);
    R(17, 14,  2,  2, '#ff7020', 0.32);
  }

  // ── 3b. Overhead accessory ────────────────────────────────────────────────

  if (type === 'solitary') {
    // Crescent moon — drawn on isolated offscreen canvas to use destination-out
    var mc = document.createElement('canvas');
    mc.width = 96; mc.height = 88;
    var mx = mc.getContext('2d');
    mx.shadowBlur = 14; mx.shadowColor = t.acc;
    mx.fillStyle = t.acc; mx.globalAlpha = 0.92;
    mx.beginPath(); mx.arc(48, 14, 11, 0, Math.PI * 2); mx.fill();
    mx.globalCompositeOperation = 'destination-out';
    mx.beginPath(); mx.arc(53, 11, 9, 0, Math.PI * 2); mx.fill();
    ctx.drawImage(mc, 0, 0);
    // Pixel star sparkles
    [[65,7],[35,9],[60,22],[38,20]].forEach(function(s) {
      ctx.fillStyle = t.acc; ctx.globalAlpha = 0.50;
      ctx.fillRect(s[0], s[1], 2, 2); ctx.globalAlpha = 1;
    });
  }
  else if (type === 'sunny') {
    // Three floating pixel hearts above the cat
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = t.acc;
    [[30,5,3,0.80],[44,2,4,0.95],[60,6,3,0.75]].forEach(function(h) {
      var bx = h[0], by = h[1], sz = h[2], al = h[3];
      ctx.globalAlpha = al; ctx.fillStyle = t.acc;
      ctx.fillRect(bx,      by,      sz,   sz  );   // top-left bump
      ctx.fillRect(bx+sz*2, by,      sz,   sz  );   // top-right bump
      ctx.fillRect(bx,      by+sz,   sz*3, sz  );   // middle row
      ctx.fillRect(bx+sz,   by+sz*2, sz,   sz  );   // bottom point
    });
    ctx.restore();
  }
  else if (type === 'mystical') {
    // Magical swirl + glowing center dot
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = t.acc;
    ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.70;
    ctx.beginPath();
    for (var ang = 0; ang < Math.PI * 3.5; ang += 0.1) {
      var rr = ang * 1.8, sx = 48 + Math.cos(ang) * rr, sy = 13 + Math.sin(ang) * rr;
      if (ang < 0.11) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.fillStyle = t.acc; ctx.globalAlpha = 0.92;
    ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(48, 13, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.arc(46.5, 11.5, 1.5, 0, Math.PI * 2); ctx.fill();
    [[36,7],[62,6],[70,16],[27,15]].forEach(function(p) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = t.acc;
      ctx.fillRect(p[0], p[1], 2, 2);
    });
    ctx.restore();
  }
  else if (type === 'sentinel') {
    // Shield emblem above
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = t.acc;
    ctx.fillStyle = '#0a1828';
    ctx.beginPath();
    ctx.moveTo(36,4); ctx.lineTo(60,4); ctx.lineTo(60,16);
    ctx.lineTo(48,23); ctx.lineTo(36,16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = t.acc; ctx.lineWidth = 2; ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(36,4); ctx.lineTo(60,4); ctx.lineTo(60,16);
    ctx.lineTo(48,23); ctx.lineTo(36,16); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(48,4); ctx.lineTo(48,23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(36,12); ctx.lineTo(60,12); ctx.stroke();
    ctx.fillStyle = t.acc; ctx.globalAlpha = 0.75;
    ctx.shadowBlur = 7; ctx.shadowColor = t.acc;
    ctx.beginPath(); ctx.arc(48,13,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(46.5,11.5,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

}

// ===================== CARD STARS =====================
function injectCardStars() {
  var card = document.getElementById('personality-card');
  if (!card) return;
  card.querySelectorAll('.pcard-star').forEach(function(s) { s.remove(); });
  var pts = [
    [5,8],[87,5],[18,12],[93,16],[7,25],[91,30],[12,42],[85,45],
    [4,56],[96,58],[9,68],[88,72],[15,80],[82,85],[50,5],[65,9],
    [35,7],[72,18],[28,22],[60,35],[20,48],[78,62],[42,75],[55,90]
  ];
  pts.forEach(function(p) {
    var s = document.createElement('span');
    s.className = 'pcard-star';
    s.style.left = p[0] + '%';
    s.style.top  = p[1] + '%';
    s.style.animationDelay = (Math.random() * 3.5).toFixed(1) + 's';
    card.appendChild(s);
  });
}

// ===================== UTILITY =====================
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
