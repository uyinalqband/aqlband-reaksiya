# Admin aloqa va kun/hafta o‘yinchisi — o‘rnatish

## Yangiliklar

- Bot menyusida **💬 Admin bilan bog‘lanish** tugmasi.
- Foydalanuvchi bitta xabar yozadi va adminlarga murojaat keladi.
- Admin **✍️ Javob berish**ni bosib, keyingi xabari bilan javob qaytaradi.
- Admin va foydalanuvchi bir-birining telefon raqamini ko‘rmaydi.
- Har kuni 09:00 da kechagi eng ko‘p g‘alaba qilgan inson e’lon qilinadi.
- Har dushanba 09:00 da oldingi haftaning eng ko‘p g‘alaba qilgan insoni
  e’lon qilinadi.
- E’londa faqat emoji avatar, ism va g‘alabalar soni ko‘rsatiladi.
- AI profillari tanlovga kiritilmaydi.
- O‘yin bo‘lmagan davrda xabar yuborilmaydi.
- Bir davr e’loni qayta chaqirilsa ham ikkinchi marta yuborilmaydi.

## 1. GitHub

ZIP ichidagi fayllarni repository ildiziga papka tuzilishini saqlagan holda
yuklang. Cloudflare Pages deployment yakunlanishini kuting.

## 2. SQL

Supabase SQL Editor’da faqat quyidagi yangi migratsiyani ishga tushiring:

`supabase/migrations/0028_support_and_champions.sql`

Natija `Success. No rows returned` bo‘lishi kerak.

## 3. Edge Functions

Quyidagi ikkita funksiyani yangi GitHub kodlari bilan qayta deploy qiling:

1. `supabase/functions/aqlband-api/index.ts` → `aqlband-api`
2. `supabase/functions/checkers-bot/index.ts` → `checkers-bot`

Secretlarni o‘zgartirish shart emas.

## 4. Bot menyusini yangilash

Oldingi setup PowerShell buyrug‘ini yana bir marta bajaring. Bu `/support`
buyrug‘ini Telegram menyusiga qo‘shadi. Bot tokeni o‘zgarmaydi.

## 5. Har kuni 09:00 Cron

Supabase Dashboard’da **Integrations → Cron** bo‘limiga kiring. Cron yoqilmagan
bo‘lsa uni yoqing, so‘ng **Create job** bosing.

- Name: `checkers-champion-announcements`
- Schedule: `0 4 * * *`
- Type: HTTP Request
- Method: POST
- URL:
  `https://idocmxdydrwsizametwg.supabase.co/functions/v1/checkers-bot`
- Headers:
  - `Content-Type`: `application/json`
  - `x-bot-admin-secret`: Supabase Secrets’dagi `TELEGRAM_SETUP_SECRET` qiymati
- Body:

```json
{"action":"announcements"}
```

Cron vaqti UTC bo‘yicha ishlaydi. `04:00 UTC` O‘zbekiston vaqti bilan `09:00`.
Haftalik e’lon uchun boshqa Cron kerak emas: shu funksiya dushanba kuni kunlik
e’lon bilan birga haftalik natijani ham tekshiradi.

## 6. Sinov

1. Botga `/start` yuboring.
2. **💬 Admin bilan bog‘lanish**ni bosing.
3. Sinov xabari yozing.
4. `ADMIN_TELEGRAM_IDS`dagi admin akkauntga murojaat kelishini tekshiring.
5. **✍️ Javob berish**ni bosib javob yozing.
6. Javob foydalanuvchiga yetib kelishini tekshiring.

Cron’ni kutmasdan e’lon mexanizmini sinash uchun Cron ishini qo‘lda **Run now**
qilish mumkin. Kecha hech qanday g‘alaba bo‘lmagan bo‘lsa, tizim ataylab xabar
yubormaydi.

