import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Lang = 'uz' | 'ru' | 'en';
type Json = Record<string, unknown>;

const APP_URL = Deno.env.get('WEB_APP_URL') ?? 'https://aqlband-reaksiya.pages.dev';
const BOT_USERNAME = 'CheckersOnlinebot';

const COPY = {
  uz: {
    welcome: '⚪⚫ <b>Checkers Online’ga xush kelibsiz!</b>\n\nOnlayn raqiblar bilan bellashing, reytingingizni oshiring va kunlik sovrinlarni oling.',
    help: 'ℹ️ <b>Yordam</b>\n\n/play — o‘yinni ochish\n/rating — reyting\n/profile — profil\n/friends — do‘stlar\n/daily — kunlik maqsadlar\n/settings — xabarnomalar\n/challenge — guruhga o‘yin chaqiruvi\n\nMuammo bo‘lsa ushbu xabarga javob yozing.',
    settings: '🔔 <b>Xabarnomalar</b>\nKerakli xabarlarni alohida boshqaring. Tinch vaqt: 22:00–08:00.',
    chooseLanguage: '🌐 Tilni tanlang:',
    game: '🎮 O‘yinni ochish',
    opponent: '⚔️ Raqib topish',
    rating: '🏆 Reyting',
    profile: '👤 Profil',
    friends: '👥 Do‘stlar',
    daily: '🎁 Kunlik maqsad',
    settingsButton: '🔔 Xabarnomalar',
    share: '📨 Do‘stni taklif qilish',
    challenge: '⚔️ <b>Ochiq shashka chaqiruvi!</b>\nBirinchi bo‘lib tugmani bosgan o‘yinchi bellashuvga qo‘shiladi.',
    onlyGroup: 'Bu buyruq Telegram guruhida ishlaydi.',
    adminOnly: 'Bu buyruq faqat administrator uchun.',
    stats: '📊 <b>Bot statistikasi</b>',
    broadcastDone: '✅ Xabar yuborish navbatiga qo‘shildi.',
    unknown: 'Kerakli bo‘limni quyidagi tugmalardan tanlang.',
    saved: '✅ Sozlama saqlandi.',
  },
  ru: {
    welcome: '⚪⚫ <b>Добро пожаловать в Checkers Online!</b>\n\nИграйте с соперниками онлайн, повышайте рейтинг и получайте ежедневные награды.',
    help: 'ℹ️ <b>Помощь</b>\n\n/play — открыть игру\n/rating — рейтинг\n/profile — профиль\n/friends — друзья\n/daily — цели дня\n/settings — уведомления\n/challenge — вызов в группе\n\nЕсли возникла проблема, ответьте на это сообщение.',
    settings: '🔔 <b>Уведомления</b>\nУправляйте каждым типом отдельно. Тихие часы: 22:00–08:00.',
    chooseLanguage: '🌐 Выберите язык:',
    game: '🎮 Открыть игру',
    opponent: '⚔️ Найти соперника',
    rating: '🏆 Рейтинг',
    profile: '👤 Профиль',
    friends: '👥 Друзья',
    daily: '🎁 Цели дня',
    settingsButton: '🔔 Уведомления',
    share: '📨 Пригласить друга',
    challenge: '⚔️ <b>Открытый вызов в шашки!</b>\nПервый нажавший кнопку присоединится к матчу.',
    onlyGroup: 'Эта команда работает в группе Telegram.',
    adminOnly: 'Эта команда доступна только администратору.',
    stats: '📊 <b>Статистика бота</b>',
    broadcastDone: '✅ Сообщение добавлено в очередь.',
    unknown: 'Выберите нужный раздел с помощью кнопок ниже.',
    saved: '✅ Настройка сохранена.',
  },
  en: {
    welcome: '⚪⚫ <b>Welcome to Checkers Online!</b>\n\nPlay online opponents, improve your rating and earn daily rewards.',
    help: 'ℹ️ <b>Help</b>\n\n/play — open game\n/rating — ranking\n/profile — profile\n/friends — friends\n/daily — daily goals\n/settings — notifications\n/challenge — group challenge\n\nReply to this message if you need support.',
    settings: '🔔 <b>Notifications</b>\nControl each notification type. Quiet hours: 22:00–08:00.',
    chooseLanguage: '🌐 Choose a language:',
    game: '🎮 Open game',
    opponent: '⚔️ Find opponent',
    rating: '🏆 Ranking',
    profile: '👤 Profile',
    friends: '👥 Friends',
    daily: '🎁 Daily goals',
    settingsButton: '🔔 Notifications',
    share: '📨 Invite a friend',
    challenge: '⚔️ <b>Open checkers challenge!</b>\nThe first player to press the button joins the match.',
    onlyGroup: 'This command works in a Telegram group.',
    adminOnly: 'This command is available to administrators only.',
    stats: '📊 <b>Bot statistics</b>',
    broadcastDone: '✅ Message added to the delivery queue.',
    unknown: 'Choose a section using the buttons below.',
    saved: '✅ Setting saved.',
  },
} as const;

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function language(value: unknown): Lang {
  const code = String(value ?? '').toLowerCase();
  return code.startsWith('ru') ? 'ru' : code.startsWith('en') ? 'en' : 'uz';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function startUrl(parameter = ''): string {
  const suffix = parameter ? `?startapp=${encodeURIComponent(parameter)}` : '';
  return `https://t.me/${BOT_USERNAME}/app${suffix}`;
}

function webButton(text: string, parameter = '') {
  return { text, web_app: { url: parameter ? `${APP_URL}/?startapp=${encodeURIComponent(parameter)}` : APP_URL } };
}

function homeKeyboard(lang: Lang, telegramId: number) {
  const t = COPY[lang];
  return {
    inline_keyboard: [
      [webButton(t.game), webButton(t.opponent, 'matchmaking')],
      [webButton(t.rating, 'rating'), webButton(t.profile, 'profile')],
      [webButton(t.friends, 'friends'), webButton(t.daily, 'daily')],
      [{ text: t.settingsButton, callback_data: 'settings' }],
      [{ text: t.share, url: `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_USERNAME}?start=ref_${telegramId}`)}` }],
    ],
  };
}

async function telegram(token: string, method: string, payload: Json): Promise<Json> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as Json;
  if (!response.ok || result.ok !== true) throw new Error(`${method}: ${String(result.description ?? response.status)}`);
  return result;
}

async function send(token: string, chatId: number, text: string, replyMarkup?: Json) {
  return telegram(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function upsertSettings(db: SupabaseClient, telegramId: number, lang: Lang) {
  await db.from('bot_user_settings').upsert({
    telegram_id: telegramId,
    language: lang,
    bot_blocked: false,
    last_interaction_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'telegram_id', ignoreDuplicates: false });
}

async function savedLanguage(db: SupabaseClient, telegramId: number, fallback: unknown): Promise<Lang> {
  const { data } = await db.from('bot_user_settings').select('language').eq('telegram_id', telegramId).maybeSingle();
  return language(data?.language ?? fallback);
}

async function settingsKeyboard(db: SupabaseClient, telegramId: number) {
  const { data } = await db.from('bot_user_settings').select('*').eq('telegram_id', telegramId).single();
  const row = data ?? {};
  const toggle = (key: string, label: string) => ({
    text: `${row[key] === false ? '⬜' : '✅'} ${label}`,
    callback_data: `toggle:${key}`,
  });
  return { inline_keyboard: [
    [toggle('game_invites', '⚔️ O‘yin chaqiruvlari')],
    [toggle('friend_requests', '👥 Do‘stlik takliflari')],
    [toggle('daily_reminders', '🎁 Kunlik eslatmalar')],
    [toggle('tournament_news', '🏟 Turnirlar')],
    [toggle('achievement_news', '🏅 Yutuqlar')],
    [toggle('product_news', '📣 Yangiliklar')],
    [{ text: '🌐 Til / Язык / Language', callback_data: 'language' }],
  ] };
}

async function processStart(db: SupabaseClient, telegramId: number, parameter: string) {
  const match = /^ref_(\d{1,19})$/.exec(parameter);
  if (!match) return;
  const inviter = Number(match[1]);
  if (!Number.isSafeInteger(inviter) || inviter === telegramId) return;
  await db.from('bot_referrals').upsert({
    invited_telegram_id: telegramId,
    inviter_telegram_id: inviter,
  }, { onConflict: 'invited_telegram_id', ignoreDuplicates: true });
}

function admins(): Set<number> {
  return new Set((Deno.env.get('ADMIN_TELEGRAM_IDS') ?? '')
    .split(',').map((item) => Number(item.trim())).filter(Number.isSafeInteger));
}

async function handleMessage(token: string, db: SupabaseClient, message: Json) {
  const chat = message.chat as Json;
  const from = message.from as Json;
  const chatId = Number(chat.id);
  const telegramId = Number(from.id);
  if (!Number.isSafeInteger(chatId) || !Number.isSafeInteger(telegramId)) return;
  const lang = await savedLanguage(db, telegramId, from.language_code);
  await upsertSettings(db, telegramId, lang);
  const rawText = String(message.text ?? '').trim();
  const [rawCommand, ...args] = rawText.split(/\s+/);
  const command = rawCommand.toLowerCase().split('@')[0];
  const isPrivate = String(chat.type) === 'private';
  const t = COPY[lang];

  if (command === '/start') {
    await processStart(db, telegramId, args[0] ?? '');
    await send(token, chatId, t.welcome, homeKeyboard(lang, telegramId));
    return;
  }
  if (command === '/help') return void await send(token, chatId, t.help, homeKeyboard(lang, telegramId));
  if (['/play', '/rating', '/profile', '/friends', '/daily'].includes(command)) {
    const parameter = command.slice(1) === 'play' ? '' : command.slice(1);
    return void await send(token, chatId, t.unknown, { inline_keyboard: [[webButton(t.game, parameter)]] });
  }
  if (command === '/settings') {
    return void await send(token, chatId, t.settings, await settingsKeyboard(db, telegramId));
  }
  if (command === '/challenge') {
    if (isPrivate) return void await send(token, chatId, t.onlyGroup);
    return void await send(token, chatId, t.challenge, {
      inline_keyboard: [[{ text: t.opponent, url: startUrl(`group_${Math.abs(chatId)}`) }]],
    });
  }
  if (command === '/top') {
    const { data: ratings } = await db.from('checkers_ratings')
      .select('user_id,rating').order('rating', { ascending: false }).limit(10);
    const ids = (ratings ?? []).map((row) => row.user_id);
    const { data: users } = ids.length
      ? await db.from('users').select('id,display_name').in('id', ids)
      : { data: [] };
    const names = new Map((users ?? []).map((row) => [row.id, row.display_name]));
    const lines = (ratings ?? []).map((row, index) =>
      `${index + 1}. <b>${escapeHtml(names.get(row.user_id) ?? 'Player')}</b> — ${row.rating} ELO`);
    return void await send(token, chatId, `🏆 <b>TOP 10</b>\n\n${lines.join('\n') || '—'}`, {
      inline_keyboard: [[webButton(t.rating, 'rating')]],
    });
  }
  if (command === '/tournaments') {
    const { data: tournaments } = await db.from('bot_tournaments')
      .select('id,title,capacity,starts_at,status')
      .in('status', ['registration', 'playing'])
      .order('starts_at').limit(5);
    const lines = (tournaments ?? []).map((item) =>
      `🏟 <b>${escapeHtml(item.title)}</b>\n${item.capacity} players · ${new Date(item.starts_at).toLocaleString(lang, { timeZone: 'Asia/Tashkent' })}`);
    return void await send(token, chatId, `🏟 <b>Turnirlar</b>\n\n${lines.join('\n\n') || 'Hozircha ochiq turnir yo‘q.'}`, {
      inline_keyboard: [[webButton(t.game, 'tournaments')]],
    });
  }
  if (command === '/stats') {
    if (!admins().has(telegramId)) return void await send(token, chatId, t.adminOnly);
    const [{ count: users }, { count: referrals }, { count: pending }] = await Promise.all([
      db.from('bot_user_settings').select('*', { count: 'exact', head: true }),
      db.from('bot_referrals').select('*', { count: 'exact', head: true }),
      db.from('bot_notification_outbox').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    await db.from('bot_admin_audit').insert({ admin_telegram_id: telegramId, action: 'stats' });
    return void await send(token, chatId, `${t.stats}\n\n👤 Users: ${users ?? 0}\n🔗 Referrals: ${referrals ?? 0}\n📨 Queue: ${pending ?? 0}`);
  }
  if (command === '/broadcast') {
    if (!admins().has(telegramId)) return void await send(token, chatId, t.adminOnly);
    const broadcast = args.join(' ').trim().slice(0, 3500);
    if (!broadcast) return void await send(token, chatId, 'Usage: /broadcast message');
    const { data: targets } = await db.from('bot_user_settings').select('telegram_id').eq('product_news', true).eq('bot_blocked', false).limit(5000);
    const rows = (targets ?? []).map((row) => ({
      telegram_id: row.telegram_id,
      kind: 'system',
      text_uz: broadcast,
      text_ru: broadcast,
      text_en: broadcast,
      dedupe_key: `broadcast:${Date.now()}:${row.telegram_id}`,
    }));
    if (rows.length) await db.from('bot_notification_outbox').insert(rows);
    await db.from('bot_admin_audit').insert({ admin_telegram_id: telegramId, action: 'broadcast', details: { recipients: rows.length } });
    return void await send(token, chatId, `${t.broadcastDone}\n👤 ${rows.length}`);
  }
  if (command === '/tournament_create') {
    if (!admins().has(telegramId)) return void await send(token, chatId, t.adminOnly);
    const title = args.join(' ').trim().slice(0, 80);
    if (title.length < 2) return void await send(token, chatId, 'Usage: /tournament_create Tournament name');
    const startsAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const { data, error } = await db.from('bot_tournaments').insert({
      title, capacity: 16, starts_at: startsAt, created_by_telegram_id: telegramId,
    }).select('id').single();
    if (error) throw error;
    await db.from('bot_admin_audit').insert({
      admin_telegram_id: telegramId, action: 'tournament_create', details: { id: data.id, title },
    });
    return void await send(token, chatId, `✅ Turnir yaratildi:\n<b>${escapeHtml(title)}</b>\n⏰ 1 soatdan keyin`);
  }
  if (isPrivate) await send(token, chatId, t.unknown, homeKeyboard(lang, telegramId));
}

async function handleCallback(token: string, db: SupabaseClient, callback: Json) {
  const from = callback.from as Json;
  const message = callback.message as Json | undefined;
  const chat = message?.chat as Json | undefined;
  const telegramId = Number(from.id);
  const chatId = Number(chat?.id);
  const callbackId = String(callback.id ?? '');
  const data = String(callback.data ?? '');
  if (!Number.isSafeInteger(telegramId)) return;
  const lang = await savedLanguage(db, telegramId, from.language_code);
  const t = COPY[lang];

  if (data === 'settings' && Number.isSafeInteger(chatId)) {
    await send(token, chatId, t.settings, await settingsKeyboard(db, telegramId));
  } else if (data === 'language' && Number.isSafeInteger(chatId)) {
    await send(token, chatId, t.chooseLanguage, { inline_keyboard: [[
      { text: 'O‘zbekcha', callback_data: 'lang:uz' },
      { text: 'Русский', callback_data: 'lang:ru' },
      { text: 'English', callback_data: 'lang:en' },
    ]] });
  } else if (data.startsWith('lang:')) {
    const next = language(data.slice(5));
    await db.from('bot_user_settings').update({ language: next, updated_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    if (Number.isSafeInteger(chatId)) await send(token, chatId, COPY[next].welcome, homeKeyboard(next, telegramId));
  } else if (data.startsWith('toggle:')) {
    const key = data.slice(7);
    const allowed = new Set(['game_invites', 'friend_requests', 'daily_reminders', 'tournament_news', 'achievement_news', 'product_news']);
    if (allowed.has(key)) {
      const { data: current } = await db.from('bot_user_settings').select(key).eq('telegram_id', telegramId).single();
      await db.from('bot_user_settings').update({ [key]: current?.[key] === false, updated_at: new Date().toISOString() }).eq('telegram_id', telegramId);
      if (Number.isSafeInteger(chatId)) await send(token, chatId, t.saved, await settingsKeyboard(db, telegramId));
    }
  }
  await telegram(token, 'answerCallbackQuery', { callback_query_id: callbackId }).catch(() => undefined);
}

async function deliverOutbox(token: string, db: SupabaseClient) {
  const { data: rows } = await db.from('bot_notification_outbox').select('*')
    .eq('status', 'pending').lte('not_before', new Date().toISOString()).order('id').limit(20);
  for (const row of rows ?? []) {
    const { data: preferences } = await db.from('bot_user_settings').select('*')
      .eq('telegram_id', row.telegram_id).maybeSingle();
    const preferenceKey: Record<string, string> = {
      game_invite: 'game_invites',
      friend_request: 'friend_requests',
      daily: 'daily_reminders',
      tournament: 'tournament_news',
      achievement: 'achievement_news',
      system: 'product_news',
    };
    const selectedPreference = preferenceKey[String(row.kind)];
    if (preferences?.bot_blocked || (selectedPreference && preferences?.[selectedPreference] === false)) {
      await db.from('bot_notification_outbox').update({ status: 'cancelled' }).eq('id', row.id);
      continue;
    }
    const tashkentHour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent', hour: '2-digit', hourCycle: 'h23',
    }).format(new Date()));
    const quietStart = Number(preferences?.quiet_hours_start ?? 22);
    const quietEnd = Number(preferences?.quiet_hours_end ?? 8);
    const isQuiet = quietStart > quietEnd
      ? tashkentHour >= quietStart || tashkentHour < quietEnd
      : tashkentHour >= quietStart && tashkentHour < quietEnd;
    if (isQuiet && !['game_invite', 'friend_request'].includes(String(row.kind))) {
      const next = new Date();
      next.setUTCHours(quietEnd - 5, 0, 0, 0);
      if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
      await db.from('bot_notification_outbox').update({ not_before: next.toISOString() }).eq('id', row.id);
      continue;
    }
    await db.from('bot_notification_outbox').update({ status: 'sending', attempts: row.attempts + 1 }).eq('id', row.id).eq('status', 'pending');
    const lang = await savedLanguage(db, Number(row.telegram_id), 'uz');
    const text = lang === 'ru' ? row.text_ru ?? row.text_uz : lang === 'en' ? row.text_en ?? row.text_uz : row.text_uz;
    try {
      const markup = row.start_parameter ? { inline_keyboard: [[webButton(COPY[lang].game, row.start_parameter)]] } : undefined;
      await send(token, Number(row.telegram_id), text, markup);
      await db.from('bot_notification_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send_failed';
      const blocked = /blocked|chat not found|deactivated/i.test(message);
      await db.from('bot_notification_outbox').update({
        status: row.attempts >= 4 || blocked ? 'failed' : 'pending',
        last_error: message.slice(0, 500),
        not_before: new Date(Date.now() + 60_000 * Math.max(1, row.attempts + 1)).toISOString(),
      }).eq('id', row.id);
      if (blocked) await db.from('bot_user_settings').update({ bot_blocked: true }).eq('telegram_id', row.telegram_id);
    }
  }
}

async function setupBot(token: string) {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/checkers-bot`;
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (!webhookSecret) throw new Error('TELEGRAM_WEBHOOK_SECRET is missing');
  const commands = [
    { command: 'play', description: '🎮 O‘yinni ochish' },
    { command: 'rating', description: '🏆 Reyting' },
    { command: 'profile', description: '👤 Profil' },
    { command: 'friends', description: '👥 Do‘stlar' },
    { command: 'daily', description: '🎁 Kunlik maqsadlar' },
    { command: 'settings', description: '🔔 Xabarnomalar' },
    { command: 'tournaments', description: '🏟 Turnirlar' },
    { command: 'top', description: '🏆 TOP 10' },
    { command: 'help', description: 'ℹ️ Yordam' },
  ];
  await telegram(token, 'setWebhook', {
    url: webhookUrl, secret_token: webhookSecret,
    allowed_updates: ['message', 'callback_query'], drop_pending_updates: false,
  });
  await telegram(token, 'setMyCommands', { commands });
  await telegram(token, 'setChatMenuButton', {
    menu_button: { type: 'web_app', text: '🎮 O‘yinni ochish', web_app: { url: APP_URL } },
  });
  await telegram(token, 'setMyDescription', {
    description: '⚪⚫ Onlayn shashka, ELO reytingi, do‘stlar, kunlik maqsadlar va turnirlar.',
  });
  await telegram(token, 'setMyShortDescription', {
    short_description: 'Onlayn shashka va ELO reytingi 🏆',
  });
  return { webhookUrl };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!token || !url || !key) throw new Error('Required server secret is missing');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    if (request.headers.get('x-bot-admin-secret')) {
      if (request.headers.get('x-bot-admin-secret') !== Deno.env.get('TELEGRAM_SETUP_SECRET')) {
        return json({ ok: false, error: 'Unauthorized' }, 401);
      }
      const adminBody = await request.json().catch(() => ({})) as Json;
      if (adminBody.action === 'drain') {
        await deliverOutbox(token, db);
        return json({ ok: true, data: { drained: true } });
      }
      return json({ ok: true, data: await setupBot(token) });
    }

    const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!expectedSecret || request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }
    const update = await request.json() as Json;
    const updateId = Number(update.update_id);
    const { error: dedupeError } = await db.from('bot_processed_updates').insert({ update_id: updateId });
    if (dedupeError?.code === '23505') return json({ ok: true, duplicate: true });
    if (update.message) await handleMessage(token, db, update.message as Json);
    if (update.callback_query) await handleCallback(token, db, update.callback_query as Json);
    await deliverOutbox(token, db);
    if (updateId % 100 === 0) await db.rpc('cleanup_bot_processed_updates');
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: 'internal_error' }, 500);
  }
});
