/**

 * Pure channel-round logic for mystic inbox (no server imports).

 */



export const CHANNEL_MAX_ROUND_TRIPS = 10;



const MYSTERIOUS_TITLES = [

  '來自夜色的低語…',

  '月影下的未讀密語…',

  '黑貓捎來的私語…',

  '星塵封存的回音…',

  '寂靜裡的微弱訊號…',

  '月光照見的絮語…',

  '深宵寄出的迷霧信…',

  '遠方傳來的貓步聲…',

  '封印在蠟印下的字句…',

  '暗夜通道的第一次問候…',

  '等待被解讀的靈魂片段…',

  '只有你能聽見的細語…',

];



export const COMPOSE_HINT_OPEN =

  '再次開啟神秘通道將消耗 1 次月光配額。';



export const COMPOSE_TITLE_REPLY = '回信';



export const COMPOSE_TITLE_OPEN = '寄出新信';



export const STATUS_BANNER_WAITING =

  '狀態：月夜等待中。寂靜已降臨，請靜候回信。';



export const STATUS_FOOTER_EXHAUSTED =

  '神祕通道已隨月色關閉。寂靜重臨，你們已完成這次的電波連線。';



export const STATUS_FOOTER_MIRROR_OPEN =

  '通道已關閉。若想再次連線，請到對方的 Mirror Card 投出下一封信。';



export const COMPOSE_PLACEHOLDER = '在寂靜中，留下你的回音…';



export const COMPOSE_PLACEHOLDER_OPEN = '在月夜下，寫下你要寄出的新信…';



/** Inbox list sentinel — render closed-channel hint UI. */

export const LIST_META_MIRROR_CLOSED = 'mirror_closed';



export function buildChannelComposeHint(remaining) {

  return `通道尚餘 ${remaining} 次來回（每次開通道最多 ${CHANNEL_MAX_ROUND_TRIPS} 次）。`;

}

/** Strip legacy cat/moon lead from channel status copy. */
export function stripChannelStatusLead(text) {
  return String(text || '')
    .replace(/^🐈‍⬛\s*[🌕🌙]?\s*：\s*/, '')
    .trim();
}



function hashString(str) {

  let h = 0;

  for (let i = 0; i < str.length; i += 1) {

    h = (h * 31 + str.charCodeAt(i)) | 0;

  }

  return Math.abs(h);

}



export function getMysteriousTitle(threadId) {

  const idx = hashString(String(threadId || '')) % MYSTERIOUS_TITLES.length;

  return MYSTERIOUS_TITLES[idx];

}



export function getUserLetters(messages) {

  return (messages || []).filter(

    (m) => m.message_type === 'user_letter' && m.sender_id,

  );

}



/**

 * Count completed back-and-forth exchanges in a channel session.

 * A→B or B→A alternation builds toward round trips.

 */

export function countRoundTrips(sessionLetters) {

  if (!sessionLetters?.length || sessionLetters.length < 2) return 0;

  let alternations = 0;

  for (let i = 1; i < sessionLetters.length; i += 1) {

    if (sessionLetters[i].sender_id !== sessionLetters[i - 1].sender_id) {

      alternations += 1;

    }

  }

  return Math.floor((alternations + 1) / 2);

}



export function getChannelRoundTripsRemaining(sessionLetters) {

  return Math.max(0, CHANNEL_MAX_ROUND_TRIPS - countRoundTrips(sessionLetters));

}



/**

 * Letters belonging to the current channel session (since last open / exhaustion).

 */

export function getActiveSessionLetters(letters) {

  const userLetters = getUserLetters(letters);

  if (!userLetters.length) return [];



  const sessions = [];

  let current = [];



  for (const letter of userLetters) {

    if (current.length > 0 && countRoundTrips(current) >= CHANNEL_MAX_ROUND_TRIPS) {

      sessions.push(current);

      current = [letter];

    } else {

      current.push(letter);

    }

  }



  if (current.length) sessions.push(current);

  return sessions[sessions.length - 1] || [];

}



/**

 * @deprecated Legacy round model — kept for reference; channel uses session round trips.

 */

export function deriveRounds(letters, participantTiers) {

  let activeRound = null;

  const rounds = [];



  for (const letter of letters) {

    const senderTier = participantTiers[letter.sender_id] || 'free';

    const isPremiumSender = senderTier === 'premium';



    if (isPremiumSender) {

      if (activeRound) {

        rounds.push(activeRound);

      }

      activeRound = {

        opened_by: letter.sender_id,

        opened_at: letter.created_at,

        replied_by: null,

      };

    } else if (activeRound && letter.sender_id !== activeRound.opened_by) {

      activeRound.replied_by = letter.sender_id;

      activeRound.replied_at = letter.created_at;

      rounds.push(activeRound);

      activeRound = null;

    }

  }



  return { rounds, activeRound };

}



function noCompose(extra = {}) {

  return {

    compose_mode: null,

    compose_title: null,

    ...extra,

  };

}



/**

 * Compute channel UI / permission state for a viewer.

 */

