# Checkers Online botini professional ishga tushirish

Bu yangilanish quyidagilarni qo‘shadi:

- uch tilli `/start`, `/help`, `/play`, `/rating`, `/profile`, `/friends`,
  `/daily`, `/settings`;
- doimiy **🎮 O‘yinni ochish** Menu Button;
- do‘stlik va o‘yin chaqiruvlarini Telegram orqali yetkazish;
- foydalanuvchi boshqaradigan xabarnoma turlari;
- 22:00–08:00 tinch vaqt;
- shaxsiy referral havolasi;
- guruhlar uchun `/challenge`;
- admin uchun `/stats` va rozilik bergan foydalanuvchilarga `/broadcast`;
- webhook secret tekshiruvi, update deduplikatsiyasi, qayta urinish navbati
  va admin audit jurnali.

## 1. GitHub

ZIPdagi barcha fayllarni papka tuzilishini saqlagan holda repository ildiziga
yuklang. Cloudflare Pages deployment yakunlanishini kuting.

## 2. SQL

Supabase → SQL Editor’da quyidagi faylni to‘liq ishga tushiring:

`supabase/migrations/0027_professional_telegram_bot.sql`

Oldingi migratsiyalarni qayta ishga tushirmang.

## 3. Supabase secrets

Supabase → Edge Functions → Secrets bo‘limida quyidagilar bo‘lishi kerak:

- `TELEGRAM_BOT_TOKEN` — @CheckersOnlinebot tokeni;
- `TELEGRAM_WEBHOOK_SECRET` — o‘zingiz yaratgan 32–64 belgili tasodifiy matn;
- `TELEGRAM_SETUP_SECRET` — boshqa 32–64 belgili tasodifiy matn;
- `WEB_APP_URL` — `https://aqlband-reaksiya.pages.dev`;
- `ADMIN_TELEGRAM_IDS` — adminlarning raqamli Telegram ID’lari, masalan
  `123456789` yoki bir nechta bo‘lsa `123456789,987654321`.

Ikki secret bir-biridan farq qilishi shart. Token yoki secretlarni GitHub
fayllariga yozmang.

## 4. Edge Functions

Supabase’da ikkala funksiyani deploy qiling:

1. `aqlband-api`
2. `checkers-bot`

`supabase/config.toml` ichida ikkala funksiya uchun ham `verify_jwt = false`
allaqachon yozilgan. `checkers-bot` Telegram yuborgan maxsus webhook secret
headerini o‘zi tekshiradi.

## 5. Webhook va menyuni bir marta sozlash

Quyidagi buyruqda `PROJECT_REF` va `SETUP_SECRET`ni o‘zingiznikiga almashtiring.
Bu buyruq bot tokenini kompyuterga chiqarishni talab qilmaydi.

PowerShell:

```powershell
$headers = @{ "x-bot-admin-secret" = "SETUP_SECRET" }
Invoke-RestMethod `
  -Method Post `
  -Uri "https://PROJECT_REF.supabase.co/functions/v1/checkers-bot" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"action":"setup"}'
```

Javobda `"ok": true` chiqishi kerak. Ushbu amal:

- xavfsiz webhookni ulaydi;
- bot buyruqlarini o‘rnatadi;
- Menu Button’ni Mini App’ga bog‘laydi;
- qisqa va to‘liq tavsifni o‘rnatadi.

## 6. Profil rasmi

`bot-assets/checkers-online-avatar.png` faylini @BotFather’da:

`/mybots` → `@CheckersOnlinebot` → **Edit Bot** → **Edit Botpic**

orqali joylang.

## 7. BotFather’da Main Mini App

@BotFather’da:

1. `/mybots`
2. `@CheckersOnlinebot`
3. **Bot Settings**
4. **Configure Mini App** yoki **Main Mini App**
5. URL: `https://aqlband-reaksiya.pages.dev`
6. Short name: `app`

Main Mini App short name `app` bo‘lishi kerak, chunki referral va natija
havolalari `t.me/CheckersOnlinebot/app?startapp=...` formatidan foydalanadi.

## 8. Sinov

Quyidagilarni ketma-ket tekshiring:

1. Botga `/start` yuboring.
2. **🎮 O‘yinni ochish** tugmasini bosing.
3. `/settings` orqali bir xabarnomani o‘chirib-yoqing.
4. Profil ichidan do‘st taklif havolasini ulashing.
5. Ikkinchi akkauntdan do‘stlik taklifi yuboring.
6. Do‘stga o‘yin chaqiruvi yuboring.
7. Telegram guruhida `/challenge` yuboring.
8. Admin akkauntdan `/stats` yuboring.

## Muhim xavfsizlik qoidalari

- `TELEGRAM_BOT_TOKEN`, webhook va setup secretlarini skrinshotda ko‘rsatmang.
- `/broadcast` faqat `ADMIN_TELEGRAM_IDS` ro‘yxatidagi akkauntlarda ishlaydi.
- Reklama/yangilik xabarlari standart holatda o‘chiq; foydalanuvchi o‘zi
  rozilik bergandan keyingina yuboriladi.
- Botni bloklagan foydalanuvchi avtomatik belgilanadi va unga qayta-qayta
  xabar yuborilmaydi.

