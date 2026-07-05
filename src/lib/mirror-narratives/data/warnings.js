/**
 * v4 三段式炸毛文案 — family → segment → trait key | _default | q9 key
 */
export const WARNINGS = {
  sentinel: {
    trigger: {
      predictability: '當承諾被打破，或計劃被臨時推翻。',
      commitment: '當對方一再改口，讓你開始懷疑這段關係是否可靠。',
      autonomy: '當你的界線被忽略，卻還被要求「不要想太多」。',
      keep_stability: '當原本說好的節奏，突然變得無法預期。',
      _default: '當承諾被打破。',
    },
    behaviour: {
      predictability:
        '你會開始變得很安靜。不是因為不生氣，而是開始保護自己。',
      commitment:
        '你不一定當場發火，但會開始重新計算：這個人值不值得相信。',
      validation:
        '你會用更規律、更克制的方式相處——彷彿在測試對方是否還在。',
      _default:
        '你的情緒未必外顯，但內心的護盾會悄悄加厚。',
    },
    recovery: {
      expressiveness:
        '一句真誠解釋，比十句道歉更有效。你需要的不是藉口，而是原因。',
      emotional_resonance:
        '若對方願意坦白當下的狀況，你的護盾其實比想像中容易放下。',
      validation:
        '當對方用行動補回被破壞的信任，你會願意再給一次機會。',
      _default:
        '如果有人願意坦白原因，你的護盾其實比想像中容易放下。',
    },
  },
  solitary: {
    trigger: {
      autonomy: '當個人空間被突然入侵，或計劃被擅自改動。',
      validation: '當對方用「為你好」的名義，要求你時刻在線。',
      keep_freedom: '當你感覺自由被換成義務，卻沒有人先問過你。',
      _default: '當你的節奏被強行打亂，卻沒有商量餘地。',
    },
    behaviour: {
      autonomy:
        '你會先退後一步，變得冷淡或失聯。不是懲罰對方，是在找回自己。',
      emotional_resonance:
        '你會關掉情緒出口，用沉默代替爭吵。',
      _default:
        '你不一定會爆發，但會自動開啟「隱形模式」，直到界線被尊重。',
    },
    recovery: {
      autonomy:
        '若對方願意給你空間，並在回來時真誠確認你的感受，你會慢慢靠近。',
      emotional_resonance:
        '一句「我懂你需要時間」比追問更能讓你重新開門。',
      _default:
        '尊重你的節奏，比急著修復關係更重要。',
    },
  },
  sunny: {
    trigger: {
      validation: '當關係狀態模糊，或對方拒絕給予清楚回應。',
      expressiveness: '當你的感受被輕輕帶過，好像從來沒說過一樣。',
      keep_companionship: '當你投入很多，卻感覺只有自己在一廂情願。',
      _default: '當態度曖昧、界線不明，讓你開始懷疑自己的位置。',
    },
    behaviour: {
      validation:
        '你會直接追問、長文對質，或變得異常執著於「講清楚」。',
      expressiveness:
        '你會把話說得更直、更大聲——因為沉默會讓你更不安。',
      _default:
        '你不怕衝突，只怕一直猜。不清楚，你不罷休。',
    },
    recovery: {
      validation:
        '一句明確的「我在乎你／我們是什麼關係」，比浪漫驚喜更能安撫你。',
      commitment:
        '若對方願意共同定義關係，你會很快從焦慮回到溫暖。',
      _default:
        '清晰比完美更重要。說清楚，你就能再次敞開。',
    },
  },
  mystical: {
    trigger: {
      emotional_resonance: '當你表達脆弱，對方卻只用道理回應。',
      expressiveness: '當你的情緒被否定，或被告知「想太多」。',
      keep_understanding: '當你感覺沒有人真的在聽，只是在解決問題。',
      _default: '當感受被略過，只剩下對錯與分析。',
    },
    behaviour: {
      emotional_resonance:
        '你會關掉情緒出口，變得沉默、疏離，像關上了只有少數人知道的門。',
      autonomy:
        '你會退回自己的世界，不再解釋——因為解釋也沒用。',
      _default:
        '你不一定會吵，但會從此把某些話留在心裡，不再說出口。',
    },
    recovery: {
      emotional_resonance:
        '若對方先接住情緒、再談道理，你會願意重新分享內心。',
      expressiveness:
        '一句「我聽到了，這對你很重要」能比你預期中更快地修復信任。',
      _default:
        '被理解，比被說服更能讓你重新靠近。',
    },
  },
};

export const Q9_TRIGGER_KEYS = {
  keep_freedom: 'keep_freedom',
  keep_understanding: 'keep_understanding',
  keep_stability: 'keep_stability',
  keep_companionship: 'keep_companionship',
};