export function getChannelState({

  viewerId,

  viewerTier,

  messages,

  participantTiers,

  context = 'thread',

}) {

  const letters = getUserLetters(messages);

  const lastLetter = letters[letters.length - 1] || null;

  const sessionLetters = getActiveSessionLetters(letters);

  const roundTrips = countRoundTrips(sessionLetters);

  const remaining = getChannelRoundTripsRemaining(sessionLetters);

  const sessionExhausted = sessionLetters.length > 0 && roundTrips >= CHANNEL_MAX_ROUND_TRIPS;

  const channelOpen = sessionLetters.length > 0 && !sessionExhausted;

  const isPremium = viewerTier === 'premium';



  if (channelOpen) {

    const composeHint = buildChannelComposeHint(remaining);

    const otherSentLast = lastLetter && lastLetter.sender_id !== viewerId;



    return {

      status: 'can_chat',

      channel_open: true,

      can_compose: true,

      can_open: false,

      can_reply: true,

      reply_opportunity: otherSentLast,

      compose_mode: 'reply',

      compose_title: COMPOSE_TITLE_REPLY,

      status_banner: null,

      status_footer: null,

      compose_hint: composeHint,

      list_meta: otherSentLast

        ? (remaining <= 3 ? `尚餘 ${remaining} 次來回` : '1 封回信機會待用')

        : (isPremium ? '月夜等待中' : null),

      channel_round_trips: roundTrips,

      channel_round_trips_remaining: remaining,

    };

  }



  if (sessionExhausted) {

    if (isPremium && context === 'mirror') {

      return {

        status: 'can_open',

        channel_open: false,

        can_compose: true,

        can_open: true,

        can_reply: false,

        reply_opportunity: false,

        compose_mode: 'open',

        compose_title: COMPOSE_TITLE_OPEN,

        status_banner: null,

        status_footer: null,

        compose_hint: COMPOSE_HINT_OPEN,

        list_meta: null,

        channel_round_trips: roundTrips,

        channel_round_trips_remaining: 0,

      };

    }



    return noCompose({

      status: 'closed',

      channel_open: false,

      can_compose: false,

      can_open: false,

      can_reply: false,

      reply_opportunity: false,

      status_banner: null,

      status_footer: STATUS_FOOTER_EXHAUSTED,

      compose_hint: null,

      list_meta: isPremium ? LIST_META_MIRROR_CLOSED : null,

      channel_round_trips: roundTrips,

      channel_round_trips_remaining: 0,

    });

  }



  if (isPremium && context === 'mirror') {

    return {

      status: 'can_open',

      channel_open: false,

      can_compose: true,

      can_open: true,

      can_reply: false,

      reply_opportunity: false,

      compose_mode: 'open',

      compose_title: COMPOSE_TITLE_OPEN,

      status_banner: null,

      status_footer: null,

      compose_hint: COMPOSE_HINT_OPEN,

      list_meta: null,

      channel_round_trips: 0,

      channel_round_trips_remaining: CHANNEL_MAX_ROUND_TRIPS,

    };

  }



  return noCompose({

    status: 'closed',

    channel_open: false,

    can_compose: false,

    can_open: false,

    can_reply: false,

    reply_opportunity: false,

    status_banner: null,

    status_footer: null,

    compose_hint: null,

    list_meta: null,

    channel_round_trips: 0,

    channel_round_trips_remaining: 0,

  });

}



export function formatPhotoExchangeInvitePreview(content) {

  const text = String(content || '').trim();

  if (text.includes('Mirror Card')) {

    return text.replace(/請到對方的 Mirror Card 回覆。?/g, '上傳你的相片即可完成交換。');

  }

  return text || '對方想與你交換真人相片。';

}



export function enrichPhotoExchangeThread({

  viewerId,

  messages,

  latestMessage,

  viewerTier,

}) {

  const exchangeMessages = (messages || []).filter(

    (m) => m.message_type === 'photo_exchange_request',

  );

  const latest = exchangeMessages[exchangeMessages.length - 1];

  const pendingForViewer = Boolean(

    latest && latest.recipient_id === viewerId,

  );



  const preview = formatPhotoExchangeInvitePreview(latestMessage?.content);



  return {

    channel_state: pendingForViewer ? 'photo_exchange_invite' : 'photo_exchange',

    mysterious_title: preview.slice(0, 80),

    reply_opportunity: pendingForViewer,

    list_meta: null,

    can_compose: false,

    compose_mode: null,

    compose_title: null,

    compose_hint: null,

    status_banner: null,

    status_footer: null,

    viewer_tier: viewerTier,

  };

}



export function enrichThreadWithChannel({

  threadId,

  viewerId,

  viewerTier,

  messages,

  participantTiers,

}) {

  const channel = getChannelState({

    viewerId,

    viewerTier,

    messages,

    participantTiers,

    context: 'thread',

  });



  return {

    channel_state: channel.status,

    mysterious_title: getMysteriousTitle(threadId),

    reply_opportunity: channel.reply_opportunity,

    list_meta: channel.list_meta,

    can_compose: channel.can_compose,

    compose_mode: channel.compose_mode,

    compose_title: channel.compose_title,

    compose_hint: channel.compose_hint,

    status_banner: channel.status_banner,

    status_footer: channel.status_footer,

    channel_round_trips: channel.channel_round_trips,

    channel_round_trips_remaining: channel.channel_round_trips_remaining,

    viewer_tier: viewerTier,

  };

}

